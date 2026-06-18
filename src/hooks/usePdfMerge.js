import { useCallback, useState } from 'react'
import { downloadPdfBytes } from '../utils/download.js'
import { isPasswordProtectedPdf } from '../utils/detectPasswordProtectedPdf.js'
import { mergePdfFiles } from '../utils/pdfWorkerClient.js'

async function validatePdfFiles(files) {
  if (!files?.length) {
    throw new Error('Select at least one PDF file.')
  }

  for (const file of files) {
    const buffer = await file.arrayBuffer()
    const isProtected = await isPasswordProtectedPdf(buffer)
    if (isProtected) {
      throw new Error(
        'This PDF is password protected. Please remove the password and try again.',
      )
    }
  }
}

export function usePdfMerge() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  const merge = useCallback(async (files, options = {}) => {
    const { download = true, filename } = options

    setStatus('loading')
    setError(null)

    try {
      await validatePdfFiles(files)
      const bytes = await mergePdfFiles(files)
      const outputName =
        filename ?? `merged-${new Date().toISOString().slice(0, 10)}.pdf`

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
    merge,
    reset,
    status,
    error,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
  }
}
