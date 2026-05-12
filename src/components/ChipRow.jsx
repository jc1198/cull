export default function ChipRow({ chips, onSelect }) {
  return (
    <div className="flex flex-wrap" style={{ gap: '12px' }}>
      {chips.map((chip) => (
        <button
          key={chip}
          type="button"
          onClick={() => onSelect(chip)}
          className="border border-border rounded-full bg-transparent text-primary hover:bg-gray-50 active:bg-gray-100 transition-colors"
          style={{ height: '40px', paddingLeft: '14px', paddingRight: '14px', fontSize: '12px' }}
        >
          {chip}
        </button>
      ))}
    </div>
  )
}
