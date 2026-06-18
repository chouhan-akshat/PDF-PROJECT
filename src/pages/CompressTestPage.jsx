import { useState } from 'react'
import { usePdfCompression } from '../hooks/usePdfCompression.js'
import ToolPageLayout from '../components/layout/ToolPageLayout.jsx'
import { cn } from '../utils/cn.js'

const COMPRESSION_LEVELS = [
  {
    id: 'LOW',
    label: 'Basic compression',
    description: 'High quality, less compression',
  },
  {
    id: 'MEDIUM',
    label: 'Strong compression',
    description: 'Good quality, good compression',
  },
  {
    id: 'HIGH',
    label: 'Extreme compression',
    description: 'Lower quality, smallest file',
  },
]

export default function CompressTestPage({ onBack }) {
  const [file, setFile] = useState(null)
  const [level, setLevel] = useState('MEDIUM')

  const {
    compress,
    reset,
    status,
    error,
    diagnostics,
    isLoading,
    isSuccess,
  } = usePdfCompression()

  function handleFileSelect(selected) {
    reset()
    setFile(selected)
  }

  function handleFileClear() {
    reset()
    setFile(null)
  }

  async function handleCompress() {
    if (!file) return

    try {
      await compress(file, { level })
    } catch {
      // Error surfaced via hook `error` state
    }
  }

  /* Map hook diagnostics into DiagnosticsPanel rows */
  let diagnosticsRows = undefined
  if (isSuccess && diagnostics) {
    diagnosticsRows = [
      { label: 'Mode', value: diagnostics.modeUsed },
      { label: 'Original size', value: `${diagnostics.originalSizeKB} KB` },
      { label: 'Compressed size', value: `${diagnostics.compressedSizeKB} KB` },
      { label: 'Reduction', value: `${diagnostics.reductionPercentage}%` },
      { label: 'Time taken', value: `${diagnostics.processingTimeMs} ms` },
    ]

    if (diagnostics.modeUsed === 'V2') {
      diagnosticsRows.push(
        { label: 'Images found', value: diagnostics.imagesFound },
        { label: 'Images processed', value: diagnostics.imagesProcessed },
        { label: 'PDF parser', value: `${diagnostics.timingPdfParseMs} ms` },
        { label: 'Image extraction', value: `${diagnostics.timingImageExtractionMs} ms` },
        { label: 'Image resize', value: `${diagnostics.timingImageResizeMs} ms` },
        { label: 'PDF rebuild', value: `${diagnostics.timingPdfRebuildMs} ms` },
      )
    }
  }

  const optionsSlot = (
    <div className="space-y-3">
      <h3 className="text-body-sm font-semibold text-primary">Compression level</h3>
      <div className="flex flex-col gap-2 sm:flex-row">
        {COMPRESSION_LEVELS.map(({ id, label, description }) => {
          const isSelected = level === id
          return (
            <label
              key={id}
              className={cn(
                'flex flex-1 cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors',
                isSelected
                  ? 'border-accent bg-accent/5'
                  : 'border-border-subtle bg-surface-base hover:border-border-default',
                isLoading && 'pointer-events-none opacity-50',
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="compression-level"
                  value={id}
                  checked={isSelected}
                  onChange={(e) => {
                    reset()
                    setLevel(e.target.value)
                  }}
                  disabled={isLoading}
                  className="size-4 shrink-0 text-accent focus:ring-accent"
                />
                <span className="text-body-sm font-medium text-primary">
                  {label}
                </span>
              </div>
              <span className="pl-6 text-caption text-secondary">
                {description}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )

  return (
    <ToolPageLayout
      title="Compress PDF"
      description="Reduce the file size of your PDF while maintaining quality. Processing runs entirely in your browser."
      onBack={onBack}
      accept="application/pdf,.pdf"
      file={file}
      onFileSelect={handleFileSelect}
      onFileClear={handleFileClear}
      uploadLabel="Drop PDF here"
      uploadHint="or click to browse"
      uploadAcceptLabel="PDF files only"
      options={optionsSlot}
      actionLabel="Compress PDF"
      actionLoadingLabel="Compressing in worker…"
      onAction={handleCompress}
      actionDisabled={isLoading || !file}
      isLoading={isLoading}
      isSuccess={isSuccess}
      successMessage="Compression complete — download started."
      error={error}
      status={status}
      diagnostics={diagnosticsRows}
    />
  )
}
