// Типы данных каталога (расширяются на следующих шагах)

export type Category = {
  id: string
  name: string
  image_url: string | null
  sort_order: number
}

export type Subcategory = {
  id: string
  category_id: string
  name: string
  sort_order: number
}

export type Product = {
  id: string
  name: string
  description: string | null
  price: number
  cost_price: number | null
  image_url: string | null
  images: string[]
  category_id: string | null
  subcategory_id: string | null
  is_active: boolean
  stock: number | null
  sort_order: number
  // поля clonemsk
  article: string | null
  coef: number | null
  rarity: number | null
  prospect: number | null
  is_new: boolean
  // админские метки (видны только в админке)
  is_collectible: boolean
  is_budget: boolean
  // ручные продажи (складываются с расчётом из заявок)
  sold_manual: number
  revenue_manual: number
  created_at: string
}

export type Admin = {
  id: number
  email: string
  telegram_id: number | null
  name: string | null
}

export type AppUser = {
  telegram_id: number
  first_name: string | null
  last_name: string | null
  username: string | null
  phone: string | null
  created_at: string
  updated_at: string
}

export type Announcement = {
  id: string
  title: string | null
  image_url: string | null
  is_active: boolean
  sort_order: number
  created_at: string
}

export type RequestStatus = 'new' | 'in_progress' | 'done' | 'canceled'

export type RequestItem = {
  id: number
  request_id: number
  product_id: string | null
  product_name: string
  price: number
  qty: number
}

export type Request = {
  id: number
  telegram_id: number | null
  customer_first_name: string | null
  customer_last_name: string | null
  phone: string | null
  comment: string | null
  total: number
  status: RequestStatus
  is_paid: boolean
  payment_method: string | null
  payment_status: string | null
  paid_at: string | null
  stock_returned: boolean
  created_at: string
  items: RequestItem[]
}
