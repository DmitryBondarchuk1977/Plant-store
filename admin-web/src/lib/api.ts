import { supabase } from './supabase'
import type {
  Category,
  Subcategory,
  Product,
  Request,
  RequestStatus,
  Announcement,
  AppUser,
  Admin,
} from './types'

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
    .order('name')
  if (error) throw error
  return (data ?? []) as Category[]
}

export async function getSubcategories(): Promise<Subcategory[]> {
  const { data, error } = await supabase
    .from('subcategories')
    .select('*')
    .order('sort_order')
    .order('name')
  if (error) throw error
  return (data ?? []) as Subcategory[]
}

export async function getProducts(): Promise<Product[]> {
  // админ видит все товары, включая скрытые (is_active = false)
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Product[]
}

/** Быстрое изменение остатка прямо из таблицы. */
export async function updateStock(id: string, stock: number | null) {
  const { error } = await supabase.from('products').update({ stock }).eq('id', id)
  if (error) throw error
}

/** Курс BYN за 100 RUB из settings (по умолчанию 3.8). */
export async function getBynRate(): Promise<number> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'byn_per_100_rub')
    .maybeSingle()
  if (error) throw error
  const v = data?.value ? parseFloat(data.value) : 3.8
  return Number.isFinite(v) ? v : 3.8
}

// ---------- Товары: создание / редактирование / удаление ----------

export type ProductInput = {
  name: string
  description: string | null
  price: number
  cost_price: number | null
  category_id: string | null
  subcategory_id: string | null
  stock: number | null
  is_active: boolean
  is_new: boolean
  article: string | null
  coef: number | null
  rarity: number | null
  prospect: number | null
  image_url: string | null
  images: string[]
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data as Product
}

export async function updateProduct(
  id: string,
  patch: Partial<ProductInput>,
): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Product
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) throw error
}

/** Ручные продажи товара для аналитики (складываются с расчётом из заявок). */
export async function updateManualSales(
  id: string,
  sold_manual: number,
  revenue_manual: number,
): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ sold_manual, revenue_manual })
    .eq('id', id)
  if (error) throw error
}

// ---------- Категории ----------

export async function createCategory(name: string, image_url: string | null) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, image_url })
    .select('*')
    .single()
  if (error) throw error
  return data as Category
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<Category, 'name' | 'image_url' | 'sort_order'>>,
) {
  const { error } = await supabase.from('categories').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

// ---------- Подкатегории ----------

export async function createSubcategory(category_id: string, name: string) {
  const { data, error } = await supabase
    .from('subcategories')
    .insert({ category_id, name })
    .select('*')
    .single()
  if (error) throw error
  return data as Subcategory
}

export async function updateSubcategory(id: string, name: string) {
  const { error } = await supabase.from('subcategories').update({ name }).eq('id', id)
  if (error) throw error
}

export async function deleteSubcategory(id: string) {
  const { error } = await supabase.from('subcategories').delete().eq('id', id)
  if (error) throw error
}

// ---------- Пользователи ----------

export type UserStat = { count: number; total: number; done: number }

export async function getUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as AppUser[]
}

/** Пользователь по telegram_id (для перехода из заявки в карточку клиента). */
export async function getAppUser(telegramId: number): Promise<AppUser | null> {
  const { data, error } = await supabase
    .from('app_users')
    .select('*')
    .eq('telegram_id', telegramId)
    .maybeSingle()
  if (error) throw error
  return (data as AppUser) ?? null
}

/** Заявки конкретного пользователя (с позициями). */
export async function getUserRequests(telegramId: number): Promise<Request[]> {
  const { data, error } = await supabase
    .from('requests')
    .select('*, items:request_items(*)')
    .eq('telegram_id', telegramId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Request[]
}

/** Вызов защищённого роута Edge Function с авторизацией по токену админа. */
async function callAdminFn<T = unknown>(
  routePath: string,
  body: unknown,
): Promise<T> {
  const base = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Нет сессии')
  const res = await fetch(`${base}/functions/v1/bot${routePath}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok || out?.error) {
    throw new Error(out?.error || `Ошибка запроса (${res.status})`)
  }
  return out as T
}

/** Отправка сообщения пользователю через бота. */
export async function sendBotMessage(telegramId: number, text: string): Promise<void> {
  await callAdminFn('/admin-web/send-message', { telegram_id: telegramId, text })
}

/** Статистика заявок по каждому telegram_id: всего заявок, сумма выполненных. */
export async function getUserStats(): Promise<Map<number, UserStat>> {
  const { data, error } = await supabase
    .from('requests')
    .select('telegram_id, total, status')
  if (error) throw error
  const m = new Map<number, UserStat>()
  for (const r of data ?? []) {
    const tid = (r as { telegram_id: number | null }).telegram_id
    if (tid == null) continue
    const cur = m.get(tid) ?? { count: 0, total: 0, done: 0 }
    cur.count += 1
    cur.total += Number((r as { total: number }).total) || 0
    if ((r as { status: string }).status === 'done') {
      cur.done += Number((r as { total: number }).total) || 0
    }
    m.set(tid, cur)
  }
  return m
}

// ---------- Анонсы ----------

export async function getAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('sort_order')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Announcement[]
}

export type AnnouncementInput = {
  title: string | null
  image_url: string | null
  is_active: boolean
}

export async function createAnnouncement(input: AnnouncementInput) {
  const { error } = await supabase.from('announcements').insert(input)
  if (error) throw error
}

export async function updateAnnouncement(id: string, patch: Partial<AnnouncementInput>) {
  const { error } = await supabase.from('announcements').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteAnnouncement(id: string) {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw error
}

// ---------- Заявки ----------

export async function getRequests(): Promise<Request[]> {
  const { data, error } = await supabase
    .from('requests')
    .select('*, items:request_items(*)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []) as Request[]
}

/** Результат доставки уведомления клиенту. */
export type NotifyResult = { notified: boolean; notify_error?: string }

/**
 * Смена статуса — через Edge Function: возврат остатка при отмене
 * и уведомление клиенту в Telegram делаются на сервере (у бота есть токен).
 */
export async function setRequestStatus(
  req: Request,
  status: RequestStatus,
): Promise<NotifyResult> {
  return await callAdminFn<NotifyResult>('/admin-web/request-status', {
    id: req.id,
    status,
  })
}

/** Ручная отметка оплаты — через Edge Function (при оплате шлём клиенту уведомление). */
export async function setRequestPaid(id: number, paid: boolean): Promise<NotifyResult> {
  return await callAdminFn<NotifyResult>('/admin-web/request-paid', { id, paid })
}

/** Добавить позицию в заявку — через Edge Function (пересчёт суммы + уведомление). */
export async function addRequestItem(
  requestId: number,
  productId: string,
  qty: number,
): Promise<NotifyResult & { request: Request }> {
  return await callAdminFn<NotifyResult & { request: Request }>(
    '/admin-web/request-add-item',
    { request_id: requestId, product_id: productId, qty },
  )
}

// ---------- Загрузка картинок в Storage ----------

export async function uploadImage(file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const rand = (globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random()))
  const path = `products/${rand}.${ext}`
  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (error) throw error
  const { data } = supabase.storage.from('product-images').getPublicUrl(path)
  return data.publicUrl
}

// ---------- Настройки бота ----------

export type BotSettings = {
  start_message: string
  start_button: string
  card_details: string
  pm_online: boolean
  pm_cash: boolean
  pm_card: boolean
}

export async function getBotSettings(): Promise<BotSettings> {
  const { data, error } = await supabase.from('settings').select('key, value')
  if (error) throw error
  const map = new Map<string, string>()
  ;(data ?? []).forEach((r: { key: string; value: string | null }) =>
    map.set(r.key, r.value ?? ''),
  )
  return {
    start_message: map.get('start_message') ?? '',
    start_button: map.get('start_button') ?? '',
    card_details: map.get('card_details') ?? '',
    pm_online: map.get('pm_online_enabled') !== 'false',
    pm_cash: map.get('pm_cash_enabled') !== 'false',
    pm_card: map.get('pm_card_enabled') !== 'false',
  }
}

export async function saveBotSettings(s: BotSettings): Promise<void> {
  const rows = [
    { key: 'start_message', value: s.start_message },
    { key: 'start_button', value: s.start_button },
    { key: 'card_details', value: s.card_details },
    { key: 'pm_online_enabled', value: s.pm_online ? 'true' : 'false' },
    { key: 'pm_cash_enabled', value: s.pm_cash ? 'true' : 'false' },
    { key: 'pm_card_enabled', value: s.pm_card ? 'true' : 'false' },
  ]
  const { error } = await supabase.from('settings').upsert(rows, { onConflict: 'key' })
  if (error) throw error
}

// ---------- Администраторы ----------

export async function getAdmins(): Promise<Admin[]> {
  const { data, error } = await supabase
    .from('admins')
    .select('*')
    .order('created_at')
  if (error) throw error
  return (data ?? []) as Admin[]
}

export async function addAdmin(
  email: string,
  telegram_id: number | null,
  name: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('admins')
    .insert({ email: email.toLowerCase(), telegram_id, name })
  if (error) throw error
}

export async function deleteAdmin(id: number): Promise<void> {
  const { error } = await supabase.from('admins').delete().eq('id', id)
  if (error) throw error
}
