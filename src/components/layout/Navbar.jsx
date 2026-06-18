import { useEffect, useRef, useState } from 'react'
import { getToolsByCategory } from '../../constants/tools.js'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'
import { cn } from '../../utils/cn.js'
import LockIcon from '../icons/LockIcon.jsx'
import logoImg from '../../assets/logo.png'

function ChevronIcon({ className, open }) {
  return (
    <svg
      className={cn(
        className,
        'transition-transform duration-fast',
        open && 'rotate-180',
      )}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MenuIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  )
}

function XIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  )
}

/* Quick-access tool ids shown as direct nav links */
const QUICK_LINKS = ['merge-test', 'split-test', 'compress-test', 'rotate-test']

export default function Navbar({ currentPage = 'home', onNavigate }) {
  const [toolsOpen, setToolsOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const toolsRef = useRef(null)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const toolGroups = getToolsByCategory()

  /* Flatten all tools for quick-link lookup */
  const allTools = toolGroups.flatMap((g) => g.tools)
  const quickLinks = QUICK_LINKS.map((id) => allTools.find((t) => t.id === id)).filter(Boolean)

  useEffect(() => {
    function handleClickOutside(event) {
      if (toolsRef.current && !toolsRef.current.contains(event.target)) {
        setToolsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function navigate(pageId) {
    onNavigate?.(pageId)
    setToolsOpen(false)
    setMobileOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border-subtle bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-content-max items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        {/* Logo */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            id="nav-logo"
            onClick={() => navigate('home')}
            className="flex items-center group overflow-hidden"
          >
            <img src={logoImg} alt="HeyPDF Logo" className="h-10 sm:h-12 w-auto object-contain" />
          </button>
        </div>

        {/* Center nav — desktop quick links + Tools dropdown */}
        {onNavigate && (
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Main navigation"
          >
            {quickLinks.map((tool) => (
              <button
                key={tool.id}
                type="button"
                onClick={() => navigate(tool.id)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors duration-fast',
                  currentPage === tool.id
                    ? 'bg-accent/10 text-accent'
                    : 'text-secondary hover:bg-surface-overlay hover:text-primary',
                )}
              >
                {tool.name}
              </button>
            ))}

            {/* Tools dropdown */}
            <div className="relative" ref={toolsRef}>
              <button
                type="button"
                id="nav-tools-dropdown"
                aria-expanded={toolsOpen}
                aria-haspopup="true"
                onClick={() => setToolsOpen((open) => !open)}
                className={cn(
                  'flex items-center gap-1 rounded-md px-3 py-1.5 text-body-sm font-medium transition-colors duration-fast',
                  toolsOpen
                    ? 'bg-surface-overlay text-primary'
                    : 'text-secondary hover:bg-surface-overlay hover:text-primary',
                )}
              >
                More Tools
                <ChevronIcon className="size-3.5" open={toolsOpen} />
              </button>

              {toolsOpen && (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] w-72 overflow-hidden rounded-xl border border-border-subtle bg-white py-2 shadow-lg">
                  {toolGroups.map((group) => (
                    <div key={group.id} className="px-2 py-1">
                      <p className="px-2 py-1 text-overline font-semibold uppercase tracking-wider text-tertiary">
                        {group.label}
                      </p>
                      <ul>
                        {group.tools.map((tool) => (
                          <li key={tool.id}>
                            <button
                              type="button"
                              onClick={() => navigate(tool.id)}
                              className={cn(
                                'w-full rounded-lg px-3 py-2 text-left text-body-sm transition-colors duration-fast',
                                currentPage === tool.id
                                  ? 'bg-accent/10 font-medium text-accent'
                                  : 'text-secondary hover:bg-surface-overlay hover:text-primary',
                              )}
                            >
                              {tool.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </nav>
        )}

        {/* Right — trust badge + mobile menu */}
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 rounded-full border border-border-subtle bg-success/8 px-3 py-1 text-caption font-medium text-success sm:inline-flex">
            <LockIcon className="size-3 shrink-0" />
            100% Local Processing
          </span>

          {onNavigate && (
            <button
              type="button"
              id="nav-mobile-toggle"
              className="flex size-9 items-center justify-center rounded-lg text-secondary transition-colors duration-fast hover:bg-surface-overlay hover:text-primary md:hidden"
              aria-expanded={mobileOpen}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? (
                <XIcon className="size-5" />
              ) : (
                <MenuIcon className="size-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && !isDesktop && onNavigate && (
        <div className="border-t border-border-subtle bg-white md:hidden">
          <div className="mx-auto max-w-content-max px-4 py-4 sm:px-6">
            <p className="mb-4 flex items-center gap-1.5 text-caption font-medium text-success">
              <LockIcon className="size-3.5" />
              100% Local Processing — files never leave your device
            </p>

            {toolGroups.map((group) => (
              <div key={group.id} className="mb-4 last:mb-0">
                <p className="mb-1.5 text-overline font-semibold uppercase tracking-wider text-tertiary">
                  {group.label}
                </p>
                <ul className="space-y-0.5">
                  {group.tools.map((tool) => (
                    <li key={tool.id}>
                      <button
                        type="button"
                        onClick={() => navigate(tool.id)}
                        className={cn(
                          'w-full rounded-lg px-3 py-2.5 text-left text-body-sm transition-colors duration-fast',
                          currentPage === tool.id
                            ? 'bg-accent/10 font-medium text-accent'
                            : 'text-secondary hover:bg-surface-overlay hover:text-primary',
                        )}
                      >
                        {tool.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </header>
  )
}
