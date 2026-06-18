import { cn } from '../../utils/cn.js'
import { TOOL_CATEGORIES } from '../../constants/tools.js'

const categoryBgClass = {
  organize: 'bg-category-organize/10 text-category-organize',
  optimize: 'bg-category-optimize/10 text-category-optimize',
  transform: 'bg-category-transform/10 text-category-transform',
  clean: 'bg-category-clean/10 text-category-clean',
}

const categoryArrowClass = {
  organize: 'text-category-organize',
  optimize: 'text-category-optimize',
  transform: 'text-category-transform',
  clean: 'text-category-clean',
}

function ToolIcon({ category }) {
  const icons = {
    organize: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <rect x="3" y="4" width="8" height="16" rx="1.5" />
        <rect x="13" y="4" width="8" height="16" rx="1.5" />
      </svg>
    ),
    optimize: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M12 3v18M3 12h18" strokeLinecap="round" />
        <circle cx="12" cy="12" r="8" />
      </svg>
    ),
    transform: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M4 7h16M4 12h10M4 17h14" strokeLinecap="round" />
        <path d="M18 10l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    clean: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M4 6h16M6 6l1 14h10l1-14M9 6V4h6v2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  }

  return icons[category] ?? icons.organize
}

function ArrowIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ToolCard({
  name,
  description,
  category = 'organize',
  icon,
  onClick,
  className,
  as: Component = 'button',
  ...props
}) {
  const categoryMeta = TOOL_CATEGORIES[category]
  const isInteractive = Boolean(onClick) || Component === 'a'

  return (
    <Component
      type={Component === 'button' ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group flex min-h-[9rem] w-full flex-col rounded-xl border border-border-subtle',
        'bg-white p-5 text-left',
        'shadow-sm transition-all duration-normal ease-out',
        isInteractive && [
          'cursor-pointer hover:-translate-y-0.5 hover:border-border hover:shadow-md',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        ],
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'mb-3.5 flex size-10 items-center justify-center rounded-lg [&>svg]:size-5',
          categoryBgClass[category] ?? categoryBgClass.organize,
        )}
      >
        {icon ?? <ToolIcon category={category} />}
      </div>

      <h3 className="text-heading-sm font-semibold text-primary">{name}</h3>
      <p className="mt-1 line-clamp-2 flex-1 text-body-sm leading-relaxed text-secondary">
        {description}
      </p>

      {isInteractive && (
        <div className="mt-3 flex items-center justify-between">
          <span className="text-caption font-medium text-tertiary uppercase tracking-wider">
            {categoryMeta?.label ?? category}
          </span>
          <ArrowIcon
            className={cn(
              'size-4 opacity-0 transition-all duration-fast group-hover:opacity-100 group-hover:translate-x-0.5',
              categoryArrowClass[category] ?? 'text-accent',
            )}
          />
        </div>
      )}
    </Component>
  )
}
