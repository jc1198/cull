// The console: a full-bleed frame at the bottom of the viewport. Canvas and
// console share #272727 — they separate by the top border and drop shadow, not
// by fill.
//
// Slots render in a FIXED order. A step omits what it doesn't need, but nothing
// reorders:
//   1. label row (label + right-aligned secondary control)
//   2. progress bar   (analyzing only)
//   3. description input
//   4. priorities panel
//   5. constraint chips
//   6. buttons
//
// The console sizes itself to its contents rather than holding a fixed height.

/**
 * A step label: bold prefix, regular name, one <p> with two spans.
 * e.g. <StepLabel prefix="Step 1 of 3:" name="Add photos" />
 */
export function StepLabel({ prefix, name }) {
  return (
    <p className="text-[12px] text-primary leading-[14px]">
      <span className="font-bold">{prefix}</span>
      <span className="font-normal"> {name}</span>
    </p>
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

export default function Console({ label, secondary, progress, description, priorities, chips, buttons }) {
  return (
    <footer className="shrink-0 w-full bg-canvas border-t border-border shadow-console relative z-10">
      <div
        className="mx-auto w-full flex flex-col"
        style={{ maxWidth: '1440px', padding: '32px 80px 48px', gap: '24px' }}
      >
        {(label || secondary) && (
          /* The row holds the label's line box whether or not a secondary
             control is present, so the console's top edge never shifts. */
          <div className="flex items-center justify-between gap-4" style={{ minHeight: '14px' }}>
            <div>{label}</div>
            {secondary ? <div className="shrink-0">{secondary}</div> : null}
          </div>
        )}
        {progress ?? null}
        {description ?? null}
        {priorities ?? null}
        {chips ?? null}
        {buttons ?? null}
      </div>
    </footer>
  )
}
