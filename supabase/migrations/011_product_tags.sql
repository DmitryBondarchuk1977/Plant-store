-- ============================================================
--  011: админские метки товара — «коллекционное» и «бюджетное»
--  Видны только в веб-админке; для витрины/клиента не обязательны.
--  Безопасно к повторному запуску.
-- ============================================================

alter table public.products
  add column if not exists is_collectible boolean not null default false;
alter table public.products
  add column if not exists is_budget      boolean not null default false;
