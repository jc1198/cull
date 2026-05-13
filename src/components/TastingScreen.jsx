import { useState, useEffect, useRef } from 'react'

const WEIGHT_CYCLE = ['high', 'medium', 'low']

function CriteriaRow({ criterion, index, onUpdate, onDelete, autoFocus }) {
  const [editingField, setEditingField] = useState(autoFocus ? 'signal' : null)
  const [hovered, setHovered]           = useState(false)
  const signalRef = useRef(null)
  const descRef   = useRef(null)

  // Auto-focus the signal input when this row is newly added
  useEffect(() => {
    if (autoFocus && signalRef.current) {
      signalRef.current.focus()
      signalRef.current.select()
    }
  // only runs on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function cycleWeight() {
    const next = WEIGHT_CYCLE[(WEIGHT_CYCLE.indexOf(criterion.weight) + 1) % WEIGHT_CYCLE.length]
    onUpdate({ ...criterion, weight: next })
  }

  function startEdit(field) {
    setEditingField(field)
    setTimeout(() => (field === 'signal' ? signalRef : descRef).current?.focus(), 0)
  }

  return (
    <li
      className="flex items-start gap-2 text-sm"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="text-muted mt-0.5 shrink-0">•</span>

      <div className="flex-1 flex flex-col min-w-0" style={{ gap: '2px' }}>
        {/* Signal */}
        {editingField === 'signal' ? (
          <input
            ref={signalRef}
            className="text-sm text-primary bg-transparent border-b border-primary outline-none w-full"
            value={criterion.signal}
            onChange={(e) => onUpdate({ ...criterion, signal: e.target.value })}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => e.key === 'Enter' && signalRef.current?.blur()}
          />
        ) : (
          <span
            className="text-primary cursor-text hover:underline decoration-dashed underline-offset-2 truncate"
            onClick={() => startEdit('signal')}
            title="Click to edit"
          >
            {criterion.signal || <span className="text-muted italic">signal</span>}
          </span>
        )}

        {/* Description */}
        {editingField === 'description' ? (
          <input
            ref={descRef}
            className="text-xs text-muted bg-transparent border-b border-border outline-none w-full"
            value={criterion.description}
            onChange={(e) => onUpdate({ ...criterion, description: e.target.value })}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => e.key === 'Enter' && descRef.current?.blur()}
          />
        ) : (
          <span
            className="text-xs text-muted cursor-text hover:underline decoration-dashed underline-offset-2 leading-relaxed"
            style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            onClick={() => startEdit('description')}
            title="Click to edit"
          >
            {criterion.description || <span className="italic">description</span>}
          </span>
        )}
      </div>

      {/* Weight badge + delete */}
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <button
          type="button"
          onClick={cycleWeight}
          className="text-xs text-muted hover:text-primary transition-colors px-1 py-0.5 rounded hover:bg-gray-100"
          title="Click to change weight"
        >
          {criterion.weight}
        </button>
        <button
          type="button"
          onClick={() => onDelete(index)}
          className="text-sm text-muted hover:text-red-400 transition-all w-4 text-center"
          style={{ opacity: hovered ? 1 : 0 }}
          tabIndex={-1}
          title="Remove"
        >
          ×
        </button>
      </div>
    </li>
  )
}

export default function TastingScreen({
  value,
  onChange,
  criteria,
  onCriteriaChange,
  isBuildingCriteria,
  onRunCull,
  runCullDisabled,
}) {
  // Index of newly added item that should auto-focus; reset after one tick
  const [autoFocusIdx, setAutoFocusIdx] = useState(null)

  useEffect(() => {
    if (autoFocusIdx !== null) {
      const t = setTimeout(() => setAutoFocusIdx(null), 150)
      return () => clearTimeout(t)
    }
  }, [autoFocusIdx])

  const showPanel = criteria.length > 0 || isBuildingCriteria

  function handleUpdate(index, updated) {
    const next = [...criteria]
    next[index] = updated
    onCriteriaChange(next)
  }

  function handleDelete(index) {
    onCriteriaChange(criteria.filter((_, i) => i !== index))
  }

  function handleAdd() {
    const newItem = { signal: 'new signal', weight: 'medium', description: 'describe what to look for' }
    const next = [...criteria, newItem]
    onCriteriaChange(next)
    setAutoFocusIdx(next.length - 1)
  }

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
            Cull will prioritize · edit to refine
          </p>

          {isBuildingCriteria ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-border border-t-primary animate-spin" />
              <span className="text-sm text-muted">Analyzing your description…</span>
            </div>
          ) : (
            <>
              <ul className="flex flex-col" style={{ gap: '10px' }}>
                {criteria.map((c, i) => (
                  <CriteriaRow
                    key={i}
                    criterion={c}
                    index={i}
                    onUpdate={(updated) => handleUpdate(i, updated)}
                    onDelete={handleDelete}
                    autoFocus={autoFocusIdx === i}
                  />
                ))}
              </ul>

              <button
                type="button"
                onClick={handleAdd}
                className="mt-4 flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors"
              >
                <span className="text-base leading-none">+</span>
                <span>Add criterion</span>
              </button>
            </>
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
