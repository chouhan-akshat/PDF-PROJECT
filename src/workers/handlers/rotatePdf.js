import { degrees, PDFDocument } from 'pdf-lib'

const VALID_ROTATIONS = new Set([90, 180, 270])

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

/**
 * Rotate every page in a PDF by the selected degrees.
 * @param {{ buffer: ArrayBuffer, rotationDegrees?: number }} payload
 * @returns {Promise<{ bytes: Uint8Array, diagnostics: object }>}
 */
export async function rotatePdf(payload) {
  const startedAt = now()
  const { buffer, rotationDegrees } = payload ?? {}

  if (!buffer?.byteLength) {
    throw new Error('PDF is empty.')
  }

  if (!VALID_ROTATIONS.has(rotationDegrees)) {
    throw new Error('Rotation must be 90, 180, or 270 degrees.')
  }

  let pdf

  try {
    pdf = await PDFDocument.load(buffer, { ignoreEncryption: true })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Could not read PDF: ${detail}`, { cause: err })
  }

  const pages = pdf.getPages()
  const pageCount = pages.length

  if (pageCount === 0) {
    throw new Error('PDF has no pages.')
  }

  for (const page of pages) {
    const currentAngle = page.getRotation().angle
    page.setRotation(degrees((currentAngle + rotationDegrees) % 360))
  }

  const bytes = await pdf.save()

  return {
    bytes,
    diagnostics: {
      pageCount,
      rotationDegrees,
      outputSizeKB: Math.round((bytes.byteLength / 1024) * 100) / 100,
      processingTimeMs: Math.round(now() - startedAt),
    },
  }
}
