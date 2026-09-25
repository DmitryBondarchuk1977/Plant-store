import { useState } from 'react'
import type { Announcement } from '../lib/types'
import {
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  uploadImage,
} from '../lib/api'
import { Modal } from '../ui/Modal'
import { errMsg } from '../lib/errors'

export function AnnouncementModal({
  item,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: Announcement | null
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const isEdit = !!item
  const [title, setTitle] = useState(item?.title ?? '')
  const [image, setImage] = useState<string | null>(item?.image_url ?? null)
  const [isActive, setIsActive] = useState(item?.is_active ?? true)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function pickFile(f: File | null) {
    if (!f) return
    setErr(null)
    setUploading(true)
    try {
      setImage(await uploadImage(f))
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    setErr(null)
    setBusy(true)
    try {
      const input = { title: title.trim() || null, image_url: image, is_active: isActive }
      if (isEdit && item) await updateAnnouncement(item.id, input)
      else await createAnnouncement(input)
      onSaved()
    } catch (e) {
      setErr(errMsg(e))
      setBusy(false)
    }
  }

  async function remove() {
    if (!item) return
    if (!confirm('Удалить анонс?')) return
    setBusy(true)
    try {
      await deleteAnnouncement(item.id)
      onDeleted()
    } catch (e) {
      setErr(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <Modal title={isEdit ? 'Редактирование анонса' : 'Новый анонс'} onClose={onClose}>
      <div className="form">
        <label className="field">
          <span>Текст анонса</span>
          <textarea
            className="input"
            rows={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Новое поступление на следующей неделе"
          />
        </label>

        <div className="field">
          <span>Картинка</span>
          <div className="thumbs">
            {image && (
              <div className="thumb cover">
                <img src={image} alt="" />
                <div className="thumb-actions">
                  <button className="icon-btn" title="Удалить" onClick={() => setImage(null)}>
                    ✕
                  </button>
                </div>
              </div>
            )}
            {!image && (
              <label className="thumb add">
                {uploading ? '…' : '+'}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </div>
        </div>

        <label className="chk">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Показывать в мини-аппе
        </label>

        {err && <div className="error banner">{err}</div>}

        <div className="modal-foot">
          {isEdit && (
            <button className="btn btn-danger" onClick={remove} disabled={busy}>
              Удалить
            </button>
          )}
          <div className="spacer" />
          <button className="btn" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy || uploading}>
            {busy ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
