import { PDFDocument } from 'pdf-lib'
import { PdfWorkerMessage } from '../../constants/pdfWorkerTypes.js'
import { detectImageFormat } from '../../utils/imageMime.js'
import { reduceShadows, enhanceContrast } from './enhancePage.js'
import {
  buildFinishDiagnostic,
  createImageLogger,
  createSessionState,
  errorMessage,
} from './notesCleanerDiagnostics.js'
import { addA4ImageBytesPage } from './pdfA4Page.js'

const JPEG_QUALITY = 0.92
const MAX_PROCESSING_EDGE = 2400

/** @type {Map<number, ReturnType<typeof createSessionState> & { pdf: import('pdf-lib').PDFDocument }>} */
const sessions = new Map()

function clearSession(jobId) {
  sessions.delete(jobId)
}

function postWorkerLog(jobId, payload) {
  self.postMessage({
    id: jobId,
    type: PdfWorkerMessage.NOTES_CLEANER_LOG,
    payload,
  })
}

function mimeFromFormat(format) {
  if (format === 'jpeg') return 'image/jpeg'
  if (format === 'png') return 'image/png'
  if (format === 'webp') return 'image/webp'
  return 'application/octet-stream'
}

/**
 * Run enhancement and encode as JPEG for PDF embedding.
 * @param {ArrayBuffer} buffer
 * @param {string} label
 * @param {ReturnType<typeof createImageLogger>} logger
 */
async function enhanceImageToJpeg(buffer, label, logger) {
  const bytes = new Uint8Array(buffer)
  const format = detectImageFormat(bytes)

  if (!format) {
    throw new Error(`"${label}" is not a valid JPG, PNG, or WEBP image.`)
  }

  const bitmap = await logger.run(
    'createImageBitmap',
    async () => {
      const image = await createImageBitmap(
        new Blob([buffer], { type: mimeFromFormat(format) }),
      )
      return image
    },
    (image) => ({
      width: image.width,
      height: image.height,
      format,
    }),
  )

  try {
    const { ctx, width, height } = await logger.run(
      'offscreenCanvas',
      async () => {
        const scale = Math.min(
          1,
          MAX_PROCESSING_EDGE / Math.max(bitmap.width, bitmap.height),
        )
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))
        const canvas = new OffscreenCanvas(width, height)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })

        if (!ctx) {
          throw new Error('Could not acquire 2d context from OffscreenCanvas.')
        }

        ctx.drawImage(bitmap, 0, 0, width, height)
        return { canvas, ctx, width, height }
      },
      (result) => ({ width: result.width, height: result.height }),
    )

    const imageData = await logger.run(
      'getImageData',
      async () => ctx.getImageData(0, 0, width, height),
      (data) => ({ width: data.width, height: data.height, length: data.data.length }),
    )

    await logger.run('reduceShadows', async () => {
      reduceShadows(imageData)
      return imageData
    })

    await logger.run('enhanceContrast', async () => {
      enhanceContrast(imageData)
      return imageData
    })

    const jpegBytes = await logger.run(
      'jpegEncode',
      async () => {
        const exportCanvas = new OffscreenCanvas(imageData.width, imageData.height)
        const exportCtx = exportCanvas.getContext('2d')

        if (!exportCtx) {
          throw new Error('Could not acquire 2d context for JPEG export canvas.')
        }

        exportCtx.putImageData(imageData, 0, 0)
        const blob = await exportCanvas.convertToBlob({
          type: 'image/jpeg',
          quality: JPEG_QUALITY,
        })

        if (!blob?.size) {
          throw new Error('JPEG encoding returned an empty blob.')
        }

        return new Uint8Array(await blob.arrayBuffer())
      },
      (encoded) => ({ byteLength: encoded.byteLength }),
    )

    return jpegBytes
  } finally {
    bitmap.close()
  }
}

/**
 * @param {import('pdf-lib').PDFDocument} pdf
 * @param {{ name: string, buffer: ArrayBuffer, index: number }} image
 * @param {ReturnType<typeof createImageLogger>} logger
 */
async function addCleanedPage(pdf, image, logger) {
  const { name, buffer, index } = image
  const label = name || `image ${index + 1}`

  if (!buffer?.byteLength) {
    throw new Error(`"${label}" is empty.`)
  }

  const jpegBytes = await enhanceImageToJpeg(buffer, label, logger)

  await logger.run(
    'pdfLibEmbed',
    async () => {
      await addA4ImageBytesPage(pdf, jpegBytes, label)
    },
    () => ({ pageCount: pdf.getPageCount() }),
  )
}

export const notesCleanerSession = {
  async start(jobId, payload = {}) {
    if (sessions.has(jobId)) {
      clearSession(jobId)
    }

    const session = {
      ...createSessionState(payload.count ?? 0),
      pdf: await PDFDocument.create(),
    }
    sessions.set(jobId, session)

    console.log(
      `[NotesCleaner] job=${jobId} session started expectedCount=${session.expectedCount}`,
    )
    postWorkerLog(jobId, {
      step: 'session',
      status: 'start',
      detail: { expectedCount: session.expectedCount },
    })
  },

  async append(jobId, payload) {
    const session = sessions.get(jobId)
    if (!session) {
      throw new Error(
        `Notes Cleaner session not found for job ${jobId}. START may not have run yet.`,
      )
    }

    const label = payload.name || `image ${payload.index + 1}`
    const logger = createImageLogger(jobId, label, (entry) =>
      postWorkerLog(jobId, entry),
    )

    session.appendReceived += 1
    session.appendInProgress = true

    console.log(
      `[NotesCleaner] job=${jobId} append #${session.appendReceived} image="${label}" bufferBytes=${payload.buffer?.byteLength ?? 0}`,
    )
    postWorkerLog(jobId, {
      step: 'append',
      status: 'start',
      detail: {
        index: payload.index,
        name: label,
        bufferBytes: payload.buffer?.byteLength ?? 0,
      },
    })

    try {
      await addCleanedPage(session.pdf, payload, logger)
      session.appendSucceeded += 1
      session.pageCount += 1
      session.lastImageLogs = logger.entries

      postWorkerLog(jobId, {
        step: 'append',
        status: 'success',
        detail: { index: payload.index, pageCount: session.pageCount },
      })
    } catch (err) {
      const message = errorMessage(err)
      session.appendFailures += 1
      session.lastAppendError = message
      session.lastImageLogs = logger.entries

      console.error(
        `[NotesCleaner] job=${jobId} append failed image="${label}": ${message}`,
      )
      postWorkerLog(jobId, {
        step: 'append',
        status: 'failure',
        detail: { index: payload.index, error: message, steps: logger.entries },
      })

      clearSession(jobId)
      throw err instanceof Error ? err : new Error(message)
    } finally {
      session.appendInProgress = false
    }
  },

  async finish(jobId) {
    const session = sessions.get(jobId)

    if (!session) {
      throw new Error(
        `Notes Cleaner session not found for job ${jobId}. It may have been cancelled by a failed APPEND.`,
      )
    }

    console.log(
      `[NotesCleaner] job=${jobId} finish pageCount=${session.pageCount} appendReceived=${session.appendReceived}`,
    )
    postWorkerLog(jobId, {
      step: 'finish',
      status: 'start',
      detail: {
        pageCount: session.pageCount,
        appendReceived: session.appendReceived,
        appendSucceeded: session.appendSucceeded,
        appendInProgress: session.appendInProgress,
      },
    })

    if (session.pageCount === 0) {
      const diagnostic = buildFinishDiagnostic(session)
      clearSession(jobId)
      throw new Error(diagnostic)
    }

    try {
      const bytes = await session.pdf.save()
      clearSession(jobId)
      return { bytes, transfer: [bytes.buffer] }
    } catch (err) {
      clearSession(jobId)
      throw new Error(`pdf.save failed: ${errorMessage(err)}`, { cause: err })
    }
  },

  cancel(jobId) {
    console.warn(`[NotesCleaner] job=${jobId} session cancelled`)
    postWorkerLog(jobId, { step: 'session', status: 'cancelled', detail: {} })
    clearSession(jobId)
  },
}
