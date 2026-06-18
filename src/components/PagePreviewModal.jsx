import { useEffect, useRef } from 'react'

function NavButton({ disabled, onClick, 'aria-label': ariaLabel, reverse, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 8,
        border: '1px solid rgba(148, 163, 184, 0.18)',
        background: disabled ? 'transparent' : 'rgba(148, 163, 184, 0.08)',
        color: disabled ? 'rgba(148, 163, 184, 0.3)' : '#cbd5e1',
        fontSize: 13,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexDirection: reverse ? 'row-reverse' : 'row',
      }}
    >
      {children}
    </button>
  )
}

export default function PagePreviewModal({ orderedPages, previewId, onClose, onNavigate }) {
  const currentIndex = orderedPages.findIndex((p) => p.id === previewId)
  const page = orderedPages[currentIndex]
  const total = orderedPages.length
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < total - 1
  const backdropRef = useRef(null)

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(orderedPages[currentIndex - 1].id)
      if (e.key === 'ArrowRight' && hasNext) onNavigate(orderedPages[currentIndex + 1].id)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, onNavigate, hasPrev, hasNext, currentIndex, orderedPages])

  // Prevent body scroll while modal open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  if (!page) return null

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current) onClose()
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of page ${currentIndex + 1}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.80)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: '16px',
      }}
    >
      {/* Modal card */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: '#0d1117',
          border: '1px solid rgba(148, 163, 184, 0.18)',
          borderRadius: 16,
          boxShadow: '0 32px 80px rgba(0,0,0,0.65)',
          maxWidth: 'min(700px, 96vw)',
          width: '100%',
          maxHeight: '92vh',
          overflow: 'hidden',
          padding: '0',
        }}
      >
        {/* Header bar */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid rgba(148, 163, 184, 0.12)',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#94a3b8',
              letterSpacing: '0.02em',
            }}
          >
            Page{' '}
            <span style={{ color: '#ffffff', fontSize: 15 }}>{currentIndex + 1}</span>
            {' '}
            <span style={{ opacity: 0.5 }}>/ {total}</span>
          </span>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid rgba(148, 163, 184, 0.18)',
              background: 'rgba(148, 163, 184, 0.08)',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
              e.currentTarget.style.color = '#ef4444'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(148, 163, 184, 0.08)'
              e.currentTarget.style.color = '#94a3b8'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Page image */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'auto',
            padding: '24px',
            background: '#f8fafc',
            width: '100%',
          }}
        >
          {page.thumbnailUrl ? (
            <img
              src={page.thumbnailUrl}
              alt={`Page ${currentIndex + 1}`}
              draggable="false"
              style={{
                maxHeight: 'calc(92vh - 140px)',
                maxWidth: '100%',
                objectFit: 'contain',
                borderRadius: 4,
                boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
                userSelect: 'none',
              }}
            />
          ) : (
            <div
              style={{
                width: 320,
                height: 420,
                borderRadius: 4,
                background: 'linear-gradient(180deg, #e5e7eb 0%, #f8fafc 45%, #e5e7eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: '#94a3b8', fontSize: 13 }}>Loading preview…</span>
            </div>
          )}
        </div>

        {/* Navigation footer */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderTop: '1px solid rgba(148, 163, 184, 0.12)',
            background: '#0d1117',
            flexShrink: 0,
            gap: 8,
          }}
        >
          <NavButton
            onClick={() => hasPrev && onNavigate(orderedPages[currentIndex - 1].id)}
            disabled={!hasPrev}
            aria-label="Previous page"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Prev</span>
          </NavButton>

          {/* Page dots / counter */}
          <span style={{ fontSize: 12, color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
            {currentIndex + 1} / {total}
          </span>

          <NavButton
            onClick={() => hasNext && onNavigate(orderedPages[currentIndex + 1].id)}
            disabled={!hasNext}
            aria-label="Next page"
            reverse
          >
            <span>Next</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </NavButton>
        </div>
      </div>
    </div>
  )
}
