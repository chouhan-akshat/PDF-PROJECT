import { PageSizes } from 'pdf-lib'
import { detectImageFormat } from '../../utils/imageMime.js'

const [A4_WIDTH, A4_HEIGHT] = PageSizes.A4

/**
 * @param {import('pdf-lib').PDFDocument} pdf
 * @param {import('pdf-lib').PDFImage} embedded
 */
export function drawEmbeddedImageOnA4(pdf, embedded) {
  const page = pdf.addPage(PageSizes.A4)
  const { width, height } = embedded.scaleToFit(A4_WIDTH, A4_HEIGHT)
  const x = (A4_WIDTH - width) / 2
  const y = (A4_HEIGHT - height) / 2

  page.drawImage(embedded, { x, y, width, height })
}

/**
 * @param {import('pdf-lib').PDFDocument} pdf
 */
async function embedWebpAsPng(pdf, buffer, label) {
  let bitmap

  try {
    bitmap = await createImageBitmap(new Blob([buffer], { type: 'image/webp' }))
  } catch (err) {
    throw new Error(`Invalid WEBP image "${label}".`, { cause: err })
  }

  try {
    const { width, height } = bitmap
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Could not create an offscreen canvas for WEBP decoding.')
    }

    ctx.drawImage(bitmap, 0, 0)
    const pngBlob = await canvas.convertToBlob({ type: 'image/png' })
    const pngBuffer = await pngBlob.arrayBuffer()
    return pdf.embedPng(pngBuffer)
  } finally {
    bitmap.close()
  }
}

/**
 * Embed image bytes and add a centered, aspect-preserving A4 page.
 * @param {import('pdf-lib').PDFDocument} pdf
 * @param {Uint8Array} bytes
 * @param {string} label
 */
export async function addA4ImageBytesPage(pdf, bytes, label) {
  const format = detectImageFormat(bytes)

  if (!format) {
    throw new Error(`"${label}" is not a valid JPG, PNG, or WEBP image.`)
  }

  let embedded

  if (format === 'jpeg') {
    embedded = await pdf.embedJpg(bytes)
  } else if (format === 'png') {
    embedded = await pdf.embedPng(bytes)
  } else {
    embedded = await embedWebpAsPng(pdf, bytes.buffer, label)
  }

  drawEmbeddedImageOnA4(pdf, embedded)
}
