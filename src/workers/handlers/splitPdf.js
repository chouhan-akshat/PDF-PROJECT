import { PDFDocument } from 'pdf-lib'
import { zipSync } from 'fflate'

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function fileStem(name = 'document.pdf') {
  const trimmed = name.trim() || 'document.pdf'
  return trimmed.replace(/\.pdf$/i, '') || 'document'
}

function pageIndexes(start, endExclusive) {
  return Array.from(
    { length: endExclusive - start },
    (_item, offset) => start + offset,
  )
}

/**
 * Split a PDF into two PDFs after a 1-based page number and package them in a ZIP.
 * @param {{ buffer: ArrayBuffer, name?: string, splitAfterPage?: number }} payload
 * @returns {Promise<{ bytes: Uint8Array, diagnostics: object }>}
 */
export async function splitPdf(payload) {
  const startedAt = now()
  const { buffer, name = 'document.pdf', splitAfterPage } = payload ?? {}

  if (!buffer?.byteLength) {
    throw new Error('PDF is empty.')
  }

  if (!Number.isInteger(splitAfterPage)) {
    throw new Error('Enter a whole page number to split after.')
  }

  let source

  try {
    source = await PDFDocument.load(buffer, { ignoreEncryption: true })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Could not read PDF: ${detail}`, { cause: err })
  }

  const totalPages = source.getPageCount()

  if (totalPages === 0) {
    throw new Error('PDF has no pages.')
  }

  if (splitAfterPage <= 0 || splitAfterPage >= totalPages) {
    throw new Error(`Split after page must be between 1 and ${totalPages - 1}.`)
  }

  const stem = fileStem(name)
  const part1 = await PDFDocument.create()
  const part2 = await PDFDocument.create()
  const part1CopiedPages = await part1.copyPages(
    source,
    pageIndexes(0, splitAfterPage),
  )
  const part2CopiedPages = await part2.copyPages(
    source,
    pageIndexes(splitAfterPage, totalPages),
  )

  part1CopiedPages.forEach((page) => part1.addPage(page))
  part2CopiedPages.forEach((page) => part2.addPage(page))

  const part1Bytes = await part1.save()
  const part2Bytes = await part2.save()
  const zipEntries = {
    [`${stem}-part-1.pdf`]: part1Bytes,
    [`${stem}-part-2.pdf`]: part2Bytes,
  }

  const zipBytes = zipSync(zipEntries)

  return {
    bytes: zipBytes,
    diagnostics: {
      totalPages,
      splitAfterPage,
      part1Pages: splitAfterPage,
      part2Pages: totalPages - splitAfterPage,
      zipSizeKB: Math.round((zipBytes.byteLength / 1024) * 100) / 100,
      processingTimeMs: Math.round(now() - startedAt),
    },
  }
}
