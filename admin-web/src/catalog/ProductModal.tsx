import { useMemo, useState } from 'react'
import type { Category, Subcategory, Product } from '../lib/types'
import {
  createProduct,
  updateProduct,
  deleteProduct,
  uploadImage,
  type ProductInput,
} from '../lib/api'
import { Modal } from '../ui/Modal'
import { errMsg } from '../lib/errors'

type Props = {
  product: Product | null // null = создание
  categories: Category[]
  subcategories: Subcategory[]
  onClose: () => void
  onSaved: () => void
  onDeleted: () => void
}

const numOrNull = (s: string): number | null => {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
const intOrNull = (s: string): number | null => {
  const n = numOrNull(s)
  return n === null ? null : Math.round(n)
}

export function ProductModal({
  product,
  categories,
  subcategories,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const isEdit = !!product

  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [costPrice, setCostPrice] = useState(
    product?.cost_price != null ? String(product.cost_price) : '',
  )
  const [catId, setCatId] = useState(product?.category_id ?? '')
  const [subId, setSubId] = useState(product?.subcategory_id ?? '')
  const [stock, setStock] = useState(
    product?.stock === null || product?.stock === undefined
      ? ''
      : String(product.stock),
  )
  const [isActive, setIsActive] = useState(product?.is_active ?? true)
  const [isNew, setIsNew] = useState(product?.is_new ?? false)
  const [isCollectible, setIsCollectible] = useState(product?.is_collectible ?? false)
  const [isBudget, setIsBudget] = useState(product?.is_budget ?? false)
  const [article, setArticle] = useState(product?.article ?? '')
  const [coef, setCoef] = useState(product?.coef != null ? String(product.coef) : '')
  const [rarity, setRarity] = useState(
    product?.rarity != null ? String(product.rarity) : '',
  )
  const [prospect, setProspect] = useState(
    product?.prospect != null ? String(product.prospect) : '',
  )
  const [images, setImages] = useState<string[]>(product?.images ?? [])

  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const subsForCat = useMemo(
    () => subcategories.filter((s) => s.category_id === catId),
    [subcategories, catId],
  )

  async function onPickФайлы(files: FileList | null) {
    if (!files || files.length === 0) return
    setErr(null)
    setUploading(true)
    try {
      const urls: string[] = []
      for (const f of Array.from(files)) {
        urls.push(await uploadImage(f))
      }
      setImages((prev) => [...prev, ...urls])
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setUploading(false)
    }
  }

  function makeCover(i: number) {
    setImages((prev) => {
      const copy = [...prev]
      const [x] = copy.splice(i, 1)
      copy.unshift(x)
      return copy
    })
  }
  function removeImg(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function save() {
    setErr(null)
    if (!name.trim()) {
      setErr('Укажите название')
      return
    }
    const priceNum = numOrNull(price)
    if (priceNum === null || priceNum < 0) {
      setErr('Укажите корректную цену в рублях')
      return
    }
    const input: ProductInput = {
      name: name.trim(),
      description: description.trim() || null,
      price: priceNum,
      cost_price: numOrNull(costPrice),
      category_id: catId || null,
      subcategory_id: subId || null,
      stock: intOrNull(stock),
      is_active: isActive,
      is_new: isNew,
      is_collectible: isCollectible,
      is_budget: isBudget,
      article: article.trim() || null,
      coef: numOrNull(coef),
      rarity: intOrNull(rarity),
      prospect: intOrNull(prospect),
      image_url: images[0] ?? null,
      images,
    }
    setBusy(true)
    try {
      if (isEdit && product) await updateProduct(product.id, input)
      else await createProduct(input)
      onSaved()
    } catch (e) {
      setErr(errMsg(e))
      setBusy(false)
    }
  }

  async function remove() {
    if (!product) return
    if (!confirm(`Удалить «${product.name}»? Действие необратимо.`)) return
    setBusy(true)
    try {
      await deleteProduct(product.id)
      onDeleted()
    } catch (e) {
      setErr(errMsg(e))
      setBusy(false)
    }
  }

  return (
    <Modal
      title={isEdit ? 'Редактирование растения' : 'Новое растение'}
      onClose={onClose}
      wide
    >
      <div className="form">
        <label className="field">
          <span>Название *</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <label className="field">
          <span>Описание</span>
          <textarea
            className="input"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        <div className="row3">
          <label className="field">
            <span>Цена, Br *</span>
            <input
              className="input"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Цена закупки, Br</span>
            <input
              className="input"
              inputMode="decimal"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Остаток (пусто = ∞)</span>
            <input
              className="input"
              inputMode="numeric"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
            />
          </label>
        </div>

        <label className="field">
          <span>Артикул</span>
          <input className="input" value={article} onChange={(e) => setArticle(e.target.value)} />
        </label>

        <div className="row2">
          <label className="field">
            <span>Категория</span>
            <select
              className="input"
              value={catId}
              onChange={(e) => {
                setCatId(e.target.value)
                setSubId('')
              }}
            >
              <option value="">— без категории —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Подкатегория</span>
            <select
              className="input"
              value={subId}
              onChange={(e) => setSubId(e.target.value)}
              disabled={!catId || subsForCat.length === 0}
            >
              <option value="">— без подкатегории —</option>
              {subsForCat.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="row3">
          <label className="field">
            <span>Коэфф. детка/клон</span>
            <input className="input" inputMode="decimal" value={coef} onChange={(e) => setCoef(e.target.value)} />
          </label>
          <label className="field">
            <span>Редкость (1–10)</span>
            <input className="input" inputMode="numeric" value={rarity} onChange={(e) => setRarity(e.target.value)} />
          </label>
          <label className="field">
            <span>Перспективность (1–10)</span>
            <input className="input" inputMode="numeric" value={prospect} onChange={(e) => setProspect(e.target.value)} />
          </label>
        </div>

        <div className="row2">
          <label className="chk">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Показывать в каталоге
          </label>
          <label className="chk">
            <input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} />
            Новинка
          </label>
        </div>

        <div className="row2">
          <label className="chk">
            <input
              type="checkbox"
              checked={isCollectible}
              onChange={(e) => setIsCollectible(e.target.checked)}
            />
            Коллекционное
          </label>
          <label className="chk">
            <input
              type="checkbox"
              checked={isBudget}
              onChange={(e) => setIsBudget(e.target.checked)}
            />
            Бюджетное
          </label>
        </div>

        <div className="field">
          <span>Фото (первое — обложка)</span>
          <div className="thumbs">
            {images.map((url, i) => (
              <div className={'thumb' + (i === 0 ? ' cover' : '')} key={url + i}>
                <img src={url} alt="" />
                {i === 0 && <span className="thumb-tag">обложка</span>}
                <div className="thumb-actions">
                  {i !== 0 && (
                    <button className="icon-btn" title="Сделать обложкой" onClick={() => makeCover(i)}>
                      ★
                    </button>
                  )}
                  <button className="icon-btn" title="Удалить" onClick={() => removeImg(i)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <label className="thumb add">
              {uploading ? '…' : '+'}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => onPickФайлы(e.target.files)}
              />
            </label>
          </div>
        </div>

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
