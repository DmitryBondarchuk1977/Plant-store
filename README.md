# 🌱 Plant Store — Telegram-каталог с заявками

Telegram Mini App: каталог с категориями/подкатегориями, поиском и сортировкой → детальная
карточка с галереей фото → корзина-«Заявка» → оформление с телефоном из Telegram. Заявки
сохраняются в Supabase и приходят администратору в Telegram. Есть полноценная админка
(товары, категории, подкатегории, анонсы, заявки) с управлением прямо из Mini App.

- **Бот:** [@plant_store_bot](https://t.me/plant_store_bot)
- **Mini App:** https://plant-store-five-eta.vercel.app
- **Supabase project ref:** `lnkwlaunbsqixezapyjj`

---

## Возможности

**Витрина (покупатель):**
- Пастельная главная: приветствие с именем и датой, поиск, категории круглыми иконками.
- Категории и подкатегории: при выборе категории над каталогом появляются чипсы подкатегорий
  («Все» + список). Показываются только категории/подкатегории, в которых есть товары в наличии.
- Поиск по названию и описанию; сортировка (диалог): дешевле / дороже / новые + сброс
  (иконка подсвечивается, когда сортировка активна).
- Карусель «Скоро в продаже» (анонсы): картинка + текст, цвет подписи автоматически
  подбирается под яркость фото.
- Карточки: пастельная заливка, одинаковая высота, фото без обрезки, кнопка «+» для быстрого
  добавления в заявку. На десктопе у каруселей — стрелки, на телефоне — свайп.
- Детальная карточка: галерея фото (свайп + стрелки на десктопе + точки), по тапу —
  полноэкранный просмотр с листанием.
- Корзина-«Заявка»: изменение количества, удаление, итог. Кнопка-«горшочек» 🪴 вверху
  появляется только когда что-то выбрано (есть SVG-фолбэк, если эмодзи не поддерживается).
- Оформление: имя/фамилия из Telegram; телефон — нативный шаринг контакта при оформлении;
  повторный клиент номер не вводит (есть «Изменить номер»).
- Остатки: товар «нет в наличии» уезжает вниз списка с плашкой и без кнопки «+»;
  из корзины такие товары убираются у тех, кто не успел оформить.

**Админка (только для `ADMIN_IDS`):**
- Вход — иконка-шестерёнка в шапке (видна только админу).
- Товары: создание/редактирование/удаление, скрытие/показ, несколько фото (drag-порядок,
  первое — обложка), категория и подкатегория, остаток, цена.
- Категории: создание/переименование/удаление, картинка (круглый чипс), управление
  подкатегориями внутри категории.
- Анонсы: текст + картинка, показывать/скрыть.
- Drag-and-drop сортировка товаров и категорий (порядок сохраняется в `sort_order`).
- Заявки: список с миниатюрами товаров (тап → карточка товара), контакт (клик — звонок),
  комментарий, сумма; фильтр по статусу; смена статуса Новая → В работе → Выполнена → Отмена.
- Уведомление администратору о новой заявке и клиенту — о смене статуса его заявки.

---

## Архитектура

| Слой | Технология | Назначение |
|------|------------|------------|
| UI | Telegram Mini App (один `index.html`, ваниль JS + SortableJS) | витрина, корзина, оформление, админка |
| Хостинг UI | Vercel | раздаёт `webapp/index.html` по HTTPS |
| Бэкенд | Supabase Edge Function (Deno) | вебхук бота, приём заявок, проверка подписи, админ-CRUD, уведомления |
| База | Supabase Postgres | товары, категории, подкатегории, анонсы, пользователи, заявки |
| Хранилище | Supabase Storage (`product-images`) | картинки товаров/категорий/анонсов |
| Бот | Telegram Bot API | вход в Mini App, уведомления |
| CI/CD | GitHub Actions + Vercel | автодеплой при `git push` |

**Поток данных:**
- Чтение витрины (товары, категории, подкатегории, анонсы): Mini App → Supabase REST
  (публикуемый ключ + RLS, только активное/публичное).
- Запись (заявка, вся админка): Mini App → Edge Function (проверка подписи `initData`) →
  Supabase (service role).
- Уведомления: Edge Function → Telegram Bot API → администратор / клиент.

---

## Структура репозитория

```
.
├── webapp/
│   └── index.html                   # Mini App (витрина, корзина, оформление, админка)
├── supabase/
│   ├── schema.sql                   # полная схема: таблицы + RLS + бакет картинок
│   ├── migrations/                  # пошаговые миграции для уже развёрнутой базы
│   │   ├── 001_categories.sql
│   │   ├── 002_category_image.sql
│   │   ├── 003_announcements.sql
│   │   ├── 004_product_images.sql
│   │   ├── 005_subcategories.sql
│   │   └── 006_stock.sql
│   └── functions/bot/index.ts       # Edge Function: /webhook, /me, /submit, /admin/*
├── .github/workflows/
│   └── deploy-function.yml          # автодеплой функции при push
├── .gitignore
└── README.md
```

---

## Модель данных

- **categories** — категории: `name`, `image_url`, `sort_order`.
- **subcategories** — подкатегории: `category_id` (FK, `on delete cascade`), `name`, `sort_order`.
- **announcements** — анонсы «Скоро в продаже»: `title`, `image_url`, `is_active`, `sort_order`.
- **products** — товары: `name`, `description`, `price`, `image_url` (обложка), `images[]`
  (галерея), `category_id`, `subcategory_id`, `is_active`, `stock` (NULL = не ограничен, 0 = нет
  в наличии, N = остаток), `sort_order`.
- **app_users** — пользователи Telegram: `telegram_id`, имя/фамилия/username, `phone`.
- **requests** — заявки: `telegram_id` (для уведомлений), контакт, `comment`, `total`,
  `status` (`new` / `in_progress` / `done` / `canceled`).
- **request_items** — позиции: `product_id`, `product_name`, `price`, `qty` (имя/цена
  фиксируются на момент заявки).

RLS: публичное чтение — только активные товары, активные анонсы, все категории/подкатегории.
Любые записи идут через Edge Function под service role.

---

## Миграции

`schema.sql` — полная схема для установки с нуля. Для уже работающей базы применяй миграции
по порядку (Supabase → SQL Editor), все безопасны к повторному запуску:

| Файл | Что добавляет |
|------|---------------|
| `001_categories.sql` | таблица `categories` + `products.category_id` + RLS |
| `002_category_image.sql` | `categories.image_url` |
| `003_announcements.sql` | таблица `announcements` + RLS |
| `004_product_images.sql` | `products.images[]` (+ перенос одиночного фото) |
| `005_subcategories.sql` | таблица `subcategories` + `products.subcategory_id` + RLS |
| `006_stock.sql` | `products.stock` |

---

## API функции `bot`

База: `https://lnkwlaunbsqixezapyjj.supabase.co/functions/v1/bot`

| Метод | Путь | Назначение |
|-------|------|------------|
| POST | `/webhook` | апдейты Telegram: `/start` (inline-кнопка каталога), приём контакта (фолбэк) |
| POST | `/me` | данные текущего пользователя + флаг `is_admin` |
| POST | `/submit` | приём заявки (пересчёт цен по БД, уведомление админам) |
| GET / POST / PATCH / DELETE | `/admin/products` | CRUD товаров (+ загрузка нескольких фото, остаток) |
| GET / POST / PATCH / DELETE | `/admin/categories` | CRUD категорий (+ картинка) |
| GET / POST / PATCH / DELETE | `/admin/subcategories` | CRUD подкатегорий (GET с `?category_id=`) |
| GET / POST / PATCH / DELETE | `/admin/announcements` | CRUD анонсов (+ картинка) |
| POST | `/admin/reorder` | сохранить порядок (`{type, ids[]}`) для drag-and-drop |
| GET | `/admin/requests` | заявки с позициями и встроенными данными товара |
| PATCH | `/admin/requests` | смена статуса + уведомление клиенту |

Все `/admin/*` требуют валидный `initData` и `telegram_id` из `ADMIN_IDS`.

---

## Авторизация (важные нюансы)

Mini App передаёт `Telegram.WebApp.initData` в заголовке `x-init-data`; функция проверяет
HMAC-SHA256 подпись ключом, производным от токена бота. Учтено в коде:

1. **Запуск только inline-кнопкой / кнопкой-меню** — иначе Telegram отдаёт пустой `initData`,
   поэтому каталог открывается inline-кнопкой под `/start`.
2. **Поле `signature` (Bot API 8.0+)** входит в строку проверки; принимается хэш с ним или без.
3. **Ручной парсинг `initData`** через `decodeURIComponent` (не `URLSearchParams`), чтобы не
   портить значения с `+`.

---

## Поток оформления заявки (телефон)

- На `/start` номер не запрашивается — только кнопка «Открыть каталог».
- Телефон запрашивается в Mini App при оформлении через `requestContact()`
  (`event.responseUnsafe.contact.phone_number`).
- При отправке заявки номер сохраняется в `app_users.phone`; в следующий раз `/me` его
  возвращает, поле заполняется, кнопка прячется (есть «Изменить номер»).
- Фолбэк: без Bot API 8.0 телефон вводится вручную.

---

## Уведомления

- Новая заявка → сообщение администраторам (`ADMIN_IDS`).
- Смена статуса → сообщение клиенту в личку с ботом
  (принята / в работе / выполнена / отменена).
- Ограничение Telegram: бот может написать пользователю только если тот раньше открывал бота
  (нажимал Start / заходил в Mini App). Иначе сообщение молча не отправляется.

---

## Настройка с нуля

### 1. Supabase
1. Создать проект на supabase.com.
2. SQL Editor → выполнить `supabase/schema.sql` (таблицы, RLS, бакет `product-images`).
3. Project Settings → API: скопировать `Project URL` и публикуемый ключ (`sb_publishable_…`).

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
- Узнать свой числовой ID (например, @userinfobot) → **ADMIN_IDS** (через запятую).

### 5. Секреты функции (Supabase → Edge Functions → Secrets)
- `BOT_TOKEN`, `ADMIN_IDS`, `WEBAPP_URL`.
- `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` подставляются автоматически.

### 6. Деплой функции
```bash
npx supabase login
npx supabase functions deploy bot --no-verify-jwt --project-ref <ref>
```

### 7. Вебхук и кнопка-меню
```
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<ref>.supabase.co/functions/v1/bot/webhook
```
В @BotFather: Bot Settings → Menu Button → указать `WEBAPP_URL`.

---

## Автодеплой (CI/CD)

- **Mini App:** Vercel пересобирает `webapp/` при каждом `git push`.
- **Функция:** GitHub Actions (`.github/workflows/deploy-function.yml`) деплоит при изменениях в
  `supabase/functions/**`. Нужны секреты репозитория (Settings → Secrets and variables → Actions):
  - `SUPABASE_ACCESS_TOKEN` — токен `sbp_…` из supabase.com/dashboard/account/tokens
  - `SUPABASE_PROJECT_REF` — `lnkwlaunbsqixezapyjj`

Порядок при изменении схемы: **сначала миграция в SQL Editor, затем `git push`** кода
(функция пишет в новые колонки/таблицы).

---

## Безопасность

- Токены и ключи — только в секретах (Supabase Secrets, GitHub Secrets), не коммитятся.
- В браузер попадает только публикуемый ключ; service role живёт внутри Edge Function.
- При компрометации: бот — `/token` в @BotFather (обновить `BOT_TOKEN`, передеплоить);
  Supabase — пересоздать токен на account/tokens и обновить `SUPABASE_ACCESS_TOKEN`.

---

## Возможные доработки

- Количество товара в заявке (сейчас добавляется по 1 шт., меняется в корзине).
- Оплата (Telegram Stars / эквайринг).
- Автосписание остатка при оформлении.
- Drag-and-drop для подкатегорий и анонсов (эндпоинт `/admin/reorder` уже поддерживает).
- Вынос `CONFIG` Mini App в переменные окружения сборки.

---

## Стек

Telegram Mini App · Supabase (Postgres, Edge Functions на Deno, Storage) · Vercel ·
GitHub Actions · SortableJS
