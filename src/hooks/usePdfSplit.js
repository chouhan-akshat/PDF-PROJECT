import { useCallback, useState } from 'react'
import { downloadZipBytes } from '../utils/download.js'
import { isPasswordProtectedPdf } from '../utils/detectPasswordProtectedPdf.js'
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
    const { download = true, filename, splitAfterPage } = options

    setStatus('loading')
    setError(null)
    setDiagnostics(null)

    try {
      const buffer = await file.arrayBuffer()
      const isProtected = await isPasswordProtectedPdf(buffer)
      if (isProtected) {
        throw new Error(
          'This PDF is password protected. Please remove the password and try again.',
        )
      }

      const result = await splitPdfFile(file, { splitAfterPage })
      const stem = file.name.replace(/\.pdf$/i, '') || 'document'
      const outputName = filename ?? `${stem}-split.zip`

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
