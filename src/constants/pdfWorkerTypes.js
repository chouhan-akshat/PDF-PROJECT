/** Message types for the PDF Web Worker (extend when adding tools). */
export const PdfWorkerMessage = {
  PING: 'ping',
  MERGE: 'merge',
  MERGE_SUCCESS: 'merge:success',
  MERGE_ERROR: 'merge:error',

  COMPRESS: 'compress',
  COMPRESS_SUCCESS: 'compress:success',
  COMPRESS_ERROR: 'compress:error',

  SPLIT: 'split',
  SPLIT_SUCCESS: 'split:success',
  SPLIT_ERROR: 'split:error',

  ROTATE: 'rotate',
  ROTATE_SUCCESS: 'rotate:success',
  ROTATE_ERROR: 'rotate:error',

  REARRANGE: 'rearrange',
  REARRANGE_SUCCESS: 'rearrange:success',
  REARRANGE_ERROR: 'rearrange:error',

  DELETE_PAGES: 'deletePages',
  DELETE_PAGES_SUCCESS: 'deletePages:success',
  DELETE_PAGES_ERROR: 'deletePages:error',

  IMAGE_TO_PDF_START: 'imageToPdf:start',
  IMAGE_TO_PDF_APPEND: 'imageToPdf:append',
  IMAGE_TO_PDF_FINISH: 'imageToPdf:finish',
  IMAGE_TO_PDF_SUCCESS: 'imageToPdf:success',
  IMAGE_TO_PDF_ERROR: 'imageToPdf:error',

  NOTES_CLEANER_START: 'notesCleaner:start',
  NOTES_CLEANER_APPEND: 'notesCleaner:append',
  NOTES_CLEANER_FINISH: 'notesCleaner:finish',
  NOTES_CLEANER_SUCCESS: 'notesCleaner:success',
  NOTES_CLEANER_ERROR: 'notesCleaner:error',
  NOTES_CLEANER_LOG: 'notesCleaner:log',
}

/** Worker responses that resolve with a Uint8Array payload.bytes */
export const PdfWorkerBinaryResponses = new Set([
  PdfWorkerMessage.MERGE_SUCCESS,
  PdfWorkerMessage.IMAGE_TO_PDF_SUCCESS,
  PdfWorkerMessage.NOTES_CLEANER_SUCCESS,
])

const IMAGE_TO_PDF_TYPES = new Set([
  PdfWorkerMessage.IMAGE_TO_PDF_START,
  PdfWorkerMessage.IMAGE_TO_PDF_APPEND,
  PdfWorkerMessage.IMAGE_TO_PDF_FINISH,
])

const NOTES_CLEANER_TYPES = new Set([
  PdfWorkerMessage.NOTES_CLEANER_START,
  PdfWorkerMessage.NOTES_CLEANER_APPEND,
  PdfWorkerMessage.NOTES_CLEANER_FINISH,
])

export function pdfWorkerErrorType(requestType) {
  if (requestType === PdfWorkerMessage.MERGE) {
    return PdfWorkerMessage.MERGE_ERROR
  }
  if (requestType === PdfWorkerMessage.COMPRESS) {
    return PdfWorkerMessage.COMPRESS_ERROR
  }
  if (requestType === PdfWorkerMessage.SPLIT) {
    return PdfWorkerMessage.SPLIT_ERROR
  }
  if (requestType === PdfWorkerMessage.ROTATE) {
    return PdfWorkerMessage.ROTATE_ERROR
  }
  if (requestType === PdfWorkerMessage.REARRANGE) {
    return PdfWorkerMessage.REARRANGE_ERROR
  }
  if (requestType === PdfWorkerMessage.DELETE_PAGES) {
    return PdfWorkerMessage.DELETE_PAGES_ERROR
  }
  if (IMAGE_TO_PDF_TYPES.has(requestType)) {
    return PdfWorkerMessage.IMAGE_TO_PDF_ERROR
  }
  if (NOTES_CLEANER_TYPES.has(requestType)) {
    return PdfWorkerMessage.NOTES_CLEANER_ERROR
  }
  return `${requestType}:error`
}
