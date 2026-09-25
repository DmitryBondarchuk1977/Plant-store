import { useEffect, useState } from 'react'
import type { AppUser, Request, RequestStatus } from '../lib/types'
import { getUserRequests, sendBotMessage } from '../lib/api'
import { byn } from '../lib/format'
import { Modal } from '../ui/Modal'

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

export function UserDetail({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [orders, setOrders] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [compose, setCompose] = useState(false)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sendErr, setSendErr] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getUserRequests(user.telegram_id)
      .then((r) => active && setOrders(r))
      .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [user.telegram_id])

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
      setSendErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
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
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setCompose((v) => !v)}
          >
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
            <div className="muted small">
              Бот сможет доставить сообщение, только если пользователь уже
              запускал бота (нажимал Start / заходил в мини-апп).
            </div>
          </div>
        )}

        <div className="ud-orders-title">Заказы</div>
        {loading ? (
          <div className="muted pad">Загрузка…</div>
        ) : error ? (
          <div className="error banner">{error}</div>
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
                <div className="req-total">Итого: {byn(r.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
