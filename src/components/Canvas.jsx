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

export default function Canvas({ children, center = false, scroll = false, className = '' }) {
  return (
    <main className={['flex-1 min-h-0', scroll ? 'overflow-y-auto' : 'overflow-hidden', className].join(' ')}>
      <div
        className={['mx-auto w-full flex flex-col', scroll ? '' : 'h-full'].join(' ')}
        style={{ maxWidth: '1440px', paddingLeft: '80px', paddingRight: '80px' }}
      >
        <Wordmark />
        <div
          className={['flex flex-col', scroll ? '' : 'flex-1 min-h-0',
                      center ? 'justify-center' : ''].join(' ')}
        >
          {children}
        </div>
      </div>
    </main>
  )
}
