// lib/pt-packs.js  (Prenolia: personal trainer)
// Il personal trainer e' un'attivita' "normale" (calendario, Disponibilita', Statistiche) con due differenze:
//  - i servizi sono PACCHETTI: una lezione di durata fissa e un numero di ingressi (services.entries);
//  - ogni iscritto ha i suoi pacchetti (pt_packs) e ogni lezione prenotata ne scala un ingresso (appointments.pt_pack_id).
// Un ingresso e' "usato" finche' la lezione non e' annullata. Senza ingressi rimasti non si puo' prenotare.

const TRAINER_TYPE = "personal trainer";
const isTrainer = (biz) => !!biz && String(biz.business_type || "").toLowerCase().trim() === TRAINER_TYPE;


// ---- Validita' e limite settimanale (Nov 2026) ----
// Un pacchetto puo' avere: una scadenza (expires_on, data locale) e un massimo di coaching a settimana (per_week).
// La settimana e' sempre da lunedi a domenica. Un coaching conta per la settimana del giorno in cui si svolge.
const TZ_DEFAULT = "Europe/Rome";
const pad2 = (n) => String(n).padStart(2, "0");
function localDateStr(iso, tz) {
  const d = new Date(iso);
  if (isNaN(d)) return "";
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz || TZ_DEFAULT, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
  catch (e) { return d.toISOString().slice(0, 10); }
}
const todayStr = (tz) => localDateStr(new Date().toISOString(), tz);
function mondayOf(ds) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ds || ""));
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const back = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - back);
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
}
// Aggiunge mesi interi a una data (il 31 gennaio + 1 mese = 28 febbraio, non marzo)
function addMonths(ds, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ds || ""));
  if (!m) return "";
  const y = +m[1], mo = +m[2] - 1 + Number(n), day = +m[3];
  const last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const d = new Date(Date.UTC(y, mo, Math.min(day, last)));
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate());
}
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
function itDate(ds) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ds || "")); return m ? (+m[3]) + " " + MESI[+m[2] - 1] : ""; }
const isExpired = (p, ds) => !!p.expires_on && String(ds) > String(p.expires_on).slice(0, 10);
const weekUsed = (p, ds) => (p.weeks && p.weeks[mondayOf(ds)]) || 0;
// Perche' un pacchetto non si puo' usare in quel giorno: "expired", "week" oppure null (si puo')
function packBlock(p, ds) {
  if (!ds) return null;
  if (isExpired(p, ds)) return "expired";
  if (Number(p.per_week) > 0 && weekUsed(p, ds) >= Number(p.per_week)) return "week";
  return null;
}
// Messaggio per l'iscritto quando nessun pacchetto va bene per quel giorno (stesso testo su pagina, Lia e dashboard)
function blockMessage(packs, serviceId, ds) {
  const mine = packs.filter((p) => !serviceId || p.service_id === serviceId);
  const withLeft = mine.filter((p) => p.left > 0);
  if (!withLeft.length) return "Non hai ingressi disponibili per questo pacchetto. Contatta il tuo personal trainer.";
  const open = withLeft.filter((p) => !isExpired(p, ds));
  if (!open.length) {
    const last = withLeft.map((p) => String(p.expires_on).slice(0, 10)).sort().pop();
    return todayStr() > last ? "Il tuo pacchetto è scaduto. Contatta il tuo personal trainer." : "Il tuo pacchetto scade il " + itDate(last) + ": non puoi prenotare dopo quella data.";
  }
  const wk = open.find((p) => Number(p.per_week) > 0);
  const n = wk ? Number(wk.per_week) : 0;
  return "Hai già prenotato " + (n === 1 ? "il coaching" : "i " + n + " coaching") + " di questa settimana. Scegli un altro giorno.";
}

// Numero confrontato per intero: l'unica tolleranza e' il prefisso internazionale (+39, 0039 o 39 davanti)
function phoneNorm(p) {
  let d = String(p || "").replace(/\D/g, "");
  if (d.startsWith("0039")) d = d.slice(4); else if (d.startsWith("39") && d.length > 10) d = d.slice(2);
  return d;
}
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
// Nome e cognome si confrontano senza badare all'ordine, alle maiuscole e agli accenti
function sameName(a, b) { const x = norm(a).split(" ").filter(Boolean).sort().join(" "), y = norm(b).split(" ").filter(Boolean).sort().join(" "); return !!x && x === y; }

// Codice di accesso: lettere e/o numeri, 4-20 caratteri. Si confronta senza badare a maiuscole e spazi.
const codeNorm = (c) => String(c || "").replace(/\s+/g, "").toLowerCase();
const codeValid = (c) => /^[A-Za-z0-9]{4,20}$/.test(String(c || "").replace(/\s+/g, ""));
// L'iscritto e' riconosciuto solo se nome, telefono (gia' filtrato in packsOf) e codice coincidono
function codeOk(packs, code) {
  const c = codeNorm(code);
  return !!c && packs.some((p) => p.access_code && codeNorm(p.access_code) === c);
}
// Tentativi sbagliati per telefono (condiviso da pagina web e Lia): dopo 8 errori in 10 minuti si blocca
const CODE_FAILS = new Map();
const ckey = (x) => (String(x).startsWith("n|") ? String(x) : phoneNorm(x));
function codeBlocked(phone) {
  const k = ckey(phone), r = CODE_FAILS.get(k);
  return !!r && Date.now() - r.t < 600000 && r.n >= 8;
}
function codeFail(phone) {
  const k = ckey(phone), r = CODE_FAILS.get(k);
  if (!r || Date.now() - r.t >= 600000) CODE_FAILS.set(k, { n: 1, t: Date.now() }); else r.n++;
  if (CODE_FAILS.size > 5000) CODE_FAILS.clear();
}
const codeReset = (phone) => CODE_FAILS.delete(ckey(phone));
// Chiave anti-abuso per nome (si entra con nome, cognome e codice, senza telefono)
const nameKey = (bizId, name) => "n|" + bizId + "|" + String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).sort().join(" ");
// Codice gia' usato da un altro iscritto dell'attivita'?
async function codeTaken(sb, bizId, code, phone) {
  const r = await sb("GET", "pt_packs?business_id=eq." + bizId + "&access_code=not.is.null&select=customer_phone,access_code&limit=2000");
  const pn = phoneNorm(phone);
  return (r.ok && Array.isArray(r.data) ? r.data : []).some((p) => codeNorm(p.access_code) === codeNorm(code) && phoneNorm(p.customer_phone) !== pn);
}

// L'iscritto che ha quel codice (e quel nome): tutti i suoi pacchetti, oppure [] se non coincide
async function packsByCode(sb, bizId, code, name) {
  const c = codeNorm(code);
  if (!c) return [];
  const r = await sb("GET", "pt_packs?business_id=eq." + bizId + "&access_code=not.is.null&select=*&order=created_at.asc&limit=2000");
  const hit = r.ok && Array.isArray(r.data) ? r.data.filter((p) => codeNorm(p.access_code) === c) : [];
  if (!hit.length) return [];
  const pn = phoneNorm(hit[0].customer_phone);
  const mine = hit.filter((p) => phoneNorm(p.customer_phone) === pn);
  if (!mine.some((p) => sameName(p.customer_name, name))) return [];
  return withUsage(sb, await packsOf(sb, bizId, hit[0].customer_phone));
}

// Pacchetti di un iscritto (per telefono) con ingressi usati e rimasti. Piu' vecchio per primo: si consuma quello.
async function packsOf(sb, bizId, phone) {
  const pn = phoneNorm(phone);
  if (pn.length < 6) return [];
  const r = await sb("GET", "pt_packs?business_id=eq." + bizId + "&select=*&order=created_at.asc&limit=1000");
  const all = r.ok && Array.isArray(r.data) ? r.data.filter((p) => phoneNorm(p.customer_phone) === pn) : [];
  return withUsage(sb, all);
}
async function withUsage(sb, packs, tz) {
  if (!packs.length) return [];
  const ids = packs.map((p) => p.id).join(",");
  const u = await sb("GET", "appointments?pt_pack_id=in.(" + ids + ")&status=neq.cancelled&select=pt_pack_id,starts_at&limit=5000");
  const used = {}, weeks = {};
  (u.ok && Array.isArray(u.data) ? u.data : []).forEach((a) => {
    used[a.pt_pack_id] = (used[a.pt_pack_id] || 0) + 1;
    const mon = mondayOf(localDateStr(a.starts_at, tz));
    if (mon) { const w = weeks[a.pt_pack_id] || (weeks[a.pt_pack_id] = {}); w[mon] = (w[mon] || 0) + 1; }
  });
  const today = todayStr(tz);
  return packs.map((p) => Object.assign({}, p, { used: used[p.id] || 0, left: Math.max(0, p.entries_total - (used[p.id] || 0)), weeks: weeks[p.id] || {}, expired: isExpired(p, today) }));
}
// Il pacchetto da cui scalare una lezione di quel servizio: il piu' vecchio con ingressi rimasti
// Se si passa la data del coaching (AAAA-MM-GG) si rispettano anche scadenza e limite settimanale
function pickPack(packs, serviceId, ds) {
  return packs.find((p) => p.left > 0 && (!serviceId || p.service_id === serviceId) && !packBlock(p, ds)) || null;
}

// Elenco degli iscritti: chi ha almeno un pacchetto assegnato dal trainer (diverso dall'elenco clienti, che nasce dagli appuntamenti)
async function rosterOf(sb, bizId, tz) {
  const r = await sb("GET", "pt_packs?business_id=eq." + bizId + "&select=*&order=created_at.asc&limit=2000");
  const packs = await withUsage(sb, r.ok && Array.isArray(r.data) ? r.data : [], tz);
  const today = todayStr(tz);
  const by = {};
  packs.forEach((p) => {
    const k = phoneNorm(p.customer_phone);
    const m = by[k] || (by[k] = { name: p.customer_name, phone: p.customer_phone, left: 0, total: 0, code: "", packs: [], _all: [] });
    if (p.access_code && !m.code) m.code = p.access_code;
    m.name = p.customer_name; m.phone = p.customer_phone;
    m._all.push(p);
    m.packs.push({ id: p.id, service_id: p.service_id || null, name: p.pack_name, total: p.entries_total, used: p.used, left: p.left, price_eur: p.price_eur, created_at: p.created_at, starts_on: p.starts_on ? String(p.starts_on).slice(0, 10) : null, expires_on: p.expires_on ? String(p.expires_on).slice(0, 10) : null, per_week: Number(p.per_week) > 0 ? Number(p.per_week) : null, expired: !!p.expired, week_used: weekUsed(p, today) });
  });
  return Object.keys(by).map((k) => {
    const m = by[k], act = m._all.filter((p) => !p.expired), set = act.length ? act : m._all;
    set.forEach((p) => { m.left += p.left; m.total += p.entries_total; });
    m.expired = !act.length;
    const dated = set.filter((p) => p.expires_on && (act.length ? p.left > 0 : true)).map((p) => String(p.expires_on).slice(0, 10)).sort();
    m.expires_on = dated.length ? (act.length ? dated[0] : dated[dated.length - 1]) : null;
    const wp = act.find((p) => Number(p.per_week) > 0 && p.left > 0) || act.find((p) => Number(p.per_week) > 0);
    m.per_week = wp ? Number(wp.per_week) : null;
    m.week_used = wp ? weekUsed(wp, today) : 0;
    delete m._all;
    return m;
  });
}

// Durata (mesi, 0 = senza scadenza) e massimo a settimana (0 = nessun limite) inviati dal modulo del pacchetto
function validityFromBody(b) {
  const set = {};
  if (b.pt_months !== undefined && b.pt_months !== null && b.pt_months !== "") {
    const m = Number(b.pt_months);
    if (!Number.isInteger(m) || m < 0 || m > 60) return { error: "La durata del pacchetto non è valida." };
    set.pt_months = m > 0 ? m : null;
  }
  if (b.pt_per_week !== undefined && b.pt_per_week !== null && b.pt_per_week !== "") {
    const w = Number(b.pt_per_week);
    if (!Number.isInteger(w) || w < 0 || w > 7) return { error: "Il massimo a settimana deve essere da 1 a 7 (oppure nessun limite)." };
    set.pt_per_week = w > 0 ? w : null;
  }
  return { set };
}

module.exports = { validityFromBody, localDateStr, todayStr, mondayOf, addMonths, itDate, packBlock, blockMessage, isExpired, weekUsed, packsByCode, nameKey, codeNorm, codeValid, codeOk, codeBlocked, codeFail, codeReset, codeTaken, rosterOf, isTrainer, phoneNorm, sameName, packsOf, withUsage, pickPack, TRAINER_TYPE };
