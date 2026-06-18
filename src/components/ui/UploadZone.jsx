import { useRef, useState } from 'react'
import { cn } from '../../utils/cn.js'
import Button from './Button.jsx'

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function UploadIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        d="M12 16V4m0 0L8 8m4-4 4 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 17v1a3 3 0 003 3h10a3 3 0 003-3v-1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FileIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 2v6h6M8 13h8M8 17h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function UploadZone({
  accept,
  multiple = false,
  disabled = false,
  file = null,
  files = [],
  onFileSelect,
  onClear,
  label = 'Drop your file here',
  hint = 'or click to browse',
  acceptLabel,
  className,
}) {
  const inputRef = useRef(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const selectedFiles = file ? [file] : files
  const hasFiles = selectedFiles.length > 0
  const primaryFile = selectedFiles[0]

  function openPicker() {
    if (!disabled) inputRef.current?.click()
  }

  function handleInputChange(event) {
    const picked = Array.from(event.target.files ?? [])
    if (picked.length === 0) return
    onFileSelect?.(multiple ? picked : picked[0])
    event.target.value = ''
  }

  function handleDragOver(event) {
    event.preventDefault()
    if (!disabled) setIsDragOver(true)
  }

  function handleDragLeave(event) {
    event.preventDefault()
    setIsDragOver(false)
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDragOver(false)
    if (disabled) return

    const dropped = Array.from(event.dataTransfer.files ?? [])
    if (dropped.length === 0) return
    onFileSelect?.(multiple ? dropped : dropped[0])
  }

  function handleClear(event) {
    event.stopPropagation()
    onClear?.()
    if (inputRef.current) inputRef.current.value = ''
  }

  if (hasFiles) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-surface-raised p-4 shadow-sm',
          disabled && 'opacity-50',
          className,
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleInputChange}
          className="sr-only"
          tabIndex={-1}
        />

        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-muted text-accent">
            <FileIcon className="size-5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-body-md font-semibold text-primary">
              {multiple && selectedFiles.length > 1
                ? `${selectedFiles.length} files selected`
                : primaryFile?.name}
            </p>
            {primaryFile && (
              <p className="mt-0.5 text-caption text-tertiary">
                {multiple && selectedFiles.length > 1
                  ? `First: ${formatFileSize(primaryFile.size)}`
                  : formatFileSize(primaryFile.size)}
              </p>
            )}
          </div>

          <div className="flex shrink-0 gap-2">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={disabled}
              onClick={openPicker}
            >
              Replace
            </Button>
            {onClear && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                disabled={disabled}
                onClick={handleClear}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (disabled) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openPicker()
        }
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center',
        'transition-[border-color,background-color,transform] duration-normal ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
        isDragOver
          ? 'scale-[1.01] border-accent bg-accent-muted'
          : 'border-border bg-surface-raised/50 hover:border-border-default hover:bg-surface-overlay/40',
        disabled && 'cursor-not-allowed opacity-50',
        !disabled && 'cursor-pointer',
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={handleInputChange}
        className="sr-only"
        tabIndex={-1}
      />

      <div
        className={cn(
          'mb-4 flex size-12 items-center justify-center rounded-full',
          isDragOver ? 'bg-accent/20 text-accent' : 'bg-surface-overlay text-secondary',
        )}
      >
        <UploadIcon className="size-6" />
      </div>

      <p className="text-body-md font-semibold text-primary">{label}</p>
      <p className="mt-1 text-body-sm text-secondary">{hint}</p>

      <Button
        variant="primary"
        size="md"
        type="button"
        disabled={disabled}
        className="mt-5 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      >
        Choose file
      </Button>

      {acceptLabel && (
        <p className="mt-3 text-caption text-tertiary">{acceptLabel}</p>
      )}
    </div>
  )
}
