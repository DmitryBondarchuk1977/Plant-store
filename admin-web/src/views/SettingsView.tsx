import { useEffect, useState } from 'react'
import type { Admin } from '../lib/types'
import {
  getBotSettings,
  saveBotSettings,
  getAdmins,
  addAdmin,
  deleteAdmin,
  type BotSettings,
} from '../lib/api'
import { errMsg } from '../lib/errors'
import { useAuth } from '../auth/AuthProvider'

export function SettingsView() {
  const { session } = useAuth()
  const myEmail = session?.user.email?.toLowerCase() ?? ''

  const [bot, setBot] = useState<BotSettings>({
    start_message: '',
    start_button: '',
    card_details: '',
    pm_online: true,
    pm_cash: true,
    pm_card: true,
  })
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [savingBot, setSavingBot] = useState(false)
  const [botSaved, setBotSaved] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [newTg, setNewTg] = useState('')
  const [newName, setNewName] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [b, a] = await Promise.all([getBotSettings(), getAdmins()])
      setBot(b)
      setAdmins(a)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function saveBot() {
    setSavingBot(true)
    setBotSaved(false)
    setError(null)
    try {
      await saveBotSettings(bot)
      setBotSaved(true)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setSavingBot(false)
    }
  }

  async function addNewAdmin() {
    const email = newEmail.trim().toLowerCase()
    if (!email) return
    setAddingAdmin(true)
    setError(null)
    try {
      await addAdmin(email, newTg.trim() ? Number(newTg.trim()) : null, newName.trim() || null)
      setNewEmail('')
      setNewTg('')
      setNewName('')
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setAddingAdmin(false)
    }
  }

  async function removeAdmin(a: Admin) {
    if (a.email.toLowerCase() === myEmail) {
      if (!confirm('Это ваша почта. Удалив её, вы потеряете доступ. Продолжить?')) return
    } else if (!confirm(`Удалить администратора ${a.email}?`)) {
      return
    }
    setError(null)
    try {
      await deleteAdmin(a.id)
      await load()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  if (loading) return <div className="muted pad">Загрузка…</div>

  return (
    <div className="settings">
      {error && <div className="error banner">{error}</div>}

      <div className="card set-card">
        <h3 className="set-h">Бот</h3>
        <div className="form">
          <label className="field">
            <span>Приветствие при /start</span>
            <textarea
              className="input"
              rows={3}
              value={bot.start_message}
              onChange={(e) => setBot({ ...bot, start_message: e.target.value })}
              placeholder="👋 Это каталог. Нажмите «Открыть каталог»…"
            />
          </label>
          <label className="field">
            <span>Текст кнопки открытия каталога</span>
            <input
              className="input"
              value={bot.start_button}
              onChange={(e) => setBot({ ...bot, start_button: e.target.value })}
              placeholder="🛍 Открыть каталог"
            />
          </label>
          <label className="field">
            <span>Реквизиты для перевода на карту</span>
            <textarea
              className="input"
              rows={2}
              value={bot.card_details}
              onChange={(e) => setBot({ ...bot, card_details: e.target.value })}
              placeholder="Например: Карта 0000 0000 0000 0000, Получатель Иван И."
            />
          </label>

          <div className="field">
            <span>Способы оплаты на экране оплаты</span>
            <div className="pm-toggles">
              <label className="chk">
                <input
                  type="checkbox"
                  checked={bot.pm_online}
                  onChange={(e) => setBot({ ...bot, pm_online: e.target.checked })}
                />
                💳 Оплата в приложении (картой онлайн)
              </label>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={bot.pm_cash}
                  onChange={(e) => setBot({ ...bot, pm_cash: e.target.checked })}
                />
                💵 Наличными при получении
              </label>
              <label className="chk">
                <input
                  type="checkbox"
                  checked={bot.pm_card}
                  onChange={(e) => setBot({ ...bot, pm_card: e.target.checked })}
                />
                🏦 Переводом на карту
              </label>
            </div>
            <span className="muted small">
              Выключенные способы не показываются клиенту. Если выключить все — экран
              оплаты пропускается, заявка просто оформляется.
            </span>
          </div>

          <div className="set-foot">
            {botSaved && <span className="ud-ok">Сохранено ✓</span>}
            <div className="spacer" />
            <button className="btn btn-primary" onClick={saveBot} disabled={savingBot}>
              {savingBot ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>

      <div className="card set-card">
        <h3 className="set-h">Администраторы</h3>
        <p className="muted small">
          Доступ к веб-админке имеют только эти почты (вход по ссылке на email).
        </p>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Почта</th>
                <th>Имя</th>
                <th>Telegram ID</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td className="name">
                    {a.email}
                    {a.email.toLowerCase() === myEmail && (
                      <span className="muted small"> · вы</span>
                    )}
                  </td>
                  <td>{a.name || '—'}</td>
                  <td>{a.telegram_id ?? '—'}</td>
                  <td className="r">
                    <button className="icon-btn" title="Удалить" onClick={() => removeAdmin(a)}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="set-add">
          <input
            className="input"
            placeholder="email@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <input
            className="input"
            placeholder="Имя (необязательно)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            className="input"
            placeholder="Telegram ID (необязательно)"
            inputMode="numeric"
            value={newTg}
            onChange={(e) => setNewTg(e.target.value)}
          />
          <button
            className="btn btn-primary"
            onClick={addNewAdmin}
            disabled={addingAdmin || !newEmail.trim()}
          >
            {addingAdmin ? 'Добавляем…' : 'Добавить'}
          </button>
        </div>
      </div>
    </div>
  )
}
