import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePdfDelete } from '../hooks/usePdfDelete.js'
import { downloadPdfBytes } from '../utils/download.js'
import PagePreviewModal from '../components/PagePreviewModal.jsx'
import ToolPageLayout from '../components/layout/ToolPageLayout.jsx'
import Button from '../components/ui/Button.jsx'
import DiagnosticsPanel from '../components/ui/DiagnosticsPanel.jsx'
import StatusBadge from '../components/ui/StatusBadge.jsx'
import { cn } from '../utils/cn.js'

const THUMBNAIL_WIDTH = 170

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function makePageId(originalIndex) {
  return `page-${originalIndex}`
}

async function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Could not create thumbnail image.'))
      },
      'image/jpeg',
      0.82,
    )
  })
}

// ---------------------------------------------------------------------------
// PageCard (Custom for Delete Pages)
// ---------------------------------------------------------------------------

function PageCard({
  page,
  position,
  isMarked = false,
  onToggleMark,
  onOpenPreview,
}) {
  const [hovered, setHovered] = useState(false)
  const [eyeHovered, setEyeHovered] = useState(false)

  const containerStyle = {
    position: 'relative',
    borderRadius: 8,
    background: '#ffffff',
    boxShadow: isMarked
      ? '0 0 0 2px var(--color-error), 0 4px 12px rgba(239, 68, 68, 0.1)'
      : '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: isMarked
      ? '1.5px solid var(--color-error)'
      : '1px solid var(--color-border-subtle)',
    outline: 'none',
    cursor: 'pointer',
    userSelect: 'none',
    transform: isMarked ? 'scale(0.96)' : hovered ? 'translateY(-2px)' : 'scale(1)',
    transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
  }

  function handleCardClick() {
    onToggleMark(page.id)
  }

  return (
    <article
      style={containerStyle}
      onClick={handleCardClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Page ${position}${isMarked ? ', marked for deletion' : ''}`}
      aria-pressed={isMarked}
    >
      {/* Thumbnail area */}
      <div className="relative grid min-h-[200px] place-items-center overflow-hidden rounded-[7px] bg-surface-raised cursor-pointer">
        {page.thumbnailUrl ? (
          <img
            src={page.thumbnailUrl}
            alt={`Page ${position} thumbnail`}
            draggable="false"
            className="block h-full w-full object-contain select-none"
          />
        ) : page.hasFailedThumbnail ? (
          <div className="flex flex-col items-center justify-center p-4 text-center select-none">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-body-md font-bold text-secondary">Page {position}</span>
            <span className="mt-1 text-[10px] text-tertiary">No preview available</span>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center select-none animate-pulse w-full h-full">
            <div className="h-[140px] w-[100px] rounded bg-gradient-to-b from-surface-muted to-surface-base" />
          </div>
        )}

        {/* Red overlay when marked */}
        {isMarked && (
          <div className="pointer-events-none absolute inset-0 bg-error/15 transition-colors duration-fast" />
        )}

        {/* Page number badge or Delete badge */}
        <span
          className={cn(
            'absolute left-2 top-2 z-10 flex min-w-[26px] items-center justify-center gap-1 rounded-full px-1.5 text-center text-[11px] font-bold leading-[22px] text-white transition-colors',
            isMarked ? 'bg-error' : 'bg-primary/80',
          )}
        >
          {isMarked ? (
            <>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <span>DEL</span>
            </>
          ) : (
            position
          )}
        </span>

        {/* Preview hint — top-right eye icon button, only when thumbnail ready */}
        {page.thumbnailUrl && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenPreview(page.id)
            }}
            onMouseEnter={() => setEyeHovered(true)}
            onMouseLeave={() => setEyeHovered(false)}
            className={cn(
              'absolute right-2 top-2 z-10 flex size-7 cursor-pointer items-center justify-center rounded-md border border-white/20 text-white transition-all',
              eyeHovered
                ? 'scale-110 bg-accent'
                : isMarked
                ? 'bg-error/80'
                : 'bg-primary/70',
            )}
            title="Click to preview"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        )}
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function DeletePagesPage({ onBack }) {
  const [file, setFile] = useState(null)
  const [pages, setPages] = useState([])
  const [deletedIds, setDeletedIds] = useState(new Set())
  const [previewId, setPreviewId] = useState(null)
  const [thumbnailStatus, setThumbnailStatus] = useState('idle')
  const [thumbnailError, setThumbnailError] = useState(null)
  const [validationMessage, setValidationMessage] = useState('')
  const [trimmedBytes, setTrimmedBytes] = useState(null)
  const [trimmedFilename, setTrimmedFilename] = useState('')

  const {
    deletePages,
    reset,
    status,
    error,
    diagnostics,
    isLoading,
    isSuccess,
  } = usePdfDelete()

  const pageById = useMemo(
    () => new Map(pages.map((page) => [page.id, page])),
    [pages],
  )

  const isPreparingThumbnails = thumbnailStatus === 'loading'
  const markedCount = deletedIds.size
  const remainingCount = pages.length - markedCount
  const canDelete = Boolean(file && markedCount > 0 && remainingCount > 0 && !isLoading)

  // Reset helper — clears download state
  const clearOutput = useCallback(() => {
    reset()
    setTrimmedBytes(null)
    setTrimmedFilename('')
  }, [reset])

  // -------------------------------------------------------------------------
  // Thumbnail rendering
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!file) return undefined

    let cancelled = false
    let loadingTask = null
    let pdf = null
    const objectUrls = []

    async function renderThumbnails() {
      setPages([])
      setDeletedIds(new Set())
      setThumbnailStatus('loading')
      setThumbnailError(null)

      try {
        console.log('[DeletePages] Starting thumbnail generation. Importing pdfjs-dist...')
        const pdfjs = await import('pdfjs-dist')
        console.log('[DeletePages] Configuring workerSrc...')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()

        console.log('[DeletePages] Reading file arrayBuffer...')
        const arrayBuffer = await file.arrayBuffer()
        console.log('[DeletePages] Calling pdfjs.getDocument...')
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) })
        pdf = await loadingTask.promise
        console.log(`[DeletePages] PDF loaded successfully. Total pages: ${pdf.numPages}`)

        if (cancelled) return

        const initialPages = Array.from({ length: pdf.numPages }, (_item, index) => ({
          id: makePageId(index),
          originalIndex: index,
          thumbnailUrl: null,
          hasFailedThumbnail: false,
        }))
        setPages(initialPages)

        const isMobile = typeof window !== 'undefined' && (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768)
        const targetWidth = isMobile ? 100 : THUMBNAIL_WIDTH
        console.log(`[DeletePages] Device mode - Mobile: ${isMobile}, Render Width: ${targetWidth}px`)

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return

          try {
            console.log(`[DeletePages] Rendering page ${pageNumber}/${pdf.numPages}...`)
            const page = await pdf.getPage(pageNumber)
            const baseViewport = page.getViewport({ scale: 1 })
            const scale = targetWidth / baseViewport.width
            const viewport = page.getViewport({ scale })
            const canvas = document.createElement('canvas')
            canvas.width = Math.ceil(viewport.width)
            canvas.height = Math.ceil(viewport.height)
            const context = canvas.getContext('2d')

            if (!context) throw new Error(`Could not get 2d context for page ${pageNumber}.`)

            await page.render({ canvasContext: context, viewport }).promise
            const blob = await canvasToBlob(canvas)
            const thumbnailUrl = URL.createObjectURL(blob)
            objectUrls.push(thumbnailUrl)

            if (cancelled) {
              URL.revokeObjectURL(thumbnailUrl)
              return
            }

            setPages((currentPages) =>
              currentPages.map((currentPage) =>
                currentPage.originalIndex === pageNumber - 1
                  ? { ...currentPage, thumbnailUrl, hasFailedThumbnail: false }
                  : currentPage,
              ),
            )
            console.log(`[DeletePages] Page ${pageNumber} thumbnail generated successfully.`)
          } catch (pageErr) {
            console.error(`[DeletePages] Error rendering page ${pageNumber} thumbnail:`, pageErr)
            setPages((currentPages) =>
              currentPages.map((currentPage) =>
                currentPage.originalIndex === pageNumber - 1
                  ? { ...currentPage, hasFailedThumbnail: true }
                  : currentPage,
              ),
            )
          }
        }

        setThumbnailStatus('ready')
      } catch (err) {
        if (!cancelled) {
          console.error(`[DeletePages] Outer thumbnail generation failed:`, err)
          
          // Attempt fallback loading using pdf-lib to get the page count
          try {
            console.log('[DeletePages] Attempting fallback page count loading using pdf-lib...')
            const { PDFDocument } = await import('pdf-lib')
            const arrayBuffer = await file.arrayBuffer()
            const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
            const numPages = pdfDoc.getPageCount()
            console.log(`[DeletePages] Fallback loaded successfully. Page count: ${numPages}`)
            
            const fallbackPages = Array.from({ length: numPages }, (_item, index) => ({
              id: makePageId(index),
              originalIndex: index,
              thumbnailUrl: null,
              hasFailedThumbnail: true,
            }))
            setPages(fallbackPages)
            setThumbnailStatus('ready-fallback')
            setThumbnailError(`Could not load thumbnails on this device: ${err instanceof Error ? err.message : String(err)}. Standard grid mode activated.`)
          } catch (fallbackErr) {
            console.error(`[DeletePages] Fallback loading failed:`, fallbackErr)
            const message = err instanceof Error ? err.message : String(err)
            setThumbnailError(`Could not prepare pages: ${message}`)
            setThumbnailStatus('error')
          }
        }
      }
    }

    renderThumbnails()

    return () => {
      cancelled = true
      loadingTask?.destroy?.()
      pdf?.destroy?.()
      objectUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [file])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleFileChange(event) {
    clearOutput()
    setValidationMessage('')
    setPages([])
    setDeletedIds(new Set())
    setThumbnailStatus('idle')
    setThumbnailError(null)
    setFile(event.target.files?.[0] ?? null)
    setPreviewId(null)
  }

  const handleToggleMark = useCallback((id) => {
    setDeletedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    clearOutput()
  }, [clearOutput])

  function handleSelectAll() {
    setDeletedIds(new Set(pages.map((p) => p.id)))
    clearOutput()
  }

  function handleResetMarks() {
    setDeletedIds(new Set())
    setValidationMessage('')
    clearOutput()
  }

  function handleOpenPreview(id) {
    setPreviewId(id)
  }

  const handleClosePreview = useCallback(() => setPreviewId(null), [])
  const handleNavigatePreview = useCallback((id) => setPreviewId(id), [])

  async function handleDelete() {
    if (!file) {
      setValidationMessage('Choose a PDF file first.')
      return
    }
    if (pages.length === 0) {
      setValidationMessage('Wait for the pages to load first.')
      return
    }
    if (markedCount === 0) {
      setValidationMessage('Select at least one page to delete.')
      return
    }
    if (remainingCount === 0) {
      setValidationMessage('Cannot delete all pages — at least one page must remain.')
      return
    }

    const deletedIndexes = Array.from(deletedIds)
      .map((id) => pageById.get(id)?.originalIndex)
      .filter((idx) => typeof idx === 'number')
      .sort((a, b) => a - b)

    setValidationMessage('')

    try {
      const result = await deletePages(file, { deletedIndexes })
      if (result?.bytes) {
        setTrimmedBytes(result.bytes)
        const stem = file.name.replace(/\.pdf$/i, '') || 'document'
        setTrimmedFilename(`${stem}-trimmed.pdf`)
      }
    } catch {
      // Error is caught and surfaced via hook state
    }
  }

  const validationError = validationMessage || (thumbnailStatus === 'error' ? thumbnailError : null)

  const diagnosticsRows =
    isSuccess && diagnostics
      ? [
          { label: 'Original pages', value: diagnostics.originalPageCount },
          { label: 'Deleted pages', value: diagnostics.deletedPages },
          { label: 'Remaining pages', value: diagnostics.remainingPages },
          { label: 'Output size', value: `${diagnostics.outputSizeKB} KB` },
        ]
      : undefined

  return (
    <ToolPageLayout
      title="Delete Pages"
      description="Remove unwanted pages easily. Click on any page card to mark it for deletion. Click the thumbnail image to preview."
      onBack={onBack}
      minimal
    >
      {/* Controls panel */}
      <div className="mb-6 mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-subtle bg-surface-raised p-5">
        <div className="flex min-w-0 w-full flex-col gap-1.5 sm:flex-1 sm:min-w-[200px]">
          <span className="text-overline font-semibold uppercase tracking-wider text-accent">
            Choose PDF File
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={handleFileChange}
            className="block w-full cursor-pointer text-body-sm text-secondary file:mr-4 file:rounded-lg file:border-0 file:bg-accent/10 file:px-4 file:py-2 file:text-body-sm file:font-semibold file:text-accent file:transition-colors hover:file:bg-accent/20"
          />
        </div>

        {file && pages.length > 0 && (
          <div className="mt-4 flex items-center gap-3 sm:mt-auto">
            <Button
              variant="secondary"
              onClick={handleSelectAll}
              disabled={isLoading}
            >
              Select All
            </Button>
            <Button
              variant="secondary"
              onClick={handleResetMarks}
              disabled={markedCount === 0 || isLoading}
            >
              Reset
            </Button>
          </div>
        )}
      </div>

      {/* File info */}
      {file && (
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-border-subtle bg-surface-base p-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-sm font-semibold text-primary">{file.name}</p>
            <p className="mt-1 text-caption text-secondary">
              Size: {formatBytes(file.size)}
            </p>
          </div>
          <span className="inline-flex items-center rounded-md bg-accent/10 px-2.5 py-1 text-caption font-semibold text-accent">
            {pages.length > 0
              ? `${pages.length} pages total`
              : 'Preparing pages…'}
          </span>
        </div>
      )}

      {/* Thumbnail loader hint */}
      {isPreparingThumbnails && pages.length > 0 && (
        <p className="mb-4 text-caption text-secondary">
          Thumbnails are loading — you can start marking pages for deletion now.
        </p>
      )}

      {/* Instructions Tip */}
      {pages.length > 0 && !isPreparingThumbnails && (
        <p className="mb-4 flex items-center gap-1.5 text-caption text-secondary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Click a card to mark/unmark for deletion. Click the image to show a larger preview.
        </p>
      )}

      {/* Page grid */}
      {pages.length > 0 && (
        <div className="mb-28 mt-5">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] items-start gap-4">
            {pages.map((page, index) => (
              <PageCard
                key={page.id}
                page={page}
                position={index + 1}
                isMarked={deletedIds.has(page.id)}
                onToggleMark={handleToggleMark}
                onOpenPreview={handleOpenPreview}
              />
            ))}
          </div>
        </div>
      )}

      {/* Sticky Bottom Actions Bar */}
      {file && pages.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between border-t border-border bg-surface-base/90 px-4 py-4 shadow-[0_-10px_25px_rgba(0,0,0,0.05)] backdrop-blur-md sm:px-6">
          <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body-sm font-medium text-primary">
                {markedCount > 0 ? (
                  <>
                    Marked for deletion: <strong className="font-bold text-error">{markedCount}</strong> pages.
                    <span className="ml-2 text-caption text-secondary">({remainingCount} remaining)</span>
                  </>
                ) : (
                  'No pages marked for deletion.'
                )}
              </span>
              {markedCount > 0 && remainingCount === 0 && (
                <span className="rounded border border-error/20 bg-error/10 px-2 py-0.5 text-caption font-semibold text-error">
                  At least 1 page must remain.
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="inline-flex w-full items-center justify-center rounded-lg bg-error px-6 py-3 text-body-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-error-hover disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="size-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing…
                </span>
              ) : (
                `Delete ${markedCount > 0 ? `${markedCount} Page${markedCount > 1 ? 's' : ''}` : 'Pages'}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* Success state */}
      {isSuccess && diagnosticsRows && (
        <div className="mb-6 space-y-4">
          <div role="status" className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/6 p-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4" aria-hidden="true">
                <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-body-md font-semibold text-primary">Success! Pages deleted successfully.</p>
              {trimmedBytes && (
                <button
                  type="button"
                  onClick={() => downloadPdfBytes(trimmedBytes, trimmedFilename)}
                  className="mt-2 inline-flex items-center gap-1.5 text-body-sm font-medium text-accent transition-colors duration-fast hover:text-accent-hover"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" />
                    <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
                  </svg>
                  Download again
                </button>
              )}
            </div>
          </div>
          <DiagnosticsPanel rows={diagnosticsRows} />
        </div>
      )}

      {/* Warning Fallback Notice */}
      {thumbnailStatus === 'ready-fallback' && thumbnailError && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-warning/20 bg-warning-muted p-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-warning)" strokeWidth="2.5" className="mt-0.5 shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <p className="text-body-sm text-primary">{thumbnailError}</p>
        </div>
      )}

      {/* Errors */}
      {validationError && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-error/25 bg-error/5 p-4">
          <p className="text-body-sm text-primary">{validationError}</p>
        </div>
      )}
      {error && !validationError && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-error/25 bg-error/5 p-4">
          <p className="text-body-sm text-primary">{error}</p>
        </div>
      )}

      {/* Status indicator */}
      <div className="flex items-center justify-between border-t border-border-subtle pt-4">
        <span className="flex items-center gap-1.5 text-caption text-tertiary">
          Processed locally · no upload
        </span>
        <StatusBadge status={status} />
      </div>

      {/* Preview modal */}
      {previewId && (
        <PagePreviewModal
          orderedPages={pages}
          previewId={previewId}
          onClose={handleClosePreview}
          onNavigate={handleNavigatePreview}
        />
      )}
    </ToolPageLayout>
  )
}
