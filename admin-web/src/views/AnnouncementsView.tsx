import { useEffect, useState } from 'react'
import type { Announcement } from '../lib/types'
import { getAnnouncements, updateAnnouncement } from '../lib/api'
import { AnnouncementModal } from './AnnouncementModal'
import { errMsg } from '../lib/errors'

export function AnnouncementsView() {
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Announcement | null | 'new'>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setItems(await getAnnouncements())
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function toggle(a: Announcement) {
    try {
      await updateAnnouncement(a.id, { is_active: !a.is_active })
      setItems((list) =>
        list.map((x) => (x.id === a.id ? { ...x, is_active: !x.is_active } : x)),
      )
    } catch (e) {
      setError(errMsg(e))
    }
  }

  return (
    <div className="announcements">
      <div className="toolbar">
        <div className="grow" />
        <button className="btn btn-sm" onClick={load}>
          Обновить
        </button>
        <button className="btn btn-sm btn-primary" onClick={() => setEditing('new')}>
          + Анонс
        </button>
      </div>

      {error && <div className="error banner">{error}</div>}

      {loading ? (
        <div className="muted pad">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="muted pad">Анонсов пока нет</div>
      ) : (
        <div className="ann-list">
          {items.map((a) => (
            <div
              key={a.id}
              className={'ann-card' + (a.is_active ? '' : ' inactive')}
              onClick={() => setEditing(a)}
            >
              <div className="ann-img">
                {a.image_url ? <img src={a.image_url} alt="" /> : <span className="muted">нет фото</span>}
              </div>
              <div className="ann-body">
                <div className="ann-title">{a.title || <span className="muted">(без текста)</span>}</div>
                <label className="chk" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={a.is_active} onChange={() => toggle(a)} />
                  Показывать
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <AnnouncementModal
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
          onDeleted={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
    </div>
  )
}
