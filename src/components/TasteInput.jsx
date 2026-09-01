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
      // Focus uses a heavier stroke, never the accent — a focused unselected
      // chip and an unfocused selected chip would otherwise look identical.
      className="w-full bg-canvas border border-border rounded-lg text-[14px] font-normal
                 text-primary placeholder-white/70 resize-none outline-none
                 focus:border-2 focus:px-[19px] focus:pt-[14px] transition-colors"
      style={{ height: '80px', paddingLeft: '20px', paddingRight: '20px', paddingTop: '15px', paddingBottom: '13px' }}
    />
  )
}
