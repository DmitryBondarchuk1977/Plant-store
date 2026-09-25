import { useEffect, useMemo, useState } from 'react'
import type { Product } from '../lib/types'
import { getProducts } from '../lib/api'
import { byn } from '../lib/format'
import { Modal } from '../ui/Modal'

export function ProductPicker({
  onClose,
  onAdd,
  busy,
}: {
  onClose: () => void
  onAdd: (productId: string, qty: number) => void
  busy: boolean
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Product | null>(null)
  const [qty, setQty] = useState('1')

  useEffect(() => {
    let active = true
    getProducts()
      .then((p) => active && setProducts(p.filter((x) => x.is_active)))
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) =>
      (p.name + ' ' + (p.article ?? '')).toLowerCase().includes(q),
    )
  }, [products, search])

  function confirm() {
    if (!selected) return
    const n = Math.max(1, Math.round(Number(qty) || 1))
    onAdd(selected.id, n)
  }

  return (
    <Modal title="Добавить позицию" onClose={onClose}>
      <div className="picker">
        <input
          className="input"
          placeholder="Поиск: название или артикул"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        {error && <div className="error banner">{error}</div>}

        <div className="picker-list">
          {loading ? (
            <div className="muted pad">Загрузка…</div>
          ) : rows.length === 0 ? (
            <div className="muted pad">Ничего не найдено</div>
          ) : (
            rows.map((p) => {
              const out = p.stock !== null && p.stock <= 0
              return (
                <div
                  key={p.id}
                  className={'picker-item' + (selected?.id === p.id ? ' active' : '')}
                  onClick={() => setSelected(p)}
                >
                  <div className="picker-name">
                    {p.name}
                    {p.article && <span className="muted small"> · {p.article}</span>}
                  </div>
                  <div className="picker-meta">
                    <span>{byn(p.price)}</span>
                    <span className={'muted small' + (out ? ' out-text' : '')}>
                      {p.stock === null ? '∞' : `ост. ${p.stock}`}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {selected && (
          <div className="picker-foot">
            <div className="picker-selected">
              Выбрано: <b>{selected.name}</b>
            </div>
            <label className="picker-qty">
              Кол-во
              <input
                className="input"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </label>
            <button className="btn btn-primary" onClick={confirm} disabled={busy}>
              {busy ? 'Добавляем…' : 'Добавить'}
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
