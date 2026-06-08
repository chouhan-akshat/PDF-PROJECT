export default function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-border/80 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:h-16 sm:px-6">
        <a
          href="/"
          className="text-base font-semibold tracking-tight text-white sm:text-lg"
        >
          PDF Studio
        </a>
        <span className="rounded-full border border-border bg-surface-muted px-2.5 py-0.5 text-xs text-muted sm:px-3 sm:text-sm">
          Client-side
        </span>
      </div>
    </header>
  )
}
