// The canvas: everything above the console. Fills the available space and
// clips at the console's top edge — photos cut off mid-thumbnail rather than
// the grid reflowing.
//
// Contents sit on the same 1280px column as the console (1440 max-width,
// 80px gutters), so the two zones align.
//
// The wordmark is canvas content on every screen — v2 has no nav bar — so the
// canvas draws it rather than each screen remembering to.

import Wordmark from './Wordmark'

// The gap between the wordmark and whatever a screen puts on the canvas. One
// value, applied here, because every screen wants the same one — screen 1 was
// setting its own and drifting.
const WORDMARK_GAP = 48

// Every step clips — results was the last screen that scrolled, and it now sizes
// its detail pane to the canvas instead, so the scroll variant is gone. Screens
// size their own content within the column; the canvas only supplies the frame.
export default function Canvas({ children, className = '' }) {
  return (
    <main className={['flex-1 min-h-0 overflow-hidden', className].join(' ')}>
      <div
        className="mx-auto w-full h-full flex flex-col"
        style={{ maxWidth: '1440px', paddingLeft: '80px', paddingRight: '80px' }}
      >
        <Wordmark />
        <div className="flex flex-col flex-1 min-h-0" style={{ marginTop: `${WORDMARK_GAP}px` }}>
          {children}
        </div>
      </div>
    </main>
  )
}
