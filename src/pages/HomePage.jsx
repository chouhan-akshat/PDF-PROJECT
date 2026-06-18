import { useRef } from 'react'
import { TOOLS } from '../constants/tools.js'
import Button from '../components/ui/Button.jsx'
import ToolCard from '../components/ui/ToolCard.jsx'
import LockIcon from '../components/icons/LockIcon.jsx'

/* ── Tool IDs for the popular section ─────────────────────────────────────── */
const POPULAR_TOOL_IDS = [
  'merge-test',
  'compress-test',
  'notes-cleaner-test',
  'rearrange-test',
]

/* ── Why PDF Studio feature data ──────────────────────────────────────────── */
const FEATURES = [
  {
    id: 'client-side',
    icon: <ClientSideIcon />,
    title: '100% Client-Side',
    description:
      'All processing runs inside your browser using WebAssembly. Nothing is sent to a server.',
  },
  {
    id: 'no-uploads',
    icon: <NoUploadIcon />,
    title: 'No Uploads',
    description:
      'Your files never leave your device. No servers receive, store, or log your documents.',
  },
  {
    id: 'privacy-first',
    icon: <PrivacyIcon />,
    title: 'Privacy First',
    description:
      'No accounts. No tracking. Work on sensitive PDFs with complete confidence.',
  },
]

/* ── Feature SVG icons ────────────────────────────────────────────────────── */
function ClientSideIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
      <path d="M7 10l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function NoUploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        d="M3 15v2a4 4 0 004 4h10a4 4 0 004-4v-2"
        strokeLinecap="round"
      />
      <path d="M3 3l18 18" strokeLinecap="round" />
      <path d="M12 3v9" strokeLinecap="round" />
      <path d="M9 9l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PrivacyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        d="M12 2L4 6v6c0 5.5 3.5 10.7 8 12 4.5-1.3 8-6.5 8-12V6l-8-4z"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ── PDF illustration for hero ────────────────────────────────────────────── */
function PdfIllustration() {
  return (
    <div className="relative flex items-center justify-center" aria-hidden="true">
      {/* Stack of document cards */}
      <div className="relative w-44 h-52 sm:w-52 sm:h-60">
        {/* Back card */}
        <div className="absolute bottom-0 right-0 w-36 h-44 sm:w-44 sm:h-52 rounded-xl border border-border bg-surface-raised shadow-sm rotate-6" />
        {/* Mid card */}
        <div className="absolute bottom-2 right-2 w-36 h-44 sm:w-44 sm:h-52 rounded-xl border border-border bg-white shadow-md rotate-2" />
        {/* Front card */}
        <div className="absolute bottom-4 right-4 w-36 h-44 sm:w-44 sm:h-52 rounded-xl border border-border-subtle bg-white shadow-lg p-4 flex flex-col gap-2.5">
          {/* PDF header */}
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-accent text-white">
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4">
                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
              </svg>
            </div>
            <div className="h-2 w-16 rounded-full bg-surface-overlay" />
          </div>
          {/* Content lines */}
          <div className="space-y-1.5 mt-1">
            <div className="h-1.5 w-full rounded-full bg-surface-overlay" />
            <div className="h-1.5 w-5/6 rounded-full bg-surface-overlay" />
            <div className="h-1.5 w-4/6 rounded-full bg-surface-overlay" />
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-surface-overlay" />
            <div className="h-1.5 w-3/4 rounded-full bg-surface-overlay" />
          </div>
          {/* Success badge */}
          <div className="mt-auto flex items-center gap-1.5 rounded-lg bg-success/10 px-2 py-1.5">
            <div className="size-2 rounded-full bg-success" />
            <div className="h-1.5 w-12 rounded-full bg-success/40" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  HomePage V2                                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */
export default function HomePage({
  onOpenMergeTest,
  onOpenImageToPdfTest,
  onOpenNotesCleanerTest,
  onOpenCompressTest,
  onOpenSplitTest,
  onOpenRotateTest,
  onOpenRearrangeTest,
  onOpenDeletePagesTest,
}) {
  const allToolsRef = useRef(null)

  /* Map tool id → handler */
  const toolHandlers = {
    'merge-test': onOpenMergeTest,
    'image-to-pdf-test': onOpenImageToPdfTest,
    'notes-cleaner-test': onOpenNotesCleanerTest,
    'compress-test': onOpenCompressTest,
    'split-test': onOpenSplitTest,
    'rotate-test': onOpenRotateTest,
    'rearrange-test': onOpenRearrangeTest,
    'delete-pages-test': onOpenDeletePagesTest,
  }

  const popularTools = TOOLS.filter((t) => POPULAR_TOOL_IDS.includes(t.id))

  function scrollToAllTools() {
    allToolsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-12 pb-4 sm:space-y-16">

      {/* ── Section 1 · Hero ──────────────────────────────────────────────── */}
      <section
        aria-labelledby="hero-headline"
        className="-mx-4 -mt-8 sm:-mx-6 sm:-mt-12"
      >
        <div
          className="px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14"
          style={{
            background:
              'linear-gradient(180deg, #f0f5ff 0%, #ffffff 100%)',
          }}
        >
          <div className="mx-auto max-w-content-max">
            <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: text content */}
              <div className="flex max-w-[38rem] flex-col gap-5">
                {/* Eyebrow */}
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/8 px-3 py-1 text-caption font-semibold text-success">
                    <LockIcon className="size-3 shrink-0" />
                    No uploads · 100% local processing
                  </span>
                </div>

                <h1
                  id="hero-headline"
                  className="text-display-md text-primary sm:text-display-lg"
                >
                  Every PDF tool you need.{' '}
                  <span className="text-accent">Right in your browser.</span>
                </h1>

                <p className="text-body-lg leading-relaxed text-secondary">
                  Merge, split, compress, rotate, rearrange and clean PDFs in
                  seconds. Everything happens locally on your device.
                </p>

                {/* CTA buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    id="hero-cta-primary"
                    variant="primary"
                    size="lg"
                    onClick={onOpenMergeTest}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    >
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" />
                      <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" />
                    </svg>
                    Choose PDF
                  </Button>
                  <Button
                    id="hero-cta-browse"
                    variant="secondary"
                    size="lg"
                    onClick={scrollToAllTools}
                  >
                    Browse Tools
                  </Button>
                </div>

                {/* Trust line */}
                <p className="text-body-sm text-secondary">
                  <LockIcon className="mr-1.5 inline size-3.5 text-success" />
                  Your files never leave your device. No uploads. No storage. No tracking.
                </p>
              </div>

              {/* Right: PDF illustration — hidden on small screens */}
              <div className="hidden lg:flex lg:shrink-0">
                <PdfIllustration />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2 · Popular Tools ─────────────────────────────────────── */}
      <section
        aria-labelledby="popular-heading"
        className="mx-auto w-full max-w-content-max"
      >
        <div className="mb-5">
          <p className="text-overline font-semibold uppercase tracking-widest text-accent mb-1">
            Popular
          </p>
          <h2
            id="popular-heading"
            className="text-display-sm text-primary"
          >
            Most-used tools
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {popularTools.map((tool) => (
            <ToolCard
              key={tool.id}
              name={tool.name}
              description={tool.description}
              category={tool.category}
              onClick={toolHandlers[tool.id]}
            />
          ))}
        </div>
      </section>

      {/* ── Section 3 · All Tools ─────────────────────────────────────────── */}
      <section
        aria-labelledby="all-tools-heading"
        ref={allToolsRef}
        className="mx-auto w-full max-w-content-max scroll-mt-20"
      >
        <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 py-8 sm:py-10 rounded-2xl"
          style={{ background: '#f8fafc' }}>
          <div className="mb-6">
            <p className="text-overline font-semibold uppercase tracking-widest text-accent mb-1">
              All Tools
            </p>
            <h2
              id="all-tools-heading"
              className="text-display-sm text-primary"
            >
              Everything in PDF Studio
            </h2>
            <p className="mt-1.5 text-body-lg text-secondary">
              Pick a tool and get started — no sign-up, no account, no upload.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {TOOLS.map((tool) => (
              <ToolCard
                key={tool.id}
                name={tool.name}
                description={tool.description}
                category={tool.category}
                onClick={toolHandlers[tool.id]}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 4 · Why PDF Studio ───────────────────────────────────── */}
      <section
        aria-labelledby="why-heading"
        className="mx-auto w-full max-w-content-max"
      >
        <div className="mb-6">
          <p className="text-overline font-semibold uppercase tracking-widest text-accent mb-1">
            Why PDF Studio
          </p>
          <h2
            id="why-heading"
            className="text-display-sm text-primary"
          >
            Built for privacy, by design.
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.id} {...feature} />
          ))}
        </div>
      </section>
    </div>
  )
}

/* ── Feature card ─────────────────────────────────────────────────────────── */
function FeatureCard({ icon, title, description }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-white p-6 shadow-sm">
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-accent/10 text-accent [&>svg]:size-5">
        {icon}
      </div>
      <h3 className="text-heading-md font-semibold text-primary">{title}</h3>
      <p className="mt-2 text-body-md leading-relaxed text-secondary">
        {description}
      </p>
    </div>
  )
}
