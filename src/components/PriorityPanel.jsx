import PriorityCard from './PriorityCard'

// Cards fill the container: three across the 1280px column land at 416px,
// four at 308px. flex-1 with a 16px gap produces both without a special case.
export default function PriorityPanel({ criteria, stale = false, onWeightChange, onRemove }) {
  return (
    <div className="w-full flex flex-col items-start" style={{ gap: '8px' }}>
      <div className="w-full flex flex-col items-start" style={{ gap: '16px' }}>
        <p className="w-full text-[16px] font-bold text-primary leading-[19px]">Cull will prioritize:</p>

        {/* The dim sits on the cards row only — the heading stays at full
            strength, so the panel still reads as a labelled section. */}
        <div
          className="w-full flex items-start"
          style={{ gap: '16px', opacity: stale ? 0.6 : 1 }}
        >
          {criteria.length === 0 ? (
            // Reserved height so the console doesn't resize when cards arrive.
            <div
              className="flex flex-col bg-surface rounded-lg"
              style={{ width: '416px', height: '64px', padding: '12px' }}
            >
              <p className="text-[12px] font-medium text-primary">
                Describe your taste first to view and edit Cull’s priorities…
              </p>
            </div>
          ) : (
            criteria.map((c) => (
              <PriorityCard
                key={c.id}
                criterion={c}
                onWeightChange={(w) => onWeightChange(c.id, w)}
                onRemove={() => onRemove(c.id)}
              />
            ))
          )}
        </div>
      </div>

      {stale && (
        <p className="w-full text-[12px] font-normal text-primary leading-[14px]">
          Reflects your earlier description
        </p>
      )}
    </div>
  )
}
