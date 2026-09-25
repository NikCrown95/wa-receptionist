// lib/lia.js  (Lia v5: il cervello comune a WhatsApp, chat sul sito e Telegram)
//
// Variabili su Vercel: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY.
// Opzionali: BUSINESS_SLUG, CLAUDE_MODEL.

const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
const DEFAULT_SLUG = process.env.BUSINESS_SLUG || "barbiere-mario";
const SLOT_STEP_MIN = 15; // allineato alla dashboard: proposte ogni 15 minuti
const MIN_LEAD_MIN = 15; // non si prenota a meno di 15 minuti da adesso
const MAX_DAYS_AHEAD = 60;
const MAX_PER_CONTACT_HOUR = 40; // messaggi all'ora per cliente
const MAX_PER_BUSINESS_HOUR = 400; // messaggi all'ora per attività (protegge dai costi)
const MAX_TEXT = 600;

// ====================== SUPABASE (via REST) ======================
function sbHeaders(extra) {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const h = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key; // solo per chiavi vecchie
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

async function getBusiness(slug) {
  const r = await sb(
    "GET",
    "businesses?slug=eq." + encodeURIComponent(slug) +
      "&active=eq.true&select=*,services(*),resources(*,opening_hours(*))"
  );
  if (!r.ok || !Array.isArray(r.data) || !r.data.length) return null;
  const b = r.data[0];
  b.services = (b.services || []).filter((s) => s.active);
  b.resources = (b.resources || []).filter((x) => x.active);
  return b;
}

// ====================== DATE E ORARI ======================
function tzOffsetMs(utcMs, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - utcMs;
}

// "2026-09-24" + "17:30" nel fuso dell'attività -> Date in UTC
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

function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow; // 1 = lunedì ... 7 = domenica
}

function italianDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("it-IT", { weekday: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

function hmToMin(hm) {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function minToHm(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return h + ":" + m;
}

function formatLocal(iso, tz) {
  return new Intl.DateTimeFormat("it-IT", {
    weekday: "long", day: "numeric", month: "long",
    hour: "2-digit", minute: "2-digit", timeZone: tz,
  }).format(new Date(iso));
}

// ====================== ORARI LIBERI ======================
async function getBusinessBlocks(businessId, dateStr) {
  const r = await sb(
    "GET",
    "business_blocks?business_id=eq." + businessId +
      "&date=eq." + dateStr +
      "&select=starts_at,ends_at"
  );
  if (r.status === 404) return [];
  if (!r.ok || !Array.isArray(r.data)) throw new Error("Errore lettura indisponibilità");
  return r.data;
}

async function freeSlots(biz, service, dateStr) {
  const tz = biz.timezone;
  const dayStart = zonedTimeToUtc(dateStr, "00:00", tz);
  const dayEnd = zonedTimeToUtc(addDays(dateStr, 1), "00:00", tz);
  const wd = weekdayOf(dateStr);
  const ids = biz.resources.map((r) => r.id);
  if (!ids.length) return [];

  const q =
    "appointments?resource_id=in.(" + ids.join(",") + ")" +
    "&status=eq.confirmed" +
    "&starts_at=lt." + encodeURIComponent(dayEnd.toISOString()) +
    "&blocked_until=gt." + encodeURIComponent(dayStart.toISOString()) +
    "&select=resource_id,starts_at,blocked_until";
  const r = await sb("GET", q);
  if (!r.ok || !Array.isArray(r.data)) throw new Error("Errore lettura appuntamenti");

  const blocks = await getBusinessBlocks(biz.id, dateStr);
  const blockedRanges = blocks
    .map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)])
    .filter((b) => Number.isFinite(b[0]) && Number.isFinite(b[1]));

  const nowMs = Date.now() + MIN_LEAD_MIN * 60000;
  const out = [];

  for (const res of biz.resources) {
    const intervals = (res.opening_hours || [])
      .filter((h) => h.weekday === wd)
      .sort((a, b) => (a.opens < b.opens ? -1 : 1));
    const busy = r.data
      .filter((b) => b.resource_id === res.id)
      .map((b) => [Date.parse(b.starts_at), Date.parse(b.blocked_until)]);

    for (const h of intervals) {
      let t = hmToMin(h.opens.slice(0, 5));
      const tEnd = hmToMin(h.closes.slice(0, 5));
      while (t + service.duration_min <= tEnd) {
        const label = minToHm(t);
        const startMs = zonedTimeToUtc(dateStr, label, tz).getTime();
        const endMs = startMs + service.duration_min * 60000;
        const blockedMs = endMs + (service.buffer_min || 0) * 60000;
        const free = startMs >= nowMs && !busy.some((b) => startMs < b[1] && blockedMs > b[0]) && !blockedRanges.some((b) => startMs < b[1] && blockedMs > b[0]);
        if (free) out.push({ time: label, resource_id: res.id });
        t += SLOT_STEP_MIN;
      }
    }
  }
  return out;
}

function findService(biz, name) {
  const n = String(name || "").toLowerCase().trim();
  if (!n) return null;
  return (
    biz.services.find((s) => s.name.toLowerCase() === n) ||
    biz.services.find((s) => s.name.toLowerCase().includes(n) || n.includes(s.name.toLowerCase())) ||
    null
  );
}

// Il nome usato per prenotare deve essere stato scritto dal cliente in questa conversazione
function nameIsFromCustomer(name, userTexts) {
  const words = String(name || "").toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return false;
  return userTexts.some((t) => t.includes(words[0]));
}

// Il numero di telefono, quando serve, deve averlo scritto il cliente
function phoneIsFromCustomer(phone, userTexts) {
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const p = digits(phone);
  if (p.length < 8 || p.length > 15) return false;
  return userTexts.some((t) => digits(t).includes(p.slice(-8)));
}

function checkDate(biz, dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return "Data non valida: usa il formato AAAA-MM-GG.";
  const today = todayStr(biz.timezone);
  if (dateStr < today) return "Quella data è già passata.";
  if (dateStr > addDays(today, MAX_DAYS_AHEAD)) return "Si prenota al massimo con " + MAX_DAYS_AHEAD + " giorni di anticipo.";
  return null;
}

// ====================== STRUMENTI PER CLAUDE ======================
const TOOLS = [
  {
    name: "check_availability",
    description: "Controlla gli orari liberi per un servizio in un giorno preciso. Usalo SEMPRE prima di proporre orari.",
    input_schema: {
      type: "object",
      properties: {
        service_name: { type: "string", description: "Nome del servizio richiesto" },
        date: { type: "string", description: "Giorno nel formato AAAA-MM-GG" },
        part_of_day: { type: "string", enum: ["mattina", "pomeriggio", "tutto"], description: "Fascia della giornata richiesta" },
      },
      required: ["service_name", "date"],
    },
  },
  {
    name: "book_appointment",
    description: "Registra un appuntamento sull'agenda. Usalo solo quando il cliente ha scelto un orario e ti ha detto il suo nome.",
    input_schema: {
      type: "object",
      properties: {
        service_name: { type: "string" },
        date: { type: "string", description: "AAAA-MM-GG" },
        time: { type: "string", description: "Orario di inizio HH:MM, uno di quelli restituiti da check_availability" },
        customer_name: { type: "string" },
        customer_phone: { type: "string", description: "Numero di telefono scritto dal cliente. Serve solo quando scrive dal sito o da Telegram; su WhatsApp non serve." },
        address: { type: "string", description: "Indirizzo del cliente, solo per i servizi a domicilio" },
        notes: { type: "string", description: "Note utili del cliente, se ce ne sono" },
      },
      required: ["service_name", "date", "time", "customer_name"],
    },
  },
  {
    name: "list_my_appointments",
    description: "Elenca i prossimi appuntamenti confermati di questo cliente.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "cancel_appointment",
    description: "Annulla un appuntamento di questo cliente, dopo che ha confermato di volerlo annullare.",
    input_schema: {
      type: "object",
      properties: { appointment_id: { type: "string", description: "Id preso da list_my_appointments" } },
      required: ["appointment_id"],
    },
  },
];
// I 4 strumenti non cambiano mai: segniamo l'ultimo come punto fino a cui la cache può riusare tutto.
TOOLS[TOOLS.length - 1].cache_control = { type: "ephemeral" };

async function runTool(name, input, ctx) {
  const biz = ctx.biz;
  try {
    if (name === "check_availability") {
      const service = findService(biz, input.service_name);
      if (!service) return { error: "Servizio non trovato. Servizi disponibili: " + biz.services.map((s) => s.name).join(", ") };
      const bad = checkDate(biz, input.date);
      if (bad) return { error: bad };
      const slots = await freeSlots(biz, service, input.date);
      let times = Array.from(new Set(slots.map((s) => s.time))).sort();
      if (input.part_of_day === "mattina") times = times.filter((t) => t < "13:00");
      if (input.part_of_day === "pomeriggio") times = times.filter((t) => t >= "13:00");
      return {
        date: input.date,
        weekday: italianDay(input.date),
        service: service.name,
        duration_min: service.duration_min,
        price_eur: service.price_eur,
        available_times: times.slice(0, 12),
        note: times.length ? undefined : "Nessun orario libero (chiuso o tutto occupato).",
      };
    }

    if (name === "book_appointment") {
      const service = findService(biz, input.service_name);
      if (!service) return { error: "Servizio non trovato." };
      const bad = checkDate(biz, input.date);
      if (bad) return { error: bad };
      if (!/^\d{2}:\d{2}$/.test(String(input.time || ""))) return { error: "Orario non valido: usa HH:MM." };
      if (!String(input.customer_name || "").trim()) return { error: "Serve il nome del cliente." };
      if (!nameIsFromCustomer(input.customer_name, ctx.userTexts || [])) {
        return { error: "Il cliente non ti ha ancora scritto questo nome. Chiedigli: 'A che nome prenoto?' e usa il nome che scrive lui." };
      }
      let phoneToStore = ctx.phone;
      if (ctx.channel !== "whatsapp") {
        phoneToStore = String(input.customer_phone || "").trim();
        if (!phoneIsFromCustomer(phoneToStore, ctx.userTexts || [])) {
          return { error: "Serve il numero di telefono del cliente, scritto da lui. Chiedigli: 'Con quale numero di telefono prenoto?'" };
        }
      }
      if (service.at_customer_place && !String(input.address || "").trim()) {
        return { error: "Questo servizio è a domicilio: chiedi l'indirizzo al cliente." };
      }

      const slots = await freeSlots(biz, service, input.date);
      const candidates = slots.filter((s) => s.time === input.time);
      if (!candidates.length) return { error: "Quell'orario non è disponibile. Richiama check_availability e proponi altri orari." };

      const start = zonedTimeToUtc(input.date, input.time, biz.timezone);
      const end = new Date(start.getTime() + service.duration_min * 60000);
      const blocked = new Date(end.getTime() + (service.buffer_min || 0) * 60000);

      for (const c of candidates) {
        const r = await sb("POST", "appointments", {
          business_id: biz.id,
          resource_id: c.resource_id,
          service_id: service.id,
          customer_name: String(input.customer_name).trim(),
          customer_phone: phoneToStore,
          channel: ctx.channel,
          contact_id: ctx.contactId,
          customer_address: input.address || null,
          notes: input.notes || null,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          blocked_until: blocked.toISOString(),
        }, "return=representation");
        if (r.ok) {
          return {
            ok: true,
            when: formatLocal(start.toISOString(), biz.timezone),
            service: service.name,
            customer_name: input.customer_name,
          };
        }
        if (r.status !== 409) return { error: "Errore nel salvataggio dell'appuntamento." };
      }
      return { error: "Quell'orario è appena stato preso. Richiama check_availability e proponi altri orari." };
    }

    if (name === "list_my_appointments") {
      const r = await sb(
        "GET",
        "appointments?business_id=eq." + biz.id +
          "&contact_id=eq." + encodeURIComponent(ctx.contactId) +
          "&status=eq.confirmed&starts_at=gt." + encodeURIComponent(new Date().toISOString()) +
          "&order=starts_at.asc&select=id,starts_at,services(name)"
      );
      if (!r.ok) return { error: "Errore nella lettura degli appuntamenti." };
      return {
        appointments: r.data.map((a) => ({
          id: a.id,
          when: formatLocal(a.starts_at, biz.timezone),
          service: a.services ? a.services.name : null,
        })),
      };
    }

    if (name === "cancel_appointment") {
      const r = await sb(
        "PATCH",
        "appointments?id=eq." + encodeURIComponent(input.appointment_id) +
          "&contact_id=eq." + encodeURIComponent(ctx.contactId) +
          "&status=eq.confirmed",
        { status: "cancelled" },
        "return=representation"
      );
      if (!r.ok || !Array.isArray(r.data) || !r.data.length) return { error: "Appuntamento non trovato." };
      return { ok: true };
    }

    return { error: "Strumento sconosciuto." };
  } catch (e) {
    console.error("Errore strumento", name, e);
    return { error: "Problema tecnico temporaneo." };
  }
}

// ====================== ISTRUZIONI PER L'AI ======================
function hoursSummary(biz) {
  const res = biz.resources[0];
  if (!res) return "non disponibili";
  const names = ["", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
  const lines = [];
  for (let wd = 1; wd <= 7; wd++) {
    const iv = (res.opening_hours || [])
      .filter((h) => h.weekday === wd)
      .sort((a, b) => (a.opens < b.opens ? -1 : 1))
      .map((h) => h.opens.slice(0, 5) + "-" + h.closes.slice(0, 5));
    lines.push(names[wd] + ": " + (iv.length ? iv.join(" e ") : "chiuso"));
  }
  return lines.join("; ");
}

// La parte STABILE del prompt: cambia solo quando il titolare modifica servizi/orari,
// o al massimo una volta al giorno (la lista dei 15 giorni). Questa è la parte che mettiamo in cache.
function systemPromptStatic(biz, channel) {
  const tz = biz.timezone;
  const today = todayStr(tz);
  const days = [];
  for (let i = 0; i < 15; i++) {
    const d = addDays(today, i);
    days.push(italianDay(d) + " " + d);
  }
  const channelNote = channel === "whatsapp" ? "" :
    "\n- Il cliente ti scrive dal " + (channel === "telegram" ? "bot Telegram" : "sito web") +
    ", quindi non hai il suo numero di telefono: chiedilo insieme al nome (\"A che nome e con quale numero di telefono prenoto?\") e passalo a book_appointment come customer_phone. Il numero deve essere quello che scrive il cliente.";
  const services = biz.services
    .map((s) => "- " + s.name + ": " + s.duration_min + " min, " + s.price_eur + " euro" +
      (s.at_customer_place ? " (a domicilio: serve l'indirizzo)" : ""))
    .join("\n");

  return `Sei la segretaria virtuale di "${biz.name}"${biz.business_type ? " (" + biz.business_type + ")" : ""} e rispondi ai clienti su WhatsApp.

Calendario dei prossimi giorni (usa SOLO questo, insieme alla riga "Adesso" più sotto, per convertire "giovedì", "domani", ecc. in una data):
${days.join("\n")}

Servizi:
${services}

Orari di apertura: ${hoursSummary(biz)}
${biz.assistant_notes ? "\nIstruzioni del titolare: " + biz.assistant_notes + "\n" : ""}
Come lavori:
- Scrivi in italiano, messaggi brevi e cordiali, da chat WhatsApp (2-3 righe, niente elenchi lunghi).
- NON inventare mai la disponibilità: per proporre orari usa SEMPRE check_availability. Proponi 2 o 3 orari, non tutti.
- Per prenotare servono servizio, giorno, ora e nome del cliente. Chiedi una cosa alla volta.${channelNote}
- Il nome: se il cliente non ti ha ancora detto come si chiama in questa conversazione, chiedilo ("A che nome prenoto?"). Se te l'ha già detto, chiedi conferma prima di prenotare ("A nome di Nico, giusto?"), perché potrebbe prenotare per un'altra persona. Non usare mai un nome che il cliente non ha scritto.
- Prenota con book_appointment solo dopo che il cliente ha scelto un orario e ha confermato il nome.
- Di' che l'appuntamento è confermato SOLO dopo che book_appointment ha risposto ok. Se risponde con un errore, spiega e proponi altri orari.
- Per annullare: usa list_my_appointments, chiedi conferma, poi cancel_appointment.
- Se la richiesta esce da quello che sai fare (sconti, preventivi, urgenze, domande strane), di' che passi la richiesta a ${biz.name}.
- Se la conversazione è già iniziata, NON ripetere il saluto e non ripartire da capo: continua da dove eravate, ricordando servizio, giorno e orario già detti. Non usare emoji. Se devi scusarti scrivi semplicemente "scusa" o "mi dispiace" (mai "mi scusa").
- Se il cliente risponde solo con un numero (es. "15") dopo che hai proposto degli orari, intendi quell'orario.
- Non inventare informazioni sull'attività.`;
}

// La parte che cambia OGNI messaggio (l'ora esatta): la teniamo fuori dal blocco in cache,
// altrimenti il testo cambierebbe sempre e la cache non funzionerebbe mai.
function systemPromptNow(biz) {
  const now = new Intl.DateTimeFormat("it-IT", { dateStyle: "full", timeStyle: "short", timeZone: biz.timezone }).format(new Date());
  return `Adesso: ${now} (Italia).`;
}

// ====================== STORICO DELLA CONVERSAZIONE (su Supabase) ======================
async function loadHistory(bizId, phone) {
  try {
    const since = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const r = await sb(
      "GET",
      "chat_messages?business_id=eq." + bizId +
        "&customer_phone=eq." + encodeURIComponent(phone) +
        "&created_at=gt." + encodeURIComponent(since) +
        "&order=created_at.desc&limit=14&select=role,content"
    );
    if (!r.ok || !Array.isArray(r.data)) return [];
    return r.data.reverse().map((m) => ({ role: m.role, content: m.content }));
  } catch (e) {
    console.error("Errore storico:", e);
    return [];
  }
}

async function saveMessage(bizId, phone, role, content) {
  try {
    await sb("POST", "chat_messages", { business_id: bizId, customer_phone: phone, role: role, content: content });
  } catch (e) {
    console.error("Errore salvataggio messaggio:", e);
  }
}

function normalizza(messaggi) {
  const out = [];
  for (const m of messaggi) {
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.role === m.role) ultimo.content += "\n" + m.content;
    else out.push({ role: m.role, content: m.content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

// ====================== CLAUDE ======================
async function callClaude(systemStatic, systemNow, messages) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      // Due blocchi: il primo (stabile) segnato per la cache, il secondo (l'ora) sempre fresco.
      system: [
        { type: "text", text: systemStatic, cache_control: { type: "ephemeral" } },
        { type: "text", text: systemNow },
      ],
      tools: TOOLS,
      messages: messages,
    }),
  });
  const data = await r.json();
  if (!r.ok) {
    console.error("Errore Anthropic:", JSON.stringify(data));
    throw new Error("anthropic");
  }
  return data;
}

async function conversa(biz, base, messages) {
  const systemStatic = systemPromptStatic(biz, base.channel);
  const msgs = messages.slice();
  const userTexts = messages.filter((m) => m.role === "user" && typeof m.content === "string").map((m) => m.content.toLowerCase());
  for (let i = 0; i < 6; i++) {
    const systemNow = systemPromptNow(biz); // ricalcolata a ogni giro, ma pesa pochissimo
    const data = await callClaude(systemStatic, systemNow, msgs);
    if (data.stop_reason !== "tool_use") {
      return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    }
    msgs.push({ role: "assistant", content: data.content });
    const results = [];
    for (const block of data.content) {
      if (block.type !== "tool_use") continue;
      const out = await runTool(block.name, block.input || {}, { biz: biz, phone: base.phone, contactId: base.contactId, channel: base.channel, userTexts: userTexts });
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(out),
        is_error: !!out.error,
      });
    }
    msgs.push({ role: "user", content: results });
  }
  return "";
}

// ====================== LIMITE DI MESSAGGI (protegge i costi) ======================
async function isRateLimited(bizId, contactId) {
  try {
    const since = encodeURIComponent(new Date(Date.now() - 3600 * 1000).toISOString());
    const base = "chat_messages?role=eq.user&created_at=gt." + since + "&business_id=eq." + bizId;
    const mine = await sb("GET", base + "&customer_phone=eq." + encodeURIComponent(contactId) + "&select=id&limit=" + (MAX_PER_CONTACT_HOUR + 1));
    if (mine.ok && Array.isArray(mine.data) && mine.data.length > MAX_PER_CONTACT_HOUR) return true;
    const all = await sb("GET", base + "&select=id&limit=" + (MAX_PER_BUSINESS_HOUR + 1));
    if (all.ok && Array.isArray(all.data) && all.data.length > MAX_PER_BUSINESS_HOUR) return true;
  } catch (e) {
    console.error("Errore limite:", e);
  }
  return false;
}

// ====================== PUNTO D'INGRESSO COMUNE ======================
// channel: "whatsapp" | "web" | "telegram"
// contactId: identifica il cliente sul canale (numero, "web:<id>", "tg:<id>")
// phone: numero di telefono vero, solo su WhatsApp
async function handleMessage(opts) {
  const biz = await getBusiness(opts.slug || DEFAULT_SLUG);
  if (!biz) throw new Error("Attività non trovata");
  const text = String(opts.text || "").trim().slice(0, MAX_TEXT);
  if (!text) return { reply: "", business: biz };

  if (await isRateLimited(biz.id, opts.contactId)) {
    return { reply: "Stai scrivendo molto in fretta: riprova tra qualche minuto.", business: biz };
  }

  const storico = await loadHistory(biz.id, opts.contactId);
  await saveMessage(biz.id, opts.contactId, "user", text);
  const messages = normalizza([...storico, { role: "user", content: text }]);

  const reply = await conversa(biz, { channel: opts.channel, contactId: opts.contactId, phone: opts.phone }, messages);
  if (reply) await saveMessage(biz.id, opts.contactId, "assistant", reply);
  return { reply: reply, business: biz };
}

module.exports = { handleMessage, getBusiness, sb, DEFAULT_SLUG };
