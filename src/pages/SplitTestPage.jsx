import { useState } from 'react'
import { usePdfSplit } from '../hooks/usePdfSplit.js'
import ToolPageLayout from '../components/layout/ToolPageLayout.jsx'

export default function SplitTestPage({ onBack }) {
  const [file, setFile] = useState(null)
  const [splitAfterPage, setSplitAfterPage] = useState('')
  const [localValidationError, setLocalValidationError] = useState('')

  const {
    split,
    reset,
    status,
    error,
    diagnostics,
    isLoading,
    isSuccess,
  } = usePdfSplit()

  function handleFileSelect(selected) {
    reset()
    setLocalValidationError('')
    setFile(selected)
  }

  function handleFileClear() {
    reset()
    setFile(null)
  }

  function handleSplitChange(event) {
    setLocalValidationError('')
    setSplitAfterPage(event.target.value)
  }

  async function handleSplit() {
    if (!file) {
      setLocalValidationError('Choose a PDF file to split.')
      return
    }

    const pageNum = parseInt(splitAfterPage, 10)
    if (Number.isNaN(pageNum) || pageNum < 1) {
      setLocalValidationError('Enter a valid page number (1 or higher).')
      return
    }

    try {
      await split(file, { splitAfterPage: pageNum })
    } catch {
      // Error surfaced via hook `error` state
    }
  }

  const diagnosticsRows =
    isSuccess && diagnostics
      ? [
          { label: 'Original pages', value: diagnostics.originalPageCount },
          { label: 'Split after', value: `Page ${diagnostics.splitAfterPage}` },
          { label: 'Part 1 size', value: `${diagnostics.part1SizeKB} KB` },
          { label: 'Part 2 size', value: `${diagnostics.part2SizeKB} KB` },
          { label: 'Time taken', value: `${diagnostics.processingTimeMs} ms` },
        ]
      : undefined

  const optionsSlot = (
    <div className="space-y-3">
      <label htmlFor="splitAfterPage" className="text-body-sm font-semibold text-primary block">
        Split after page
      </label>
      <input
        id="splitAfterPage"
        type="number"
        min="1"
        value={splitAfterPage}
        onChange={handleSplitChange}
        disabled={isLoading}
        placeholder="e.g. 5"
        className="w-full sm:w-48 rounded-lg border border-border-subtle bg-surface-base px-3 py-2 text-body-sm text-primary placeholder:text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
      />
      <p className="text-caption text-secondary">
        The document will be split into two parts: Pages 1 to X, and Pages X+1 to end.
      </p>
    </div>
  )

  return (
    <ToolPageLayout
      title="Split PDF"
      description="Split a PDF into two separate files at a specific page number. Processing runs entirely in your browser."
      onBack={onBack}
      accept="application/pdf,.pdf"
      file={file}
      onFileSelect={handleFileSelect}
      onFileClear={handleFileClear}
      uploadLabel="Drop PDF here"
      uploadHint="or click to browse"
      uploadAcceptLabel="PDF files only"
      options={optionsSlot}
      actionLabel="Split PDF & Download"
      actionLoadingLabel="Splitting in worker…"
      onAction={handleSplit}
      actionDisabled={isLoading || !file}
      isLoading={isLoading}
      isSuccess={isSuccess}
      successMessage="Split complete — ZIP download should have started."
      error={error}
      validationError={localValidationError}
      status={status}
      diagnostics={diagnosticsRows}
    />
  )
}
