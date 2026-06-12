import {
  PdfWorkerMessage,
  pdfWorkerErrorType,
} from '../constants/pdfWorkerTypes.js'
import { compressPdf } from './handlers/compressPdf.js'
import { imageToPdfSession } from './handlers/imageToPdf.js'
import { mergePdfs } from './handlers/mergePdfs.js'
import { notesCleanerSession } from './handlers/notesCleaner.js'
import { splitPdf } from './handlers/splitPdf.js'

/** One-shot handlers: (payload) => result */
const handlers = {
  [PdfWorkerMessage.PING]: async () => ({ ok: true }),
  [PdfWorkerMessage.MERGE]: async (payload) => {
    const bytes = await mergePdfs(payload.files)
    return { bytes, transfer: [bytes.buffer] }
  },
  [PdfWorkerMessage.COMPRESS]: async (payload) => compressPdf(payload),
  [PdfWorkerMessage.SPLIT]: async (payload) => splitPdf(payload),
}

/** Streaming session handlers: (payload, jobId) => result | void */
const sessionHandlers = {
  [PdfWorkerMessage.IMAGE_TO_PDF_START]: (_payload, jobId) =>
    imageToPdfSession.start(jobId),
  [PdfWorkerMessage.IMAGE_TO_PDF_APPEND]: (payload, jobId) =>
    imageToPdfSession.append(jobId, payload),
  [PdfWorkerMessage.IMAGE_TO_PDF_FINISH]: (_payload, jobId) =>
    imageToPdfSession.finish(jobId),

  [PdfWorkerMessage.NOTES_CLEANER_START]: (payload, jobId) =>
    notesCleanerSession.start(jobId, payload),
  [PdfWorkerMessage.NOTES_CLEANER_APPEND]: (payload, jobId) =>
    notesCleanerSession.append(jobId, payload),
  [PdfWorkerMessage.NOTES_CLEANER_FINISH]: (_payload, jobId) =>
    notesCleanerSession.finish(jobId),
}

const SESSION_FINISH_SUCCESS = {
  [PdfWorkerMessage.IMAGE_TO_PDF_FINISH]: PdfWorkerMessage.IMAGE_TO_PDF_SUCCESS,
  [PdfWorkerMessage.NOTES_CLEANER_FINISH]:
    PdfWorkerMessage.NOTES_CLEANER_SUCCESS,
}

const SESSION_CANCEL = {
  [PdfWorkerMessage.IMAGE_TO_PDF_START]: imageToPdfSession.cancel,
  [PdfWorkerMessage.IMAGE_TO_PDF_APPEND]: imageToPdfSession.cancel,
  [PdfWorkerMessage.IMAGE_TO_PDF_FINISH]: imageToPdfSession.cancel,
  [PdfWorkerMessage.NOTES_CLEANER_START]: notesCleanerSession.cancel,
  [PdfWorkerMessage.NOTES_CLEANER_APPEND]: notesCleanerSession.cancel,
  [PdfWorkerMessage.NOTES_CLEANER_FINISH]: notesCleanerSession.cancel,
}

const notesCleanerQueues = new Map()

function isNotesCleanerMessage(type) {
  return (
    type === PdfWorkerMessage.NOTES_CLEANER_START ||
    type === PdfWorkerMessage.NOTES_CLEANER_APPEND ||
    type === PdfWorkerMessage.NOTES_CLEANER_FINISH
  )
}

function clearNotesCleanerQueue(jobId) {
  notesCleanerQueues.delete(jobId)
}

function enqueueNotesCleanerTask(jobId, task) {
  const previous = notesCleanerQueues.get(jobId) ?? Promise.resolve()
  const queued = previous.catch(() => {}).then(task)
  const tracked = queued.finally(() => {
    if (notesCleanerQueues.get(jobId) === tracked) {
      clearNotesCleanerQueue(jobId)
    }
  })

  notesCleanerQueues.set(jobId, tracked)

  return queued
}

function postBinarySuccess(id, successType, bytes) {
  self.postMessage(
    {
      id,
      type: successType,
      payload: { bytes },
    },
    [bytes.buffer],
  )
}

function postError(id, requestType, error) {
  self.postMessage({
    id,
    type: pdfWorkerErrorType(requestType),
    error,
  })
}

self.addEventListener('message', async (event) => {
  const { id, type, payload } = event.data ?? {}

  if (sessionHandlers[type]) {
    try {
      const result = isNotesCleanerMessage(type)
        ? await enqueueNotesCleanerTask(id, () => sessionHandlers[type](payload, id))
        : await sessionHandlers[type](payload, id)
      const successType = SESSION_FINISH_SUCCESS[type]

      if (successType && result?.bytes) {
        postBinarySuccess(id, successType, result.bytes)
      }
    } catch (err) {
      SESSION_CANCEL[type]?.(id)
      if (isNotesCleanerMessage(type)) {
        clearNotesCleanerQueue(id)
      }
      const message = err instanceof Error ? err.message : String(err)
      postError(id, type, message)
    }
    return
  }

  const handler = handlers[type]

  if (!handler) {
    postError(id, type, `Unknown message type: ${type ?? 'undefined'}`)
    return
  }

  try {
    const result = await handler(payload)

    if (type === PdfWorkerMessage.MERGE && result?.bytes) {
      postBinarySuccess(id, PdfWorkerMessage.MERGE_SUCCESS, result.bytes)
      return
    }

    if (type === PdfWorkerMessage.COMPRESS && result?.bytes) {
      self.postMessage(
        {
          id,
          type: PdfWorkerMessage.COMPRESS_SUCCESS,
          payload: result,
        },
        [result.bytes.buffer],
      )
      return
    }

    if (type === PdfWorkerMessage.SPLIT && result?.bytes) {
      self.postMessage(
        {
          id,
          type: PdfWorkerMessage.SPLIT_SUCCESS,
          payload: result,
        },
        [result.bytes.buffer],
      )
      return
    }

    self.postMessage({ id, type: `${type}:success`, payload: result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    postError(id, type, message)
  }
})
