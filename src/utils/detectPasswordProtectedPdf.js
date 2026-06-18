import { PDFDocument } from 'pdf-lib'

/**
 * Detect if a PDF buffer is password-protected by attempting to load it
 * without ignoring encryption.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<boolean>} true if password-protected, false otherwise
 */
export async function isPasswordProtectedPdf(buffer) {
  if (!buffer?.byteLength) {
    return false
  }

  try {
    // Try loading WITHOUT ignoring encryption - this will fail if password-protected
    await PDFDocument.load(buffer, { ignoreEncryption: false })
    return false
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // PDF-lib throws specific errors for password-protected PDFs
    if (
      message.includes('encrypted') ||
      message.includes('password') ||
      message.includes('decrypt')
    ) {
      return true
    }
    // If it's a different error, it's not password protection - let it bubble up
    throw err
  }
}
