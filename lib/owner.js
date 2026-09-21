// lib/owner.js  (Lia: strumenti per il titolare: agenda del giorno e messaggi su Telegram)
// Variabili su Vercel: SUPABASE_URL, SUPABASE_SECRET_KEY, TELEGRAM_BOT_TOKEN.
// Opzionale: PUBLIC_URL (l'indirizzo pubblico del sito, senza / finale).

const PUBLIC_URL = process.env.PUBLIC_URL || "https://wa-receptionist-sigma.vercel.app";

function sbHeaders(extra) {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const h = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key;
  return Object.assign(h, extra || {});
}

async function sb(method, path, body, prefer) {
  const res = await fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, {
    method: method,
    headers: sbHeaders(prefer ? { Prefer: prefer } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }
  return { ok: res.ok, status: res.status, data: data };
}

function tzOffsetMs(utcMs, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - utcMs;
}

function zonedTimeToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(guess, tz);
  let utc = guess - off1;
  const off2 = tzOffsetMs(utc, tz);
  if (off2 !== off1) utc = guess - off2;
  return new Date(utc);
}

function todayStr(tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// Link all'agenda web del titolare
async function agendaLink(biz) {
  try {
    let token = biz.agenda_token;
    if (!token) {
      const r = await sb("GET", "businesses?id=eq." + biz.id + "&select=agenda_token");
      if (r.ok && Array.isArray(r.data) && r.data.length) token = r.data[0].agenda_token;
    }
    return token ? PUBLIC_URL + "/api/agenda?t=" + token : "";
  } catch (e) {
    return "";
  }
}

// Testo dell'agenda di un giorno: offset 0 = oggi, 1 = domani
// options.greeting = true per il recap del mattino
async function agendaText(biz, offset, options) {
  const tz = biz.timezone || "Europe/Rome";
  const date = addDays(todayStr(tz), offset);
  const start = zonedTimeToUtc(date, "00:00", tz);
  const end = zonedTimeToUtc(addDays(date, 1), "00:00", tz);

  const r = await sb(
    "GET",
    "appointments?business_id=eq." + biz.id +
      "&status=eq.confirmed" +
      "&starts_at=gte." + encodeURIComponent(start.toISOString()) +
      "&starts_at=lt." + encodeURIComponent(end.toISOString()) +
      "&order=starts_at.asc" +
      "&select=starts_at,ends_at,customer_name,customer_phone,customer_address,notes,services(name),resources(name)"
  );
  if (!r.ok || !Array.isArray(r.data)) throw new Error("Errore lettura agenda");

  const dayLabel = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: tz }).format(start);
  const when = offset === 0 ? "di oggi" : offset === 1 ? "di domani" : "";
  const timeFmt = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: tz });

  const head = (options && options.greeting ? "Buongiorno! " : "") +
    "Ecco l'agenda " + when + ", " + dayLabel + " (" + biz.name + ").";

  const link = await agendaLink(biz);
  const foot = link ? "\n\nApri l'agenda: " + link : "";

  if (!r.data.length) {
    return head + "\n\nNessun appuntamento. " + (options && options.greeting ? "Buona giornata!" : "") + foot;
  }

  const resources = {};
  r.data.forEach((a) => { if (a.resources && a.resources.name) resources[a.resources.name] = true; });
  const showResource = Object.keys(resources).length > 1;

  const lines = r.data.map((a, i) => {
    const bits = [];
    if (a.services && a.services.name) bits.push(a.services.name);
    if (showResource && a.resources) bits.push(a.resources.name);
    if (a.customer_phone) bits.push(a.customer_phone);
    let s = (i + 1) + ") " + timeFmt.format(new Date(a.starts_at)) + "–" + timeFmt.format(new Date(a.ends_at)) + "  " + a.customer_name;
    if (bits.length) s += "\n    " + bits.join(" · ");
    if (a.customer_address) s += "\n    Indirizzo: " + a.customer_address;
    if (a.notes) s += "\n    Note: " + a.notes;
    return s;
  });

  const n = r.data.length;
  return head + "\n\n" + lines.join("\n\n") + "\n\nTotale: " + n + (n === 1 ? " appuntamento." : " appuntamenti.") + foot;
}

// Manda un messaggio Telegram a una chat
async function sendTelegram(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN || "";
  if (!token) return false;
  try {
    const r = await fetch("https://api.telegram.org/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: text }),
    });
    if (!r.ok) console.error("Telegram sendMessage:", r.status);
    return r.ok;
  } catch (e) {
    console.error("Telegram sendMessage:", e);
    return false;
  }
}

module.exports = { sb, agendaText, sendTelegram };
