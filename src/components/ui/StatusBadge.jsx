import { cn } from '../../utils/cn.js'

const DOT_CLASS = {
  loading: 'bg-warning animate-pulse',
  success: 'bg-success',
  error: 'bg-error',
  idle: 'bg-tertiary',
}

/**
 * Small inline status indicator used in tool page footers.
 * @param {{ status?: 'idle'|'loading'|'success'|'error', className?: string }} props
 */
export default function StatusBadge({ status = 'idle', className }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-caption text-secondary',
        className,
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          DOT_CLASS[status] ?? DOT_CLASS.idle,
        )}
        aria-hidden="true"
      />
      <span className="font-medium capitalize">{status}</span>
    </span>
  )
}
