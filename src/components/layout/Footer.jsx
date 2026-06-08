export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-border/80 bg-surface-elevated">
      <div className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-muted sm:px-6 sm:text-sm">
        <p>All processing runs in your browser. No uploads, no server.</p>
        <p className="mt-1">&copy; {year} PDF Studio</p>
      </div>
    </footer>
  )
}
