import { cn } from '../../utils/cn.js'
import Button from '../ui/Button.jsx'
import UploadZone from '../ui/UploadZone.jsx'
import StatusBadge from '../ui/StatusBadge.jsx'
import DiagnosticsPanel from '../ui/DiagnosticsPanel.jsx'
import LockIcon from '../icons/LockIcon.jsx'

/* ── Sub-components ──────────────────────────────────────────────────────── */

function BackButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md text-body-sm font-medium text-secondary',
        'transition-colors duration-fast hover:text-primary',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="size-4 shrink-0"
        aria-hidden="true"
      >
        <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      All tools
    </button>
  )
}

function SuccessBanner({ message, onDownload }) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/6 p-4"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="size-4"
          aria-hidden="true"
        >
          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body-md font-semibold text-primary">{message}</p>
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="mt-2 inline-flex items-center gap-1.5 text-body-sm font-medium text-accent hover:text-accent-hover transition-colors duration-fast"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="size-3.5"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" />
              <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
            </svg>
            Download again
          </button>
        )}
      </div>
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-error/25 bg-error/5 p-4"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-error/15 text-error">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="size-4"
          aria-hidden="true"
        >
          <path
            d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            strokeLinejoin="round"
          />
          <path d="M12 9v4M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <p className="pt-1 text-body-sm text-primary">{message}</p>
    </div>
  )
}

/* ── ToolPageLayout ───────────────────────────────────────────────────────── */

/**
 * Unified shell for all PDF tool pages.
 *
 * Normal mode  — renders header → upload zone → options → children → action
 *                → success banner → diagnostics → error → status footer.
 *
 * Minimal mode — renders header only, then passes all children through.
 *                Used by complex pages (Rearrange, Delete) that own their own
 *                upload, action, success, error, and status UI.
 *
 * @param {{
 *   // Header
 *   title: string
 *   description?: string
 *   onBack?: () => void
 *
 *   // Upload (normal mode)
 *   accept?: string
 *   multiple?: boolean
 *   file?: File | null
 *   files?: File[]
 *   onFileSelect?: (f: File | File[]) => void
 *   onFileClear?: () => void
 *   uploadLabel?: string
 *   uploadHint?: string
 *   uploadAcceptLabel?: string
 *
 *   // Options slot (normal mode — rendered between upload and action)
 *   options?: React.ReactNode
 *
 *   // Action (normal mode)
 *   actionLabel?: string
 *   actionLoadingLabel?: string
 *   onAction?: () => void
 *   actionDisabled?: boolean
 *   isLoading?: boolean
 *
 *   // States (normal mode)
 *   isSuccess?: boolean
 *   successMessage?: string
 *   onDownload?: () => void
 *   error?: string | null
 *   validationError?: string
 *   status?: string
 *
 *   // Diagnostics (normal mode)
 *   diagnostics?: Array<{ label: string, value: string|number }>
 *
 *   // Layout
 *   minimal?: boolean
 *   children?: React.ReactNode
 * }} props
 */
export default function ToolPageLayout({
  /* Header */
  title,
  description,
  onBack,
  /* Upload */
  accept,
  multiple = false,
  file = null,
  files = [],
  onFileSelect,
  onFileClear,
  uploadLabel = 'Drop your file here',
  uploadHint,
  uploadAcceptLabel,
  /* Options slot */
  options,
  /* Action */
  actionLabel = 'Process & Download',
  actionLoadingLabel,
  onAction,
  actionDisabled = false,
  isLoading = false,
  /* States */
  isSuccess = false,
  successMessage = 'Done — download started.',
  onDownload,
  error = null,
  validationError,
  status = 'idle',
  /* Diagnostics */
  diagnostics,
  /* Layout */
  minimal = false,
  children,
}) {
  const displayError = validationError || error

  return (
    <div className={cn(minimal ? 'w-full' : 'w-full max-w-2xl')}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className={cn(!minimal && 'mb-6')}>
        {onBack && (
          <div className="mb-3">
            <BackButton onClick={onBack} />
          </div>
        )}
        <h1 className="text-display-sm text-primary">{title}</h1>
        {description && (
          <p className="mt-2 max-w-prose text-body-lg leading-relaxed text-secondary">
            {description}
          </p>
        )}
      </div>

      {/* ── Minimal mode: full control to children ────────────────── */}
      {minimal ? (
        children
      ) : (
        <div className="space-y-5">
          {/* Upload zone */}
          {onFileSelect && (
            <UploadZone
              accept={accept}
              multiple={multiple}
              disabled={isLoading}
              file={!multiple ? file : null}
              files={multiple ? files : []}
              onFileSelect={onFileSelect}
              onClear={onFileClear}
              label={uploadLabel}
              hint={uploadHint}
              acceptLabel={uploadAcceptLabel}
            />
          )}

          {/* Options slot */}
          {options && (
            <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
              {options}
            </div>
          )}

          {/* Extra content (page-level additions, e.g. page-count input) */}
          {children}

          {/* Action button */}
          {onAction && (
            <div>
              <Button
                variant="primary"
                size="lg"
                type="button"
                disabled={actionDisabled}
                loading={isLoading}
                onClick={onAction}
                className="w-full sm:w-auto"
              >
                {isLoading
                  ? (actionLoadingLabel ?? actionLabel)
                  : actionLabel}
              </Button>
            </div>
          )}

          {/* Success banner */}
          {isSuccess && (
            <SuccessBanner message={successMessage} onDownload={onDownload} />
          )}

          {/* Diagnostics */}
          {isSuccess && diagnostics && diagnostics.length > 0 && (
            <DiagnosticsPanel rows={diagnostics} />
          )}

          {/* Error / validation banner */}
          {displayError && <ErrorBanner message={displayError} />}

          {/* Status footer */}
          <div className="flex items-center justify-between border-t border-border-subtle pt-4">
            <span className="flex items-center gap-1.5 text-caption text-tertiary">
              <LockIcon className="size-3 text-success" aria-hidden="true" />
              Processed locally · no upload
            </span>
            <StatusBadge status={status} />
          </div>
        </div>
      )}
    </div>
  )
}
