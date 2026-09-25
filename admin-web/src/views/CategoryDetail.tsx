import { useState } from 'react'
import type { Product } from '../lib/types'
import { updateManualSales } from '../lib/api'
import { byn, num } from '../lib/format'
import { Modal } from '../ui/Modal'
import { errMsg } from '../lib/errors'

type AutoMap = Map<string, { units: number; revenue: number }>

const numOrZero = (s: string) => {
  const t = s.trim().replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

export function CategoryDetail({
  categoryName,
  products,
  auto,
  onClose,
  onChanged,
}: {
  categoryName: string
  products: Product[]
  auto: AutoMap
  onClose: () => void
  onChanged: () => void | Promise<void>
}) {
  const [list, setList] = useState<Product[]>(products)
  const [draft, setDraft] = useState<Record<string, { sold: string; rev: string }>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function getDraft(p: Product) {
    return (
      draft[p.id] ?? {
        sold: String(p.sold_manual ?? 0),
        rev: String(p.revenue_manual ?? 0),
      }
    )
  }

  async function save(p: Product) {
    const d = getDraft(p)
    const sold = Math.max(0, Math.round(numOrZero(d.sold)))
    const rev = Math.max(0, numOrZero(d.rev))
    setSavingId(p.id)
    setError(null)
    try {
      await updateManualSales(p.id, sold, rev)
      setList((l) =>
        l.map((x) =>
          x.id === p.id ? { ...x, sold_manual: sold, revenue_manual: rev } : x,
        ),
      )
      setDraft((dd) => {
        const { [p.id]: _, ...rest } = dd
        return rest
      })
      await onChanged()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <Modal title={`Категория: ${categoryName}`} onClose={onClose} xwide>
      <div className="cat-detail">
        <div className="muted small">
          «Ручное» складывается с автоматическим расчётом из заявок. Итог = заявки +
          ручное.
        </div>
        {error && <div className="error banner">{error}</div>}

        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Растение</th>
                <th className="r">Авто&nbsp;шт</th>
                <th className="r">Авто&nbsp;₽</th>
                <th className="r">Ручное&nbsp;шт</th>
                <th className="r">Ручная&nbsp;сумма</th>
                <th className="r">Итог&nbsp;шт</th>
                <th className="r">Итог&nbsp;сумма</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted pad">
                    В категории нет растений
                  </td>
                </tr>
              ) : (
                list.map((p) => {
                  const a = auto.get(p.id) ?? { units: 0, revenue: 0 }
                  const d = getDraft(p)
                  const changed =
                    draft[p.id] !== undefined &&
                    (Math.round(numOrZero(d.sold)) !== (p.sold_manual ?? 0) ||
                      numOrZero(d.rev) !== Number(p.revenue_manual ?? 0))
                  const totUnits = a.units + Math.max(0, Math.round(numOrZero(d.sold)))
                  const totRev = a.revenue + Math.max(0, numOrZero(d.rev))
                  return (
                    <tr key={p.id}>
                      <td className="name">{p.name}</td>
                      <td className="r muted">{num(a.units, 0)}</td>
                      <td className="r muted">{byn(a.revenue)}</td>
                      <td className="r">
                        <input
                          className="input mini"
                          inputMode="numeric"
                          value={d.sold}
                          onChange={(e) =>
                            setDraft((dd) => ({
                              ...dd,
                              [p.id]: { ...getDraft(p), sold: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="r">
                        <input
                          className="input mini"
                          inputMode="decimal"
                          value={d.rev}
                          onChange={(e) =>
                            setDraft((dd) => ({
                              ...dd,
                              [p.id]: { ...getDraft(p), rev: e.target.value },
                            }))
                          }
                        />
                      </td>
                      <td className="r">{num(totUnits, 0)}</td>
                      <td className="r">{byn(totRev)}</td>
                      <td className="r">
                        <button
                          className="btn btn-sm btn-primary"
                          disabled={!changed || savingId === p.id}
                          onClick={() => save(p)}
                        >
                          {savingId === p.id ? '…' : '✓'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}
