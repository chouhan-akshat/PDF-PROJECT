import { PDFDocument } from 'pdf-lib'

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function assertValidPageOrder(orderedPageIndexes, pageCount) {
  if (!Array.isArray(orderedPageIndexes)) {
    throw new Error('Page order is missing.')
  }

  if (orderedPageIndexes.length !== pageCount) {
    throw new Error('Page order does not match the PDF page count.')
  }

  const seen = new Set()

  for (const index of orderedPageIndexes) {
    if (!Number.isInteger(index) || index < 0 || index >= pageCount) {
      throw new Error('Page order contains an invalid page.')
    }

    if (seen.has(index)) {
      throw new Error('Page order contains a duplicate page.')
    }

    seen.add(index)
  }
}

function movedPageCount(orderedPageIndexes) {
  return orderedPageIndexes.reduce(
    (count, originalIndex, position) =>
      originalIndex === position ? count : count + 1,
    0,
  )
}

/**
 * Rebuild a PDF with pages copied in the current gallery order.
 * @param {{ buffer: ArrayBuffer, orderedPageIndexes?: number[] }} payload
 * @returns {Promise<{ bytes: Uint8Array, diagnostics: object }>}
 */
export async function rearrangePdf(payload) {
  const startedAt = now()
  const { buffer, orderedPageIndexes } = payload ?? {}

  if (!buffer?.byteLength) {
    throw new Error('PDF is empty.')
  }

  let source

  try {
    source = await PDFDocument.load(buffer, { ignoreEncryption: true })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Could not read PDF: ${detail}`, { cause: err })
  }

  const pageCount = source.getPageCount()

  if (pageCount === 0) {
    throw new Error('PDF has no pages.')
  }

  assertValidPageOrder(orderedPageIndexes, pageCount)

  const output = await PDFDocument.create()
  const copiedPages = await output.copyPages(source, orderedPageIndexes)

  copiedPages.forEach((page) => output.addPage(page))

  const bytes = await output.save()

  return {
    bytes,
    diagnostics: {
      pageCount,
      movedPages: movedPageCount(orderedPageIndexes),
      outputSizeKB: Math.round((bytes.byteLength / 1024) * 100) / 100,
      processingTimeMs: Math.round(now() - startedAt),
    },
  }
}
