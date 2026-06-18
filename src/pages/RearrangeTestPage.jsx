import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePdfRearrange } from '../hooks/usePdfRearrange.js'
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

function countMovedPages(pageOrder, pageById) {
  return pageOrder.reduce((count, id, position) => {
    const page = pageById.get(id)
    return page?.originalIndex === position ? count : count + 1
  }, 0)
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
// PageCard
// ---------------------------------------------------------------------------

function PageCard({
  page,
  position,
  isOverlay = false,
  isSelected = false,
  onSelect,
  onMoveToStart,
  onMoveToEnd,
  onOpenPreview,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: page.id,
    disabled: isOverlay,
  })

  const containerStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    position: 'relative',
    borderRadius: 8,
    background: '#ffffff',
    boxShadow: isOverlay
      ? '0 20px 45px rgba(0, 0, 0, 0.15)'
      : isSelected
      ? '0 0 0 2px var(--color-accent), 0 4px 12px rgba(0,0,0,0.05)'
      : '0 1px 3px rgba(0, 0, 0, 0.1)',
    border: isOverlay
      ? '1.5px solid var(--color-accent)'
      : isSelected
      ? '1.5px solid var(--color-accent)'
      : '1px solid var(--color-border-subtle)',
    outline: 'none',
    cursor: isOverlay ? 'grabbing' : 'grab',
    touchAction: 'none',
    userSelect: 'none',
  }

  function handleArticleClick() {
    if (!onSelect) return
    onSelect(page.id)
  }

  function handleThumbnailClick(e) {
    e.stopPropagation()
    if (!page.thumbnailUrl) return
    if (onOpenPreview) onOpenPreview(page.id)
  }

  function handleMoveStart(e) {
    e.stopPropagation()
    if (onMoveToStart) onMoveToStart(page.id)
  }

  function handleMoveEnd(e) {
    e.stopPropagation()
    if (onMoveToEnd) onMoveToEnd(page.id)
  }

  return (
    <article
      ref={setNodeRef}
      style={containerStyle}
      {...attributes}
      {...listeners}
      onClick={isOverlay ? undefined : handleArticleClick}
      aria-label={`Page ${position}${isSelected ? ', selected' : ''}`}
      aria-pressed={isSelected}
    >
      {/* Thumbnail area */}
      <div
        className={cn(
          'relative grid min-h-[200px] place-items-center overflow-hidden bg-surface-raised',
          isSelected ? 'rounded-t-[7px]' : 'rounded-[7px]',
        )}
        style={{ cursor: page.thumbnailUrl && !isOverlay ? 'zoom-in' : undefined }}
        onClick={handleThumbnailClick}
        title={page.thumbnailUrl ? 'Click to preview' : undefined}
      >
        {page.thumbnailUrl ? (
          <img
            src={page.thumbnailUrl}
            alt={`Page ${position} thumbnail`}
            draggable="false"
            className="block w-full h-full object-contain select-none"
          />
        ) : (
          <div className="w-[72%] h-[78%] rounded bg-gradient-to-b from-surface-muted to-surface-base" />
        )}

        {/* Page number badge */}
        <span
          className={cn(
            'absolute left-2 top-2 min-w-[26px] rounded-full px-1.5 text-center text-[11px] font-bold leading-[22px] text-white transition-colors',
            isSelected ? 'bg-accent' : 'bg-primary/80',
          )}
        >
          {position}
        </span>

        {/* Preview hint — top-right eye icon, only when thumbnail ready */}
        {page.thumbnailUrl && !isOverlay && (
          <span
            className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-md bg-primary/60 text-white/90 pointer-events-none"
            title="Click to preview"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
        )}
      </div>

      {/* Quick-action bar — only when selected and not overlay */}
      {isSelected && !isOverlay && (
        <div
          className="flex items-center justify-center gap-1 border-t border-accent/20 bg-accent/5 p-1.5 rounded-b-[7px]"
          onClick={(e) => e.stopPropagation()}
        >
          <ActionBtn
            onClick={handleMoveStart}
            title="Move to first position"
            ariaLabel={`Move page ${position} to start`}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M2 3v10M5 8h9M5 8L8 5M5 8l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Start
          </ActionBtn>

          <div className="h-4 w-px bg-accent/20" />

          <ActionBtn
            onClick={handleMoveEnd}
            title="Move to last position"
            ariaLabel={`Move page ${position} to end`}
          >
            End
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M14 3v10M11 8H2M11 8L8 5M11 8l-3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </ActionBtn>
        </div>
      )}
    </article>
  )
}

function ActionBtn({ children, onClick, title, ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-md border border-accent/20 bg-accent/10 px-2 py-1 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/20"
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function RearrangeTestPage({ onBack }) {
  const [file, setFile] = useState(null)
  const [pages, setPages] = useState([])
  const [pageOrder, setPageOrder] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [previewId, setPreviewId] = useState(null)
  const [thumbnailStatus, setThumbnailStatus] = useState('idle')
  const [thumbnailError, setThumbnailError] = useState(null)
  const [validationMessage, setValidationMessage] = useState('')
  const [rearrangedBytes, setRearrangedBytes] = useState(null)
  const [rearrangedFilename, setRearrangedFilename] = useState('')

  const {
    rearrange,
    reset,
    status,
    error,
    diagnostics,
    isLoading,
    isSuccess,
  } = usePdfRearrange()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  )

  const pageById = useMemo(
    () => new Map(pages.map((page) => [page.id, page])),
    [pages],
  )

  const orderedPages = pageOrder.map((id) => pageById.get(id)).filter(Boolean)
  const activePage = activeId ? pageById.get(activeId) : null
  const activePosition = activeId ? pageOrder.indexOf(activeId) + 1 : 0
  const movedPages = countMovedPages(pageOrder, pageById)
  const isPreparingThumbnails = thumbnailStatus === 'loading'
  const canSave = Boolean(file && pageOrder.length > 0 && !isLoading)

  // Reset helper — clears download state
  const clearOutput = useCallback(() => {
    reset()
    setRearrangedBytes(null)
    setRearrangedFilename('')
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
      setPageOrder([])
      setThumbnailStatus('loading')
      setThumbnailError(null)

      try {
        const pdfjs = await import('pdfjs-dist')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()

        const arrayBuffer = await file.arrayBuffer()
        loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) })
        pdf = await loadingTask.promise

        if (cancelled) return

        const initialPages = Array.from({ length: pdf.numPages }, (_item, index) => ({
          id: makePageId(index),
          originalIndex: index,
          thumbnailUrl: null,
        }))
        setPages(initialPages)
        setPageOrder(initialPages.map((page) => page.id))

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          if (cancelled) return

          const page = await pdf.getPage(pageNumber)
          const baseViewport = page.getViewport({ scale: 1 })
          const scale = THUMBNAIL_WIDTH / baseViewport.width
          const viewport = page.getViewport({ scale })
          const canvas = document.createElement('canvas')
          canvas.width = Math.ceil(viewport.width)
          canvas.height = Math.ceil(viewport.height)
          const context = canvas.getContext('2d')

          if (!context) throw new Error(`Could not render sheet ${pageNumber}.`)

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
                ? { ...currentPage, thumbnailUrl }
                : currentPage,
            ),
          )
        }

        setThumbnailStatus('ready')
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          setThumbnailError(`Could not prepare thumbnails: ${message}`)
          setThumbnailStatus('error')
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
    setPageOrder([])
    setThumbnailStatus('idle')
    setThumbnailError(null)
    setFile(event.target.files?.[0] ?? null)
    setSelectedId(null)
    setPreviewId(null)
  }

  function handleDragStart(event) {
    setActiveId(event.active.id)
    setSelectedId(null)
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    setPageOrder((items) => {
      const oldIndex = items.indexOf(active.id)
      const newIndex = items.indexOf(over.id)
      if (oldIndex === -1 || newIndex === -1) return items
      return arrayMove(items, oldIndex, newIndex)
    })
    clearOutput()
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  function handleCardSelect(id) {
    setSelectedId((prev) => (prev === id ? null : id))
  }

  function handleMoveToStart(id) {
    setPageOrder((prev) => {
      const idx = prev.indexOf(id)
      if (idx <= 0) return prev
      return [id, ...prev.filter((x) => x !== id)]
    })
    setSelectedId(null)
    clearOutput()
  }

  function handleMoveToEnd(id) {
    setPageOrder((prev) => {
      const idx = prev.indexOf(id)
      if (idx === prev.length - 1) return prev
      return [...prev.filter((x) => x !== id), id]
    })
    setSelectedId(null)
    clearOutput()
  }

  function handleOpenPreview(id) {
    setPreviewId(id)
    setSelectedId(null)
  }

  const handleClosePreview = useCallback(() => setPreviewId(null), [])
  const handleNavigatePreview = useCallback((id) => setPreviewId(id), [])

  function handleResetOrder() {
    setPageOrder(pages.map((page) => page.id))
    setValidationMessage('')
    setSelectedId(null)
    clearOutput()
  }

  async function handleSave() {
    if (!file) {
      setValidationMessage('Choose a PDF file to rearrange.')
      return
    }
    if (pageOrder.length === 0) {
      setValidationMessage('Wait for the pages to appear before saving.')
      return
    }

    const orderedPageIndexes = pageOrder.map((id) => pageById.get(id)?.originalIndex)

    if (orderedPageIndexes.some((index) => !Number.isInteger(index))) {
      setValidationMessage('Page order is not ready yet.')
      return
    }

    setValidationMessage('')

    try {
      const result = await rearrange(file, { orderedPageIndexes })
      if (result?.bytes) {
        setRearrangedBytes(result.bytes)
        const stem = file.name.replace(/\.pdf$/i, '') || 'document'
        setRearrangedFilename(`${stem}-rearranged.pdf`)
      }
    } catch {
      // Error surfaced via hook `error` state
    }
  }

  const validationError = validationMessage || thumbnailError

  const diagnosticsRows =
    isSuccess && diagnostics
      ? [
          { label: 'Page count', value: diagnostics.pageCount },
          { label: 'Moved pages', value: diagnostics.movedPages },
          { label: 'Output size', value: `${diagnostics.outputSizeKB} KB` },
          { label: 'Time taken', value: `${diagnostics.processingTimeMs} ms` },
        ]
      : undefined

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <ToolPageLayout
      title="Rearrange Pages"
      description="Drag pages into order, or click a tile to reveal quick-move actions. Click a thumbnail to preview the page at full size."
      onBack={onBack}
      minimal
    >
      {/* Controls panel */}
      <div className="mb-6 mt-6 flex flex-wrap items-center gap-4 rounded-xl border border-border-subtle bg-surface-raised p-5">
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

        <div className="flex w-full items-center gap-3 sm:w-auto sm:mt-auto">
          <Button
            variant="secondary"
            onClick={handleResetOrder}
            disabled={!pageOrder.length || isLoading}
          >
            Reset Order
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!canSave}
            loading={isLoading}
          >
            {isLoading ? 'Processing…' : 'Download PDF'}
          </Button>
        </div>
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
              ? `${pages.length} pages${movedPages ? ` · ${movedPages} moved` : ''}`
              : 'Preparing pages…'}
          </span>
        </div>
      )}

      {/* Thumbnail hint */}
      {isPreparingThumbnails && pages.length > 0 && (
        <p className="mb-4 text-caption text-secondary">
          Thumbnails are loading — you can start arranging now.
        </p>
      )}

      {/* Tip bar */}
      {orderedPages.length > 0 && !isPreparingThumbnails && (
        <p className="mb-4 flex items-center gap-1.5 text-caption text-secondary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Click a tile to select it and reveal <strong className="font-semibold text-primary">Start / End</strong> shortcuts.
          Click a thumbnail to <strong className="font-semibold text-primary">preview</strong> the page.
        </p>
      )}

      {/* Page grid */}
      {orderedPages.length > 0 && (
        <div className="mb-8">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={pageOrder} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] items-start gap-4">
                {orderedPages.map((page, index) => (
                  <PageCard
                    key={page.id}
                    page={page}
                    position={index + 1}
                    isSelected={selectedId === page.id}
                    isDraggingAny={activeId !== null}
                    onSelect={handleCardSelect}
                    onMoveToStart={handleMoveToStart}
                    onMoveToEnd={handleMoveToEnd}
                    onOpenPreview={handleOpenPreview}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activePage ? (
                <div className="w-44">
                  <PageCard
                    page={activePage}
                    position={activePosition}
                    isOverlay
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
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
              <p className="text-body-md font-semibold text-primary">Success! Rearranged PDF is ready.</p>
              {rearrangedBytes && (
                <button
                  type="button"
                  onClick={() => downloadPdfBytes(rearrangedBytes, rearrangedFilename)}
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

      {/* Status Footer */}
      <div className="flex items-center justify-between border-t border-border-subtle pt-4">
        <span className="flex items-center gap-1.5 text-caption text-tertiary">
          Processed locally · no upload
        </span>
        <StatusBadge status={status} />
      </div>

      {/* Preview modal */}
      {previewId && (
        <PagePreviewModal
          orderedPages={orderedPages}
          previewId={previewId}
          onClose={handleClosePreview}
          onNavigate={handleNavigatePreview}
        />
      )}
    </ToolPageLayout>
  )
}
