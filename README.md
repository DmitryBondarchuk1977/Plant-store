# 🌱 Plant Store — Telegram-каталог с заявками

Telegram Mini App: каталог товаров → детальная карточка → корзина-«Заявка» →
оформление с автоподстановкой телефона из Telegram. Заявки сохраняются в Supabase
и мгновенно приходят администратору в Telegram. Есть админка для модерации товаров
и ведения заявок.

- **Бот:** [@plant_store_bot](https://t.me/plant_store_bot)
- **Mini App:** https://plant-store-five-eta.vercel.app
- **Supabase project ref:** `lnkwlaunbsqixezapyjj`

---

## Возможности

**Для покупателя:**
- Каталог товаров сеткой (картинка, название, цена).
- Детальный экран: фото, название, описание, цена, кнопка «В заявку».
- Корзина-«Заявка»: изменение количества, удаление позиций, итоговая сумма.
- Оформление: имя и фамилия подставляются из Telegram, телефон — через шаринг контакта; поле для комментария.

**Для администратора:**
- Доступ к админке только для Telegram ID из списка `ADMIN_IDS`.
- Модерация товаров: добавление, редактирование, скрытие/показ в каталоге, удаление, загрузка картинки.
- Вкладка «Заявки»: список заявок с составом, контактом (клик — звонок), комментарием и суммой.
- Смена статуса заявки: Новая → В работе → Выполнена (в БД заложен и `canceled`).
- Уведомление о каждой новой заявке в Telegram.

---

## Архитектура

| Слой | Технология | Назначение |
|------|------------|------------|
| UI | Telegram Mini App (один `index.html`, ваниль JS) | каталог, корзина, оформление, админка |
| Хостинг UI | Vercel | раздаёт `webapp/index.html` по HTTPS |
| Бэкенд | Supabase Edge Function (Deno) | вебхук бота, приём заявок, проверка подписи, админ-CRUD |
| База | Supabase Postgres | товары, пользователи, заявки, позиции |
| Хранилище | Supabase Storage | картинки товаров |
| Бот | Telegram Bot API | вход в Mini App, шаринг телефона, уведомления |
| CI/CD | GitHub Actions + Vercel | автодеплой при `git push` |

**Поток данных:**
- Чтение каталога: Mini App → Supabase REST (публикуемый ключ + RLS, только активные товары).
- Запись (заявка, модерация): Mini App → Edge Function (проверка подписи `initData`) → Supabase (service role).
- Уведомления: Edge Function → Telegram Bot API → администратор.

---

## Структура репозитория

```
.
├── webapp/
│   └── index.html                  # Mini App (каталог, корзина, оформление, админка)
├── supabase/
│   ├── schema.sql                  # таблицы + RLS + бакет картинок
│   └── functions/bot/index.ts      # Edge Function: /webhook, /me, /submit, /admin/*
├── .github/workflows/
│   └── deploy-function.yml          # автодеплой функции при push
├── .gitignore
└── README.md
```

---

## Модель данных

- **products** — товары: `name`, `description`, `price`, `image_url`, `is_active` (модерация), `sort_order`.
- **app_users** — пользователи Telegram: `telegram_id`, имя/фамилия/username, `phone`.
- **requests** — заявки: контакт, `comment`, `total`, `status` (`new` / `in_progress` / `done` / `canceled`).
- **request_items** — позиции заявки: `product_name`, `price`, `qty` (фиксируются на момент заявки).

RLS: публичное чтение разрешено только для активных товаров; все записи идут через Edge Function под service role.

---

## API функции `bot`

База: `https://lnkwlaunbsqixezapyjj.supabase.co/functions/v1/bot`

| Метод | Путь | Назначение |
|-------|------|------------|
| POST | `/webhook` | апдейты Telegram: `/start`, сохранение телефона |
| POST | `/me` | данные текущего пользователя + флаг `is_admin` |
| POST | `/submit` | приём заявки (пересчёт цен по БД, уведомление админам) |
| GET | `/admin/products` | список всех товаров (для админа) |
| POST/PATCH | `/admin/products` | создать / обновить товар (+ загрузка картинки) |
| DELETE | `/admin/products?id=…` | удалить товар |
| GET | `/admin/requests` | список заявок с позициями |
| PATCH | `/admin/requests` | смена статуса заявки |

---

## Авторизация (важные нюансы)

Mini App передаёт `Telegram.WebApp.initData` в заголовке `x-init-data`; функция проверяет
HMAC-SHA256 подпись секретным ключом, производным от токена бота. Несколько подводных камней,
которые учтены в коде:

1. **Запуск только inline-кнопкой или кнопкой-меню.** При запуске из reply-клавиатуры или
   inline-режима Telegram отдаёт пустой `initData` — поэтому каталог открывается inline-кнопкой
   под сообщением `/start`.
2. **Поле `signature` (Bot API 8.0+) входит в строку проверки** при вычислении HMAC-хэша.
   Функция принимает подпись, если хэш совпал с вариантом строки со `signature` или без него.
3. **Ручной парсинг `initData`** через `decodeURIComponent` (а не `URLSearchParams`), чтобы не
   портить значения, содержащие `+`.

---

## Настройка с нуля

### 1. Supabase
1. Создать проект на supabase.com.
2. SQL Editor → выполнить `supabase/schema.sql` (создаст таблицы, RLS, бакет `product-images`).
3. Скопировать из Project Settings → API: `Project URL` и публикуемый ключ (`sb_publishable_…`).

### 2. Mini App (`webapp/index.html`)
Заполнить блок `CONFIG` вверху `<script>`:
```js
const CONFIG = {
  SUPABASE_URL:  "https://<ref>.supabase.co",
  SUPABASE_ANON: "sb_publishable_…",
  FUNCTION_BASE: "https://<ref>.supabase.co/functions/v1/bot",
};
```

### 3. Хостинг (Vercel)
Импортировать репозиторий, **Root Directory = `webapp`**, Framework Preset = Other,
Build/Output пустые. Полученный адрес — это `WEBAPP_URL`.

### 4. Бот (@BotFather)
- `/newbot` → получить **BOT_TOKEN**.
- Узнать свой числовой ID (например через @userinfobot) → **ADMIN_IDS**.

### 5. Секреты функции (Supabase → Edge Functions → Secrets)
- `BOT_TOKEN` — токен бота
- `ADMIN_IDS` — ID администраторов через запятую
- `WEBAPP_URL` — адрес Mini App
`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` Supabase подставляет автоматически.

### 6. Деплой функции
```bash
npx supabase login
npx supabase functions deploy bot --no-verify-jwt --project-ref <ref>
```

### 7. Вебхук и кнопка-меню
```bash
# вебхук
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<ref>.supabase.co/functions/v1/bot/webhook
```
В @BotFather: Bot Settings → Menu Button → указать `WEBAPP_URL`.

---

## Автодеплой (CI/CD)

- **Mini App:** Vercel пересобирает `webapp/` при каждом `git push`.
- **Функция:** GitHub Actions (`.github/workflows/deploy-function.yml`) деплоит при изменениях в
  `supabase/functions/**`. Нужны два секрета репозитория (Settings → Secrets and variables → Actions):
  - `SUPABASE_ACCESS_TOKEN` — токен `sbp_…` из supabase.com/dashboard/account/tokens
  - `SUPABASE_PROJECT_REF` — `lnkwlaunbsqixezapyjj`

После настройки достаточно `git push` — деплой обоих частей происходит автоматически.

---

## Безопасность

- Токены и ключи хранятся только в секретах (Supabase Secrets, GitHub Secrets) и **не коммитятся**
  (`.gitignore` исключает `.env`).
- В браузер попадает только публикуемый ключ (`sb_publishable_…`); `sb_secret_…` и service role
  живут исключительно внутри Edge Function.
- При компрометации токена: бот — `/token` в @BotFather (затем обновить секрет `BOT_TOKEN` и
  передеплоить); Supabase — пересоздать токен на странице account/tokens.

---

## Возможные доработки

- Категории, поиск и сортировка в каталоге.
- Остатки на складе и контроль доступного количества.
- Фильтр заявок по статусу, кнопка «Отменить» (бэкенд уже принимает `canceled`).
- Уведомление клиенту о смене статуса заявки.
- Оплата (Telegram Stars / эквайринг).
- Вынос `CONFIG` Mini App в переменные окружения сборки.

---

## Стек

Telegram Mini App · Supabase (Postgres, Edge Functions на Deno, Storage) · Vercel · GitHub Actions
