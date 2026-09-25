-- ============================================================
--  008: доверенные админы + RLS для веб-админки
--  Вход в веб-админку — magic link (Supabase Auth) по email.
--  Пускаем только тех, чья почта есть в public.admins.
--  Запись/чтение служебных данных открыто ТОЛЬКО админам (is_admin()).
--  Публичное чтение витрины (анон-ключ мини-аппа) не трогаем.
--  Безопасно к повторному запуску.
-- ============================================================

-- ---------- Список доверенных админов ----------
create table if not exists public.admins (
  id          bigint generated always as identity primary key,
  email       text unique not null,          -- почта для входа по magic link
  telegram_id bigint,                         -- на будущее: связь с ботом
  name        text,
  created_at  timestamptz not null default now()
);

alter table public.admins enable row level security;

-- Проверка: текущий залогиненный пользователь — админ?
-- SECURITY DEFINER: функция сама читает admins в обход RLS (нет рекурсии политик).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Список админов виден и управляется только админами.
-- Первого админа заводим вручную через SQL Editor (он идёт под service role, в обход RLS).
drop policy if exists "admins manage admins" on public.admins;
create policy "admins manage admins" on public.admins
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------- Полный доступ админам к служебным таблицам ----------
-- Политики PERMISSIVE: складываются по ИЛИ с публичными read-политиками витрины.
do $$
declare t text;
begin
  foreach t in array array[
    'products','categories','subcategories','announcements',
    'settings','requests','request_items','app_users'
  ]
  loop
    execute format('drop policy if exists "admins all %1$s" on public.%1$I;', t);
    execute format(
      'create policy "admins all %1$s" on public.%1$I for all
         using (public.is_admin()) with check (public.is_admin());', t);
  end loop;
end $$;

-- ---------- Storage: загрузка картинок админами ----------
drop policy if exists "admins write product images" on storage.objects;
create policy "admins write product images" on storage.objects
  for all
  using      (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
