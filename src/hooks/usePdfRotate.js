import { useCallback, useState } from 'react'
import { downloadPdfBytes } from '../utils/download.js'
import { isPasswordProtectedPdf } from '../utils/detectPasswordProtectedPdf.js'
import { rotatePdfFile } from '../utils/pdfWorkerClient.js'

export function usePdfRotate() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [diagnostics, setDiagnostics] = useState(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setDiagnostics(null)
  }, [])

  const rotate = useCallback(async (file, options = {}) => {
    const { download = true, filename, rotationDegrees } = options

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

      const result = await rotatePdfFile(file, { rotationDegrees })
      const stem = file.name.replace(/\.pdf$/i, '') || 'document'
      const outputName = filename ?? `${stem}-rotated.pdf`

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
    rotate,
    reset,
    status,
    error,
    diagnostics,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
  }
}
