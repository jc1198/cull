export default function TastingScreen({
  value,
  onChange,
  criteria,
  isBuildingCriteria,
  onRunCull,
  runCullDisabled,
}) {
  const showPanel = criteria.length > 0 || isBuildingCriteria

  return (
    <div className="w-full flex flex-col" style={{ gap: '20px' }}>
      {/* Taste textarea */}
      <div className="flex flex-col" style={{ gap: '8px' }}>
        <label className="text-sm font-medium text-primary">
          What are you looking for in this batch?
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. golden light, candid moments, sharp on the subject…"
          className="w-full border border-border rounded-md px-4 py-3 text-sm text-primary placeholder-muted bg-transparent focus:outline-none focus:border-primary transition-colors resize-none"
          style={{ height: '200px' }}
        />
      </div>

      {/* Priority panel */}
      {showPanel && (
        <div className="w-full border border-border rounded-md px-5 py-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
            Cull will prioritize
          </p>
          {isBuildingCriteria ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-border border-t-primary animate-spin" />
              <span className="text-sm text-muted">Analyzing your description…</span>
            </div>
          ) : (
            <ul className="flex flex-col" style={{ gap: '6px' }}>
              {criteria.map((c, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-primary">
                  <span className="text-muted mt-0.5">•</span>
                  <span>
                    {c.signal}
                    {c.weight && (
                      <span className="text-muted ml-1 text-xs">· {c.weight}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Run Cull */}
      <button
        type="button"
        onClick={onRunCull}
        disabled={runCullDisabled}
        className={[
          'w-full py-3 text-sm font-semibold rounded-md transition-colors',
          runCullDisabled
            ? 'bg-gray-100 text-muted cursor-not-allowed'
            : 'bg-primary text-white hover:opacity-90 active:opacity-80',
        ].join(' ')}
      >
        Run Cull
      </button>
    </div>
  )
}
