import LockIcon from '../icons/LockIcon.jsx'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-border-subtle bg-surface-raised">
      <div className="mx-auto max-w-content-max px-4 py-5 sm:px-6">
        <div className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="flex items-center gap-1.5 text-caption text-secondary">
            <LockIcon className="size-3.5 shrink-0 text-success" aria-hidden="true" />
            All PDF processing happens locally in your browser. No uploads. No storage.
          </p>
          <p className="text-caption text-tertiary">
            &copy; {year} PDF Studio
          </p>
        </div>
      </div>
    </footer>
  )
}
