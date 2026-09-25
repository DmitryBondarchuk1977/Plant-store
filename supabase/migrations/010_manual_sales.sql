-- ============================================================
--  010: ручные продажи для аналитики
--  Складываются с автоматическим расчётом из заявок.
--  sold_manual    — вручную проданных штук
--  revenue_manual — вручную заведённая сумма (Br)
--  Безопасно к повторному запуску.
-- ============================================================

alter table public.products
  add column if not exists sold_manual    int           not null default 0;
alter table public.products
  add column if not exists revenue_manual numeric(12,2) not null default 0;
