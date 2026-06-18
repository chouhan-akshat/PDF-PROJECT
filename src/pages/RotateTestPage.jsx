import { useState } from 'react'
import { usePdfRotate } from '../hooks/usePdfRotate.js'
import ToolPageLayout from '../components/layout/ToolPageLayout.jsx'
import { cn } from '../utils/cn.js'

const ROTATIONS = [
  { degrees: 90, label: 'Right (90°)' },
  { degrees: 180, label: 'Upside down (180°)' },
  { degrees: 270, label: 'Left (270°)' },
]

export default function RotateTestPage({ onBack }) {
  const [file, setFile] = useState(null)
  const [rotationDegrees, setRotationDegrees] = useState(90)
  const [localValidationError, setLocalValidationError] = useState('')

  const {
    rotate,
    reset,
    status,
    error,
    diagnostics,
    isLoading,
    isSuccess,
  } = usePdfRotate()

  function handleFileSelect(selected) {
    reset()
    setLocalValidationError('')
    setFile(selected)
  }

  function handleFileClear() {
    reset()
    setFile(null)
  }

  function handleRotationChange(event) {
    setLocalValidationError('')
    setRotationDegrees(Number(event.target.value))
  }

  async function handleRotate() {
    if (!file) {
      setLocalValidationError('Choose a PDF file to rotate.')
      return
    }

    if (!ROTATIONS.some((r) => r.degrees === rotationDegrees)) {
      setLocalValidationError('Choose a rotation of 90, 180, or 270 degrees.')
      return
    }

    try {
      await rotate(file, { rotationDegrees })
    } catch {
      // Error surfaced via hook `error` state
    }
  }

  const diagnosticsRows =
    isSuccess && diagnostics
      ? [
          { label: 'Page count', value: diagnostics.pageCount },
          { label: 'Rotation', value: `${diagnostics.rotationDegrees}°` },
          { label: 'Output size', value: `${diagnostics.outputSizeKB} KB` },
          { label: 'Time taken', value: `${diagnostics.processingTimeMs} ms` },
        ]
      : undefined

  const optionsSlot = (
    <div className="space-y-3">
      <h3 className="text-body-sm font-semibold text-primary">Rotation angle</h3>
      <div className="flex flex-col gap-2 sm:flex-row">
        {ROTATIONS.map(({ degrees, label }) => {
          const isSelected = rotationDegrees === degrees
          return (
            <label
              key={degrees}
              className={cn(
                'flex flex-1 cursor-pointer items-center gap-2 rounded-lg border p-3 transition-colors',
                isSelected
                  ? 'border-accent bg-accent/5'
                  : 'border-border-subtle bg-surface-base hover:border-border-default',
                isLoading && 'pointer-events-none opacity-50',
              )}
            >
              <input
                type="radio"
                name="rotation-degrees"
                value={degrees}
                checked={isSelected}
                onChange={handleRotationChange}
                disabled={isLoading}
                className="size-4 shrink-0 text-accent focus:ring-accent"
              />
              <span className="text-body-sm font-medium text-primary">
                {label}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )

  return (
    <ToolPageLayout
      title="Rotate PDF"
      description="Rotate every page in a PDF and download the result. Processing runs fully client-side in your browser."
      onBack={onBack}
      accept="application/pdf,.pdf"
      file={file}
      onFileSelect={handleFileSelect}
      onFileClear={handleFileClear}
      uploadLabel="Drop PDF here"
      uploadHint="or click to browse"
      uploadAcceptLabel="PDF files only"
      options={optionsSlot}
      actionLabel="Rotate PDF"
      actionLoadingLabel="Rotating in worker…"
      onAction={handleRotate}
      actionDisabled={isLoading || !file}
      isLoading={isLoading}
      isSuccess={isSuccess}
      successMessage="Rotation complete — download started."
      error={error}
      validationError={localValidationError}
      status={status}
      diagnostics={diagnosticsRows}
    />
  )
}
