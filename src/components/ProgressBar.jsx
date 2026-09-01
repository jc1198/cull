// 6px across the full 1280px column. Track and fill share the 3px radius so the
// fill sits flush inside the track at both ends.
export default function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0
  return (
    <div className="relative w-full" style={{ height: '6px' }}>
      <div
        className="absolute left-0 top-0 w-full"
        style={{ height: '6px', borderRadius: '3px', backgroundColor: '#D3D3D1' }}
      />
      <div
        className="absolute left-0 top-0 bg-accent transition-[width] duration-200 ease-out"
        style={{ height: '6px', borderRadius: '3px', width: `${pct}%` }}
      />
    </div>
  )
}
