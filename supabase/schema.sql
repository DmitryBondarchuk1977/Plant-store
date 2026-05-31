-- ============================================================
--  TG Catalog — схема базы данных Supabase
--  Запусти весь файл в Supabase → SQL Editor
-- ============================================================

-- ---------- Категории ----------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  image_url   text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- Анонсы («Скоро в продаже») ----------
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  image_url   text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- Товары каталога ----------
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  price       numeric(12,2) not null default 0,
  image_url   text,
  images      text[] not null default '{}',
  category_id uuid references public.categories(id) on delete set null,
  is_active   boolean not null default true,   -- модерация: показывать в каталоге или нет
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- Пользователи Telegram (имя + телефон) ----------
create table if not exists public.app_users (
  telegram_id bigint primary key,
  first_name  text,
  last_name   text,
  username    text,
  phone       text,                            -- телефон, полученный из Telegram (кнопка «Поделиться контактом»)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------- Заявки (аналог заказа) ----------
create table if not exists public.requests (
  id                  bigint generated always as identity primary key,
  telegram_id         bigint,
  customer_first_name text,
  customer_last_name  text,
  phone               text,
  comment             text,
  total               numeric(12,2) not null default 0,
  status              text not null default 'new',  -- new | in_progress | done | canceled
  created_at          timestamptz not null default now()
);

-- ---------- Позиции заявки ----------
create table if not exists public.request_items (
  id           bigint generated always as identity primary key,
  request_id   bigint not null references public.requests(id) on delete cascade,
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,                  -- фиксируем имя/цену на момент заявки
  price        numeric(12,2) not null default 0,
  qty          int not null default 1
);

create index if not exists idx_request_items_request on public.request_items(request_id);
create index if not exists idx_products_active on public.products(is_active, sort_order);
create index if not exists idx_products_category on public.products(category_id);

-- ============================================================
--  RLS (Row Level Security)
-- ============================================================
alter table public.products      enable row level security;
alter table public.categories    enable row level security;
alter table public.announcements enable row level security;
alter table public.app_users     enable row level security;
alter table public.requests      enable row level security;
alter table public.request_items enable row level security;

-- Каталог: публичное чтение ТОЛЬКО активных товаров (anon-ключом из Mini App).
drop policy if exists "public read active products" on public.products;
create policy "public read active products"
  on public.products for select
  using (is_active = true);

-- Категории: публичное чтение (для чипсов-фильтров в каталоге).
drop policy if exists "public read categories" on public.categories;
create policy "public read categories"
  on public.categories for select
  using (true);

-- Анонсы: публичное чтение активных.
drop policy if exists "public read announcements" on public.announcements;
create policy "public read announcements"
  on public.announcements for select
  using (is_active = true);

-- Запись в products / app_users / requests / request_items — НИКОМУ через anon.
-- Все записи идут только через Edge Function (service_role обходит RLS).
-- Поэтому отдельные write-политики не создаём.

-- ============================================================
--  Storage: бакет под картинки товаров
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Публичное чтение картинок
drop policy if exists "public read product images" on storage.objects;
create policy "public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');
-- Загрузка картинок идёт через Edge Function (service_role), отдельная политика не нужна.
