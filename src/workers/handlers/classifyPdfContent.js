import {
  PDFArray,
  PDFContentStream,
  PDFDict,
  PDFName,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
} from 'pdf-lib'

function nameValue(value) {
  return value instanceof PDFName ? value.decodeText() : null
}

function dictSize(dict) {
  return dict instanceof PDFDict ? dict.entries().length : 0
}

function pageHasFonts(page) {
  const resources = page.node.Resources()
  const fonts = resources?.lookupMaybe(PDFName.of('Font'), PDFDict)
  return dictSize(fonts) > 0
}

function countPageImages(page) {
  const resources = page.node.Resources()
  const xObjects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict)
  let count = 0

  for (const [, object] of xObjects?.entries() ?? []) {
    const stream = page.doc.context.lookup(object, PDFStream)
    if (!stream?.dict) continue

    const subtype = nameValue(
      stream.dict.lookupMaybe(PDFName.of('Subtype'), PDFName),
    )
    if (subtype === 'Image') count++
  }

  return count
}

function contentStreamBytes(stream) {
  if (stream instanceof PDFRawStream) {
    return decodePDFRawStream(stream).decode()
  }

  if (stream instanceof PDFContentStream) {
    return stream.getUnencodedContents()
  }

  return null
}

function collectContentStreams(contents, context) {
  if (!contents) return []

  if (contents instanceof PDFRawStream || contents instanceof PDFContentStream) {
    return [contents]
  }

  if (contents instanceof PDFArray) {
    const streams = []
    for (let index = 0; index < contents.size(); index++) {
      const stream = contents.lookup(index, PDFStream)
      if (stream) streams.push(stream)
    }
    return streams
  }

  const stream = context.lookup(contents, PDFStream)
  return stream ? [stream] : []
}

function pageHasTextOperators(page) {
  const contents = page.node.Contents()
  const streams = collectContentStreams(contents, page.doc.context)

  for (const stream of streams) {
    const bytes = contentStreamBytes(stream)
    if (!bytes) continue

    const text = new TextDecoder('latin1').decode(bytes)

    if (/\b(Tj|TJ|Td|TD|Tm|T\*|'|")\b/.test(text)) {
      return true
    }

    if (/\bBT\b/.test(text) && /\bET\b/.test(text)) {
      return true
    }
  }

  return false
}

/**
 * Classify PDF content for compression routing.
 * @param {import('pdf-lib').PDFDocument} source
 * @returns {{ category: 'imageHeavy' | 'mixed' | 'textHeavy', signals: object }}
 */
export function classifyPdfContent(source) {
  const pages = source.getPages()
  let pagesWithFonts = 0
  let pagesWithTextOps = 0
  let pagesWithImages = 0
  let totalImages = 0
  let imageOnlyPages = 0

  for (const page of pages) {
    const hasFonts = pageHasFonts(page)
    const imageCount = countPageImages(page)
    const hasTextOps = pageHasTextOperators(page)

    if (hasFonts) pagesWithFonts++
    if (hasTextOps) pagesWithTextOps++
    if (imageCount > 0) {
      pagesWithImages++
      totalImages += imageCount
    }
    if (imageCount > 0 && !hasFonts && !hasTextOps) {
      imageOnlyPages++
    }
  }

  const pageCount = pages.length
  const hasTextSignals = pagesWithFonts > 0 || pagesWithTextOps > 0
  const hasImageSignals = pagesWithImages > 0

  const signals = {
    pageCount,
    pagesWithFonts,
    pagesWithTextOps,
    pagesWithImages,
    totalImages,
    imageOnlyPages,
  }

  if (pageCount > 0 && imageOnlyPages === pageCount) {
    return { category: 'imageHeavy', signals }
  }

  if (hasImageSignals && !hasTextSignals) {
    return { category: 'imageHeavy', signals }
  }

  if (!hasImageSignals && hasTextSignals) {
    return { category: 'textHeavy', signals }
  }

  if (hasImageSignals && hasTextSignals) {
    return { category: 'mixed', signals }
  }

  return { category: 'textHeavy', signals }
}
