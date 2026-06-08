import { PDFDocument } from 'pdf-lib'
import { detectImageFormat } from '../../utils/imageMime.js'
import { addA4ImageBytesPage } from './pdfA4Page.js'

/** @type {Map<number, { pdf: import('pdf-lib').PDFDocument, pageCount: number }>} */
const sessions = new Map()

function clearSession(jobId) {
  sessions.delete(jobId)
}

/**
 * @param {import('pdf-lib').PDFDocument} pdf
 * @param {{ name: string, mimeType?: string, buffer: ArrayBuffer, index: number }} image
 */
async function addImagePage(pdf, image) {
  const { name, buffer, index } = image
  const label = name || `image ${index + 1}`

  if (!buffer?.byteLength) {
    throw new Error(`"${label}" is empty.`)
  }

  const bytes = new Uint8Array(buffer)
  const format = detectImageFormat(bytes)

  if (!format) {
    throw new Error(`"${label}" is not a valid JPG, PNG, or WEBP image.`)
  }

  try {
    await addA4ImageBytesPage(pdf, bytes, label)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Could not process "${label}": ${detail}`, { cause: err })
  }
}

export const imageToPdfSession = {
  async start(jobId) {
    if (sessions.has(jobId)) {
      clearSession(jobId)
    }
    sessions.set(jobId, { pdf: await PDFDocument.create(), pageCount: 0 })
  },

  async append(jobId, payload) {
    const session = sessions.get(jobId)
    if (!session) {
      throw new Error('Image-to-PDF session not found. Start a new conversion.')
    }

    try {
      await addImagePage(session.pdf, payload)
      session.pageCount += 1
    } catch (err) {
      clearSession(jobId)
      throw err
    }
  },

  async finish(jobId) {
    const session = sessions.get(jobId)
    clearSession(jobId)

    if (!session) {
      throw new Error('Image-to-PDF session not found. Start a new conversion.')
    }

    if (session.pageCount === 0) {
      throw new Error('No valid images were added to the PDF.')
    }

    const bytes = await session.pdf.save()
    return { bytes, transfer: [bytes.buffer] }
  },

  cancel(jobId) {
    clearSession(jobId)
  },
}
