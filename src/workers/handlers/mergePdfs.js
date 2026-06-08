import { PDFDocument } from 'pdf-lib'

/**
 * Merge multiple PDF byte arrays in order (all pages from file 1, then file 2, …).
 * @param {{ name: string, buffer: ArrayBuffer }[]} files
 * @returns {Promise<Uint8Array>}
 */
export async function mergePdfs(files) {
  if (!files?.length) {
    throw new Error('Select at least one PDF file.')
  }

  const merged = await PDFDocument.create()

  for (let i = 0; i < files.length; i++) {
    const { name, buffer } = files[i]
    const label = name || `file ${i + 1}`

    if (!buffer?.byteLength) {
      throw new Error(`"${label}" is empty.`)
    }

    try {
      const source = await PDFDocument.load(buffer, { ignoreEncryption: true })
      const indices = source.getPageIndices()

      if (indices.length === 0) {
        throw new Error(`"${label}" has no pages.`)
      }

      const pages = await merged.copyPages(source, indices)
      pages.forEach((page) => merged.addPage(page))
    } catch (err) {
      if (err instanceof Error && err.message.includes('has no pages')) {
        throw err
      }
      const detail = err instanceof Error ? err.message : String(err)
      throw new Error(`Could not read "${label}": ${detail}`, { cause: err })
    }
  }

  if (merged.getPageCount() === 0) {
    throw new Error('Merged PDF has no pages.')
  }

  return merged.save()
}
