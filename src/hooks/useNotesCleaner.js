import { useCallback, useEffect, useState } from 'react'
import { downloadPdfBytes } from '../utils/download.js'
import {
  notesCleanerFilesToPdf,
  onNotesCleanerWorkerLog,
} from '../utils/pdfWorkerClient.js'

export function useNotesCleaner() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState([])

  useEffect(() => {
    onNotesCleanerWorkerLog((entry) => {
      setLogs((previous) => [...previous, entry])
    })
    return () => onNotesCleanerWorkerLog(null)
  }, [])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
    setLogs([])
  }, [])

  const clean = useCallback(async (files, options = {}) => {
    const { download = true, filename } = options

    setStatus('loading')
    setError(null)

    try {
      const bytes = await notesCleanerFilesToPdf(files)
      const outputName =
        filename ?? `cleaned-notes-${new Date().toISOString().slice(0, 10)}.pdf`

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
    clean,
    reset,
    status,
    error,
    logs,
    isLoading: status === 'loading',
    isSuccess: status === 'success',
  }
}
