import { useState } from 'react'
import { useImageToPdf } from '../hooks/useImageToPdf.js'
import ToolPageLayout from '../components/layout/ToolPageLayout.jsx'

export default function ImageToPdfTestPage({ onBack }) {
  const [files, setFiles] = useState([])
  const { convert, reset, status, error, isLoading, isSuccess } = useImageToPdf()

  function handleFileSelect(selected) {
    reset()
    setFiles(Array.isArray(selected) ? selected : [selected])
  }

  function handleFileClear() {
    reset()
    setFiles([])
  }

  async function handleConvert() {
    try {
      await convert(files)
    } catch {
      // Error surfaced via hook `error` state
    }
  }

  return (
    <ToolPageLayout
      title="Image to PDF"
      description="Convert JPG, PNG, or WebP images into a single PDF. Select one or more images and they'll be combined in order — processed entirely in your browser."
      onBack={onBack}
      accept="image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
      multiple
      files={files}
      onFileSelect={handleFileSelect}
      onFileClear={handleFileClear}
      uploadLabel="Drop images here"
      uploadHint="or click to browse — select one or more"
      uploadAcceptLabel="JPG, PNG, WebP"
      actionLabel="Create PDF & Download"
      actionLoadingLabel="Converting in worker…"
      onAction={handleConvert}
      actionDisabled={isLoading || files.length < 1}
      isLoading={isLoading}
      isSuccess={isSuccess}
      successMessage="PDF created — your file has been downloaded."
      error={error}
      status={status}
    />
  )
}
