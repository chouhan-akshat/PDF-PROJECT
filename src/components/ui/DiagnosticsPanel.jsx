/**
 * Styled definition-list grid for displaying tool diagnostics.
 *
 * @param {{
 *   title?: string,
 *   rows: Array<{ label: string, value: string|number }>
 * }} props
 */
export default function DiagnosticsPanel({ title = 'Diagnostics', rows = [] }) {
  if (!rows.length) return null

  return (
    <div className="rounded-xl border border-border-subtle bg-surface-raised p-4">
      <h3 className="text-overline font-semibold uppercase tracking-wider text-accent mb-3">
        {title}
      </h3>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {rows.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-caption text-secondary">{label}</dt>
            <dd className="mt-0.5 font-mono text-body-sm font-medium text-primary">
              {value ?? 'n/a'}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
