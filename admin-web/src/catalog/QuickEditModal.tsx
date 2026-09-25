import { useState } from 'react'
import type { Product } from '../lib/types'
import { updateProduct } from '../lib/api'
import { Modal } from '../ui/Modal'
import { errMsg } from '../lib/errors'

const numOrNull = (s: string): number | null => {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function QuickEditModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product
  onClose: () => void
  onSaved: (p: Product) => void
}) {
  const [price, setPrice] = useState(String(product.price))
  const [cost, setCost] = useState(
    product.cost_price != null ? String(product.cost_price) : '',
  )
  const [stock, setStock] = useState(
    product.stock === null || product.stock === undefined ? '' : String(product.stock),
  )
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save() {
    setErr(null)
    const priceNum = numOrNull(price)
    if (priceNum === null || priceNum < 0) {
      setErr('Некорректная цена')
      return
    }
    const costNum = numOrNull(cost)
    const stockRaw = numOrNull(stock)
    const stockNum = stockRaw === null ? null : Math.max(0, Math.round(stockRaw))
    setBusy(true)
    try {
      const updated = await updateProduct(product.id, {
        price: priceNum,
        cost_price: costNum,
        stock: stockNum,
      })
      onSaved(updated)
    } catch (e) {
      setErr(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <Modal title={product.name} onClose={onClose}>
      <div className="form">
        <div className="row3">
          <label className="field">
            <span>Цена, Br</span>
            <input
              className="input"
              inputMode="decimal"
              autoFocus
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Цена закупки, Br</span>
            <input
              className="input"
              inputMode="decimal"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Остаток (∞ = пусто)</span>
            <input
              className="input"
              inputMode="numeric"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
              }}
            />
          </label>
        </div>

        {err && <div className="error banner">{err}</div>}

        <div className="modal-foot">
          <div className="spacer" />
          <button className="btn" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
