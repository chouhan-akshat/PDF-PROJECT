import { useState } from 'react'
import { usePdfMerge } from '../hooks/usePdfMerge.js'
import ToolPageLayout from '../components/layout/ToolPageLayout.jsx'

export default function MergeTestPage({ onBack }) {
  const [files, setFiles] = useState([])
  const { merge, reset, status, error, isLoading, isSuccess } = usePdfMerge()

  function handleFileSelect(selected) {
    reset()
    setFiles(Array.isArray(selected) ? selected : [selected])
  }

  function handleFileClear() {
    reset()
    setFiles([])
  }

  async function handleMerge() {
    try {
      await merge(files)
    } catch {
      // Error surfaced via hook `error` state
    }
  }

  return (
    <ToolPageLayout
      title="Merge PDF"
      description="Combine multiple PDFs into one document. Select two or more files — everything is processed in your browser."
      onBack={onBack}
      accept="application/pdf,.pdf"
      multiple
      files={files}
      onFileSelect={handleFileSelect}
      onFileClear={handleFileClear}
      uploadLabel="Drop PDF files here"
      uploadHint="or click to browse — select two or more"
      uploadAcceptLabel="PDF files only"
      actionLabel="Merge & Download"
      actionLoadingLabel="Merging in worker…"
      onAction={handleMerge}
      actionDisabled={isLoading || files.length < 2}
      isLoading={isLoading}
      isSuccess={isSuccess}
      successMessage="Merge complete — your combined PDF has been downloaded."
      error={error}
      status={status}
    />
  )
}
