import { useState } from 'react'
import { useNotesCleaner } from '../hooks/useNotesCleaner.js'
import ToolPageLayout from '../components/layout/ToolPageLayout.jsx'

export default function NotesCleanerTestPage({ onBack }) {
  const [files, setFiles] = useState([])
  const { clean, reset, status, error, logs, isLoading, isSuccess } =
    useNotesCleaner()

  function handleFileSelect(selected) {
    reset()
    setFiles(Array.isArray(selected) ? selected : [selected])
  }

  function handleFileClear() {
    reset()
    setFiles([])
  }

  async function handleClean() {
    try {
      await clean(files)
    } catch {
      // Error surfaced via hook `error` state
    }
  }

  /* Map worker log entries → DiagnosticsPanel rows */
  const diagnosticsRows =
    isSuccess && logs.length > 0
      ? logs.map((entry) => ({
          label: entry.step ?? 'step',
          value: entry.status ?? '',
        }))
      : undefined

  return (
    <ToolPageLayout
      title="Notes Cleaner"
      description="Shadow reduction and contrast enhancement for scanned notes, exported as a clean A4 PDF. Processing runs sequentially in a Web Worker."
      onBack={onBack}
      accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
      multiple
      files={files}
      onFileSelect={handleFileSelect}
      onFileClear={handleFileClear}
      uploadLabel="Drop note images here"
      uploadHint="or click to browse — select one or more"
      uploadAcceptLabel="JPG, PNG, WebP"
      actionLabel="Clean & Export PDF"
      actionLoadingLabel="Cleaning in worker…"
      onAction={handleClean}
      actionDisabled={isLoading || files.length < 1}
      isLoading={isLoading}
      isSuccess={isSuccess}
      successMessage="Cleaned PDF ready — your file has been downloaded."
      error={error}
      status={status}
      diagnostics={diagnosticsRows}
    />
  )
}
