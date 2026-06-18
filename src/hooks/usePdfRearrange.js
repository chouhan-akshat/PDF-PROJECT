import { useCallback, useState } from 'react'
import { downloadPdfBytes } from '../utils/download.js'
import { rearrangePdfFile } from '../utils/pdfWorkerClient.js'

export function usePdfRearrange() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [diagnostics, setDiagnostics] = useState(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setDiagnostics(null)
  }, [])

  const rearrange = useCallback(async (file, options = {}) => {
    const { download = true, filename, orderedPageIndexes } = options

    setStatus('loading')
    setError(null)
    setDiagnostics(null)

    try {
      const result = await rearrangePdfFile(file, { orderedPageIndexes })
      const stem = file.name.replace(/\.pdf$/i, '') || 'document'
      const outputName = filename ?? `${stem}-rearranged.pdf`

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
    rearrange,
    reset,
    status,
    error,
    diagnostics,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
  }
}
