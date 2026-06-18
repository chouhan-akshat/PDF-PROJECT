import { cn } from '../../utils/cn.js'

const variantStyles = {
  primary:
    'bg-accent text-accent-foreground hover:bg-accent-hover focus-visible:ring-accent/40 disabled:hover:bg-accent shadow-sm',
  secondary:
    'border border-border bg-white text-primary hover:bg-surface-raised hover:border-border-strong focus-visible:ring-border-strong/40 disabled:hover:bg-white shadow-sm',
  ghost:
    'text-secondary hover:bg-surface-overlay hover:text-primary focus-visible:ring-border/40 disabled:hover:bg-transparent disabled:hover:text-secondary',
}

const sizeStyles = {
  sm: 'h-8 gap-1.5 px-3 text-caption',
  md: 'h-10 gap-2 px-4 text-body-md',
  lg: 'h-12 gap-2.5 px-6 text-body-md font-semibold',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  type = 'button',
  className,
  disabled = false,
  loading = false,
  children,
  ...props
}) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium',
        'transition-colors duration-fast ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'active:scale-[0.98]',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="size-4 shrink-0" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

function Spinner({ className }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}
