import { useState } from 'react'
import type { Category, Subcategory } from '../lib/types'
import {
  createCategory,
  updateCategory,
  deleteCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} from '../lib/api'
import { Modal } from '../ui/Modal'
import { errMsg } from '../lib/errors'

type Props = {
  categories: Category[]
  subcategories: Subcategory[]
  onClose: () => void
  onChanged: () => void | Promise<void>
}

export function CategoriesManager({
  categories,
  subcategories,
  onClose,
  onChanged,
}: Props) {
  const [selCat, setSelCat] = useState<string>(categories[0]?.id ?? '')
  const [newCat, setNewCat] = useState('')
  const [newSub, setNewSub] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const subs = subcategories.filter((s) => s.category_id === selCat)

  async function run(fn: () => Promise<unknown>) {
    setErr(null)
    setBusy(true)
    try {
      await fn()
      await onChanged()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function addCat() {
    const name = newCat.trim()
    if (!name) return
    await run(async () => {
      const c = await createCategory(name, null)
      setNewCat('')
      setSelCat(c.id)
    })
  }
  async function renameCat(c: Category) {
    const name = prompt('Новое название категории:', c.name)?.trim()
    if (!name || name === c.name) return
    await run(() => updateCategory(c.id, { name }))
  }
  async function delCat(c: Category) {
    if (
      !confirm(
        `Удалить категорию «${c.name}»? Её подкатегории удалятся, а товары останутся без категории.`,
      )
    )
      return
    await run(async () => {
      await deleteCategory(c.id)
      if (selCat === c.id) setSelCat('')
    })
  }

  async function addSub() {
    const name = newSub.trim()
    if (!name || !selCat) return
    await run(async () => {
      await createSubcategory(selCat, name)
      setNewSub('')
    })
  }
  async function renameSub(s: Subcategory) {
    const name = prompt('Новое название подкатегории:', s.name)?.trim()
    if (!name || name === s.name) return
    await run(() => updateSubcategory(s.id, name))
  }
  async function delSub(s: Subcategory) {
    if (!confirm(`Удалить подкатегорию «${s.name}»?`)) return
    await run(() => deleteSubcategory(s.id))
  }

  return (
    <Modal title="Категории и подкатегории" onClose={onClose} wide>
      <div className="cats">
        <div className="cats-col">
          <div className="cats-title">Категории</div>
          <div className="cats-list">
            {categories.map((c) => (
              <div
                key={c.id}
                className={'cats-item' + (c.id === selCat ? ' active' : '')}
                onClick={() => setSelCat(c.id)}
              >
                <span className="cats-name">{c.name}</span>
                <span className="cats-item-actions">
                  <button className="icon-btn" title="Переименовать" onClick={(e) => { e.stopPropagation(); renameCat(c) }}>
                    ✎
                  </button>
                  <button className="icon-btn" title="Удалить" onClick={(e) => { e.stopPropagation(); delCat(c) }}>
                    ✕
                  </button>
                </span>
              </div>
            ))}
            {categories.length === 0 && <div className="muted pad">Пока нет категорий</div>}
          </div>
          <div className="cats-add">
            <input
              className="input"
              placeholder="Новая категория"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCat()}
            />
            <button className="btn btn-sm btn-primary" onClick={addCat} disabled={busy}>
              +
            </button>
          </div>
        </div>

        <div className="cats-col">
          <div className="cats-title">
            Подкатегории{' '}
            {selCat && <span className="muted">· {categories.find((c) => c.id === selCat)?.name}</span>}
          </div>
          {selCat ? (
            <>
              <div className="cats-list">
                {subs.map((s) => (
                  <div key={s.id} className="cats-item">
                    <span className="cats-name">{s.name}</span>
                    <span className="cats-item-actions">
                      <button className="icon-btn" title="Переименовать" onClick={() => renameSub(s)}>
                        ✎
                      </button>
                      <button className="icon-btn" title="Удалить" onClick={() => delSub(s)}>
                        ✕
                      </button>
                    </span>
                  </div>
                ))}
                {subs.length === 0 && <div className="muted pad">Нет подкатегорий</div>}
              </div>
              <div className="cats-add">
                <input
                  className="input"
                  placeholder="Новая подкатегория"
                  value={newSub}
                  onChange={(e) => setNewSub(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSub()}
                />
                <button className="btn btn-sm btn-primary" onClick={addSub} disabled={busy}>
                  +
                </button>
              </div>
            </>
          ) : (
            <div className="muted pad">Выбери категорию слева</div>
          )}
        </div>
      </div>
      {err && <div className="error banner">{err}</div>}
    </Modal>
  )
}
