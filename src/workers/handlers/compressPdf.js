import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
} from 'pdf-lib'

const QUALITY_BY_LEVEL = {
  low: 0.85,
  medium: 0.7,
  high: 0.5,
}

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function ratio(originalSize, compressedSize) {
  if (!originalSize) return 1
  return compressedSize / originalSize
}

function diagnostics(startedAt, originalSize, compressedSize, extra = {}) {
  return {
    originalSize,
    compressedSize,
    compressionRatio: ratio(originalSize, compressedSize),
    processingTimeMs: Math.round(now() - startedAt),
    ...extra,
  }
}

function nameValue(value) {
  return value instanceof PDFName ? value.decodeText() : null
}

function isDctFilter(filter) {
  if (filter instanceof PDFName) {
    return filter.decodeText() === 'DCTDecode'
  }

  if (filter?.asArray) {
    return filter.asArray().some((entry) => nameValue(entry) === 'DCTDecode')
  }

  return false
}

function dictSize(dict) {
  return dict instanceof PDFDict ? dict.entries().length : 0
}

function pageHasFonts(page) {
  const resources = page.node.Resources()
  const fonts = resources?.lookupMaybe(PDFName.of('Font'), PDFDict)
  return dictSize(fonts) > 0
}

function imageDimensions(stream) {
  const width = stream.dict.lookupMaybe(PDFName.of('Width'), PDFNumber)
  const height = stream.dict.lookupMaybe(PDFName.of('Height'), PDFNumber)

  if (!width || !height) return null

  return {
    width: width.asNumber(),
    height: height.asNumber(),
  }
}

function getPageJpegImage(page) {
  if (pageHasFonts(page)) return null

  const resources = page.node.Resources()
  const xObjects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict)
  const entries = xObjects?.entries() ?? []
  const images = []

  for (const [, object] of entries) {
    const stream = page.doc.context.lookupMaybe(object, PDFRawStream)
    if (!stream) continue

    const subtype = nameValue(stream.dict.lookupMaybe(PDFName.of('Subtype'), PDFName))
    const filter = stream.dict.get(PDFName.of('Filter'))
    const dimensions = imageDimensions(stream)

    if (subtype === 'Image' && dimensions && isDctFilter(filter)) {
      images.push({ bytes: stream.asUint8Array(), dimensions })
    }
  }

  return images.length === 1 ? images[0] : null
}

async function reencodeJpeg(bytes, quality) {
  const bitmap = await createImageBitmap(
    new Blob([bytes], { type: 'image/jpeg' }),
  )

  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Could not create canvas for JPEG re-encoding.')
    }

    ctx.drawImage(bitmap, 0, 0)

    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality,
    })

    if (!blob?.size) {
      throw new Error('JPEG re-encoding returned an empty blob.')
    }

    return new Uint8Array(await blob.arrayBuffer())
  } finally {
    bitmap.close()
  }
}

function drawImageFit(page, image, dimensions) {
  const { width: pageWidth, height: pageHeight } = page.getSize()
  const scale = Math.min(
    pageWidth / Math.max(1, dimensions.width),
    pageHeight / Math.max(1, dimensions.height),
  )
  const width = dimensions.width * scale
  const height = dimensions.height * scale
  const x = (pageWidth - width) / 2
  const y = (pageHeight - height) / 2

  page.drawImage(image, { x, y, width, height })
}

/**
 * Conservative V1 compressor for image-based PDFs.
 * Unsupported PDFs intentionally return the original bytes.
 */
export async function compressPdf(payload) {
  const startedAt = now()
  const { buffer, level = 'medium', name = 'PDF' } = payload ?? {}
  const originalSize = buffer?.byteLength ?? 0
  const quality = QUALITY_BY_LEVEL[level] ?? QUALITY_BY_LEVEL.medium

  if (!originalSize) {
    throw new Error(`"${name}" is empty.`)
  }

  try {
    const source = await PDFDocument.load(buffer, { ignoreEncryption: true })
    const pages = source.getPages()

    if (pages.length === 0) {
      return {
        bytes: new Uint8Array(buffer),
        diagnostics: diagnostics(startedAt, originalSize, originalSize, {
          level,
          quality,
          usedOriginal: true,
          reason: 'PDF has no pages.',
        }),
      }
    }

    const pageImages = pages.map(getPageJpegImage)

    if (pageImages.some((image) => !image)) {
      return {
        bytes: new Uint8Array(buffer),
        diagnostics: diagnostics(startedAt, originalSize, originalSize, {
          level,
          quality,
          usedOriginal: true,
          reason:
            'Unsupported PDF structure for V1. Expected image-only JPEG pages.',
        }),
      }
    }

    const output = await PDFDocument.create()

    for (let index = 0; index < pages.length; index++) {
      const page = pages[index]
      const pageImage = pageImages[index]
      const reencoded = await reencodeJpeg(pageImage.bytes, quality)
      const embedded = await output.embedJpg(reencoded)
      const size = page.getSize()
      const outputPage = output.addPage([size.width, size.height])

      drawImageFit(outputPage, embedded, pageImage.dimensions)
    }

    const compressed = await output.save()

    if (compressed.byteLength >= originalSize) {
      return {
        bytes: new Uint8Array(buffer),
        diagnostics: diagnostics(startedAt, originalSize, originalSize, {
          level,
          quality,
          pageCount: pages.length,
          usedOriginal: true,
          reason: 'Compressed output was not smaller than the original.',
        }),
      }
    }

    return {
      bytes: compressed,
      diagnostics: diagnostics(startedAt, originalSize, compressed.byteLength, {
        level,
        quality,
        pageCount: pages.length,
        usedOriginal: false,
        reason: 'Compressed JPEG image pages.',
      }),
    }
  } catch (err) {
    return {
      bytes: new Uint8Array(buffer),
      diagnostics: diagnostics(startedAt, originalSize, originalSize, {
        level,
        quality,
        usedOriginal: true,
        reason: `Compression failed; original PDF returned. ${
          err instanceof Error ? err.message : String(err)
        }`,
      }),
    }
  }
}
