export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.click()
  URL.revokeObjectURL(url)
}

export function downloadPdfBytes(bytes, filename = 'merged.pdf') {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  downloadBlob(blob, filename)
}

export function downloadZipBytes(bytes, filename = 'split-pages.zip') {
  const blob = new Blob([bytes], { type: 'application/zip' })
  downloadBlob(blob, filename)
}
