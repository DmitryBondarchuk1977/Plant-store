import { useEffect, useRef, useState } from 'react'

export type MenuItem = { key: string; label: string; icon?: string }

export function Menu({
  items,
  current,
  onSelect,
}: {
  items: MenuItem[]
  current: string
  onSelect: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  return (
    <div className="menu" ref={ref}>
      <button
        className="icon-btn menu-btn"
        onClick={() => setOpen((o) => !o)}
        title="Меню"
        aria-label="Меню"
      >
        ☰
      </button>
      {open && (
        <div className="menu-drop">
          {items.map((it) => (
            <button
              key={it.key}
              className={'menu-item' + (it.key === current ? ' active' : '')}
              onClick={() => {
                onSelect(it.key)
                setOpen(false)
              }}
            >
              {it.icon && <span className="menu-ic">{it.icon}</span>}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
