import { useEffect, useMemo, useState } from 'react'
import type { Request, Product, Category } from '../lib/types'
import { getRequests, getProducts, getCategories } from '../lib/api'
import { byn, num } from '../lib/format'
import { CategoryDetail } from './CategoryDetail'
import { errMsg } from '../lib/errors'

type Period = 7 | 30 | 0 // 0 = всё время
type Basis = 'done' | 'active' // done = выполненные; active = все кроме отмены

type CatRow = {
  id: string
  name: string
  units: number
  revenue: number
  cost: number
  margin: number
}
type ProdRow = { name: string; units: number; revenue: number }

const NO_CAT = '—'

export function AnalyticsView() {
  const [requests, setRequests] = useState<Request[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState<Period>(30)
  const [basis, setBasis] = useState<Basis>('done')
  const [openCat, setOpenCat] = useState<{ id: string; name: string } | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [r, p, c] = await Promise.all([
        getRequests(),
        getProducts(),
        getCategories(),
      ])
      setRequests(r)
      setProducts(p)
      setCategories(c)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const prodMap = useMemo(() => {
    const m = new Map<string, Product>()
    products.forEach((p) => m.set(p.id, p))
    return m
  }, [products])
  const catName = useMemo(() => {
    const m = new Map<string, string>()
    categories.forEach((c) => m.set(c.id, c.name))
    return m
  }, [categories])

  const data = useMemo(() => {
    const cutoff = period === 0 ? 0 : Date.now() - period * 24 * 60 * 60 * 1000
    const included = requests.filter((r) => {
      if (basis === 'done' && r.status !== 'done') return false
      if (basis === 'active' && r.status === 'canceled') return false
      if (cutoff && new Date(r.created_at).getTime() < cutoff) return false
      return true
    })

    // авто по товару (для попапа категории) и общий агрегат по товару
    const autoByProduct = new Map<string, { units: number; revenue: number }>()
    type Agg = {
      productId: string | null
      name: string
      category_id: string | null
      units: number
      revenue: number
    }
    const agg = new Map<string, Agg>()

    for (const r of included) {
      for (const it of r.items) {
        const rev = Number(it.price) * it.qty
        const pid = it.product_id
        const prod = pid ? prodMap.get(pid) : undefined
        const key = pid ?? 'n:' + it.product_name
        const cur =
          agg.get(key) ??
          {
            productId: pid,
            name: it.product_name || prod?.name || '—',
            category_id: prod?.category_id ?? null,
            units: 0,
            revenue: 0,
          }
        cur.units += it.qty
        cur.revenue += rev
        agg.set(key, cur)
        if (pid) {
          const a = autoByProduct.get(pid) ?? { units: 0, revenue: 0 }
          a.units += it.qty
          a.revenue += rev
          autoByProduct.set(pid, a)
        }
      }
    }

    // ручные продажи — складываются с авто (независимо от периода)
    for (const p of products) {
      const sold = p.sold_manual ?? 0
      const rev = Number(p.revenue_manual ?? 0)
      if (sold === 0 && rev === 0) continue
      const cur =
        agg.get(p.id) ??
        {
          productId: p.id,
          name: p.name,
          category_id: p.category_id,
          units: 0,
          revenue: 0,
        }
      cur.units += sold
      cur.revenue += rev
      agg.set(p.id, cur)
    }

    // категории
    const cats = new Map<string, CatRow>()
    let totalRevenue = 0
    let totalUnits = 0
    let totalCost = 0
    for (const a of agg.values()) {
      totalRevenue += a.revenue
      totalUnits += a.units
      const prod = a.productId ? prodMap.get(a.productId) : undefined
      const cost = prod?.cost_price != null ? Number(prod.cost_price) * a.units : 0
      totalCost += cost
      const cid = a.category_id ?? NO_CAT
      const cname = a.category_id ? catName.get(a.category_id) ?? 'Без категории' : 'Без категории'
      const cur =
        cats.get(cid) ?? { id: cid, name: cname, units: 0, revenue: 0, cost: 0, margin: 0 }
      cur.units += a.units
      cur.revenue += a.revenue
      cur.cost += cost
      cur.margin = cur.revenue - cur.cost
      cats.set(cid, cur)
    }

    const catRows = [...cats.values()].sort((a, b) => b.revenue - a.revenue)
    const prodRows: ProdRow[] = [...agg.values()]
      .map((a) => ({ name: a.name, units: a.units, revenue: a.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)

    return {
      catRows,
      prodRows,
      autoByProduct,
      totalRevenue,
      totalUnits,
      totalCost,
      totalMargin: totalRevenue - totalCost,
      orders: included.length,
      maxCatRevenue: Math.max(1, ...catRows.map((c) => c.revenue)),
    }
  }, [requests, products, basis, period, prodMap, catName])

  const pct = (m: number, r: number) => (r > 0 ? Math.round((m / r) * 100) : 0)

  const openCatProducts = useMemo(() => {
    if (!openCat) return []
    return products.filter((p) =>
      openCat.id === NO_CAT ? !p.category_id : p.category_id === openCat.id,
    )
  }, [openCat, products])

  return (
    <div className="analytics">
      <div className="chips">
        <button className={'chip' + (period === 7 ? ' on' : '')} onClick={() => setPeriod(7)}>
          7 дней
        </button>
        <button className={'chip' + (period === 30 ? ' on' : '')} onClick={() => setPeriod(30)}>
          30 дней
        </button>
        <button className={'chip' + (period === 0 ? ' on' : '')} onClick={() => setPeriod(0)}>
          Всё время
        </button>
        <div className="grow" />
        <button
          className={'chip' + (basis === 'done' ? ' on' : '')}
          onClick={() => setBasis('done')}
        >
          Выполненные
        </button>
        <button
          className={'chip' + (basis === 'active' ? ' on' : '')}
          onClick={() => setBasis('active')}
        >
          Все, кроме отмены
        </button>
        <button className="btn btn-sm" onClick={load}>
          Обновить
        </button>
      </div>

      {error && <div className="error banner">{error}</div>}

      {loading ? (
        <div className="muted pad">Загрузка…</div>
      ) : (
        <>
          <div className="kpis">
            <div className="kpi">
              <div className="kpi-label">Выручка</div>
              <div className="kpi-val">{byn(data.totalRevenue)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Маржа</div>
              <div className="kpi-val">{byn(data.totalMargin)}</div>
              <div className="kpi-sub muted">{pct(data.totalMargin, data.totalRevenue)}%</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Продано позиций</div>
              <div className="kpi-val">{num(data.totalUnits, 0)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Заказов</div>
              <div className="kpi-val">{num(data.orders, 0)}</div>
            </div>
          </div>

          <div className="an-title">Продажи по категориям</div>
          {data.catRows.length === 0 ? (
            <div className="muted pad">Нет данных за период</div>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Категория</th>
                    <th className="r">Продано</th>
                    <th className="r">Выручка</th>
                    <th className="r">Себестоимость</th>
                    <th className="r">Маржа</th>
                    <th className="r">Маржа %</th>
                    <th className="bar-col">Доля выручки</th>
                  </tr>
                </thead>
                <tbody>
                  {data.catRows.map((c) => (
                    <tr
                      key={c.id}
                      className="clickable"
                      onClick={() => setOpenCat({ id: c.id, name: c.name })}
                    >
                      <td className="name">{c.name} ›</td>
                      <td className="r">{num(c.units, 0)}</td>
                      <td className="r">{byn(c.revenue)}</td>
                      <td className="r muted">{c.cost > 0 ? byn(c.cost) : '—'}</td>
                      <td className="r">{byn(c.margin)}</td>
                      <td className="r">{pct(c.margin, c.revenue)}%</td>
                      <td className="bar-col">
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{ width: `${(c.revenue / data.maxCatRevenue) * 100}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="an-title">Топ растений</div>
          {data.prodRows.length === 0 ? (
            <div className="muted pad">Нет данных за период</div>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th className="r" style={{ width: 40 }}>
                      #
                    </th>
                    <th>Растение</th>
                    <th className="r">Продано</th>
                    <th className="r">Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  {data.prodRows.map((p, i) => (
                    <tr key={p.name}>
                      <td className="r muted">{i + 1}</td>
                      <td className="name">{p.name}</td>
                      <td className="r">{num(p.units, 0)}</td>
                      <td className="r">{byn(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="muted small an-note">
            Итог = продажи из заявок + ручные продажи. Маржа считается по текущей цене
            закупки; ручные продажи в расчёт не зависят от выбранного периода.
          </div>
        </>
      )}

      {openCat && (
        <CategoryDetail
          categoryName={openCat.name}
          products={openCatProducts}
          auto={data.autoByProduct}
          onClose={() => setOpenCat(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}
