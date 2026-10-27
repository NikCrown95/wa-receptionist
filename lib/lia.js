// lib/lia.js  (Lia v5: il cervello comune a WhatsApp, chat sul sito e Telegram)
//
// Variabili su Vercel: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SECRET_KEY.
// Opzionali: BUSINESS_SLUG, CLAUDE_MODEL.

const { getAccess, customerBlockedMessage } = require("./access.js");
const { logAiUsage } = require("./usage.js");
const mail = require("./mail.js");
const promos = require("./promos.js");
const { phoneProblem, emailProblem } = require("./validate.js");
const { attachStaff, resourceOk, eligibleStaff, dropBrokenPackages, isPackage, maxUnits, unitsOf } = require("./staff.js");

const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001";
const DEFAULT_SLUG = process.env.BUSINESS_SLUG || "barbiere-mario";
const SLOT_STEP_MIN = 15; // allineato alla dashboard: proposte ogni 15 minuti
const MIN_LEAD_MIN = 15; // minimo di sistema: il titolare puo' solo alzarlo
const CANCEL_LIMIT_DEFAULT_H = 2;
function leadMin(biz) {
  const v = Number(biz && biz.min_notice_min);
  return Number.isFinite(v) && v >= MIN_LEAD_MIN ? Math.min(v, 2880) : MIN_LEAD_MIN;
}
function cancelLimitH(biz) {
  const v = biz && biz.cancel_limit_hours;
  if (v === null || v === undefined) return CANCEL_LIMIT_DEFAULT_H;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 168) : CANCEL_LIMIT_DEFAULT_H;
}
const MAX_DAYS_AHEAD = 90; // anticipo massimo di default (circa 3 mesi); il titolare puo' cambiarlo nelle Regole di prenotazione
const ADVANCE_CHOICES = [7, 14, 30, 60, 90, 180];
function maxAdvance(biz) {
  const v = Number(biz && biz.max_advance_days);
  return ADVANCE_CHOICES.includes(v) ? v : MAX_DAYS_AHEAD;
}
function advanceLabel(days) {
  if (days === 7) return "1 settimana";
  if (days === 14) return "2 settimane";
  if (days === 30) return "1 mese";
  if (days === 60 || days === 90 || days === 180) return days / 30 + " mesi";
  return days + " giorni";
}

// Regole di prenotazione particolari di un'attività (colonna booking_rules, impostata solo per il circolo di tennis).
// Senza regola tutto funziona come sempre.
function partyRules(biz) {
  const r = biz && biz.booking_rules;
  if (!r || typeof r !== "object" || !Array.isArray(r.players)) return null;
  const players = r.players.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 20).sort((a, b) => a - b);
  if (!players.length) return null;
  const lim = Number(r.member_daily_limit_min);
  const memberDailyMin = (r.members === true && Number.isInteger(lim) && lim > 0) ? lim : null;
  return { players, members: r.members === true, certificate: r.medical_certificate === true, memberDailyMin };
}
function validateParty(rules, input) {
  const p = Number(input && input.players);
  if (!rules.players.includes(p)) return { error: "I giocatori devono essere " + rules.players.join(" oppure ") + "." };
  let m = null;
  if (rules.members) {
    m = Number(input && input.members);
    if (!Number.isInteger(m) || m < 0 || m > p) return { error: "Indica quanti dei " + p + " giocatori sono soci (da 0 a " + p + ")." };
  }
  // Limite giornaliero per i soci: serve sapere se chi prenota è socio (sì/no)
  let bm = null;
  if (rules.memberDailyMin) {
    const v = input && input.booker_member;
    if (v !== true && v !== false) return { error: "Indica se chi prenota è socio del circolo." };
    bm = v === true;
    if (bm && m < 1) return { error: "Se chi prenota è socio, tra i giocatori deve esserci almeno 1 socio." };
  }
  return { players: p, members: m, nonMembers: m === null ? p : p - m, bookerMember: bm };
}

function limitLabel(min) {
  if (min % 60 === 0) return min === 60 ? "un'ora" : (min / 60) + " ore";
  return min + " minuti";
}

// Un socio non può prenotare più di N minuti di campo al giorno (contando tutte le sue prenotazioni
// confermate di quel giorno, riconosciuto dal numero di telefono). Restituisce un messaggio se il limite
// viene superato, altrimenti null. Se il controllo non riesce si lascia passare (come gli altri controlli anti-abuso).
async function memberDayCheck(biz, rules, party, phone, dateStr, minutes, excludeId) {
  if (!rules || !rules.memberDailyMin || !party || party.bookerMember !== true) return null;
  try {
    const tz = biz.timezone;
    const dayStart = zonedTimeToUtc(dateStr, "00:00", tz);
    const dayEnd = zonedTimeToUtc(addDays(dateStr, 1), "00:00", tz);
    const r = await sb("GET", "appointments?business_id=eq." + biz.id + "&status=eq.confirmed" +
      "&starts_at=gte." + encodeURIComponent(dayStart.toISOString()) +
      "&starts_at=lt." + encodeURIComponent(dayEnd.toISOString()) +
      "&select=id,customer_phone,starts_at,ends_at");
    if (!r.ok || !Array.isArray(r.data)) return null;
    const key = (p) => String(p || "").replace(/\D/g, "").slice(-9);
    const mine = key(phone);
    if (!mine) return null;
    let used = 0;
    for (const a of r.data) {
      if (excludeId && a.id === excludeId) continue;
      if (key(a.customer_phone) === mine) used += Math.round((new Date(a.ends_at) - new Date(a.starts_at)) / 60000);
    }
    if (used + minutes > rules.memberDailyMin) {
      return "Come socio puoi prenotare il campo al massimo per " + limitLabel(rules.memberDailyMin) + " al giorno, e per questo giorno hai già una prenotazione. Scegli un altro giorno.";
    }
  } catch (e) { console.error("Controllo limite socio non riuscito (ignoro):", e && e.message); }
  return null;
}
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
  dropBrokenPackages(b);
  b.resources = (b.resources || []).filter((x) => x.active);
  await attachStaff(b, sb);
  await promos.attach(b, sb);
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

async function freeSlots(biz, service, dateStr, units) {
  const dur = service.duration_min * (units || 1); // piu' ore di fila: tutta la durata deve essere libera
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

  const nowMs = Date.now() + leadMin(biz) * 60000;
  const out = [];

  for (const res of biz.resources) {
    if (!resourceOk(biz, res, service, dateStr)) continue;
    const intervals = (res.opening_hours || [])
      .filter((h) => h.weekday === wd)
      .sort((a, b) => (a.opens < b.opens ? -1 : 1));
    const busy = r.data
      .filter((b) => b.resource_id === res.id)
      .map((b) => [Date.parse(b.starts_at), Date.parse(b.blocked_until)]);

    for (const h of intervals) {
      let t = hmToMin(h.opens.slice(0, 5));
      const tEnd = hmToMin(h.closes.slice(0, 5));
      while (t + dur <= tEnd) {
        const label = minToHm(t);
        const startMs = zonedTimeToUtc(dateStr, label, tz).getTime();
        const endMs = startMs + dur * 60000;
        const blockedMs = endMs + (service.buffer_min || 0) * 60000;
        const free = startMs >= nowMs && !busy.some((b) => startMs < b[1] && blockedMs > b[0]) && !blockedRanges.some((b) => startMs < b[1] && blockedMs > b[0]);
        if (free) out.push({ time: label, resource_id: res.id });
        t += SLOT_STEP_MIN;
      }
    }
  }
  return out;
}

// Come findService, ma se il nome corrisponde a piu' servizi (stesso nome, oppure un nome generico contenuto in piu' servizi)
// NON ne sceglie uno: restituisce l'errore che dice a Lia di chiedere al cliente quale vuole.
function serviceOrAsk(biz, name) {
  let n = String(name || "").toLowerCase().trim();
  if (!n) return { error: "Manca il nome del servizio." };
  const all = biz.services || [];
  // Due servizi con lo stesso nome possono differire solo per il luogo: "(a domicilio)" o "(in sede)" dopo il nome li distingue.
  const wantsHome = /\((a domicilio|a casa)[^)]*\)\s*$/.test(n), wantsOffice = /\((in sede|in presenza)[^)]*\)\s*$/.test(n);
  n = n.replace(/\s*\((a domicilio|a casa|in sede|in presenza)[^)]*\)\s*$/, "").trim();
  const exact = all.filter((s) => s.name.toLowerCase() === n);
  let hits = exact.length ? exact : all.filter((s) => s.name.toLowerCase().includes(n) || n.includes(s.name.toLowerCase()));
  if (hits.length > 1 && (wantsHome || wantsOffice)) {
    const byPlace = hits.filter((s) => !!s.at_customer_place === wantsHome);
    if (byPlace.length) hits = byPlace;
  }
  if (hits.length === 1) return { service: hits[0] };
  if (hits.length > 1) {
    const list = hits.map((s) => s.name + " (" + s.duration_min + " min, " + (s.price_eur === null || s.price_eur === undefined ? "prezzo da concordare" : s.price_eur + " euro") + (s.at_customer_place ? ", a domicilio" : "") + ")").join("; ");
    return { error: "\"" + name + "\" può essere più di un servizio: " + list + ". NON sceglierne uno tu e non proporre orari: chiedi al cliente, con UNA domanda, quale preferisce (usa le differenze reali: modalità, luogo, livello, prezzo), poi richiama lo strumento con il nome esatto. Se due servizi hanno lo stesso nome, scrivi il nome seguito da \" (a domicilio)\" oppure \" (in sede)" };
  }
  return { error: "Servizio non trovato. Servizi disponibili: " + all.map((s) => s.name).join(", ") + ". Se la richiesta del cliente è generica, non indovinare: chiedigli con una domanda quale di questi servizi vuole." };
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
  if (dateStr > addDays(today, maxAdvance(biz))) return "Si può prenotare al massimo con " + advanceLabel(maxAdvance(biz)) + " di anticipo.";
  return null;
}

// Giorni con almeno un orario libero, a partire da fromDate (per non proporre mai un giorno pieno)
// ---- Elenco ordinato delle disponibilita': stesso formato su webchat, Telegram e WhatsApp ----
// Il testo e' costruito qui, non scritto dall'AI: l'AI lo copia nella risposta, cosi' i giorni e gli orari non si sbagliano.
function italianDateLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const wd = italianDay(dateStr);
  const mon = new Intl.DateTimeFormat("it-IT", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, d)));
  return wd.charAt(0).toUpperCase() + wd.slice(1) + " " + d + " " + mon;
}
// Se gli orari sono tanti ne mostra al massimo "max", distribuiti nella giornata (il primo e l'ultimo ci sono sempre)
function spreadTimes(times, max) {
  if (times.length <= max) return times;
  const out = [];
  for (let i = 0; i < max; i++) out.push(times[Math.round((i * (times.length - 1)) / (max - 1))]);
  return Array.from(new Set(out));
}
function availabilityList(rows, maxPerDay) {
  return rows.map((r) => italianDateLabel(r.date) + ": " + spreadTimes(r.times, maxPerDay || 6).join(", ")).join("\n");
}
// Elenco dei servizi: una riga per servizio, con prezzo e durata
function servicesList(biz) {
  return biz.services.map((s) => {
    const parts = [];
    if (Number(s.price_eur) > 0) parts.push(s.price_eur + " euro" + (s.__promo ? " (in offerta, invece di " + s.__orig_price_eur + " euro, fino al " + s.__promo.untilLabel + ")" : ""));
    if (Number(s.duration_min) > 0) parts.push(s.duration_min + " minuti");
    if (maxUnits(s) > 1) parts.push("prenotabile anche per piu' ore di fila: fino a " + maxUnits(s) + " blocchi da " + s.duration_min + " minuti, il prezzo e' per un blocco");
    const extra = isPackage(s) ? " (comprende " + s.package_service_ids.map((id) => { const x = biz.services.find((y) => y.id === id); return x ? x.name : null; }).filter(Boolean).join(" + ") + ")" : "";
    return s.name + ": " + (parts.join(", ") || "su richiesta") + extra + (s.at_customer_place ? " (a domicilio)" : "");
  }).join("\n");
}

async function upcomingFreeDays(biz, service, fromDate, partOfDay, maxDays, scan, units) {
  const today = todayStr(biz.timezone);
  let start = fromDate && fromDate > today ? fromDate : today;
  const found = [];
  let scanned = 0;
  while (found.length < maxDays && scanned < scan) {
    const batch = [];
    for (let i = 0; i < 7 && scanned < scan; i++, scanned++) {
      const d = addDays(start, scanned);
      if (checkDate(biz, d)) continue;
      batch.push(d);
    }
    const res = await Promise.all(batch.map(async (d) => {
      try {
        let times = Array.from(new Set((await freeSlots(biz, service, d, units)).map((x) => x.time))).sort();
        if (partOfDay === "mattina") times = times.filter((t) => t < "13:00");
        if (partOfDay === "pomeriggio") times = times.filter((t) => t >= "13:00");
        return { d, times };
      } catch (e) { return { d, times: [] }; }
    }));
    for (const r of res) {
      if (r.times.length && found.length < maxDays) found.push({ date: r.d, weekday: italianDay(r.d), times_sample: r.times.slice(0, 3), free_count: r.times.length, times: r.times });
    }
  }
  return found;
}

// ====================== STRUMENTI PER CLAUDE ======================
const BLOCKS_PROP = { type: "integer", description: "Solo per i servizi prenotabili per piu' ore di fila (lo dice l'elenco servizi): quanti blocchi consecutivi vuole il cliente, ognuno lungo quanto la durata indicata. Chiedilo SEMPRE al cliente prima di controllare gli orari. Se il servizio non lo permette, non indicarlo (vale 1)." };
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
        requested_time: { type: "string", description: "Solo se il cliente ha chiesto un orario preciso (HH:MM): lo strumento dice se è libero e, se non lo è, prepara le alternative (elenco_alternative)." },
        staff_name: { type: "string", description: "Solo se il cliente ha scelto una persona precisa (vedi la sezione Persone, se c'è): il suo nome. Se non ha preferenze, non indicarlo." },
        blocks: BLOCKS_PROP,
      },
      required: ["service_name", "date"],
    },
  },
  {
    name: "find_free_days",
    description: "Elenca i prossimi giorni che hanno davvero almeno un orario libero per un servizio. Usalo SEMPRE quando devi proporre dei giorni (il cliente non ha detto un giorno preciso, oppure il giorno scelto e' pieno): proponi SOLO i giorni che restituisce.",
    input_schema: {
      type: "object",
      properties: {
        service_name: { type: "string", description: "Nome del servizio richiesto" },
        from_date: { type: "string", description: "Facoltativo: parti da questo giorno (AAAA-MM-GG). Se manca, da oggi." },
        part_of_day: { type: "string", enum: ["mattina", "pomeriggio", "tutto"], description: "Fascia della giornata richiesta" },
        staff_name: { type: "string", description: "Solo se il cliente ha scelto una persona precisa: il suo nome." },
        blocks: BLOCKS_PROP,
      },
      required: ["service_name"],
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
        customer_email: { type: "string", description: "Email del cliente, SOLO se l'ha scritta lui in questa conversazione (serve per mandargli conferma e promemoria). Se non l'ha data, non indicarla." },
        players: { type: "integer", description: "Numero di giocatori. Solo per le attività con regole sui giocatori (vedi regole di prenotazione)." },
        members: { type: "integer", description: "Quanti dei giocatori sono soci. Solo per le attività con regole sui giocatori." },
        booker_member: { type: "boolean", description: "Se la persona che prenota (quella con cui parli) è socio del circolo: true o false. Solo per le attività che hanno il limite giornaliero per i soci." },
        staff_name: { type: "string", description: "Solo se il cliente ha scelto una persona precisa (vedi la sezione Persone, se c'è): il suo nome. Se non ha preferenze, non indicarlo." },
        blocks: BLOCKS_PROP,
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

// Il cliente puo' scegliere la persona solo se il titolare ha attivato la scelta.
// Restituisce { biz } (da usare per gli orari) oppure { error } con un messaggio per Lia.
function staffView(biz, service, staffName) {
  const wanted = String(staffName || "").trim();
  if (!wanted || !biz.__teamMode || biz.staff_choice !== true) return { biz: biz, person: null };
  const lower = wanted.toLowerCase();
  const people = biz.resources || [];
  const person = people.find((r) => String(r.name).toLowerCase() === lower) || people.find((r) => String(r.name).toLowerCase().startsWith(lower));
  if (!person) return { error: "Non trovo \"" + wanted + "\". Le persone sono: " + people.map((r) => r.name).join(", ") + "." };
  const can = eligibleStaff(biz, service);
  if (!can.some((r) => r.id === person.id)) return { error: person.name + " non fa questo servizio. Lo fanno: " + can.map((r) => r.name).join(", ") + "." };
  return { biz: Object.assign({}, biz, { resources: [person] }), person: person };
}

async function runTool(name, input, ctx) {
  const biz = ctx.biz;
  try {
    if (name === "check_availability") {
      const sr = serviceOrAsk(biz, input.service_name);
      if (sr.error) return { error: sr.error };
      const service = sr.service;
      const bad = checkDate(biz, input.date);
      if (bad) return { error: bad };
      const ur = unitsOf(service, input.blocks);
      if (ur.error) return { error: ur.error + " Questo servizio si puo' prenotare al massimo per " + maxUnits(service) + " blocchi di fila." };
      const units = ur.units;
      const sv = staffView(biz, service, input.staff_name);
      if (sv.error) return { error: sv.error };
      const slots = await freeSlots(sv.biz, service, input.date, units);
      let times = Array.from(new Set(slots.map((s) => s.time))).sort();
      if (input.part_of_day === "mattina") times = times.filter((t) => t < "13:00");
      if (input.part_of_day === "pomeriggio") times = times.filter((t) => t >= "13:00");
      const reqTime = input.requested_time ? String(input.requested_time).slice(0, 5) : "";
      const reqFree = reqTime ? times.indexOf(reqTime) >= 0 : undefined;
      let nextDays;
      if (!times.length || reqFree === false) {
        // alternative: il giorno chiesto (se ha altri orari) e i giorni liberi successivi, in tutto i primi 3 giorni utili
        try { nextDays = await upcomingFreeDays(sv.biz, service, addDays(input.date, 1), input.part_of_day, times.length ? 2 : 3, 21, units); } catch (e) { nextDays = undefined; }
      }
      const altRows = [];
      if (reqFree === false && times.length) altRows.push({ date: input.date, times: times.slice(0, 12) });
      (nextDays || []).forEach((x) => altRows.push({ date: x.date, times: x.times }));
      const nextList = altRows.length ? availabilityList(altRows, 3) : undefined;
      return {
        ...(nextDays ? { next_days_with_slots: nextDays.map((x) => ({ date: x.date, weekday: x.weekday, times_sample: x.times_sample, free_count: x.free_count })) } : {}),
        ...(nextList ? { elenco_alternative: nextList } : {}),
        ...(reqTime ? { requested_time: reqTime, requested_time_available: reqFree } : {}),
        ...(times.length >= 2 && !reqTime ? { elenco_pronto: availabilityList([{ date: input.date, times: times.slice(0, 12) }], 5) } : {}),
        date: input.date,
        weekday: italianDay(input.date),
        service: service.name,
        duration_min: service.duration_min * units,
        price_eur: service.price_eur === null || service.price_eur === undefined ? service.price_eur : Number(service.price_eur) * units,
        ...(units > 1 ? { blocks: units, note_durata: "Orari liberi per " + units + " blocchi di fila: ogni orario e' quello di inizio." } : {}),
        available_times: times.slice(0, 12),
        ...(sv.person ? { staff: sv.person.name } : {}),
        note: times.length ? undefined : (sv.person ? "Nessun orario libero con " + sv.person.name + " in questo giorno (chiuso, in riposo o tutto occupato)." : "Nessun orario libero (chiuso o tutto occupato)."),
      };
    }

    if (name === "find_free_days") {
      const sr = serviceOrAsk(biz, input.service_name);
      if (sr.error) return { error: sr.error };
      const service = sr.service;
      const ur = unitsOf(service, input.blocks);
      if (ur.error) return { error: ur.error + " Questo servizio si puo' prenotare al massimo per " + maxUnits(service) + " blocchi di fila." };
      const sv = staffView(biz, service, input.staff_name);
      if (sv.error) return { error: sv.error };
      const days = await upcomingFreeDays(sv.biz, service, input.from_date, input.part_of_day, 6, 28, ur.units);
      return {
        service: service.name,
        free_days: days.map((x) => ({ date: x.date, weekday: x.weekday, times_sample: x.times_sample, free_count: x.free_count })),
        ...(days.length ? { elenco_pronto: availabilityList(days.slice(0, 3).map((x) => ({ date: x.date, times: x.times })), 3) } : {}),
        note: days.length ? "Copia elenco_pronto nella risposta. Per gli orari esatti di un giorno usa check_availability." : "Nessun giorno libero nei prossimi 28 giorni: dillo al cliente e suggerisci di contattare l'attivita'.",
      };
    }

    if (name === "book_appointment") {
      const sr = serviceOrAsk(biz, input.service_name);
      if (sr.error) return { error: sr.error };
      const service = sr.service;
      const bad = checkDate(biz, input.date);
      if (bad) return { error: bad };
      const ub = unitsOf(service, input.blocks);
      if (ub.error) return { error: ub.error + " Questo servizio si puo' prenotare al massimo per " + maxUnits(service) + " blocchi di fila." };
      const units = ub.units, totalMin = service.duration_min * units;
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
        const pErr = phoneProblem(phoneToStore);
        if (pErr) return { error: "Il numero di telefono non sembra valido (" + pErr + ") Chiedi al cliente di riscriverlo, senza prenotare finché non è corretto." };
      }
      if (service.at_customer_place && !String(input.address || "").trim()) {
        return { error: "Questo servizio è a domicilio: chiedi l'indirizzo al cliente." };
      }
      if (service.at_customer_place) {
        const zoneErr = require("./areas.js").areaProblem(biz, input.address);
        if (zoneErr) return { error: zoneErr };
      }
      let emailToStore = "";
      if (String(input.customer_email || "").trim()) {
        const eErr = emailProblem(input.customer_email);
        if (eErr) return { error: "L'email non è valida (" + eErr + ") Chiedi al cliente di riscriverla, oppure prenota senza email." };
        const em = mail.normalizeEmail(input.customer_email);
        if (!(ctx.userTexts || []).some((t) => String(t).toLowerCase().includes(em))) return { error: "Usa solo l'email scritta dal cliente. Se non l'ha data, prenota senza email." };
        emailToStore = em;
      }
      const rules = partyRules(biz);
      let party = null;
      if (rules) {
        party = validateParty(rules, input);
        if (party.error) return { error: party.error + " Chiedilo al cliente prima di prenotare." };
        const lim = await memberDayCheck(biz, rules, party, phoneToStore, input.date, totalMin, null);
        if (lim) return { error: lim + " Spiegalo al cliente con gentilezza e proponi un altro giorno." };
      }

      const sv = staffView(biz, service, input.staff_name);
      if (sv.error) return { error: sv.error };
      const slots = await freeSlots(sv.biz, service, input.date, units);
      const candidates = slots.filter((s) => s.time === input.time);
      if (!candidates.length) return { error: "Quell'orario non è disponibile. Richiama check_availability (con requested_time) e mostra elenco_alternative." };

      const start = zonedTimeToUtc(input.date, input.time, biz.timezone);
      const end = new Date(start.getTime() + totalMin * 60000);
      const blocked = new Date(end.getTime() + (service.buffer_min || 0) * 60000);

      for (const c of candidates) {
        const apRow = {
          business_id: biz.id,
          resource_id: c.resource_id,
          service_id: service.id,
          customer_name: String(input.customer_name).trim(),
          customer_phone: phoneToStore,
          channel: ctx.channel,
          contact_id: ctx.contactId,
          customer_address: input.address || null,
          notes: input.notes || null,
          ...(service.__promo ? { promo_price_eur: service.__promo.price } : {}),
          ...(emailToStore ? { customer_email: emailToStore } : {}),
          ...(party ? { players: party.players, members: party.members } : {}),
          ...(units > 1 ? { units: units } : {}), // ore prenotate di fila (colonna appointments.units)
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          blocked_until: blocked.toISOString(),
        };
        let r = await sb("POST", "appointments", apRow, "return=representation");
        if (!r.ok && r.status === 400 && (apRow.customer_email || apRow.units || apRow.promo_price_eur != null)) { delete apRow.promo_price_eur; delete apRow.customer_email; delete apRow.units; r = await sb("POST", "appointments", apRow, "return=representation"); } // colonna email non ancora creata: prenota comunque
        if (r.ok) {
          // Avviso sul telefono del titolare, come per le prenotazioni dalla pagina. Non blocca mai la prenotazione.
          await require("./push.js").notifyNewBooking(biz.id, { name: String(input.customer_name).trim(), service: service.name, startsAt: start.toISOString(), timezone: biz.timezone, medical: require("./verticals.js").isMedical(biz.business_type) });
          // Conferma via email, solo se il cliente ha dato l'indirizzo. Non blocca mai la prenotazione.
          let emailSent = false;
          const newId = Array.isArray(r.data) && r.data[0] ? r.data[0].id : null;
          if (emailToStore && newId) {
            try {
              const who = (biz.__teamMode && biz.staff_choice === true) ? ((biz.resources || []).find((x) => x.id === c.resource_id) || null) : null;
              const em = mail.appointmentEmail({ kind: "confirm", slug: biz.slug, apptId: newId, bizName: biz.name, bizPhone: biz.public_phone || "", bizAddress: biz.address || "", customerName: String(input.customer_name).trim(), service: service.name, staffName: who ? who.name : "", startsAt: start.toISOString(), endsAt: end.toISOString(), tz: biz.timezone, customerAddress: service.at_customer_place ? String(input.address || "") : "", cancelLimitH: cancelLimitH(biz), privacyUrl: mail.baseUrl() + "/privacy/" + biz.slug });
              emailSent = await Promise.race([mail.sendMail(emailToStore, em.subject, em.html, em.text, biz.name), new Promise((ok) => setTimeout(() => ok(false), 4500))]);
            } catch (e) { console.error("Email di conferma non inviata:", e && e.message); }
          }
          const assigned = (biz.__teamMode && biz.staff_choice === true) ? ((biz.resources || []).find((x) => x.id === c.resource_id) || null) : null;
          return {
            ok: true,
            ...(emailToStore ? { email_sent: !!emailSent } : {}),
            when: formatLocal(start.toISOString(), biz.timezone),
            service: service.name,
            ...(assigned ? { staff: assigned.name } : {}),
            customer_name: input.customer_name,
            ...(units > 1 ? { blocks: units, duration_min: totalMin, until: new Intl.DateTimeFormat("it-IT", { timeZone: biz.timezone, hour: "2-digit", minute: "2-digit" }).format(end), price_total_eur: service.price_eur === null || service.price_eur === undefined ? null : Number(service.price_eur) * units } : {}),
            ...(party ? {
              players: party.players,
              members: party.members,
              non_members: party.nonMembers,
              total_due_eur: party.nonMembers * Number(service.price_eur || 0),
              medical_certificate_needed: !!(rules && rules.certificate) && party.nonMembers > 0,
              ...((rules && rules.certificate && party.nonMembers > 0) ? { reminder_obbligatorio: "Nella risposta al cliente scrivi che i non soci devono portare il certificato medico." } : {}),
            } : {}),
            location: service.at_customer_place ? "" : String(biz.address || ""),
            calendar: {
              title: service.name + " - " + biz.name,
              start: start.toISOString(),
              end: end.toISOString(),
              location: service.at_customer_place ? String(input.address || "") : String(biz.address || ""),
              description: "Appuntamento confermato con " + biz.name + (party ? " - " + party.players + " giocatori" : "")
            }
          };
        }
        if (r.status !== 409) return { error: "Errore nel salvataggio dell'appuntamento." };
      }
      return { error: "Quell'orario è appena stato preso. Richiama check_availability (con requested_time) e mostra elenco_alternative." };
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
      const lim = cancelLimitH(biz);
      if (lim > 0) {
        const cur = await sb("GET", "appointments?id=eq." + encodeURIComponent(input.appointment_id) +
          "&contact_id=eq." + encodeURIComponent(ctx.contactId) + "&status=eq.confirmed&select=starts_at");
        const st = cur.ok && Array.isArray(cur.data) && cur.data[0] ? Date.parse(cur.data[0].starts_at) : NaN;
        if (Number.isFinite(st) && st - Date.now() < lim * 3600000) {
          return { error: "Non si può più annullare in chat: mancano meno di " + (lim === 1 ? "1 ora" : lim + " ore") + " all'appuntamento. Di' al cliente di contattare direttamente l'attività" + (biz.public_phone ? " al " + biz.public_phone : "") + "." };
        }
      }
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
  const res = biz.__hoursResource || biz.resources[0];
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
  const channelLabel = channel === "whatsapp" ? "WhatsApp" : channel === "telegram" ? "Telegram" : "la chat del sito";
  // Sul sito e su Telegram il cliente ha gia' letto un benvenuto fisso: non va salutato due volte.
  const greetRule = channel === "whatsapp"
    ? '- Primo messaggio: saluta in base all\'ora ("Buongiorno", "Buon pomeriggio", "Buonasera") con tono accogliente e presentati in una riga come Lia, l\'assistente di ' + biz.name + '. Dopo non salutare più.'
    : '- Il cliente ha già letto il messaggio di benvenuto in cui ti presenti come Lia, l\'assistente di ' + biz.name + ': NON salutare di nuovo e NON ripresentarti, nemmeno nel primo messaggio. Rispondi subito a ciò che chiede, con tono accogliente. Se il cliente scrive solo un saluto ("ciao", "buonasera"), rispondi con una frase breve che lo invita a dirti cosa gli serve, senza ripetere il tuo nome e senza dire di nuovo di chi sei l\'assistente.';
  const rulesNow = partyRules(biz);
  const partyBlock = rulesNow ? `Regole di prenotazione di questa attività (valgono solo qui e hanno la precedenza sulle altre regole):
- Ogni prenotazione è per un campo, a nome di una sola persona, per ${rulesNow.players.join(" oppure ")} giocatori: mai altri numeri. Chiedi sempre quanti giocatori sono${rulesNow.members ? " e, tra questi, quanti sono soci del circolo" : ""}.
${rulesNow.members ? "- I soci non pagano la prenotazione: hanno già pagato come soci. Ogni non socio paga il prezzo indicato per il servizio. Totale dovuto = numero di non soci × prezzo del servizio; se sono tutti soci non c'è nulla da pagare. Mostra il calcolo con i numeri (ad esempio 2 non soci × 12 € = 24 €). Non dire dove o come si paga.\n" : ""}${rulesNow.certificate ? "- CERTIFICATO MEDICO (obbligatorio, mai facoltativo): appena sai che tra i giocatori c'è almeno un non socio, avvisalo subito, nello stesso messaggio in cui mostri il totale e prima di chiedere la conferma, che i non soci devono portare il certificato medico; ripetilo anche nella frase finale di conferma della prenotazione. Se sono tutti soci non nominarlo.\n" : ""}${rulesNow.memberDailyMin ? "- Chiedi sempre anche se la persona con cui parli (quella che prenota) è socio del circolo e passa la risposta in booker_member (true/false). Un socio può prenotare il campo al massimo per " + limitLabel(rulesNow.memberDailyMin) + " al giorno: se la prenotazione viene rifiutata per questo limite, spiegalo con gentilezza e proponi un altro giorno, senza cercare modi per aggirarlo.\n" : ""}- Passa i numeri a book_appointment nei campi players${rulesNow.members ? " e members" : ""}${rulesNow.memberDailyMin ? " e booker_member" : ""}.
- Nella conferma aggiungi una seconda frase breve con il totale dovuto dai non soci (solo se c'è) e, se c'è almeno un non socio, il promemoria del certificato medico (sempre).

` : "";
  let teamBlock = "";
  if (biz.__teamMode && biz.staff_choice === true && (biz.resources || []).length > 1) {
    const lines = biz.resources.map((r) => {
      const ids = (biz.__svc && biz.__svc[r.id]) || [];
      const names = ids.length ? biz.services.filter((sv) => ids.indexOf(sv.id) !== -1).map((sv) => sv.name).join(", ") : "tutti i servizi";
      return "- " + r.name + ": " + (names || "tutti i servizi");
    }).join("\n");
    teamBlock = "Persone (il cliente può scegliere con chi prenotare):\n" + lines + "\n" +
      "Come gestirle:\n" +
      "- Quando il cliente ha scelto un servizio che fanno almeno due persone, chiedi UNA sola volta se ha una preferenza o se va bene chiunque sia libero (per esempio: \"Hai una preferenza per chi ti segue o va bene chiunque sia libero?\"), citando solo i nomi di chi fa quel servizio. Se lo fa una sola persona non chiedere nulla.\n" +
      "- Se indica una persona, passa il suo nome come staff_name sia a check_availability sia a book_appointment. Se non ha preferenze, non passare staff_name.\n" +
      "- Se la persona scelta non ha orari liberi, dillo con gentilezza e proponi altri orari con lei oppure lo stesso orario con un'altra persona, lasciando decidere al cliente.\n" +
      "- Se book_appointment restituisce staff, puoi dire nella conferma \"con [nome]\". Non inventare mai chi fa cosa: usa solo questo elenco.\n\n";
  } else if (biz.__teamMode) {
    teamBlock = "In questa attività lavorano più persone, ma il cliente non sceglie con chi prenotare: non chiedere preferenze e non nominare i singoli collaboratori.\n\n";
  }
  // Telefono OBBLIGATORIO (solo fuori da WhatsApp, dove c'è già), email FACOLTATIVA: si chiedono insieme al nome in un solo messaggio.
  const emailRule = channel === "whatsapp"
    ? "- Email (facoltativa): dopo che il cliente ha scelto l'orario, chiedi il nome insieme all'email in un solo messaggio (per esempio \"A che nome prenoto? Se vuoi anche la conferma via email, scrivimi l'indirizzo\"). Se invece il cliente ha già dato il nome senza l'email, e prima di prenotare, chiedigli UNA sola volta se vuole ricevere conferma e promemoria via email (\"Vuoi che ti mandi la conferma e un promemoria via email? Se sì scrivimi l'indirizzo, altrimenti non fa niente\"). Se la scrive, passala come customer_email; se dice di no o non risponde all'email, prenota senza e non richiederla. Non inventare mai un'email. Se book_appointment risponde email_sent true, aggiungi in una frase breve che gli hai mandato la conferma via email, con il link per annullare."
    : "- Dati di contatto: dopo che il cliente ha scelto l'orario, chiedi in UN solo messaggio il nome e il numero di telefono (OBBLIGATORIO: senza telefono non puoi prenotare) e dì che l'email è facoltativa (per esempio \"A che nome prenoto e con quale numero di telefono? Se vuoi anche la conferma via email, scrivimi pure l'indirizzo, ma è facoltativo\"). Se il cliente dà il nome ma non il telefono, richiedi SOLO il telefono: non passare all'email e non prenotare finché non ce l'hai. Se dà un numero che non sembra completo, chiedi di riscriverlo. L'email non è mai obbligatoria: se non la dà o dice di no, prenota senza e non insistere. Se la scrive, passala come customer_email. Non inventare mai telefono o email. Se book_appointment risponde email_sent true, aggiungi in una frase breve che gli hai mandato la conferma via email, con il link per annullare.";
  const channelNote = channel === "whatsapp" ? "" :
    "\n- Il cliente ti scrive dal " + (channel === "telegram" ? "bot Telegram" : "sito web") +
    ", quindi non hai il suo numero di telefono: chiedilo insieme al nome (\"A che nome e con quale numero di telefono prenoto?\") e passalo a book_appointment come customer_phone. Il numero deve essere quello che scrive il cliente.";
  const services = biz.services
    .map((s) => "- " + s.name + ": " + s.duration_min + " min" + (s.price_eur === null || s.price_eur === undefined ? ", prezzo da concordare" : ", " + s.price_eur + " euro" + (s.__promo ? " (OFFERTA: prima " + s.__orig_price_eur + " euro, fino al " + s.__promo.untilLabel + ")" : "")) +
      (isPackage(s) ? " (pacchetto che comprende: " + s.package_service_ids.map((id) => { const x = biz.services.find((y) => y.id === id); return x ? x.name : null; }).filter(Boolean).join(" + ") + "; si prenota come un unico servizio)" : "") +
      (maxUnits(s) > 1 ? " (si puo' prenotare per piu' ore di fila, da 1 a " + maxUnits(s) + " blocchi da " + s.duration_min + " min: chiedi sempre quanti ne servono; durata e prezzo indicati sono per un blocco)" : "") +
      (s.at_customer_place ? " (a domicilio: serve l'indirizzo" + (Array.isArray(biz.service_areas) && biz.service_areas.length ? ", solo in: " + biz.service_areas.join(", ") : "") + ")" : ""))
    .join("\n");

  const servicesReady = servicesList(biz);

  return `Sei Lia, l'assistente di "${biz.name}"${biz.business_type ? " (" + biz.business_type + ")" : ""} e rispondi ai clienti in chat (${channelLabel}).

Calendario dei prossimi giorni (usa SOLO questo, insieme alla riga "Adesso" più sotto, per convertire "giovedì", "domani", ecc. in una data):
${days.join("\n")}

Servizi:
${services}

Orari di apertura: ${hoursSummary(biz)}
${biz.assistant_notes ? "\nIstruzioni del titolare: " + biz.assistant_notes + "\n" : ""}
Voce e stile (valgono su ogni canale):
- Scrivi in italiano corretto, con il tono di un'assistente di un'attività curata: cordiale, calorosa e professionale. Fai sentire il cliente accolto, senza essere mai sdolcinata, servile o troppo informale. Niente slang e niente abbreviazioni da chat.
- Registro: dai del tu se il cliente ti dà del tu, usa il lei se lui usa il lei. Se non è chiaro, usa il tu in modo educato.
- Tono: formale ma molto gentile. Non essere mai secca o telegrafica: ogni risposta ha un'apertura cortese e varia (per esempio "Volentieri", "Ottimo", "Perfetto", "Nessun problema", "La ringrazio"). NON usare mai "Con piacere" e non aprire due risposte di fila con la stessa formula; spesso basta entrare subito nel merito con garbo. Quando serve una scelta, chiudi con quando serve una scelta, una domanda gentile. Mai frasi come "Dimmi quale servizio vuoi" o "Cosa preferisci?" da sole, senza una frase gentile prima.
- Emoji: poche e con gusto, né zero né troppe. Al massimo una per messaggio e solo in un messaggio su due o tre: di solito nel saluto, nella conferma della prenotazione o quando ringrazi (per esempio 😊 oppure 👍). Mai due emoji nello stesso messaggio, mai file di emoji, mai emoji se il cliente è arrabbiato, deluso o sta spiegando un problema. Se in questa conversazione non ne hai ancora usata nessuna, mettine una nel saluto o nella conferma.
- Testo semplice: niente grassetto, asterischi, titoli, elenchi puntati o numerati. Le uniche eccezioni sono i due elenchi in righe separate (disponibilità e servizi) descritti in "Come lavori": senza trattini né simboli.
- Messaggi brevi: di norma 1-3 frasi, una sola domanda per messaggio. La prima frase risponde a ciò che il cliente ha chiesto.
- Scorrevolezza (molto importante): fai le cose, non annunciarle. Mai frasi come "ti dico i giorni disponibili", "controllo subito", "fammi vedere" e mai chiedere il permesso di procedere ("vuoi che controlli?", "posso proporti degli orari?"): usa lo strumento e rispondi direttamente con il risultato. Non ripetere ciò che il cliente ha appena detto e non chiedere conferme inutili. Se il cliente dà più informazioni in un solo messaggio (servizio, giorno, ora), usale tutte e vai subito al passo successivo. Eccezione voluta: subito dopo che il cliente ha scelto il servizio, se non ha ancora indicato né giorno né orario né persona, fai UNA domanda sulle preferenze prima di mostrare orari (vedi "Appena il cliente ha scelto il servizio"). Obiettivo: arrivare alla prenotazione nel minor numero di messaggi possibile.
- Punto esclamativo: ogni tanto, per dare calore (nel saluto o nella conferma), mai più di uno per messaggio e mai doppio. Niente puntini di sospensione.
- Orari nel formato 15:30, date con giorno e numero ("giovedì 8 ottobre"), prezzi come "18 euro".
- Preferisci frasi naturali e calorose ("Volentieri", "Ottimo", "Nessun problema") alle formule da chatbot ("Certamente!", "Assolutamente!", "Come posso aiutarti oggi?", "Spero di esserti stato utile", "Non esitare a chiedere"). Varia le aperture e non ripetere la stessa parola in due messaggi di fila.
${greetRule}
- Usa il nome del cliente quando lo conosci, senza ripeterlo in ogni messaggio.
- Quando devi dire di no o correggere il cliente, di' prima cosa puoi fare, poi il limite, senza giustificazioni lunghe.
- Conferma della prenotazione: una sola frase calda, con il nome del cliente, il servizio, il giorno e l'ora, e una emoji finale, come in questo esempio: "Perfetto, Marco, ti ho prenotato per un taglio giovedì 8 ottobre alle 15:30. Ti aspettiamo! 😊". Non aggiungere altro: l'indirizzo e il promemoria per il calendario sono già nei pulsanti che il cliente vede sotto il messaggio, e non devi nominarli, salvo quanto richiesto dalle regole di prenotazione dell'attività.
- Se il cliente ti chiede se sei una persona, rispondi con sincerità che sei Lia, l'assistente virtuale di ${biz.name}.

${partyBlock}${teamBlock}Come lavori:
- Segui sempre le regole di "Voce e stile" qui sopra, anche quando devi dire di no o correggere il cliente.
- NON inventare mai la disponibilità: per proporre orari usa SEMPRE check_availability o find_free_days.
- Disponibilità (formato fisso): quando il cliente chiede quando c'è posto, quali giorni o orari sono liberi, o quando devi mostrare più di un orario, la risposta ha sempre tre parti:
1) una frase di apertura gentile che nomina il servizio e finisce con i due punti (per esempio "Ecco quando c'è posto per la Rivoluzione solare:" oppure "Queste sono le prime disponibilità per la Rivoluzione solare:");
2) le righe del campo elenco_pronto copiate senza cambiare giorni, orari o righe, una per giorno, senza trattini:
Sabato 17 ottobre: 15:00, 16:30, 19:00
Domenica 18 ottobre: 14:00
3) dopo una riga vuota, una chiusura cortese in forma di domanda ("Quale giorno e orario preferisci?", oppure con il lei "Quale giorno e orario preferisce?").
Non riscrivere le righe in una frase. Se c'è un solo orario libero scrivilo in una frase gentile. Se il giorno chiesto è pieno, dillo con garbo ("Quel giorno purtroppo è al completo, ma ho posto in questi giorni:") e poi copia le righe del campo elenco_alternative.
- Primi posti: se il cliente chiede il primo appuntamento libero, i primi posti o "il prima possibile", chiama find_free_days e mostra elenco_pronto con lo schema qui sopra: sono i primi 3 giorni utili.
- Giorno e ora precisi: se il cliente chiede un giorno e un'ora (per esempio "sabato alle 15"), chiama check_availability passando requested_time. Se requested_time_available è true vai avanti con il nome. Se è false (o il giorno è pieno), apri con una frase gentile ("Quell'orario purtroppo non è libero, ma queste sono le disponibilità più vicine:"), poi copia le righe del campo elenco_alternative, poi una riga vuota e la chiusura cortese ("Quale preferisci?").
- Richieste generiche (molto importante): se ciò che chiede il cliente può corrispondere a più servizi dell'elenco (la stessa materia o lo stesso trattamento in versioni diverse: online o in presenza, a domicilio o nella sede dell'attività, per livello o tipo di cliente, per durata), NON scegliere tu e non proporre né controllare orari: prima fai UNA domanda precisa che distingue le versioni, usando solo le differenze che vedi nell'elenco dei servizi e, se cambia, anche il prezzo (per esempio "Preferisci la lezione online o in presenza?", poi "È per uno studente universitario?"). Se ci sono più differenze, chiedile una alla volta, partendo da quella che divide di più i servizi, e salta quelle a cui il cliente ha già risposto con le sue parole (se scrive "online" non chiedere dove). Quando resta un solo servizio, prosegui. Se non sa scegliere, spiega in una frase la differenza e il prezzo. Non inventare mai opzioni che non sono nell'elenco e non fare domande se i servizi non lasciano scelta.
- Più ore di fila: se il servizio scelto si può prenotare per più ore di fila (lo dice l'elenco Servizi), prima di controllare gli orari chiedi con una sola domanda quanto tempo serve al cliente (per esempio \"Quante ore ti servono? Puoi prenotare da 1 a 3 ore di fila\") e passa la risposta come blocks a check_availability, find_free_days e book_appointment. Gli orari che mostri sono quelli di inizio. Il prezzo dell'elenco è per un blocco: nella risposta usa price_eur e duration_min restituiti dallo strumento, che sono già il totale. Nella conferma dì anche la durata, per esempio \"dalle 16:00 alle 18:00\" (usa until). Se il cliente non lo dice e non serve più di un blocco, usa 1.
- Se il cliente chiede la disponibilità senza dire il servizio, chiedilo con gentilezza, senza dire che "poi controlli" ("Per quale servizio desidera sapere quando c'è posto?", oppure col tu "Per quale servizio vuoi sapere quando c'è posto?"), e se non sa quale scegliere mostragli i servizi.
- Servizi (formato fisso): quando il cliente chiede quali servizi o trattamenti offrite, o il listino, la risposta ha sempre tre parti: una frase di apertura gentile ("Ecco i servizi che offriamo:"), le righe qui sotto copiate senza riassumerle e senza metterle in una frase, e dopo una riga vuota una chiusura cortese ("Quale desidera prenotare?", oppure col tu "Quale ti interessa?"):
${servicesReady}
Se invece chiede prezzo o durata di un solo servizio, rispondi in una frase gentile.
- Giorni: NON proporre MAI un giorno senza aver verificato che abbia posto. Quando il cliente non ha scelto un giorno preciso ("quando hai posto?", "che giorni ci sono?") oppure il giorno scelto è pieno, chiama find_free_days e mostra SOLO i giorni che restituisce, con lo schema "Disponibilità" (elenco_pronto), mai giorni a caso. Se un giorno risulta pieno, di' subito quali sono i più vicini liberi (elenco_alternative).
- Per prenotare servono servizio, giorno, ora e nome del cliente. Chiedi una cosa alla volta, tranne i dati di contatto, che chiedi insieme in un solo messaggio.
- Appena il cliente ha scelto il servizio senza dire quando: chiedi in una sola frase se ha preferenze di giorno, orario o persona, altrimenti proponi tu i primi posti liberi (per esempio "Hai preferenze di giorno o di orario? Se vuoi ti propongo i primi posti liberi."). Se risponde che non ha preferenze o chiede di proporre, usa find_free_days e mostra la lista CORTA (elenco_pronto: 3 giorni, al massimo 3 orari ciascuno) con lo schema "Disponibilità" qui sopra. Se invece indica già preferenze (giorno, fascia, persona) o dà giorno e ora insieme al servizio, non fare la domanda: usa subito gli strumenti e mostra i risultati. Se il cliente ha già indicato un giorno, usa check_availability per quel giorno e mostra l'elenco di quel giorno. Se il giorno e l'orario che chiede sono liberi, non chiedere altro che il nome.${channelNote}
- Il nome: se il cliente non ti ha ancora detto come si chiama in questa conversazione, chiedilo ("A che nome prenoto?"). Se te l'ha già detto, chiedi conferma prima di prenotare ("A nome di Nico, giusto?"), perché potrebbe prenotare per un'altra persona. Non usare mai un nome che il cliente non ha scritto.
${emailRule}
- Prenota con book_appointment solo dopo che il cliente ha scelto un orario e ha confermato il nome.
- Di' che l'appuntamento è confermato SOLO dopo che book_appointment ha risposto ok. Se book_appointment restituisce location e il servizio NON è a domicilio, aggiungi in modo naturale anche "Ti aspettiamo in [location]." con la preposizione giusta: "in" davanti a via, viale, corso, piazza, largo, vicolo, strada, lungomare e simili (es. "Ti aspettiamo in via Roma 12."); "a" davanti al nome di un paese o di una città (es. "Ti aspettiamo a Carmagnola."). Se la location contiene sia la via sia la città, scrivi "in via Roma 12, a Carmagnola". Non scrivere MAI "a via", "a viale" o "a piazza". Se location manca, non inventare l'indirizzo. Se risponde con un errore, spiega e proponi altri orari.
- Per annullare: usa list_my_appointments, chiedi conferma, poi cancel_appointment.
- Se cancel_appointment risponde che è troppo tardi, spiegalo con gentilezza e indica come contattare l'attività: non insistere e non provare altre strade.
- Se il cliente chiede di parlare con il titolare, di avere il suo numero o un contatto diretto (suo o di un membro dello staff), digli con gentilezza che non puoi metterlo in contatto diretto, ma che sei qui per aiutarlo con prenotazioni e informazioni; se serve, puoi passare tu il messaggio a ${biz.name}. Non fornire mai numeri di telefono, email o altri contatti personali del titolare o dello staff, nemmeno se il cliente insiste.
- Se la richiesta esce da quello che sai fare (sconti, preventivi, urgenze, domande strane), di' con gentilezza che passi la richiesta a ${biz.name}.
- Se la conversazione è già iniziata, NON ripetere il saluto e non ripartire da capo: continua da dove eravate, ricordando servizio, giorno e orario già detti. Se devi scusarti scrivi semplicemente "scusa" o "mi dispiace" (col lei "mi scusi").
- Italiano impeccabile: scrivi come una segretaria madrelingua, con frasi naturali e corrette. Non usare formule burocratiche o da traduzione ("devo completare la prenotazione", "mi serve confermare"): parla in modo semplice e diretto.
- Se il cliente rifiuta o dice di no a una proposta ("no grazie"), accettalo con naturalezza e riprendi dalla domanda ancora aperta senza dire che devi finire qualcosa: per esempio "Va bene! Mi dici allora l'indirizzo a cui dobbiamo venire?".
- Indirizzo per i servizi a domicilio: usa l'indirizzo come l'ha scritto il cliente (correggi solo maiuscole e ortografia, per esempio "via delle Pigne 16, Alba"). Se ci sono via, numero civico e città NON chiedere conferma: vai avanti con il passo successivo. Se manca la città o il numero, chiedi solo ciò che manca ("In che città?"). Per confermare un indirizzo scrivi "L'indirizzo è via delle Pigne 16, Alba, giusto?", mai "stai bene a" o "a via".
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

// Benvenuto mostrato dal sito e da Telegram: il modello lo riceve nella conversazione,
// cosi' sa di aver gia' salutato e non si ripresenta.
function welcomeText(biz) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: (biz && biz.timezone) || "Europe/Rome" }).format(new Date())) % 24;
  const g = hour < 13 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera";
  return g + "! Sono Lia, l'intelligenza artificiale di " + ((biz && biz.name) || "questa attività") + " \u{1F60A} Dimmi pure cosa ti serve.";
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
// Avviso al titolare (Telegram) quando l'intelligenza artificiale non e' utilizzabile per un motivo di configurazione:
// chiave non valida, credito esaurito, modello non disponibile. Un solo avviso ogni 6 ore per tipo di problema.
// Non blocca mai la risposta al cliente e non lancia mai errori.
async function notifyAiFailure(status, data) {
  try {
    if (![400, 401, 403, 404].includes(status)) return;
    const msg = String((data && data.error && data.error.message) || "").toLowerCase();
    let kind, text;
    if (status === 401 || status === 403) {
      kind = "key";
      text = "\u26A0\uFE0F Lia non riesce a rispondere ai clienti: la chiave API di Anthropic non \u00e8 valida (errore " + status + ").\n\nCrea una nuova chiave su console.anthropic.com, mettila su Vercel come ANTHROPIC_API_KEY e fai Redeploy.";
    } else if (status === 400 && msg.includes("credit")) {
      kind = "credit";
      text = "\u26A0\uFE0F Lia non riesce a rispondere ai clienti: il credito dell\u2019account Anthropic \u00e8 esaurito.\n\nRicarica da console.anthropic.com, in Billing.";
    } else if (status === 404) {
      kind = "model";
      text = "\u26A0\uFE0F Lia non riesce a rispondere ai clienti: il modello AI configurato non \u00e8 disponibile (errore 404). Controlla la variabile CLAUDE_MODEL su Vercel.";
    } else {
      return;
    }
    const { sb, sendTelegram } = require("./owner.js");
    const slot = new Date(Date.now()).toISOString().slice(0, 10) + "-" + Math.floor(new Date().getUTCHours() / 6);
    const ins = await sb("POST", "admin_alerts_sent", { alert_key: "ai-down:" + kind + ":" + slot, kind: "ai_down", details: { status: status } });
    if (!ins.ok) return; // gia' avvisato in questa fascia (o registro non raggiungibile): niente doppioni
    const chats = await sb("GET", "admin_alert_chats?channel=eq.telegram&active=eq.true&select=chat_id");
    const ids = (chats.ok && Array.isArray(chats.data) ? chats.data : []).map((c) => c.chat_id);
    for (const id of ids) await sendTelegram(id, text);
  } catch (e) { console.error("Avviso AI non inviato:", e && e.message); }
}

async function callClaudeOnce(systemStatic, systemNow, messages, tools) {
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
      tools: tools || TOOLS,
      messages: messages,
    }),
  });
  const data = await r.json();
  if (!r.ok) {
    console.error("Errore Anthropic:", r.status, JSON.stringify(data));
    await notifyAiFailure(r.status, data);
    const err = new Error("anthropic");
    err.status = r.status;
    throw err;
  }
  return data;
}

// Errori passeggeri (modello sovraccarico, limite momentaneo, rete): un solo nuovo tentativo.
async function callClaude(systemStatic, systemNow, messages, tools) {
  try {
    return await callClaudeOnce(systemStatic, systemNow, messages, tools);
  } catch (e) {
    const passeggero = !e.status || [408, 409, 429, 500, 502, 503, 504, 529].includes(e.status);
    if (!passeggero) throw e;
    await new Promise((ok) => setTimeout(ok, 900));
    return await callClaudeOnce(systemStatic, systemNow, messages, tools);
  }
}

const CERTIFICATE_REMINDER = "Ricordo che i non soci devono portare il certificato medico.";

async function conversa(biz, base, messages) {
  // Circoli e centri sportivi: Lia prenota i campi con i suoi strumenti (lib/lia-courts.js)
  if (require("./verticals.js").areaOf(biz.business_type) === "campi") return require("./lia-courts.js").conversa(biz, base, messages, { callClaude, logAiUsage, sb, MODEL });
  const systemStatic = systemPromptStatic(biz, base.channel);
  let calendar = null;
  let certNeeded = false;
  const msgs = messages.slice();
  const userTexts = messages.filter((m) => m.role === "user" && typeof m.content === "string").map((m) => m.content.toLowerCase());
  let bookedOk = false; // book_appointment riuscita in questo giro
  let nudged = false;   // correzione "non hai prenotato" già mandata
  for (let i = 0; i < 6; i++) {
    const systemNow = systemPromptNow(biz); // ricalcolata a ogni giro, ma pesa pochissimo
    const data = await callClaude(systemStatic, systemNow, msgs);
    // Registro dei costi: mai bloccante, mai un errore verso il cliente.
    await logAiUsage({ businessId: biz.id, channel: base.channel, model: data.model || MODEL, usage: data.usage });
    if (data.stop_reason !== "tool_use") {
      let finalText = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
      // Rete di sicurezza: se la prenotazione include non soci, il promemoria del certificato medico c'è SEMPRE.
      if (certNeeded && finalText && !/certificat/i.test(finalText)) finalText += "\n\n" + CERTIFICATE_REMINDER;
      // Rete di sicurezza: mai dire "prenotato" se book_appointment non ha risposto ok (altrimenti il cliente crede di avere un
      // appuntamento che non esiste e il titolare non riceve nessuna notifica). Si ripete il giro una volta con una correzione.
      if (!bookedOk && !nudged && finalText && /(ti ho (prenotat|riservat|fissat)|prenotazione (è |e' )?confermat|appuntamento (è |e' )?confermat|è tutto confermat|ti aspettiamo)/i.test(finalText)) {
        nudged = true;
        console.error("Conferma senza prenotazione salvata (canale " + base.channel + "): correggo il modello");
        msgs.push({ role: "assistant", content: data.content });
        msgs.push({ role: "user", content: "(Messaggio di sistema, non del cliente: NON hai ancora prenotato, book_appointment non è stata eseguita con successo. Non dire che è confermato. Se hai servizio, giorno, ora, nome e numero di telefono scritti dal cliente, chiama ora book_appointment. Se manca il numero di telefono, chiedilo (è obbligatorio; l'email è facoltativa). Se manca altro, chiedilo.)" });
        continue;
      }
      return { text: finalText, calendar: calendar, certNeeded: certNeeded };
    }
    msgs.push({ role: "assistant", content: data.content });
    const results = [];
    for (const block of data.content) {
      if (block.type !== "tool_use") continue;
      const out = await runTool(block.name, block.input || {}, { biz: biz, phone: base.phone, contactId: base.contactId, channel: base.channel, userTexts: userTexts });
      if (out && out.calendar) calendar = out.calendar;
      if (block.name === "book_appointment" && out && out.ok === true) bookedOk = true;
      if (out && out.medical_certificate_needed === true) certNeeded = true;
      results.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(out),
        is_error: !!out.error,
      });
    }
    msgs.push({ role: "user", content: results });
  }
  return { text: "", calendar: calendar, certNeeded: certNeeded };
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

// Rete di sicurezza sullo stile: anche se il modello sbaglia, il cliente non vede mai
// piu' di una emoji per messaggio, grassetti, elenchi puntati o punti esclamativi doppi.
function pulisciRisposta(text) {
  let emojiViste = 0;
  return String(text || "")
    // Errori di italiano tipici del modello: "mi scusa" -> "scusa"; "a via/viale/piazza..." -> "in via/viale/piazza...".
    .replace(/\bmi scusa\b/gi, (m) => (m[0] === "M" ? "Scusa" : "scusa"))
    .replace(/\b(a)(\s+)(via|viale|corso|piazza|piazzale|largo|vicolo|strada|lungomare)\b(?!\s+di\b)/gi, (m, a, sp, v) => (a === "A" ? "In" : "in") + sp + v)
    .replace(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*/gu, (m) => (++emojiViste > 1 ? "" : m))
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/^\s*[-\u2022]\s+/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!{2,}/g, "!")
    .replace(/\s+([!?.,;:])/g, "$1")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

  // Abbonamento non rinnovato (o piano senza Lia): niente AI, niente costi, risposta gentile.
  // Studi sanitari: nessuna chat con l'IA, mai (testo libero dei pazienti = possibili dati sanitari). Controllo nel codice,
  // indipendente dal piano e dal database, e PRIMA di salvare qualsiasi messaggio.
  if (require("./verticals.js").isMedical(biz.business_type)) {
    return { reply: customerBlockedMessage(biz, { allowed: true }), business: biz, blocked: true };
  }
  const acc = await getAccess(biz.id);
  if (!acc.lia_allowed) {
    return { reply: customerBlockedMessage(biz, acc), business: biz, blocked: true };
  }

  if (await isRateLimited(biz.id, opts.contactId)) {
    return { reply: "Stai scrivendo molto in fretta: riprova tra qualche minuto.", business: biz };
  }

  const storico = await loadHistory(biz.id, opts.contactId);
  await saveMessage(biz.id, opts.contactId, "user", text);
  const benvenuto = (opts.channel === "web" || opts.channel === "telegram")
    ? [{ role: "user", content: "(Il cliente ha appena aperto la chat.)" }, { role: "assistant", content: welcomeText(biz) }]
    : [];
  const messages = normalizza([...benvenuto, ...storico, { role: "user", content: text }]);

  const ctx = { channel: opts.channel, contactId: opts.contactId, phone: opts.phone };
  let answer = await conversa(biz, ctx, messages);
  // Risposta vuota: se non e' stato prenotato nulla si riprova una volta (con una prenotazione gia' fatta NON si
  // riprova, per non rischiare doppioni).
  if ((!answer || !String(answer.text || "").trim()) && !(answer && answer.calendar)) {
    console.error("Risposta vuota dal modello, riprovo una volta (canale " + opts.channel + ")");
    answer = await conversa(biz, ctx, messages);
  }
  let reply = answer && answer.text ? pulisciRisposta(answer.text) : "";
  if (!reply && answer && answer.calendar) reply = "Prenotazione confermata." + (answer.certNeeded ? " " + CERTIFICATE_REMINDER : "");
  if (!reply) {
    console.error("Risposta ancora vuota dopo il nuovo tentativo (canale " + opts.channel + ")");
    reply = "Scusa, non sono riuscita a rispondere bene. Puoi riscrivermi la richiesta?";
  }
  if (reply) await saveMessage(biz.id, opts.contactId, "assistant", reply);
  return { reply: reply, business: biz, calendar: answer ? answer.calendar : null };
}

module.exports = { handleMessage, getBusiness, sb, DEFAULT_SLUG, welcomeText, partyRules, validateParty, runTool, serviceOrAsk, _notifyAiFailure: notifyAiFailure };
