import { useEffect, useState } from 'react'
import type { AppUser, Request, RequestStatus } from '../lib/types'
import {
  getUserRequests,
  sendBotMessage,
  setRequestStatus,
  addRequestItem,
} from '../lib/api'
import { byn } from '../lib/format'
import { Modal } from '../ui/Modal'
import { ProductPicker } from './ProductPicker'
import { errMsg } from '../lib/errors'

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
const canEdit = (s: RequestStatus) => s === 'new' || s === 'in_progress'

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export function UserDetail({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [orders, setOrders] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [compose, setCompose] = useState(false)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendErr, setSendErr] = useState<string | null>(null)

  const [busyId, setBusyId] = useState<number | null>(null)
  const [picking, setPicking] = useState<Request | null>(null)
  const [adding, setAdding] = useState(false)

  async function loadOrders() {
    try {
      setOrders(await getUserRequests(user.telegram_id))
    } catch (e) {
      setError(errMsg(e))
    }
  }

  useEffect(() => {
    let active = true
    getUserRequests(user.telegram_id)
      .then((r) => active && setOrders(r))
      .catch((e) => active && setError(errMsg(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [user.telegram_id])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const fullName =
    `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() || 'Без имени'

  async function send() {
    setSendErr(null)
    setSent(false)
    const text = msg.trim()
    if (!text) return
    setSending(true)
    try {
      await sendBotMessage(user.telegram_id, text)
      setSent(true)
      setMsg('')
    } catch (e) {
      setSendErr(errMsg(e))
    } finally {
      setSending(false)
    }
  }

  async function changeStatus(order: Request, status: RequestStatus) {
    if (order.status === status) return
    if (
      status === 'canceled' &&
      !confirm(`Отменить заявку #${order.id}? Остаток неоплаченной заявки вернётся на склад.`)
    )
      return
    setBusyId(order.id)
    setNotice(null)
    try {
      const res = await setRequestStatus(order, status)
      await loadOrders()
      setNotice(
        res.notified
          ? 'Статус изменён, клиенту отправлено уведомление ✓'
          : `Статус изменён, но уведомление не доставлено: ${res.notify_error || 'клиент не запускал бота'}`,
      )
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusyId(null)
    }
  }

  async function addItem(productId: string, qty: number) {
    if (!picking) return
    setAdding(true)
    setNotice(null)
    try {
      const res = await addRequestItem(picking.id, productId, qty)
      // обновить эту заявку из ответа
      setOrders((list) => list.map((o) => (o.id === res.request.id ? res.request : o)))
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

  return (
    <Modal title={fullName} onClose={onClose} wide>
      <div className="user-detail">
        <div className="ud-info">
          {user.username && (
            <span>
              <span className="muted">Telegram: </span>
              <a
                className="req-phone"
                href={`https://t.me/${user.username}`}
                target="_blank"
                rel="noreferrer"
              >
                @{user.username}
              </a>
            </span>
          )}
          {user.phone && (
            <span>
              <span className="muted">Телефон: </span>
              <a className="req-phone" href={`tel:${user.phone}`}>
                {user.phone}
              </a>
            </span>
          )}
          <span className="muted">ID: {user.telegram_id}</span>
        </div>

        <div className="ud-actions">
          {user.username ? (
            <a
              className="btn btn-sm"
              href={`https://t.me/${user.username}`}
              target="_blank"
              rel="noreferrer"
            >
              💬 Открыть чат в Telegram
            </a>
          ) : (
            <span className="muted small">
              Нет username — прямой чат недоступен, но можно написать через бота
            </span>
          )}
          <button className="btn btn-sm btn-primary" onClick={() => setCompose((v) => !v)}>
            ✉️ Написать через бота
          </button>
        </div>

        {compose && (
          <div className="ud-compose">
            <textarea
              className="input"
              rows={3}
              placeholder="Текст сообщения — придёт пользователю в бота"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
            />
            <div className="ud-compose-foot">
              {sent && <span className="ud-ok">Отправлено ✓</span>}
              {sendErr && <span className="error">{sendErr}</span>}
              <div className="spacer" />
              <button
                className="btn btn-sm btn-primary"
                onClick={send}
                disabled={sending || !msg.trim()}
              >
                {sending ? 'Отправка…' : 'Отправить'}
              </button>
            </div>
          </div>
        )}

        {error && <div className="error banner">{error}</div>}
        {notice && <div className="banner notice-banner">{notice}</div>}

        <div className="ud-orders-title">Заказы</div>
        {loading ? (
          <div className="muted pad">Загрузка…</div>
        ) : orders.length === 0 ? (
          <div className="muted pad">Заказов нет</div>
        ) : (
          <div className="req-list">
            {orders.map((r) => (
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
                  {canEdit(r.status) && (
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
                        className="btn btn-sm btn-primary"
                        disabled={busyId === r.id}
                        onClick={() => setPicking(r)}
                      >
                        + Позиция
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {picking && (
        <ProductPicker
          busy={adding}
          onClose={() => setPicking(null)}
          onAdd={addItem}
        />
      )}
    </Modal>
  )
}
