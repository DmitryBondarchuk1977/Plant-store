-- ============================================================
--  007: поля в стиле clonemsk
--  Артикул, коэффициент детка/клон, редкость, перспективность,
--  метка «Новинка» + курс BYN за 100 RUB в настройках.
--  Безопасно к повторному запуску.
-- ============================================================

alter table public.products add column if not exists article  text;                 -- артикул (SKU)
alter table public.products add column if not exists coef     numeric(6,2);          -- коэффициент детка/клон
alter table public.products add column if not exists rarity   int;                   -- редкость, балл 1–10
alter table public.products add column if not exists prospect int;                   -- перспективность маточника, балл 1–10
alter table public.products add column if not exists is_new   boolean not null default false; -- метка «Новинка»

-- быстрый поиск / сортировка по артикулу
create index if not exists idx_products_article on public.products(article);

-- ---------- Курс BYN ----------
-- Цена товара хранится в RUB (как раньше). BYN считается на лету:
--   price_byn = price_rub * (byn_per_100_rub / 100)
-- clonemsk: 100 RUB = 3,8 BYN.
insert into public.settings(key, value)
values ('byn_per_100_rub', '3.8')
on conflict (key) do nothing;
