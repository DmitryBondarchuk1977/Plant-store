import { useEffect, useMemo, useState } from 'react'
import type { AppUser } from '../lib/types'
import { getUsers, getUserStats, type UserStat } from '../lib/api'
import { byn } from '../lib/format'
import { UserDetail } from './UserDetail'

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })

export function UsersView() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [stats, setStats] = useState<Map<number, UserStat>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AppUser | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [u, s] = await Promise.all([getUsers(), getUserStats()])
      setUsers(u)
      setStats(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter((u) =>
      `${u.first_name ?? ''} ${u.last_name ?? ''} ${u.username ?? ''} ${u.phone ?? ''}`
        .toLowerCase()
        .includes(q),
    )
  }, [users, search])

  return (
    <div className="users">
      <div className="toolbar">
        <input
          className="input search"
          placeholder="Поиск: имя, username, телефон"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn btn-sm" onClick={load}>
          Обновить
        </button>
      </div>

      <div className="meta">
        <span>{rows.length} пользователей</span>
      </div>

      {error && <div className="error banner">{error}</div>}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Имя</th>
              <th>Username</th>
              <th>Телефон</th>
              <th className="r">Заявок</th>
              <th className="r">Куплено</th>
              <th className="r">Регистрация</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="muted pad">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted pad">
                  Пользователей нет
                </td>
              </tr>
            ) : (
              rows.map((u) => {
                const st = stats.get(u.telegram_id)
                return (
                  <tr
                    key={u.telegram_id}
                    className="clickable"
                    onClick={() => setSelected(u)}
                  >
                    <td className="name">
                      {(u.first_name ?? '') + ' ' + (u.last_name ?? '') || '—'}
                    </td>
                    <td>
                      {u.username ? (
                        <a
                          className="req-phone"
                          href={`https://t.me/${u.username}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          @{u.username}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      {u.phone ? (
                        <a
                          className="req-phone"
                          href={`tel:${u.phone}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {u.phone}
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="r">{st?.count ?? 0}</td>
                    <td className="r">{byn(st?.done ?? 0)}</td>
                    <td className="r muted">{fmtDate(u.created_at)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <UserDetail user={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
