import type { ReactNode } from 'react'

export function Modal({
  title,
  onClose,
  children,
  wide = false,
  xwide = false,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
  xwide?: boolean
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className={'modal' + (xwide ? ' modal-xwide' : wide ? ' modal-wide' : '')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
