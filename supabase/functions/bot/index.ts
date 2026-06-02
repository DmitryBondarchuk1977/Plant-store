// ============================================================
//  Edge Function: bot
//  Деплой:  supabase functions deploy bot --no-verify-jwt
//
//  Роуты (все под /functions/v1/bot):
//    POST  /bot/webhook          — вебхук Telegram (/start, контакт)
//    POST  /bot/me               — данные текущего пользователя (телефон/имя/isAdmin)
//    POST  /bot/submit           — отправка заявки
//    GET   /bot/admin/products   — все товары (для админа)
//    POST  /bot/admin/products   — создать товар
//    PATCH /bot/admin/products   — обновить товар
//    DELETE/bot/admin/products?id=… — удалить товар
//
//  Секреты (Supabase → Edge Functions → Secrets):
//    BOT_TOKEN, ADMIN_IDS (через запятую), WEBAPP_URL,
//    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (есть по умолчанию)
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN")!;
const WEBAPP_URL = Deno.env.get("WEBAPP_URL") ?? "";
const ADMIN_IDS = (Deno.env.get("ADMIN_IDS") ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const enc = new TextEncoder();

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-init-data",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}

// ---------- Валидация Telegram initData ----------
async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
}
function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type TgUser = { id: number; first_name?: string; last_name?: string; username?: string };

async function verifyInitData(initData: string): Promise<TgUser | null> {
  if (!initData) return null;

  // Ручной парсинг через decodeURIComponent (URLSearchParams портит значения с '+').
  let hash = "";
  const all: [string, string][] = []; // все поля, кроме hash
  for (const part of initData.split("&")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const val = decodeURIComponent(part.slice(eq + 1));
    if (key === "hash") { hash = val; continue; }
    all.push([key, val]);
  }
  if (!hash) return null;

  // Принимаем подпись, если хэш сошёлся с любым из вариантов строки проверки:
  // со signature (актуальное поведение Telegram) или без него (на будущее/совместимость).
  const build = (withSig: boolean) =>
    all.filter(([k]) => withSig || k !== "signature")
      .map(([k, v]) => `${k}=${v}`)
      .sort()
      .join("\n");

  const secretKey = await hmac(enc.encode("WebAppData"), BOT_TOKEN);
  const calcIncl = toHex(await hmac(secretKey, build(true)));
  const calcExcl = toHex(await hmac(secretKey, build(false)));
  if (calcIncl !== hash && calcExcl !== hash) return null;

  // Проверка свежести: не старше 24ч
  const authDate = Number(all.find(([k]) => k === "auth_date")?.[1] ?? 0);
  if (authDate && Date.now() / 1000 - authDate > 86400) return null;

  const userRaw = all.find(([k]) => k === "user")?.[1];
  if (!userRaw) return null;
  try { return JSON.parse(userRaw) as TgUser; } catch { return null; }
}

function isAdmin(id: number): boolean {
  return ADMIN_IDS.includes(String(id));
}

async function getInitUser(req: Request): Promise<TgUser | null> {
  const fromHeader = req.headers.get("x-init-data");
  if (fromHeader) return verifyInitData(fromHeader);
  return null;
}

// ---------- Telegram helpers ----------
async function tg(method: string, body: unknown) {
  const r = await fetch(`${TG_API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function upsertUser(u: TgUser, phone?: string) {
  await supabase.from("app_users").upsert({
    telegram_id: u.id,
    first_name: u.first_name ?? null,
    last_name: u.last_name ?? null,
    username: u.username ?? null,
    ...(phone ? { phone } : {}),
    updated_at: new Date().toISOString(),
  }, { onConflict: "telegram_id" });
}

async function getSetting(key: string, def: string): Promise<string> {
  const { data } = await supabase.from("settings").select("value").eq("key", key).maybeSingle();
  return (data && typeof data.value === "string" && data.value.length) ? data.value : def;
}

// ============================================================
//  Роутер
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/bot/, "") || "/";

  try {
    // -------- 1. Вебхук Telegram --------
    if (path === "/webhook" && req.method === "POST") {
      const update = await req.json();
      const msg = update.message;
      if (msg) {
        const chatId = msg.chat.id;
        const from = msg.from as TgUser;

        // Пользователь поделился контактом → сохраняем телефон
        if (msg.contact && msg.contact.user_id === from.id) {
          await upsertUser(from, msg.contact.phone_number);
          await tg("sendMessage", {
            chat_id: chatId,
            text: "✅ Номер сохранён. Открывайте каталог и формируйте заявку.",
          });
        } else if (typeof msg.text === "string" && msg.text.startsWith("/start")) {
          await upsertUser(from);
          // Каталог — INLINE-кнопкой: только так Telegram передаёт initData.
          // Текст приветствия и подпись кнопки редактируются в админке (таблица settings).
          const startMsg = await getSetting(
            "start_message",
            "👋 Это каталог. Нажмите «Открыть каталог», чтобы выбрать товары и оформить заявку.",
          );
          const startBtn = await getSetting("start_button", "🛍 Открыть каталог");
          await tg("sendMessage", {
            chat_id: chatId,
            text: startMsg,
            reply_markup: {
              inline_keyboard: [
                [{ text: startBtn, web_app: { url: WEBAPP_URL } }],
              ],
            },
          });
        }
      }
      return json({ ok: true });
    }

    // -------- 2. Данные текущего пользователя --------
    if (path === "/me" && req.method === "POST") {
      const u = await getInitUser(req);
      if (!u) return json({ error: "unauthorized" }, 401);
      await upsertUser(u);
      const { data } = await supabase
        .from("app_users").select("phone, first_name, last_name")
        .eq("telegram_id", u.id).maybeSingle();
      return json({
        telegram_id: u.id,
        first_name: u.first_name ?? data?.first_name ?? "",
        last_name: u.last_name ?? data?.last_name ?? "",
        phone: data?.phone ?? "",
        is_admin: isAdmin(u.id),
      });
    }

    // -------- 3. Отправка заявки --------
    if (path === "/submit" && req.method === "POST") {
      const u = await getInitUser(req);
      if (!u) return json({ error: "unauthorized" }, 401);

      const body = await req.json();
      const items: { product_id: string; qty: number }[] = body.items ?? [];
      if (!items.length) return json({ error: "empty" }, 400);

      // Цены берём из БД, не доверяя клиенту
      const ids = items.map((i) => i.product_id);
      const { data: products } = await supabase
        .from("products").select("id, name, price").in("id", ids);
      const byId = new Map((products ?? []).map((p) => [p.id, p]));

      let total = 0;
      const rows = items
        .filter((i) => byId.has(i.product_id))
        .map((i) => {
          const p = byId.get(i.product_id)!;
          const qty = Math.max(1, Number(i.qty) || 1);
          total += Number(p.price) * qty;
          return { product_id: p.id, product_name: p.name, price: p.price, qty };
        });
      if (!rows.length) return json({ error: "no valid items" }, 400);

      const phone = (body.phone ?? "").toString().trim();
      const firstName = (body.firstName ?? u.first_name ?? "").toString().trim();
      const lastName = (body.lastName ?? u.last_name ?? "").toString().trim();
      const comment = (body.comment ?? "").toString().trim();

      const { data: reqRow, error: reqErr } = await supabase
        .from("requests")
        .insert({
          telegram_id: u.id,
          customer_first_name: firstName,
          customer_last_name: lastName,
          phone,
          comment,
          total,
          status: "new",
        })
        .select("id").single();
      if (reqErr) return json({ error: reqErr.message }, 500);

      await supabase.from("request_items")
        .insert(rows.map((r) => ({ ...r, request_id: reqRow.id })));

      if (phone) await upsertUser(u, phone);

      // Уведомление админам
      const lines = rows
        .map((r) => `• ${r.product_name} × ${r.qty} — ${fmt(r.price * r.qty)}`)
        .join("\n");
      const uname = u.username ? `@${u.username}` : `id ${u.id}`;
      const text =
        `🆕 <b>Новая заявка #${reqRow.id}</b>\n\n` +
        `👤 ${escapeHtml(firstName)} ${escapeHtml(lastName)} (${uname})\n` +
        `📞 ${escapeHtml(phone) || "—"}\n` +
        (comment ? `💬 ${escapeHtml(comment)}\n` : "") +
        `\n${lines}\n\n💰 <b>Итого: ${fmt(total)}</b>`;
      for (const adminId of ADMIN_IDS) {
        await tg("sendMessage", { chat_id: adminId, text, parse_mode: "HTML" });
      }

      return json({ ok: true, request_id: reqRow.id });
    }

    // -------- 3b. Мои заявки (для пользователя) --------
    if (path === "/my/requests" && req.method === "POST") {
      const u = await getInitUser(req);
      if (!u) return json({ error: "unauthorized" }, 401);
      const { data, error } = await supabase
        .from("requests")
        .select("*, items:request_items(*, product:products(image_url, images, description, category_id, is_active))")
        .eq("telegram_id", u.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return json({ error: error.message }, 500);
      return json({ requests: data ?? [] });
    }

    // -------- 4. Админ: товары --------
    if (path === "/admin/products") {
      const u = await getInitUser(req);
      if (!u || !isAdmin(u.id)) return json({ error: "forbidden" }, 403);

      if (req.method === "GET") {
        const { data } = await supabase.from("products")
          .select("*").order("sort_order").order("created_at", { ascending: false });
        return json({ products: data ?? [] });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = await req.json();

        const payload: Record<string, unknown> = {
          name: body.name,
          description: body.description ?? null,
          price: Number(body.price) || 0,
          is_active: body.is_active ?? true,
          sort_order: Number(body.sort_order) || 0,
          category_id: body.category_id || null,
          subcategory_id: body.subcategory_id || null,
          stock: (body.stock === null || body.stock === "" || body.stock === undefined)
            ? null : Number(body.stock),
        };

        // Картинки: оставляем переданные URL + грузим новые из base64.
        const kept: string[] = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
        const newB64: string[] = Array.isArray(body.imagesBase64) ? body.imagesBase64 : [];
        if (body.imageBase64) newB64.push(body.imageBase64); // обратная совместимость (одно фото)
        const uploaded: string[] = [];
        for (const b64 of newB64) {
          const u = await uploadImage(b64);
          if (u) uploaded.push(u);
        }
        // Обновляем галерею только если клиент прислал инфу о картинках.
        if (Array.isArray(body.images) || newB64.length) {
          const images = [...kept, ...uploaded];
          payload.images = images;
          payload.image_url = images[0] ?? null; // обложка = первое фото
        }

        if (req.method === "POST") {
          const { data, error } = await supabase.from("products")
            .insert(payload).select().single();
          if (error) return json({ error: error.message }, 500);
          return json({ product: data });
        } else {
          if (!body.id) return json({ error: "id required" }, 400);
          const { data, error } = await supabase.from("products")
            .update(payload).eq("id", body.id).select().single();
          if (error) return json({ error: error.message }, 500);
          return json({ product: data });
        }
      }

      if (req.method === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await supabase.from("products").delete().eq("id", id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }
    }

    // -------- 4b. Админ: категории --------
    if (path === "/admin/categories") {
      const u = await getInitUser(req);
      if (!u || !isAdmin(u.id)) return json({ error: "forbidden" }, 403);

      if (req.method === "GET") {
        const { data } = await supabase.from("categories")
          .select("*").order("sort_order").order("name");
        return json({ categories: data ?? [] });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = await req.json();
        const name = (body.name ?? "").toString().trim();
        if (!name) return json({ error: "name required" }, 400);

        let image_url = body.image_url ?? null;
        if (body.imageBase64) {
          const url = await uploadImage(body.imageBase64);
          if (url) image_url = url;
        }

        const payload: Record<string, unknown> = { name, sort_order: Number(body.sort_order) || 0 };
        if (image_url !== null) payload.image_url = image_url;

        if (req.method === "POST") {
          const { data, error } = await supabase.from("categories")
            .insert(payload).select().single();
          if (error) return json({ error: error.message }, 500);
          return json({ category: data });
        } else {
          if (!body.id) return json({ error: "id required" }, 400);
          const { data, error } = await supabase.from("categories")
            .update(payload).eq("id", body.id).select().single();
          if (error) return json({ error: error.message }, 500);
          return json({ category: data });
        }
      }

      if (req.method === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id) return json({ error: "id required" }, 400);
        // товары остаются (category_id → NULL по FK on delete set null)
        const { error } = await supabase.from("categories").delete().eq("id", id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }
    }

    // -------- 4b2. Админ: подкатегории --------
    if (path === "/admin/subcategories") {
      const u = await getInitUser(req);
      if (!u || !isAdmin(u.id)) return json({ error: "forbidden" }, 403);

      if (req.method === "GET") {
        const cat = url.searchParams.get("category_id");
        let q = supabase.from("subcategories").select("*").order("sort_order").order("name");
        if (cat) q = q.eq("category_id", cat);
        const { data } = await q;
        return json({ subcategories: data ?? [] });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = await req.json();
        const name = (body.name ?? "").toString().trim();
        if (!name) return json({ error: "name required" }, 400);

        if (req.method === "POST") {
          if (!body.category_id) return json({ error: "category_id required" }, 400);
          const { data, error } = await supabase.from("subcategories")
            .insert({ category_id: body.category_id, name, sort_order: Number(body.sort_order) || 0 })
            .select().single();
          if (error) return json({ error: error.message }, 500);
          return json({ subcategory: data });
        } else {
          if (!body.id) return json({ error: "id required" }, 400);
          const { data, error } = await supabase.from("subcategories")
            .update({ name }).eq("id", body.id).select().single();
          if (error) return json({ error: error.message }, 500);
          return json({ subcategory: data });
        }
      }

      if (req.method === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await supabase.from("subcategories").delete().eq("id", id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }
    }

    // -------- 4c. Админ: анонсы --------
    if (path === "/admin/announcements") {
      const u = await getInitUser(req);
      if (!u || !isAdmin(u.id)) return json({ error: "forbidden" }, 403);

      if (req.method === "GET") {
        const { data } = await supabase.from("announcements")
          .select("*").order("sort_order").order("created_at", { ascending: false });
        return json({ announcements: data ?? [] });
      }

      if (req.method === "POST" || req.method === "PATCH") {
        const body = await req.json();
        let image_url = body.image_url ?? null;
        if (body.imageBase64) {
          const url2 = await uploadImage(body.imageBase64);
          if (url2) image_url = url2;
        }
        const payload: Record<string, unknown> = {
          title: body.title ?? null,
          is_active: body.is_active ?? true,
          sort_order: Number(body.sort_order) || 0,
        };
        if (image_url !== null) payload.image_url = image_url;

        if (req.method === "POST") {
          const { data, error } = await supabase.from("announcements")
            .insert(payload).select().single();
          if (error) return json({ error: error.message }, 500);
          return json({ announcement: data });
        } else {
          if (!body.id) return json({ error: "id required" }, 400);
          const { data, error } = await supabase.from("announcements")
            .update(payload).eq("id", body.id).select().single();
          if (error) return json({ error: error.message }, 500);
          return json({ announcement: data });
        }
      }

      if (req.method === "DELETE") {
        const id = url.searchParams.get("id");
        if (!id) return json({ error: "id required" }, 400);
        const { error } = await supabase.from("announcements").delete().eq("id", id);
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }
    }

    // -------- 4d. Админ: порядок (drag-and-drop) --------
    if (path === "/admin/reorder") {
      const u = await getInitUser(req);
      if (!u || !isAdmin(u.id)) return json({ error: "forbidden" }, 403);
      if (req.method === "POST") {
        const body = await req.json();
        const tables: Record<string, string> = {
          products: "products", categories: "categories",
          subcategories: "subcategories", announcements: "announcements",
        };
        const table = tables[body.type];
        const ids: string[] = Array.isArray(body.ids) ? body.ids : [];
        if (!table || !ids.length) return json({ error: "bad params" }, 400);
        for (let i = 0; i < ids.length; i++) {
          await supabase.from(table).update({ sort_order: i }).eq("id", ids[i]);
        }
        return json({ ok: true });
      }
    }

    // -------- 4e. Админ: настройки бота --------
    if (path === "/admin/settings") {
      const u = await getInitUser(req);
      if (!u || !isAdmin(u.id)) return json({ error: "forbidden" }, 403);

      if (req.method === "GET") {
        const { data } = await supabase.from("settings").select("key, value");
        const map: Record<string, string> = {};
        for (const row of (data ?? [])) map[row.key] = row.value;
        return json({
          start_message: map["start_message"] ?? "",
          start_button:  map["start_button"]  ?? "",
        });
      }

      if (req.method === "POST") {
        const body = await req.json();
        const rows = [
          { key: "start_message", value: (body.start_message ?? "").toString() },
          { key: "start_button",  value: (body.start_button  ?? "").toString() },
        ];
        const { error } = await supabase.from("settings").upsert(rows, { onConflict: "key" });
        if (error) return json({ error: error.message }, 500);
        return json({ ok: true });
      }
    }

    // -------- 5. Админ: заявки --------
    if (path === "/admin/requests") {
      const u = await getInitUser(req);
      if (!u || !isAdmin(u.id)) return json({ error: "forbidden" }, 403);

      if (req.method === "GET") {
        const { data, error } = await supabase
          .from("requests")
          .select("*, items:request_items(*, product:products(image_url, images, description, category_id, is_active))")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) return json({ error: error.message }, 500);
        return json({ requests: data ?? [] });
      }

      if (req.method === "PATCH") {
        const body = await req.json();
        const allowed = ["new", "in_progress", "done", "canceled"];
        if (!body.id || !allowed.includes(body.status)) {
          return json({ error: "bad params" }, 400);
        }
        const { data, error } = await supabase
          .from("requests").update({ status: body.status })
          .eq("id", body.id).select().single();
        if (error) return json({ error: error.message }, 500);

        // Уведомление клиенту о смене статуса
        if (data?.telegram_id) {
          const labels: Record<string, string> = {
            new: "принята ✅",
            in_progress: "в работе 🛠",
            done: "выполнена 🎉",
            canceled: "отменена ❌",
          };
          const txt = `Ваша заявка #${data.id} — ${labels[body.status] || body.status}.`;
          try { await tg("sendMessage", { chat_id: data.telegram_id, text: txt }); } catch (_e) { /* клиент мог не писать боту */ }
        }
        return json({ request: data });
      }
    }

    return json({ error: "not found", path }, 404);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

// ---------- утилиты ----------
function fmt(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(Math.round(Number(n))) + " ₽";
}
function escapeHtml(s: string): string {
  return s.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
}
async function uploadImage(dataUrl: string): Promise<string | null> {
  const m = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!m) return null;
  const [, mime, b64] = m;
  const ext = mime.split("/")[1];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("product-images").upload(fileName, bytes, { contentType: mime, upsert: false });
  if (error) return null;
  const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
  return data.publicUrl;
}
