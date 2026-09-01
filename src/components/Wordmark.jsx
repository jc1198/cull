// There is no nav bar in v2. The wordmark is canvas content, not chrome —
// it sits on the canvas at x=80, y=64 with no bar and no background.
// Canvas supplies the x=80 gutter; this supplies the y offset.

export default function Wordmark() {
  return (
    <p
      className="shrink-0 text-[48px] font-bold text-primary select-none"
      style={{ marginTop: '64px', lineHeight: '57px' }}
    >
      Cull
    </p>
  )
}
