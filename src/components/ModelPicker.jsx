import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { DEMO_MODEL, canonicalModel, isInstalled, modelRows } from '../lib/models'
import copyIcon from '../assets/model-picker/copy.svg'
import checkIcon from '../assets/model-picker/check.svg'
import connectedIcon from '../assets/model-picker/connected.svg'

export default function ModelPicker({ model, health, refresh, locked, onSelect, consequence }) {
  const [open, setOpen] = useState(false)
  const [present, setPresent] = useState(false)
  const [pillWidth, setPillWidth] = useState(66)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const [menuWidth, setMenuWidth] = useState(null)
  const [toast, setToast] = useState(null)
  const trigger = useRef(null)
  const anchor = useRef(null)
  const menu = useRef(null)
  const motionFrame = useRef(null)
  const toastSequence = useRef(0)
  const menuId = useId()
  const isDemo = model === DEMO_MODEL
  const connected = health.connected && isInstalled(model, health.models)

  function close(restoreFocus = false) {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => trigger.current?.focus())
  }

  function showMenu() {
    if (locked) return
    setPresent(true)
    setOpen(true)
    refresh()
  }

  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => setPillWidth(trigger.current.offsetWidth))
    observer.observe(trigger.current)
    setPillWidth(trigger.current.offsetWidth)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (!present) return
    function place() {
      const rect = anchor.current.getBoundingClientRect()
      setPosition({ top: rect.top, right: Math.max(8, window.innerWidth - rect.right) })
      setMenuWidth(menu.current?.getBoundingClientRect().width ?? null)
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(menu.current)
    window.addEventListener('resize', place)
    return () => { observer.disconnect(); window.removeEventListener('resize', place) }
  }, [present])

  useLayoutEffect(() => {
    if (!present) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const collapsed = { clipPath: `inset(0 0 calc(100% - 20px) calc(100% - ${pillWidth}px) round 8px)`, opacity: 0 }
    const expanded = { clipPath: 'inset(0 0 0 0 round 8px)', opacity: 1 }
    const element = menu.current
    const start = motionFrame.current ?? (open ? collapsed : expanded)
    const animation = element.animate([start, open ? expanded : collapsed], {
      duration: reducedMotion ? 0 : 240,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'both',
    })
    animation.onfinish = () => { if (!open) setPresent(false) }
    return () => {
      const style = getComputedStyle(element)
      motionFrame.current = { clipPath: style.clipPath, opacity: style.opacity }
      animation.cancel()
    }
  }, [open, present])

  useEffect(() => {
    if (!open) return
    menu.current?.focus()
    function outside(event) {
      if (!menu.current?.contains(event.target) && !anchor.current?.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('focusin', outside)
    }
  }, [open])

  useEffect(() => { if (locked) setOpen(false) }, [locked])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  async function copyCommand(name) {
    const command = `ollama pull ${name}`
    try {
      await navigator.clipboard.writeText(command)
      setToast({ command, id: ++toastSequence.current })
    } catch {
      setToast({ error: `Could not copy. Run this command in your terminal:`, command, id: ++toastSequence.current })
    }
  }

  function keyboard(event) {
    if (event.key === 'Escape') { event.preventDefault(); close(true); return }
    const buttons = [...menu.current.querySelectorAll('button:not(:disabled)')]
    const current = buttons.indexOf(document.activeElement)
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : event.key === 'ArrowDown' ? (current + 1) % buttons.length
          : (current - 1 + buttons.length) % buttons.length
      buttons[index]?.focus()
    }
    if (event.key === 'Tab' && (event.shiftKey ? current <= 0 : current === buttons.length - 1)) {
      event.preventDefault()
      close(true)
    }
  }

  function row(name, description, demo = false) {
    const available = demo || (!health.checking && health.connected && isInstalled(name, health.models))
    const selected = canonicalModel(model) === canonicalModel(name)
    const canCopy = !demo && !health.checking && health.connected && !isInstalled(name, health.models)
    return (
      <div key={name} className="flex items-start justify-between gap-2">
        <button type="button" disabled={!available} aria-pressed={selected}
          className={`model-option flex-1 text-left ${selected ? 'text-accentLight' : 'text-black'} ${!available ? 'opacity-60' : ''}`}
          onClick={() => { onSelect(name); close(true) }}>
          <span className="model-line font-medium">{demo ? 'Demo mode' : name}</span>
          {description && <span className="model-line font-light">{description}</span>}
        </button>
        {canCopy && <button type="button" className="model-copy flex shrink-0 items-center gap-[6px] p-1 text-black"
          aria-label={`Copy command for ${name}`} onClick={() => copyCommand(name)}>
          Copy command<img src={copyIcon} width="10" height="10" alt="" />
        </button>}
      </div>
    )
  }

  return <>
    <div className="model-picker flex shrink-0 items-center gap-2 py-1 h-7">
      <span className="model-picker-label text-[16px] font-semibold leading-[19px] whitespace-nowrap">Running on:</span>
      <div ref={anchor} className="model-picker-anchor relative h-5" style={{ width: open ? menuWidth ?? pillWidth : pillWidth }}>
        <button ref={trigger} type="button" disabled={locked} aria-haspopup="dialog" aria-expanded={open}
          aria-controls={open ? menuId : undefined} aria-label={`Running on ${isDemo ? 'Demo mode' : model}${!isDemo && !connected ? health.checking ? ', checking' : ', offline' : ''}`}
          className="model-trigger absolute right-0 top-0 flex h-5 items-center gap-1 rounded-lg bg-white p-1 text-[10px] leading-[12px] text-black whitespace-nowrap"
          aria-hidden={open || undefined}
          tabIndex={open ? -1 : undefined}
          style={{ opacity: open ? 0 : 1, pointerEvents: open ? 'none' : undefined }}
          onClick={showMenu} onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); showMenu() }
          }}>
          <span className="font-medium">{isDemo ? 'Demo mode' : model}</span>
          {!isDemo && (health.checking ? <span>checking<span className="checking-dots" aria-hidden="true">...</span></span>
            : connected ? <img src={connectedIcon} width="8" height="8" alt="Connected" /> : <span>offline</span>)}
        </button>
      </div>
    </div>
    {present && createPortal(<div ref={menu} id={menuId} role="dialog" aria-label="Choose a model" aria-hidden={!open || undefined} inert={!open ? '' : undefined} tabIndex={-1}
      onKeyDown={keyboard} className="model-menu fixed z-50 flex flex-col gap-[6px] rounded-lg bg-white p-1 text-[10px] leading-[12px] text-black"
      style={{ pointerEvents: open ? undefined : 'none', top: position.top, right: position.right, maxHeight: `calc(100dvh - ${position.top + 8}px)` }}>
      {row(DEMO_MODEL, 'Sample results, no model needed', true)}
      <hr className="border-black/10" />
      <div className="flex items-center justify-between gap-4">
        <span className="model-line font-semibold">Local models</span>
        <button type="button" className="p-1 underline" aria-label={health.checking ? 'Checking local models' : 'Re-check'} disabled={health.checking} onClick={refresh}>
          {health.checking ? <span role="status">Checking<span className="checking-dots">...</span></span> : 'Re-check'}
        </button>
      </div>
      {!health.checking && !health.connected && <p role="status" className="max-w-[240px] rounded p-1 bg-black/5 leading-[15px]">
        Ollama isn’t running. Start Ollama, then re-check.
      </p>}
      {modelRows(health.models).map(({ name, description }) => row(name, description))}
      {consequence && <><hr className="border-black/10" /><p className="p-1 leading-[12px]">
        Switching models resets your priorities{consequence === 'results' ? ' and results' : ''}.
      </p></>}
    </div>, document.body)}
    {toast && createPortal(<div role="status" className="model-toast font-sans fixed z-[60] top-[76px] left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-black p-2 text-[10px] font-medium leading-[16px] text-white">
      {!toast.error && <img src={checkIcon} width="16" height="16" className="shrink-0" alt="" />}
      <p>{toast.error ? `${toast.error} ` : 'Copied: '}<code className="font-mono text-accent">{toast.command}</code>{!toast.error && '. Paste it into your terminal window to install the model.'}</p>
    </div>, document.body)}
  </>
}
