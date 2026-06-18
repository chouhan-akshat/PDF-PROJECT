import { useCallback, useEffect, useState } from 'react'
import { downloadPdfBytes } from '../utils/download.js'
import {
  notesCleanerFilesToPdf,
  onNotesCleanerWorkerLog,
} from '../utils/pdfWorkerClient.js'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB per image
const MAX_TOTAL_SIZE = 200 * 1024 * 1024 // 200MB total

function validateImageFiles(files) {
  if (!files?.length) {
    throw new Error('Select at least one image.')
  }

  let totalSize = 0

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      const maxMB = Math.round(MAX_FILE_SIZE / 1024 / 1024)
      throw new Error(
        `"${file.name}" exceeds the ${maxMB}MB per image limit.`,
      )
    }
    totalSize += file.size
  }

  if (totalSize > MAX_TOTAL_SIZE) {
    const maxMB = Math.round(MAX_TOTAL_SIZE / 1024 / 1024)
    throw new Error(`Total upload size exceeds the ${maxMB}MB limit.`)
  }
}

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
      validateImageFiles(files)
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
