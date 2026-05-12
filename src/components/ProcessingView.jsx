export default function ProcessingView({ processingStage, progress, results, cullCriteria }) {
  const pct   = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const keeps = results.filter((r) => r.decision === 'keep').length
  const cuts  = results.filter((r) => r.decision === 'cut').length

  return (
    <div className="w-full flex flex-col" style={{ gap: '28px' }}>

      {/* Header + status */}
      <div className="flex flex-col" style={{ gap: '4px' }}>
        <h2 className="text-lg font-semibold text-primary">Culling your photos…</h2>
        <div className="flex items-center gap-2">
          {processingStage === 'compressing' && (
            <div className="w-3 h-3 rounded-full border-2 border-border border-t-primary animate-spin shrink-0" />
          )}
          <p className="text-sm text-muted">{progress.label || 'Preparing…'}</p>
        </div>
      </div>

      {/* Progress bar — only during evaluating */}
      {processingStage === 'evaluating' && (
        <div className="flex flex-col" style={{ gap: '8px' }}>
          <div className="flex justify-between">
            <span className="text-xs text-muted">{pct}% complete</span>
            <span className="text-xs text-muted">{progress.current} of {progress.total}</span>
          </div>
          <div className="w-full rounded-full overflow-hidden bg-gray-100" style={{ height: '4px' }}>
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          {results.length > 0 && (
            <div className="flex gap-4">
              <span className="text-xs" style={{ color: '#16a34a' }}>{keeps} kept</span>
              <span className="text-xs" style={{ color: '#f87171' }}>{cuts} cut</span>
            </div>
          )}
        </div>
      )}

      {/* Criteria tags — shown once populated */}
      {cullCriteria.length > 0 && (
        <div className="flex flex-col" style={{ gap: '8px' }}>
          <p className="text-xs font-semibold text-muted uppercase tracking-wider">
            Cull is evaluating against:
          </p>
          <div className="flex flex-wrap" style={{ gap: '8px' }}>
            {cullCriteria.map((c, i) => (
              <span
                key={i}
                className="px-3 py-1 text-xs text-primary border border-border rounded-full"
              >
                {c.signal}
                <span className="text-muted ml-1">· {c.weight}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Live thumbnail feed */}
      {results.length > 0 && (
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, 80px)', gap: '8px' }}
        >
          {results.map(({ photo, decision }) => (
            <div key={photo.id} className="relative">
              <img
                src={photo.url}
                alt={photo.name}
                className="rounded object-cover"
                style={{ width: '80px', height: '60px' }}
                draggable={false}
              />
              <div
                className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
                style={{ fontSize: '9px', backgroundColor: decision === 'keep' ? '#16a34a' : '#f87171' }}
              >
                {decision === 'keep' ? '✓' : '✕'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
