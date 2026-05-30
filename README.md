# Telegram-каталог с заявками (Mini App + Supabase)

Готовый прототип: каталог товаров внутри Telegram → детальный экран → корзина-«Заявка» →
оформление с подтягиванием телефона из Telegram → заявка падает в Supabase и тебе в Telegram.
Плюс админ-панель модерации (добавить / редактировать / скрыть / удалить товар).

```
supabase/
  schema.sql               # БД + RLS + бакет под картинки
  functions/bot/index.ts   # Edge Function: вебхук, /me, /submit, админ-CRUD
webapp/
  index.html               # Mini App (каталог, корзина, оформление, админка)
```

## Как это работает

- **Каталог** Mini App читает напрямую из Supabase (anon-ключ + RLS, только активные товары).
- **Все записи** (заявка, модерация) идут через Edge Function, которая проверяет подпись
  Telegram `initData` — клиент не может подделать пользователя или цену.
- **Телефон** берётся через кнопку бота «Поделиться номером» (надёжно во всех клиентах) и
  сохраняется в БД; при оформлении подставляется автоматически. Доп. кнопка внутри Mini App
  использует `WebApp.requestContact()` (Bot API 8.0+) — необязательная, для удобства.
- **Уведомления** о заявке приходят всем `ADMIN_IDS` в Telegram.

---

## Шаги настройки

### 1. Бот в @BotFather
1. `/newbot` → получи **BOT_TOKEN**.
2. Узнай свой числовой Telegram ID (например через @userinfobot) — это **ADMIN_IDS**.

### 2. Supabase
1. Создай проект на supabase.com.
2. **SQL Editor** → вставь и выполни `supabase/schema.sql`.
3. Возьми в **Project Settings → API**: `Project URL` и `anon public` ключ.

### 3. Хостинг Mini App
В `webapp/index.html` вверху заполни `CONFIG`:
```js
SUPABASE_URL:  "https://xxxx.supabase.co",
SUPABASE_ANON: "eyJ...",                       // anon public
FUNCTION_BASE: "https://xxxx.supabase.co/functions/v1/bot",
```
Залей `index.html` на любой статический HTTPS-хостинг: **Cloudflare Pages / Vercel / Netlify /
GitHub Pages** (можно и в Supabase Storage публичным файлом). Получишь **WEBAPP_URL** —
публичную HTTPS-ссылку. HTTPS обязателен, Telegram не открывает http.

### 4. Edge Function
Установи Supabase CLI, затем:
```bash
supabase login
supabase link --project-ref ТВОЙ_REF

# секреты функции
supabase secrets set BOT_TOKEN=123:ABC
supabase secrets set ADMIN_IDS=123456789          # несколько — через запятую
supabase secrets set WEBAPP_URL=https://твой-хостинг/index.html

supabase functions deploy bot --no-verify-jwt
```
`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` Supabase подставляет в функцию сам.

### 5. Подключить вебхук и кнопку меню
```bash
# вебхук бота → на функцию
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://ТВОЙ-ПРОЕКТ.supabase.co/functions/v1/bot/webhook"
```
В @BotFather: **Bot Settings → Menu Button → Configure** → вставь **WEBAPP_URL**
(кнопка-меню будет открывать каталог). Кнопка «Открыть каталог» также приходит на `/start`.

### 6. Проверка
1. Открой бота, нажми **/start** → появятся кнопки «Открыть каталог» и «Поделиться номером».
2. Поделись номером (один тап).
3. Открой каталог. Если твой ID в `ADMIN_IDS` — внизу будет «⚙️ Модерация»: добавь пару товаров.
4. Выбери товары → «Заявка» → «Оформить» → имя/фамилия подставятся из Telegram, телефон — из БД.
5. Отправь — заявка появится в таблицах `requests` / `request_items` и придёт тебе в Telegram.

---

## Заметки и идеи на потом
- **Просмотр заявок** сейчас в БД Supabase + уведомления в Telegram. Легко добавить вкладку
  «Заявки» в админку (роут `GET /admin/requests` + смена статуса).
- **Категории, поиск, количество на складе** — добавляются полями в `products` и фильтром в каталоге.
- **Оплата** — Telegram Stars или эквайринг; под РФ-рынок учитывай ограничения сторов
  (можно раздавать через прямую ссылку на Mini App и RuStore-обёртку, без публикации в Google Play).
- `requestContact()` в разных клиентах возвращает данные немного по-разному — основным
  источником телефона оставлен надёжный путь через кнопку бота.
