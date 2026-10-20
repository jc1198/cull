import { useLayoutEffect, useState } from 'react'

// The console: a full-bleed frame at the bottom of the viewport. Canvas and
// console share #272727 — a shadow complements the grid’s bottom fade. No top stroke:
// the border was a spec error, never in the Figma frames.
//
// Slots render in a FIXED order. A step omits what it doesn't need, but nothing
// reorders:
//   1. label row (label + right-aligned secondary control)
//   2. progress bar   (analyzing only)
//   3. description input
//   4. constraint chips
//   5. priorities panel
//   6. buttons
//
// The console sizes itself to its contents rather than holding a fixed height.

/**
 * A step label: bold prefix, regular name, one <p> with two spans.
 * e.g. <StepLabel prefix="Step 1 of 3:" name="Add photos" />
 */
export function StepLabel({ prefix, name }) {
  return (
    <span className="text-[12px] text-primary leading-[14px]">
      <span className="font-bold">{prefix}</span>
      <span className="font-normal"> {name}</span>
    </span>
  )
}

/**
 * A status, not a step — analysis is a wait the user can't act on. Regular
 * weight throughout so it doesn't read as a step label with a missing prefix.
 */
export function StatusLabel({ prefix, children }) {
  return (
    <p className="text-[12px] text-primary leading-[14px]">
      <span className="font-bold">{prefix}</span>
      <span className="font-normal">{children}</span>
    </p>
  )
}

/**
 * The label row's right-aligned control. 12px bold, underlined — distinct from
 * the console's other text link, which is 13px with a bottom border.
 *
 * Pinned to the step label's 14px line box. A button's default `normal` line
 * height is taller than the label's, so an unconstrained link grew the label row
 * and walked the console's top border a few pixels whenever it appeared.
 */
export function ConsoleLink({ children, ...props }) {
  return (
    <button
      type="button"
      className="block text-[12px] font-bold text-primary leading-[14px] underline whitespace-nowrap hover:opacity-70 transition-opacity"
      {...props}
    >
      {children}
    </button>
  )
}

export default function Console({ label, secondary, progress, description, priorities, chips, buttons,
  collapsed = false, onToggle, summary, motionReady = false, panelRef }) {
  const [panelSettled, setPanelSettled] = useState(false)
  useLayoutEffect(() => {
    setPanelSettled((settled) => !collapsed && (settled || !motionReady || window.matchMedia('(prefers-reduced-motion: reduce)').matches))
  }, [collapsed, motionReady])
  return (
    <footer className="shrink-0 w-full bg-canvas shadow-console relative z-10">
      {onToggle && (
        <button type="button" className="taste-toggle" onClick={onToggle}
          aria-expanded={!collapsed} aria-controls="taste-priorities"
          aria-label={collapsed ? 'Expand priorities' : 'Collapse priorities'}>
          <svg className={`taste-caret ${collapsed ? '' : 'is-open'} ${motionReady ? 'motion-ready' : ''}`}
            width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      )}
      <div
        className="mx-auto w-full flex flex-col"
        style={{ maxWidth: '1440px', padding: '32px 80px 48px', gap: '24px' }}
      >
        {(label || secondary) && (
          /* The row holds the label's line box whether or not a secondary
             control is present, so the console's top edge never shifts. */
          <div className="flex items-center justify-between gap-4" style={{ minHeight: '14px' }}>
            <div className="flex items-center gap-3 min-w-0">
              {label}
              {onToggle && collapsed && summary && <span className="taste-summary">{summary}</span>}
            </div>
            {secondary ? <div className="shrink-0">{secondary}</div> : null}
          </div>
        )}
        {progress ?? null}
        {description ?? null}
        {chips ?? null}
        {onToggle ? (
          <div ref={panelRef} id="taste-priorities"
            className={`taste-priorities ${collapsed ? '' : 'is-open'} ${motionReady ? 'motion-ready' : ''} ${panelSettled ? 'is-settled' : ''}`}
            aria-hidden={collapsed} inert={collapsed ? '' : undefined}
            onTransitionEnd={(event) => {
              if (event.target === event.currentTarget && event.propertyName === 'grid-template-rows') setPanelSettled(!collapsed)
            }}>
            <div className="taste-priorities-clip">
              <div className="taste-priorities-content">{priorities}</div>
            </div>
          </div>
        ) : priorities ?? null}
        {buttons ?? null}
      </div>
    </footer>
  )
}
