import { useCallback, useState } from 'react'
import { downloadZipBytes } from '../utils/download.js'
import { splitPdfFile } from '../utils/pdfWorkerClient.js'

export function usePdfSplit() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [diagnostics, setDiagnostics] = useState(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setDiagnostics(null)
  }, [])

  const split = useCallback(async (file, options = {}) => {
    const { download = true, filename } = options

    setStatus('loading')
    setError(null)
    setDiagnostics(null)

    try {
      const result = await splitPdfFile(file)
      const stem = file.name.replace(/\.pdf$/i, '') || 'document'
      const outputName =
        filename ?? `${stem}-pages-${new Date().toISOString().slice(0, 10)}.zip`

      if (download) {
        downloadZipBytes(result.bytes, outputName)
      }

      setDiagnostics(result.diagnostics)
      setStatus('success')
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      setStatus('error')
      throw err
    }
  }, [])

  return {
    split,
    reset,
    status,
    error,
    diagnostics,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
  }
}
