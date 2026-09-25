import { useEffect, useMemo, useState } from 'react'
import type { Request, RequestStatus } from '../lib/types'
import { getRequests, setRequestStatus, setRequestPaid } from '../lib/api'
import { byn } from '../lib/format'

const STATUS: { key: RequestStatus; label: string }[] = [
  { key: 'new', label: 'Новая' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'done', label: 'Выполнена' },
  { key: 'canceled', label: 'Отмена' },
]
const STATUS_LABEL: Record<RequestStatus, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  canceled: 'Отмена',
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export function RequestsView() {
  const [items, setItems] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | RequestStatus>('all')
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await getRequests())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length }
    for (const s of STATUS) c[s.key] = items.filter((r) => r.status === s.key).length
    return c
  }, [items])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false
      if (q) {
        const name = `${r.customer_first_name ?? ''} ${r.customer_last_name ?? ''} ${r.phone ?? ''} #${r.id}`.toLowerCase()
        if (!name.includes(q)) return false
      }
      return true
    })
  }, [items, filter, search])

  async function changeStatus(r: Request, status: RequestStatus) {
    if (r.status === status) return
    if (
      status === 'canceled' &&
      !confirm(`Отменить заявку #${r.id}? Остаток неоплаченной заявки вернётся на склад.`)
    )
      return
    setBusyId(r.id)
    try {
      await setRequestStatus(r, status)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  async function togglePaid(r: Request) {
    setBusyId(r.id)
    try {
      await setRequestPaid(r.id, !r.is_paid)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="requests">
      <div className="toolbar">
        <input
          className="input search"
          placeholder="Поиск: имя, телефон, № заявки"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-sm" onClick={load}>
          Обновить
        </button>
      </div>

      <div className="chips">
        <button
          className={'chip' + (filter === 'all' ? ' on' : '')}
          onClick={() => setFilter('all')}
        >
          Все · {counts.all ?? 0}
        </button>
        {STATUS.map((s) => (
          <button
            key={s.key}
            className={'chip' + (filter === s.key ? ' on' : '')}
            onClick={() => setFilter(s.key)}
          >
            {s.label} · {counts[s.key] ?? 0}
          </button>
        ))}
      </div>

      {error && <div className="error banner">{error}</div>}

      {loading ? (
        <div className="muted pad">Загрузка…</div>
      ) : rows.length === 0 ? (
        <div className="muted pad">Заявок нет</div>
      ) : (
        <div className="req-list">
          {rows.map((r) => (
            <div key={r.id} className={'req-card st-' + r.status}>
              <div className="req-head">
                <div className="req-id">
                  #{r.id}
                  <span className={'status-tag st-' + r.status}>
                    {STATUS_LABEL[r.status]}
                  </span>
                  {r.is_paid && <span className="status-tag paid">оплачено</span>}
                </div>
                <div className="muted req-date">{fmtDate(r.created_at)}</div>
              </div>

              <div className="req-customer">
                <b>
                  {(r.customer_first_name ?? '') + ' ' + (r.customer_last_name ?? '')}
                </b>
                {r.phone && (
                  <a className="req-phone" href={`tel:${r.phone}`}>
                    {r.phone}
                  </a>
                )}
              </div>

              {r.comment && <div className="req-comment">💬 {r.comment}</div>}

              <div className="req-items">
                {r.items.map((it) => (
                  <div key={it.id} className="req-item">
                    <span>{it.product_name}</span>
                    <span className="muted">
                      {it.qty} × {byn(it.price)} = {byn(it.price * it.qty)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="req-foot">
                <div className="req-total">Итого: {byn(r.total)}</div>
                <div className="req-actions">
                  <select
                    className="input select-sm"
                    value={r.status}
                    disabled={busyId === r.id}
                    onChange={(e) => changeStatus(r, e.target.value as RequestStatus)}
                  >
                    {STATUS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className={'btn btn-sm' + (r.is_paid ? '' : ' btn-primary')}
                    disabled={busyId === r.id}
                    onClick={() => togglePaid(r)}
                  >
                    {r.is_paid ? 'Снять оплату' : 'Отметить оплату'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
