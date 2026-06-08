export default function HomePage({
  onOpenMergeTest,
  onOpenImageToPdfTest,
  onOpenNotesCleanerTest,
}) {
  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-wider text-accent">
          PDF tools
        </p>
        <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
          Process PDFs privately in your browser
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
          A fast, lightweight workspace built for client-side PDF handling. Heavy
          work will run in Web Workers so the UI stays responsive.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-border bg-surface-elevated p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Web Workers</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
            PDF parsing and transforms stay off the main thread via dedicated
            workers in <code className="text-accent">src/workers/</code>.
          </p>
        </article>
        <article className="rounded-xl border border-border bg-surface-elevated p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-white">Performance first</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">
            Vite code-splitting, vendor chunks, and lazy routes keep initial load
            small as features grow.
          </p>
        </article>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-surface-muted/50 p-8 text-center sm:p-12">
        <p className="text-sm text-muted sm:text-base">
          PDF merge runs in a Web Worker via pdf-lib.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {onOpenMergeTest && (
            <button
              type="button"
              onClick={onOpenMergeTest}
              className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover"
            >
              Open merge test
            </button>
          )}
          {onOpenImageToPdfTest && (
            <button
              type="button"
              onClick={onOpenImageToPdfTest}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-surface-muted px-5 py-2.5 text-sm font-medium text-white hover:bg-surface-elevated"
            >
              Open image to PDF test
            </button>
          )}
          {onOpenNotesCleanerTest && (
            <button
              type="button"
              onClick={onOpenNotesCleanerTest}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-surface-muted px-5 py-2.5 text-sm font-medium text-white hover:bg-surface-elevated"
            >
              Open notes cleaner test
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
