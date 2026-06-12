import { PDFDocument } from 'pdf-lib'
import { zipSync } from 'fflate'

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function pageFileName(stem, pageNumber, pageCount) {
  const digits = Math.max(3, String(pageCount).length)
  const padded = String(pageNumber).padStart(digits, '0')
  return `${stem}-page-${padded}.pdf`
}

function fileStem(name = 'document.pdf') {
  const trimmed = name.trim() || 'document.pdf'
  return trimmed.replace(/\.pdf$/i, '') || 'document'
}

/**
 * Split every page of a PDF into individual PDFs and package them in a ZIP.
 * @param {{ buffer: ArrayBuffer, name?: string }} payload
 * @returns {Promise<{ bytes: Uint8Array, diagnostics: object }>}
 */
export async function splitPdf(payload) {
  const startedAt = now()
  const { buffer, name = 'document.pdf' } = payload ?? {}

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

  const stem = fileStem(name)
  const zipEntries = {}
  const generatedFileNames = []

  for (let index = 0; index < pageCount; index++) {
    const output = await PDFDocument.create()
    const [page] = await output.copyPages(source, [index])
    output.addPage(page)

    const pageBytes = await output.save()
    const fileName = pageFileName(stem, index + 1, pageCount)
    generatedFileNames.push(fileName)
    zipEntries[fileName] = pageBytes
  }

  const zipBytes = zipSync(zipEntries)

  return {
    bytes: zipBytes,
    diagnostics: {
      pageCount,
      generatedFiles: generatedFileNames.length,
      generatedFileNames,
      zipSizeKB: Math.round((zipBytes.byteLength / 1024) * 100) / 100,
      processingTimeMs: Math.round(now() - startedAt),
    },
  }
}
