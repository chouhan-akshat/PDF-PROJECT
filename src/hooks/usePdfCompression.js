import { useCallback, useState } from 'react'
import { downloadPdfBytes } from '../utils/download.js'
import { compressPdfFile } from '../utils/pdfWorkerClient.js'

export function usePdfCompression() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [diagnostics, setDiagnostics] = useState(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setDiagnostics(null)
  }, [])

  const compress = useCallback(async (file, options = {}) => {
    const { download = true, filename, level = 'medium' } = options

    setStatus('loading')
    setError(null)
    setDiagnostics(null)

    try {
      const result = await compressPdfFile(file, { level })
      const outputName =
        filename ?? `compressed-${new Date().toISOString().slice(0, 10)}.pdf`

      if (download) {
        downloadPdfBytes(result.bytes, outputName)
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
    compress,
    reset,
    status,
    error,
    diagnostics,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
  }
}
