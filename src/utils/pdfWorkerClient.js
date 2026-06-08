import {
  PdfWorkerBinaryResponses,
  PdfWorkerMessage,
} from '../constants/pdfWorkerTypes.js'
import { assertSupportedImageFile } from './imageMime.js'
import { createWorker } from './worker.js'

let workerInstance = null
let requestId = 0
const pending = new Map()
/** @type {((entry: object) => void) | null} */
let notesCleanerLogListener = null

export function onNotesCleanerWorkerLog(listener) {
  notesCleanerLogListener = listener
}

function rejectAllPending(message) {
  for (const [, entry] of pending) {
    entry.reject(new Error(message))
  }
  pending.clear()
}

function getWorker() {
  if (!workerInstance) {
    workerInstance = createWorker(
      () =>
        new Worker(new URL('../workers/pdf.worker.js', import.meta.url), {
          type: 'module',
        }),
    )

    workerInstance.onmessage = (event) => {
      const { id, type, payload, error } = event.data ?? {}

      if (type === PdfWorkerMessage.NOTES_CLEANER_LOG) {
        console.log('[NotesCleaner Worker]', payload)
        notesCleanerLogListener?.(payload)
        return
      }

      const entry = pending.get(id)
      if (!entry) return

      if (PdfWorkerBinaryResponses.has(type)) {
        pending.delete(id)
        entry.resolve(payload.bytes)
        return
      }

      if (
        type === PdfWorkerMessage.MERGE_ERROR ||
        type === PdfWorkerMessage.IMAGE_TO_PDF_ERROR ||
        type === PdfWorkerMessage.NOTES_CLEANER_ERROR ||
        (typeof type === 'string' && type.endsWith(':error'))
      ) {
        pending.delete(id)
        entry.reject(new Error(error ?? 'PDF worker failed'))
        return
      }

      if (typeof type === 'string' && type.endsWith(':success')) {
        pending.delete(id)
        entry.resolve(payload)
        return
      }

      pending.delete(id)
      entry.reject(new Error(error ?? `Unexpected worker response: ${type}`))
    }

    workerInstance.onerror = () => {
      rejectAllPending('PDF worker crashed')
      workerInstance?.terminate()
      workerInstance = null
    }
  }

  return workerInstance
}

function postToWorker(type, payload, transferables = [], id = ++requestId) {
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    getWorker().postMessage({ id, type, payload }, transferables)
  })
}

function postToWorkerFireAndForget(type, payload, transferables = [], id) {
  getWorker().postMessage({ id, type, payload }, transferables)
}

/**
 * Read files on the main thread, merge in the worker, return merged bytes.
 * @param {File[]} files
 * @returns {Promise<Uint8Array>}
 */
export async function mergePdfFiles(files) {
  if (!files?.length) {
    throw new Error('Select at least one PDF file.')
  }

  const prepared = await Promise.all(
    files.map(async (file) => {
      if (file.type && file.type !== 'application/pdf') {
        throw new Error(`"${file.name}" is not a PDF.`)
      }
      const buffer = await file.arrayBuffer()
      return { name: file.name, buffer }
    }),
  )

  const transferables = prepared.map((file) => file.buffer)
  return postToWorker(
    PdfWorkerMessage.MERGE,
    { files: prepared },
    transferables,
  )
}

/**
 * Stream images to the worker one at a time (sequential read + transfer).
 * @param {File[]} files
 * @returns {Promise<Uint8Array>}
 */
export async function imageFilesToPdf(files) {
  if (!files?.length) {
    throw new Error('Select at least one image.')
  }

  const id = ++requestId

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })

    ;(async () => {
      try {
        postToWorkerFireAndForget(
          PdfWorkerMessage.IMAGE_TO_PDF_START,
          { count: files.length },
          [],
          id,
        )

        for (let index = 0; index < files.length; index++) {
          const file = files[index]
          const mimeType = assertSupportedImageFile(file)
          const buffer = await file.arrayBuffer()

          postToWorkerFireAndForget(
            PdfWorkerMessage.IMAGE_TO_PDF_APPEND,
            { index, name: file.name, mimeType, buffer },
            [buffer],
            id,
          )
        }

        postToWorkerFireAndForget(
          PdfWorkerMessage.IMAGE_TO_PDF_FINISH,
          {},
          [],
          id,
        )
      } catch (err) {
        pending.delete(id)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })()
  })
}

/**
 * Clean note photos in the worker and export as A4 PDF (sequential streaming).
 * @param {File[]} files
 * @returns {Promise<Uint8Array>}
 */
export async function notesCleanerFilesToPdf(files) {
  if (!files?.length) {
    throw new Error('Select at least one image.')
  }

  const id = ++requestId

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })

    ;(async () => {
      try {
        postToWorkerFireAndForget(
          PdfWorkerMessage.NOTES_CLEANER_START,
          { count: files.length },
          [],
          id,
        )

        for (let index = 0; index < files.length; index++) {
          const file = files[index]
          const mimeType = assertSupportedImageFile(file)
          const buffer = await file.arrayBuffer()

          postToWorkerFireAndForget(
            PdfWorkerMessage.NOTES_CLEANER_APPEND,
            { index, name: file.name, mimeType, buffer },
            [buffer],
            id,
          )
        }

        postToWorkerFireAndForget(
          PdfWorkerMessage.NOTES_CLEANER_FINISH,
          {},
          [],
          id,
        )
      } catch (err) {
        pending.delete(id)
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    })()
  })
}

export function pingPdfWorker() {
  return postToWorker(PdfWorkerMessage.PING, {})
}

export function terminatePdfWorker() {
  rejectAllPending('PDF worker terminated')
  workerInstance?.terminate()
  workerInstance = null
}
