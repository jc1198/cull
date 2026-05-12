export default function CUIBar({ value, onChange, placeholder }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-10 px-4 text-sm text-primary border border-border rounded-md bg-transparent placeholder-muted focus:outline-none focus:border-primary transition-colors"
    />
  )
}
