import { useEffect, useMemo, useState, type DragEvent } from 'react'
import type { Request, RequestStatus, AppUser } from '../lib/types'
import {
  getRequests,
  setRequestStatus,
  setRequestPaid,
  addRequestItem,
  getAppUser,
} from '../lib/api'
import { byn } from '../lib/format'
import { ProductPicker } from './ProductPicker'
import { UserDetail } from './UserDetail'
import { errMsg } from '../lib/errors'

const STATUS: { key: RequestStatus; label: string }[] = [
  { key: 'new', label: 'Новая' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'done', label: 'Выполнена' },
  { key: 'canceled', label: 'Отмена' },
]
const canEdit = (s: RequestStatus) => s === 'new' || s === 'in_progress'

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
  const [notice, setNotice] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [picking, setPicking] = useState<Request | null>(null)
  const [adding, setAdding] = useState(false)
  const [viewUser, setViewUser] = useState<AppUser | null>(null)

  // drag-and-drop
  const [dragId, setDragId] = useState<number | null>(null)
  const [overCol, setOverCol] = useState<RequestStatus | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await getRequests())
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // авто-скрытие плашки уведомления
  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((r) => {
      const hay = `${r.customer_first_name ?? ''} ${r.customer_last_name ?? ''} ${r.phone ?? ''} #${r.id}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, search])

  const byStatus = useMemo(() => {
    const m: Record<RequestStatus, Request[]> = {
      new: [],
      in_progress: [],
      done: [],
      canceled: [],
    }
    for (const r of filtered) m[r.status].push(r)
    return m
  }, [filtered])

  async function changeStatus(r: Request, status: RequestStatus) {
    if (r.status === status) return
    if (
      status === 'canceled' &&
      !confirm(`Отменить заявку #${r.id}? Остаток неоплаченной заявки вернётся на склад.`)
    )
      return
    setBusyId(r.id)
    setNotice(null)
    // оптимистично двигаем карточку
    setItems((list) => list.map((x) => (x.id === r.id ? { ...x, status } : x)))
    try {
      const res = await setRequestStatus(r, status)
      await load()
      setNotice(
        res.notified
          ? 'Статус изменён, клиенту отправлено уведомление ✓'
          : `Статус изменён, но уведомление не доставлено: ${res.notify_error || 'клиент не запускал бота'}`,
      )
    } catch (e) {
      setError(errMsg(e))
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function togglePaid(r: Request) {
    const willPay = !r.is_paid
    setBusyId(r.id)
    setNotice(null)
    try {
      const res = await setRequestPaid(r.id, willPay)
      await load()
      if (willPay) {
        setNotice(
          res.notified
            ? 'Оплата отмечена, клиенту отправлено уведомление ✓'
            : `Оплата отмечена, но уведомление не доставлено: ${res.notify_error || 'клиент не запускал бота'}`,
        )
      }
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusyId(null)
    }
  }

  async function openUser(r: Request) {
    if (!r.telegram_id) return
    try {
      const u = await getAppUser(r.telegram_id)
      setViewUser(
        u ?? {
          telegram_id: r.telegram_id,
          first_name: r.customer_first_name,
          last_name: r.customer_last_name,
          username: null,
          phone: r.phone,
          created_at: r.created_at,
          updated_at: r.created_at,
        },
      )
    } catch (e) {
      setError(errMsg(e))
    }
  }

  async function addItem(productId: string, qty: number) {
    if (!picking) return
    setAdding(true)
    setNotice(null)
    try {
      const res = await addRequestItem(picking.id, productId, qty)
      setItems((list) => list.map((o) => (o.id === res.request.id ? res.request : o)))
      setPicking(null)
      setNotice(
        res.notified
          ? 'Позиция добавлена, клиенту отправлено уведомление ✓'
          : `Позиция добавлена, но уведомление не доставлено: ${res.notify_error || 'клиент не запускал бота'}`,
      )
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setAdding(false)
    }
  }

  // ---- drag handlers ----
  function onDragStart(e: DragEvent, r: Request) {
    setDragId(r.id)
    e.dataTransfer.setData('text/plain', String(r.id))
    e.dataTransfer.effectAllowed = 'move'
  }
  function onColDragOver(e: DragEvent, status: RequestStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overCol !== status) setOverCol(status)
  }
  function onColDrop(e: DragEvent, status: RequestStatus) {
    e.preventDefault()
    setOverCol(null)
    const id = Number(e.dataTransfer.getData('text/plain')) || dragId
    setDragId(null)
    if (!id) return
    const r = items.find((x) => x.id === id)
    if (r && r.status !== status) changeStatus(r, status)
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
        <span className="muted small hide-sm">Перетаскивайте карточки между колонками</span>
        <div className="grow" />
        <button className="btn btn-sm" onClick={load}>
          Обновить
        </button>
      </div>

      {error && <div className="error banner">{error}</div>}
      {notice && <div className="banner notice-banner">{notice}</div>}

      {loading ? (
        <div className="muted pad">Загрузка…</div>
      ) : (
        <div className="board">
          {STATUS.map((col) => (
            <div
              key={col.key}
              className={'board-col' + (overCol === col.key ? ' drop' : '')}
              onDragOver={(e) => onColDragOver(e, col.key)}
              onDragLeave={() => setOverCol((c) => (c === col.key ? null : c))}
              onDrop={(e) => onColDrop(e, col.key)}
            >
              <div className={'board-col-head st-' + col.key}>
                <span>{col.label}</span>
                <span className="muted">{byStatus[col.key].length}</span>
              </div>

              {byStatus[col.key].map((r) => (
                <div
                  key={r.id}
                  className={'req-card board-card st-' + r.status + (dragId === r.id ? ' dragging' : '')}
                  draggable
                  onDragStart={(e) => onDragStart(e, r)}
                  onDragEnd={() => {
                    setDragId(null)
                    setOverCol(null)
                  }}
                  onClick={() => openUser(r)}
                  title={r.telegram_id ? 'Открыть карточку клиента' : undefined}
                >
                  <div className="req-head">
                    <div className="req-id">
                      #{r.id}
                      {r.is_paid && <span className="status-tag paid">оплачено</span>}
                    </div>
                    <div className="muted req-date">{fmtDate(r.created_at)}</div>
                  </div>

                  <div className="req-customer">
                    <b>{(r.customer_first_name ?? '') + ' ' + (r.customer_last_name ?? '')}</b>
                    {r.phone && (
                      <a
                        className="req-phone"
                        href={`tel:${r.phone}`}
                        onClick={(e) => e.stopPropagation()}
                      >
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
                    <div className="req-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className={'btn btn-sm' + (r.is_paid ? '' : ' btn-primary')}
                        disabled={busyId === r.id}
                        onClick={() => togglePaid(r)}
                      >
                        {r.is_paid ? 'Снять оплату' : 'Отметить оплату'}
                      </button>
                      {canEdit(r.status) && (
                        <button
                          className="btn btn-sm"
                          disabled={busyId === r.id}
                          onClick={() => setPicking(r)}
                        >
                          + Позиция
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {byStatus[col.key].length === 0 && (
                <div className="board-empty muted">перетащите сюда</div>
              )}
            </div>
          ))}
        </div>
      )}

      {picking && (
        <ProductPicker busy={adding} onClose={() => setPicking(null)} onAdd={addItem} />
      )}

      {viewUser && (
        <UserDetail
          user={viewUser}
          onClose={() => {
            setViewUser(null)
            load()
          }}
        />
      )}
    </div>
  )
}
