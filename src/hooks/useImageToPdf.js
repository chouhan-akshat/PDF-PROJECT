import { useCallback, useState } from 'react'
import { downloadPdfBytes } from '../utils/download.js'
import { imageFilesToPdf } from '../utils/pdfWorkerClient.js'

export function useImageToPdf() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  const convert = useCallback(async (files, options = {}) => {
    const { download = true, filename } = options

    setStatus('loading')
    setError(null)

    try {
      const bytes = await imageFilesToPdf(files)
      const outputName =
        filename ?? `images-${new Date().toISOString().slice(0, 10)}.pdf`

      if (download) {
        downloadPdfBytes(bytes, outputName)
      }

      setStatus('success')
      return bytes
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setStatus('error')
      throw err
    }
  }, [])

  return {
    convert,
    reset,
    status,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
  }
}
