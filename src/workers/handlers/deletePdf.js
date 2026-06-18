import { PDFDocument } from 'pdf-lib'

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function assertValidDeletion(deletedIndexes, pageCount) {
  if (!Array.isArray(deletedIndexes) || deletedIndexes.length === 0) {
    throw new Error('No pages selected for deletion.')
  }

  if (deletedIndexes.length >= pageCount) {
    throw new Error('Cannot delete all pages — at least one page must remain.')
  }

  const seen = new Set()
  for (const index of deletedIndexes) {
    if (!Number.isInteger(index) || index < 0 || index >= pageCount) {
      throw new Error(`Invalid page index: ${index}`)
    }
    if (seen.has(index)) {
      throw new Error(`Duplicate index in deletion request: ${index}`)
    }
    seen.add(index)
  }
}

/**
 * Rebuild a PDF excluding pages marked for deletion.
 * @param {{ buffer: ArrayBuffer, deletedIndexes?: number[] }} payload
 * @returns {Promise<{ bytes: Uint8Array, diagnostics: object }>}
 */
export async function deletePdfPages(payload) {
  const startedAt = now()
  const { buffer, deletedIndexes } = payload ?? {}

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

  assertValidDeletion(deletedIndexes, pageCount)

  // Compute kept pages (preserving order)
  const deletedSet = new Set(deletedIndexes)
  const keptIndexes = []
  for (let i = 0; i < pageCount; i++) {
    if (!deletedSet.has(i)) {
      keptIndexes.push(i)
    }
  }

  const output = await PDFDocument.create()
  const copiedPages = await output.copyPages(source, keptIndexes)
  copiedPages.forEach((page) => output.addPage(page))

  const bytes = await output.save()

  return {
    bytes,
    diagnostics: {
      originalPageCount: pageCount,
      deletedPages: deletedIndexes.length,
      remainingPages: keptIndexes.length,
      outputSizeKB: Math.round((bytes.byteLength / 1024) * 100) / 100,
      processingTimeMs: Math.round(now() - startedAt),
    },
  }
}
