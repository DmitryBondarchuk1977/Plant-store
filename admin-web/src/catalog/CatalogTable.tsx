import { useEffect, useMemo, useState } from 'react'
import type { Category, Subcategory, Product } from '../lib/types'
import { getCategories, getSubcategories, getProducts } from '../lib/api'
import { byn, num } from '../lib/format'
import { ProductModal } from './ProductModal'
import { CategoriesManager } from './CategoriesManager'
import { QuickEditModal } from './QuickEditModal'

type SortKey =
  | 'article'
  | 'name'
  | 'category'
  | 'price'
  | 'cost'
  | 'coef'
  | 'rarity'
  | 'prospect'
  | 'stock'

type Sort = { key: SortKey; dir: 'asc' | 'desc' }

const COLUMNS: { key: SortKey; label: string; align?: 'right' }[] = [
  { key: 'article', label: 'Артикул' },
  { key: 'name', label: 'Название' },
  { key: 'category', label: 'Категория' },
  { key: 'price', label: 'Цена', align: 'right' },
  { key: 'cost', label: 'Цена закупки', align: 'right' },
  { key: 'coef', label: 'Коэфф.', align: 'right' },
  { key: 'rarity', label: 'Редк.', align: 'right' },
  { key: 'prospect', label: 'Персп.', align: 'right' },
  { key: 'stock', label: 'Остаток', align: 'right' },
]

export function CatalogTable() {
  const [categories, setCategories] = useState<Category[]>([])
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // фильтры
  const [search, setSearch] = useState('')
  const [catId, setCatId] = useState('')
  const [subId, setSubId] = useState('')
  const [onlyNew, setOnlyNew] = useState(false)
  const [onlyOut, setOnlyOut] = useState(false)

  // сортировка
  const [sort, setSort] = useState<Sort>({ key: 'name', dir: 'asc' })

  // модалки
  const [editing, setEditing] = useState<Product | null | 'new'>(null)
  const [quick, setQuick] = useState<Product | null>(null)
  const [showCats, setShowCats] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [cats, subs, prods] = await Promise.all([
        getCategories(),
        getSubcategories(),
        getProducts(),
      ])
      setCategories(cats)
      setSubcategories(subs)
      setProducts(prods)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const catName = useMemo(() => {
    const m = new Map<string, string>()
    categories.forEach((c) => m.set(c.id, c.name))
    return m
  }, [categories])

  const subsForCat = useMemo(
    () => subcategories.filter((s) => s.category_id === catId),
    [subcategories, catId],
  )

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = products.filter((p) => {
      if (catId && p.category_id !== catId) return false
      if (subId && p.subcategory_id !== subId) return false
      if (onlyNew && !p.is_new) return false
      if (onlyOut && !(p.stock !== null && p.stock <= 0)) return false
      if (q) {
        const hay =
          (p.name + ' ' + (p.description ?? '') + ' ' + (p.article ?? '')).toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    const dir = sort.dir === 'asc' ? 1 : -1
    const val = (p: Product): string | number | null => {
      switch (sort.key) {
        case 'article':
          return p.article ?? ''
        case 'name':
          return p.name
        case 'category':
          return catName.get(p.category_id ?? '') ?? ''
        case 'price':
          return p.price
        case 'cost':
          return p.cost_price
        case 'coef':
          return p.coef
        case 'rarity':
          return p.rarity
        case 'prospect':
          return p.prospect
        case 'stock':
          return p.stock
      }
    }
    list = [...list].sort((a, b) => {
      const va = val(a)
      const vb = val(b)
      const na = va === null || va === undefined || va === ''
      const nb = vb === null || vb === undefined || vb === ''
      if (na && nb) return 0
      if (na) return 1
      if (nb) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir
      return String(va).localeCompare(String(vb), 'ru') * dir
    })
    return list
  }, [products, search, catId, subId, onlyNew, onlyOut, sort, catName])

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    )
  }

  function onQuickSaved(p: Product) {
    setProducts((list) => list.map((x) => (x.id === p.id ? p : x)))
    setQuick(null)
  }

  const arrow = (key: SortKey) =>
    sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''

  const openQuick = (e: React.MouseEvent, p: Product) => {
    e.stopPropagation()
    setQuick(p)
  }

  return (
    <div className="catalog">
      <div className="toolbar">
        <input
          className="input search"
          placeholder="Поиск: название, описание, артикул"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input select"
          value={catId}
          onChange={(e) => {
            setCatId(e.target.value)
            setSubId('')
          }}
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input select"
          value={subId}
          onChange={(e) => setSubId(e.target.value)}
          disabled={!catId || subsForCat.length === 0}
        >
          <option value="">Все подкатегории</option>
          {subsForCat.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <label className="chk">
          <input
            type="checkbox"
            checked={onlyNew}
            onChange={(e) => setOnlyNew(e.target.checked)}
          />
          Новинки
        </label>
        <label className="chk">
          <input
            type="checkbox"
            checked={onlyOut}
            onChange={(e) => setOnlyOut(e.target.checked)}
          />
          Нет в наличии
        </label>
        <button className="btn btn-sm" onClick={load}>
          Обновить
        </button>
        <div className="grow" />
        <button className="btn btn-sm" onClick={() => setShowCats(true)}>
          Категории
        </button>
        <button className="btn btn-sm btn-primary" onClick={() => setEditing('new')}>
          + Растение
        </button>
      </div>

      <div className="meta">
        <span>{rows.length} позиций</span>
        <span className="muted">Все цены — в белорусских рублях (Br)</span>
      </div>

      {error && <div className="error banner">{error}</div>}

      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={c.align === 'right' ? 'r sortable' : 'sortable'}
                  onClick={() => toggleSort(c.key)}
                >
                  {c.label}
                  {arrow(c.key)}
                </th>
              ))}
              <th className="c badge-col">Метки</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="muted pad">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="muted pad">
                  Ничего не найдено
                </td>
              </tr>
            ) : (
              rows.map((p) => {
                const out = p.stock !== null && p.stock <= 0
                return (
                  <tr
                    key={p.id}
                    className={'clickable ' + (p.is_active ? '' : 'inactive')}
                    onClick={() => setEditing(p)}
                  >
                    <td className="mono">{p.article ?? '—'}</td>
                    <td className="name">{p.name}</td>
                    <td>{catName.get(p.category_id ?? '') ?? '—'}</td>

                    <td className="r editable">
                      <span className="cell-val">{byn(p.price)}</span>
                      <button className="pencil" title="Изменить" onClick={(e) => openQuick(e, p)}>
                        ✎
                      </button>
                    </td>

                    <td className="r editable">
                      <span className="cell-val">
                        {byn(p.cost_price)}
                      </span>
                      <button className="pencil" title="Изменить" onClick={(e) => openQuick(e, p)}>
                        ✎
                      </button>
                    </td>

                    <td className="r">{num(p.coef)}</td>
                    <td className="r">{p.rarity ?? '—'}</td>
                    <td className="r">{p.prospect ?? '—'}</td>

                    <td className="r editable">
                      <span className={'cell-val' + (out ? ' out' : '')}>
                        {p.stock === null ? '∞' : p.stock}
                      </span>
                      <button className="pencil" title="Изменить" onClick={(e) => openQuick(e, p)}>
                        ✎
                      </button>
                    </td>

                    <td className="c badges badge-col">
                      {p.is_new && <span className="badge new">NEW</span>}
                      {!p.is_active && <span className="badge hidden">скрыт</span>}
                      {out && <span className="badge out">нет</span>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <ProductModal
          product={editing === 'new' ? null : editing}
          categories={categories}
          subcategories={subcategories}
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

      {quick && (
        <QuickEditModal
          product={quick}
          onClose={() => setQuick(null)}
          onSaved={onQuickSaved}
        />
      )}

      {showCats && (
        <CategoriesManager
          categories={categories}
          subcategories={subcategories}
          onClose={() => setShowCats(false)}
          onChanged={load}
        />
      )}
    </div>
  )
}
