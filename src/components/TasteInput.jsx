// The one surface where the product sounds like a person talking — sans-serif
// UI face, not monospace. This is the only place the user writes prose.

const PLACEHOLDER =
  'Describe what you’re looking for in this batch of photos ' +
  '(e.g. "Moody landscape shots, prefer silhouettes at golden hour")'

export default function TasteInput({ value, onChange }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={PLACEHOLDER}
      // Focus changes the border's opacity, never the accent — a focused
      // unselected chip and an unfocused selected chip would otherwise look
      // identical. Never its width either: widening the stroke moves the
      // content box, which shifted the placeholder a pixel down and right.
      className="w-full bg-canvas border border-white/60 rounded-lg text-[14px] font-normal
                 text-primary placeholder-white/70 resize-none outline-none
                 focus:border-white transition-colors"
      style={{ height: '80px', paddingLeft: '20px', paddingRight: '20px', paddingTop: '15px', paddingBottom: '13px' }}
    />
  )
}
