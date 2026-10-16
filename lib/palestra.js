// lib/palestra.js  (Prenolia: modulo Palestra)
// Un solo endpoint (api/palestra.js) serve:
//   - la pagina del titolare   /api/palestra?t=TOKEN        (iscritti, abbonamenti, programma, presenze)
//   - la pagina degli iscritti /api/palestra?b=SLUG         (prenotazione corsi)
// Il controllo "abbonamento valido e posti liberi" è fatto dalla funzione SQL gym_book (atomica);
// qui sopra si ricalcola solo per mostrare all'iscritto il motivo del divieto prima che tocchi il pulsante.

const { getAccess, BOOKING_BLOCKED_MESSAGE } = require("./access.js");
const pages = require("./palestra-pages.js");

const DEFAULT_CUTOFF_MIN = 180; // disdetta fino a 3 ore prima
const DAYS_AHEAD = 14; // quanti giorni avanti si può prenotare
const DEFAULT_CATEGORIES = ["corsi", "circuiti", "hyrox", "pilates"];
const DEFAULT_EXPIRY_DAYS = 5; // da quanti giorni prima della scadenza l'abbonamento compare "in scadenza" e nella campanella
const DEFAULT_PT_HOURS = ["10:00", "11:00", "12:00", "15:00", "16:00", "17:00"]; // ore in cui è possibile il Personal 1:1 (se non c'è un corso)

function sbHeaders(extra) {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const h = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key;
  return Object.assign(h, extra || {});
}
async function sb(method, path, body, prefer) {
  const res = await fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, {
    method, headers: sbHeaders(prefer ? { Prefer: prefer } : {}), body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { ok: res.ok, status: res.status, data };
}
const enc = encodeURIComponent;

// ---- date e fusi orari ----
function tzOffsetMs(utcMs, tz) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utcMs));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - utcMs;
}
function todayStr(tz) { return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); }
function addDays(d, n) { const [y, m, dd] = d.split("-").map(Number); return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10); }
function weekdayOf(d) { const [y, m, dd] = d.split("-").map(Number); const w = new Date(Date.UTC(y, m - 1, dd)).getUTCDay(); return w === 0 ? 7 : w; }
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(Date.parse(s));
function hm(t) { return String(t || "").slice(0, 5); }
function startUtc(dateStr, time, tz) {
  const [y, m, d] = dateStr.split("-").map(Number); const [h, mi] = hm(time).split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi); const o1 = tzOffsetMs(guess, tz); let utc = guess - o1; const o2 = tzOffsetMs(utc, tz); if (o2 !== o1) utc = guess - o2; return new Date(utc);
}
const IT_MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
function itDate(d) { const [, m, dd] = d.split("-").map(Number); return dd + " " + IT_MONTHS[m - 1]; }

// ---- persone ----
const phoneKey = (p) => String(p || "").replace(/\D/g, "").slice(-9);
const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
function namesMatch(m, first, last) {
  const a = [norm(m.first_name), norm(m.last_name)].filter(Boolean).join(" ").split(" ").sort().join(" ");
  const b = [norm(first), norm(last)].filter(Boolean).join(" ").split(" ").sort().join(" ");
  return !!a && a === b;
}
const clean = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

// ---- anti tentativi (per istanza: basta per fermare chi prova a caso) ----
const fails = new Map();
function throttled(key) { const e = fails.get(key); return !!e && e.n >= 8 && Date.now() - e.t < 10 * 60000; }
function noteFail(key) { const e = fails.get(key); if (!e || Date.now() - e.t > 10 * 60000) fails.set(key, { n: 1, t: Date.now() }); else { e.n++; } if (fails.size > 2000) fails.clear(); }

// ---- abbonamenti ----
function planValidOn(p, date) {
  if (p.cancelled || p.starts_on > date) return false;
  if (p.kind === "time") return !!p.ends_on && p.ends_on >= date;
  return (p.entries_left || 0) > 0 && (!p.ends_on || p.ends_on >= date);
}
// Stessa regola della funzione SQL, ma con il motivo scritto per esteso.
function eligibility(plans, category, date) {
  const live = plans.filter((p) => !p.cancelled);
  if (live.some((p) => planValidOn(p, date) && (p.covers || []).includes(category))) return { ok: true };
  if (live.some((p) => planValidOn(p, date))) return { ok: false, code: "not_included", message: "Il tuo abbonamento non include questo corso. Chiedi in palestra di aggiungerlo." };
  const entries = live.filter((p) => p.kind === "entries");
  if (entries.length && entries.every((p) => (p.entries_left || 0) <= 0) && !live.some((p) => p.kind === "time")) return { ok: false, code: "no_entries", message: "Hai finito gli ingressi. Chiedi in palestra di rinnovare." };
  const ends = live.filter((p) => p.ends_on).map((p) => p.ends_on).sort();
  const last = ends[ends.length - 1];
  if (last && last < date) {
    const today = todayStr("Europe/Rome");
    return { ok: false, code: "expired", message: last < today ? "Il tuo abbonamento è scaduto il " + itDate(last) + ". Rinnovalo in palestra per prenotare." : "Il tuo abbonamento scade il " + itDate(last) + ": per questo giorno non è valido." };
  }
  const starts = live.map((p) => p.starts_on).sort();
  if (starts.length && starts[0] > date) return { ok: false, code: "not_started", message: "Il tuo abbonamento parte il " + itDate(starts[0]) + "." };
  return { ok: false, code: "none", message: "Non hai un abbonamento attivo. Chiedi in palestra." };
}
function planLine(p) {
  if (p.kind === "entries") return p.plan_name + " · " + (p.entries_left || 0) + (p.entries_left === 1 ? " ingresso rimasto" : " ingressi rimasti");
  return p.plan_name + " · fino al " + itDate(p.ends_on);
}
// Stato di un iscritto per l'elenco del titolare
function memberStatus(plans, today, warnDays) {
  const wd = Number.isInteger(warnDays) ? warnDays : DEFAULT_EXPIRY_DAYS;
  const live = plans.filter((p) => !p.cancelled);
  const valid = live.filter((p) => planValidOn(p, today));
  if (!live.length) return { s: "none", label: "Nessun abbonamento", detail: "Da inserire" };
  if (!valid.length) {
    const last = live.map((p) => p.ends_on).filter(Boolean).sort().pop();
    const noEntries = live.every((p) => p.kind === "entries" && (p.entries_left || 0) <= 0);
    return { s: "bad", label: "Scaduto", detail: noEntries ? "Ingressi finiti" : last ? "Scaduto il " + itDate(last) : "Non attivo" };
  }
  const soon = valid.filter((p) => p.kind === "time" && p.ends_on <= addDays(today, wd));
  const low = valid.filter((p) => p.kind === "entries" && (p.entries_left || 0) <= 2);
  const timeOk = valid.some((p) => p.kind === "time" && p.ends_on > addDays(today, wd));
  const best = valid.slice().sort((a, b) => (b.ends_on || "9999").localeCompare(a.ends_on || "9999"))[0];
  if (!timeOk && (soon.length || low.length)) return { s: "warn", label: "In scadenza", ends_on: soon.length ? soon[0].ends_on : null, detail: soon.length ? (soon[0].ends_on === today ? "Scade oggi" : "Scade il " + itDate(soon[0].ends_on)) : (low[0].entries_left + (low[0].entries_left === 1 ? " ingresso rimasto" : " ingressi rimasti")) };
  return { s: "ok", label: "Attivo", detail: planLine(best) };
}

// ---- lettura attività ----
async function bizBySlug(slug) {
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) return null;
  const r = await sb("GET", "businesses?slug=eq." + enc(slug) + "&active=eq.true&select=id,name,slug,timezone,public_tagline,public_phone,public_instagram,address,booking_rules,business_type");
  return r.ok && Array.isArray(r.data) && r.data.length ? r.data[0] : null;
}
async function bizByToken(token) {
  if (!/^[a-f0-9]{32,128}$/.test(token)) return null;
  const r = await sb("GET", "businesses?agenda_token=eq." + token + "&active=eq.true&select=id,name,slug,timezone,public_tagline,public_phone,address,booking_rules,business_type");
  return r.ok && Array.isArray(r.data) && r.data.length ? r.data[0] : null;
}
function cfg(biz) {
  const g = (biz.booking_rules && biz.booking_rules.gym) || {};
  const c = Number(g.cutoff_min);
  const e = Number(g.expiry_days);
  const pt = Array.isArray(g.pt_hours) ? g.pt_hours.map(String).filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)) : null;
  return {
    cutoff_min: Number.isInteger(c) && c >= 0 && c <= 72 * 60 ? c : DEFAULT_CUTOFF_MIN, days_ahead: DAYS_AHEAD,
    expiry_days: Number.isInteger(e) && e >= 1 && e <= 30 ? e : DEFAULT_EXPIRY_DAYS,
    pt_hours: pt ? Array.from(new Set(pt)).sort() : DEFAULT_PT_HOURS,
    pt_price: Number(g.pt_price) >= 0 && Number(g.pt_price) <= 1000 && g.pt_price != null ? Number(g.pt_price) : PT_PRICE_DEFAULT,
  };
}

// Lettura a pagine (Supabase restituisce al massimo 1000 righe per richiesta)
async function sbAll(path) {
  const out = [];
  for (let off = 0; off < 20000; off += 1000) {
    const r = await sb("GET", path + "&order=id.asc&limit=1000&offset=" + off);
    if (!r.ok || !Array.isArray(r.data)) return { ok: false, data: [] };
    out.push.apply(out, r.data);
    if (r.data.length < 1000) break;
  }
  return { ok: true, data: out };
}

// Lezioni con posti occupati: si leggono programma, prenotazioni e annullamenti una volta sola per tutto l'intervallo.
// light = senza i nomi (per la vista mese basta contare).
async function loadRange(biz, from, to, light) {
  const who = light ? "" : ",gym_members(first_name,last_name,phone)";
  const [sr, br, cr, pr] = await Promise.all([
    sb("GET", "gym_schedule?business_id=eq." + biz.id + "&active=eq.true&select=id,weekday,starts_at_time,capacity,gym_courses(id,name,category,description,duration_min,capacity,active)&order=starts_at_time.asc"),
    sbAll("gym_bookings?business_id=eq." + biz.id + "&session_date=gte." + from + "&session_date=lte." + to + "&status=eq.confirmed&select=id,schedule_id,session_date,member_id,no_show" + who),
    sb("GET", "gym_cancelled_sessions?business_id=eq." + biz.id + "&session_date=gte." + from + "&session_date=lte." + to + "&select=schedule_id,session_date,reason"),
    sbAll("gym_pt_bookings?business_id=eq." + biz.id + "&session_date=gte." + from + "&session_date=lte." + to + "&status=eq.confirmed&select=id,session_date,start_time,member_id,no_show" + who),
  ]);
  if (!sr.ok || !br.ok || !cr.ok || !pr.ok) throw new Error("Errore lettura programma");
  return { sched: sr.data || [], bookings: br.data || [], cancelled: cr.data || [], pt: pr.data || [] };
}
// Ore di Personal 1:1 di un giorno: solo nei giorni in cui c'è almeno un corso e nelle ore senza corso.
function ptSlotsOf(biz, conf, data, date) {
  const wd = weekdayOf(date);
  const day = data.sched.filter((s) => s.weekday === wd && s.gym_courses && s.gym_courses.active);
  if (!day.length) return [];
  const mins = (t) => Number(hm(t).slice(0, 2)) * 60 + Number(hm(t).slice(3, 5));
  const busy = (t) => day.some((s) => { const a = mins(s.starts_at_time), b = a + (s.gym_courses.duration_min || 60); return a < mins(t) + 60 && b > mins(t); });
  const booked = data.pt.filter((x) => x.session_date === date);
  const times = Array.from(new Set(conf.pt_hours.filter((t) => !busy(t)).concat(booked.map((x) => hm(x.start_time))))).sort();
  const nowMs = Date.now();
  return times.map((t) => {
    const bk = booked.find((x) => hm(x.start_time) === t) || null;
    const start = startUtc(date, t, biz.timezone);
    return { time: t, starts_at: start.toISOString(), started: start.getTime() <= nowMs, _bk: bk };
  });
}
function sessionsOf(biz, data, date) {
  const wd = weekdayOf(date);
  const nowMs = Date.now();
  return data.sched.filter((s) => s.weekday === wd && s.gym_courses && s.gym_courses.active).map((s) => {
    const c = s.gym_courses;
    const cap = s.capacity || c.capacity;
    const bk = data.bookings.filter((b) => b.schedule_id === s.id && b.session_date === date);
    const canc = data.cancelled.filter((x) => x.schedule_id === s.id && x.session_date === date)[0];
    const start = startUtc(date, s.starts_at_time, biz.timezone);
    return {
      schedule_id: s.id, time: hm(s.starts_at_time), starts_at: start.toISOString(), duration_min: c.duration_min,
      course: { id: c.id, name: c.name, category: c.category, description: c.description || "" },
      capacity: cap, taken: bk.length, cancelled: !!canc, cancel_reason: canc && canc.reason ? canc.reason : "",
      started: start.getTime() <= nowMs, _bk: bk,
    };
  }).sort((a, b) => (a.time < b.time ? -1 : 1));
}
async function daySessions(biz, date) {
  return sessionsOf(biz, await loadRange(biz, date, date), date);
}
function ownerSession(s) {
  return {
    schedule_id: s.schedule_id, time: s.time, duration_min: s.duration_min, course: s.course, capacity: s.capacity, taken: s.taken, cancelled: s.cancelled, cancel_reason: s.cancel_reason, started: s.started,
    attendees: s._bk.map((b) => ({ booking_id: b.id, member_id: b.member_id, no_show: !!b.no_show, name: b.gym_members ? b.gym_members.first_name + " " + b.gym_members.last_name : "?", phone: b.gym_members ? b.gym_members.phone : "" })),
  };
}
function ownerPt(p) {
  const b = p._bk;
  return { time: p.time, started: p.started, free: !b, booking_id: b ? b.id : null, member_id: b ? b.member_id : null, no_show: !!(b && b.no_show), name: b && b.gym_members ? b.gym_members.first_name + " " + b.gym_members.last_name : "", phone: b && b.gym_members ? b.gym_members.phone : "" };
}

// Avvisi nella campanella (best effort: se non riesce, la prenotazione resta valida)
async function notify(bizId, type, memberName, courseName, startsAt) {
  try {
    await sb("POST", "notification_events", { business_id: bizId, event_type: type, customer_name: memberName, service_name: courseName, starts_at: startsAt, channel: "selfservice" }, "return=minimal");
  } catch (e) { /* si ignora */ }
}

async function memberPlans(memberId) {
  const r = await sb("GET", "gym_member_plans?member_id=eq." + memberId + "&order=starts_on.desc&select=id,plan_id,plan_name,kind,covers,starts_on,ends_on,entries_total,entries_left,price_paid,cancelled,created_at,max_entries,max_per_week");
  return r.ok && Array.isArray(r.data) ? r.data : [];
}

// Date delle prenotazioni confermate di un iscritto (lezioni + Personal), per controllare i limiti dell'abbonamento
async function memberDates(memberId, since) {
  const [a, b] = await Promise.all([
    sbAll("gym_bookings?member_id=eq." + memberId + "&status=eq.confirmed&session_date=gte." + since + "&select=id,session_date"),
    sbAll("gym_pt_bookings?member_id=eq." + memberId + "&status=eq.confirmed&session_date=gte." + since + "&select=id,session_date"),
  ]);
  return a.data.concat(b.data).map((x) => x.session_date);
}
// Stessa regola della funzione SQL gym_caps_error, con il motivo scritto per esteso. Null = nessun problema.
function capsMessage(plans, dates, category, date) {
  const p = plans.filter((x) => planValidOn(x, date) && (x.covers || []).includes(category)).sort((a, b) => (a.kind === "time" ? 0 : 1) - (b.kind === "time" ? 0 : 1))[0];
  if (!p) return null;
  if (p.max_per_week) {
    const mon = addDays(date, 1 - weekdayOf(date)), sun = addDays(mon, 6);
    if (dates.filter((d) => d >= mon && d <= sun).length >= p.max_per_week) return "In quella settimana ci sono già " + p.max_per_week + " ingressi prenotati (il massimo).";
  }
  if (p.max_entries && dates.filter((d) => d >= p.starts_on && (!p.ends_on || d <= p.ends_on)).length >= p.max_entries) return "Gli " + p.max_entries + " ingressi del mese sono già stati prenotati.";
  return null;
}

async function rpc(name, args) {
  const r = await sb("POST", "rpc/" + name, args);
  if (!r.ok) throw new Error("rpc " + name + " " + r.status + " " + JSON.stringify(r.data).slice(0, 200));
  return r.data;
}

// ================= pagina e dati degli iscritti =================
async function handlePublic(req, res, q) {
  const biz = await bizBySlug(String(q.b || ""));
  if (!biz) return res.status(404).json({ error: "Palestra non trovata" });
  const conf = cfg(biz);
  const acc = await getAccess(biz.id);

  if (req.method === "GET" && q.info === "1") {
    return res.status(200).json({ name: biz.name, tagline: biz.public_tagline || "", phone: biz.public_phone || "", address: biz.address || "", instagram: biz.public_instagram || "", cutoff_min: conf.cutoff_min, days_ahead: conf.days_ahead, today: todayStr(biz.timezone), open: acc.allowed !== false, privacy: "/privacy/" + biz.slug });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });
  const body = req.body || {};
  const action = String(body.action || "");
  const ip = String((req.headers && (req.headers["x-forwarded-for"] || "")) || "").split(",")[0].trim();
  const tkey = biz.id + "|" + ip;

  async function identify(required) {
    const first = clean(body.first, 60), last = clean(body.last, 60), key = phoneKey(body.phone);
    if (!first || !last || key.length < 8) return required ? { err: "Scrivi nome, cognome e numero di telefono." } : { member: null };
    if (throttled(tkey)) return { err: "Troppi tentativi. Riprova tra qualche minuto o chiedi in palestra." };
    const r = await sb("GET", "gym_members?business_id=eq." + biz.id + "&phone_key=eq." + key + "&active=eq.true&select=id,first_name,last_name,phone");
    const m = r.ok && Array.isArray(r.data) ? r.data.find((x) => namesMatch(x, first, last)) : null;
    if (!m) { noteFail(tkey); return { err: "Non ti trovo. Controlla nome, cognome e telefono: devono essere gli stessi dati dati in palestra." }; }
    return { member: m };
  }
  function window(date) {
    if (!isDate(date)) return "Data non valida.";
    const t = todayStr(biz.timezone);
    if (date < t) return "Quella data è già passata.";
    if (date > addDays(t, conf.days_ahead)) return "Si può prenotare fino a " + conf.days_ahead + " giorni avanti.";
    return null;
  }

  if (action === "login") {
    const id = await identify(true);
    if (id.err) return res.status(401).json({ error: id.err });
    return res.status(200).json(await summary(biz, id.member, conf));
  }
  if (action === "me") {
    const id = await identify(true);
    if (id.err) return res.status(401).json({ error: id.err });
    return res.status(200).json(await summary(biz, id.member, conf));
  }
  // Una o più giornate: un solo caricamento di dati e un solo controllo dell'iscritto per tutte
  async function daysOut(dates) {
    const id = await identify(false);
    if (id.err) return { err: id.err };
    const data = await loadRange(biz, dates[0], dates[dates.length - 1], true);
    const plans = id.member ? await memberPlans(id.member.id) : null;
    let used = [];
    if (id.member) { const since = plans.map((p) => p.starts_on).sort()[0]; used = since ? await memberDates(id.member.id, since) : []; }
    const outs = dates.map((date) => {
      const sessions = sessionsOf(biz, data, date);
      // Vale per lezioni e Personal: prima l'abbonamento (scaduto / non incluso), poi i limiti
      const gate = (category) => {
        const el = eligibility(plans, category, date);
        if (!el.ok) return el;
        const msg = capsMessage(plans, used, category, date);
        return msg ? { ok: false, code: "limit", message: msg } : el;
      };
      const out = sessions.map((s) => {
        const mine = id.member ? s._bk.find((b) => b.member_id === id.member.id) : null;
        let can = null;
        if (id.member) {
          if (s.cancelled) can = { ok: false, message: s.cancel_reason ? "Lezione annullata: " + s.cancel_reason : "Lezione annullata." };
          else if (s.started) can = { ok: false, message: "La lezione è già iniziata." };
          else if (mine) can = { ok: false, code: "already", message: "" };
          else if (s.taken >= s.capacity) can = { ok: false, code: "full", message: "Lezione al completo." };
          else can = gate(s.course.category);
        }
        return { schedule_id: s.schedule_id, time: s.time, duration_min: s.duration_min, course: s.course, capacity: s.capacity, taken: s.taken, cancelled: s.cancelled, started: s.started, mine: mine ? mine.id : null, can };
      });
      // Personal 1:1: solo le ore libere (nei giorni in cui c'è almeno un corso)
      const ptAll = ptSlotsOf(biz, conf, data, date);
      let ptCan = id.member ? gate("personal") : null;
      if (ptCan && !ptCan.ok) {
        const hasPt = plans.some((x) => !x.cancelled && (x.covers || []).includes("personal"));
        if (ptCan.code === "not_included" || ptCan.code === "none" || ptCan.code === "expired" || ptCan.code === "not_started") ptCan = hasPt ? { ok: false, code: "no_entries", message: "Hai finito le lezioni del Piano Personal. Chiedi in palestra di rinnovarlo." } : { ok: false, code: "not_included", message: "Per prenotare un Personal serve il Piano Personal. Chiedilo in palestra." };
        else if (ptCan.code === "no_entries") ptCan = { ok: false, code: "no_entries", message: "Hai finito le lezioni del Piano Personal. Chiedi in palestra di rinnovarlo." };
      }
      if (ptCan && ptCan.ok && ptAll.some((x) => x._bk && x._bk.member_id === id.member.id)) ptCan = { ok: false, code: "one_per_day", message: "Hai già un Personal questo giorno: se ne prenota uno al giorno." };
      const pt = ptAll.filter((x) => !x.started && (!x._bk || (id.member && x._bk.member_id === id.member.id))).map((x) => ({
        time: x.time, mine: x._bk ? x._bk.id : null, duration_min: 60,
        can: id.member ? (x._bk ? { ok: false, code: "already", message: "" } : ptCan) : null,
      }));
      return { date, sessions: out, pt, open: acc.allowed !== false };
    });
    return { outs };
  }
  if (action === "day") {
    const date = String(body.date || "");
    const bad = window(date);
    if (bad) return res.status(400).json({ error: bad });
    const r = await daysOut([date]);
    if (r.err) return res.status(401).json({ error: r.err });
    return res.status(200).json(r.outs[0]);
  }
  if (action === "days") {
    // tutta la finestra prenotabile in una volta: il cambio giorno nella pagina è istantaneo
    const t = todayStr(biz.timezone), dates = [];
    for (let i = 0; i < conf.days_ahead; i++) dates.push(addDays(t, i));
    const r = await daysOut(dates);
    if (r.err) return res.status(401).json({ error: r.err });
    return res.status(200).json({ days: r.outs });
  }
  if (action === "book") {
    if (acc.allowed === false) return res.status(503).json({ error: BOOKING_BLOCKED_MESSAGE });
    const id = await identify(true);
    if (id.err) return res.status(401).json({ error: id.err });
    const date = String(body.date || "");
    const bad = window(date);
    if (bad) return res.status(400).json({ error: bad });
    const sid = String(body.schedule_id || "");
    if (!/^[0-9a-f-]{36}$/.test(sid)) return res.status(400).json({ error: "Richiesta non valida" });
    const r = await rpc("gym_book", { p_business: biz.id, p_member: id.member.id, p_schedule: sid, p_date: date });
    if (!r || r.ok !== true) return res.status(409).json({ error: (r && r.message) || "Prenotazione non riuscita.", code: r && r.code });
    try {
      const cr = await sb("GET", "gym_schedule?id=eq." + sid + "&select=gym_courses(name)");
      await notify(biz.id, "booked", id.member.first_name + " " + id.member.last_name, cr.ok && cr.data && cr.data[0] && cr.data[0].gym_courses ? cr.data[0].gym_courses.name : "Lezione", r.starts_at);
    } catch (e) { /* si ignora */ }
    return res.status(200).json({ ok: true, booking: r });
  }
  if (action === "pt_book") {
    if (acc.allowed === false) return res.status(503).json({ error: BOOKING_BLOCKED_MESSAGE });
    const id = await identify(true);
    if (id.err) return res.status(401).json({ error: id.err });
    const date = String(body.date || "");
    const bad = window(date);
    if (bad) return res.status(400).json({ error: bad });
    const time = String(body.time || "");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return res.status(400).json({ error: "Richiesta non valida" });
    const data = await loadRange(biz, date, date, true);
    if (!ptSlotsOf(biz, conf, data, date).some((x) => x.time === time)) return res.status(409).json({ error: "In quell'ora il Personal 1:1 non è disponibile." });
    const r = await rpc("gym_pt_book", { p_business: biz.id, p_member: id.member.id, p_date: date, p_time: time });
    if (!r || r.ok !== true) return res.status(409).json({ error: (r && r.message) || "Prenotazione non riuscita.", code: r && r.code });
    await notify(biz.id, "booked", id.member.first_name + " " + id.member.last_name, "Personal 1:1", r.starts_at);
    return res.status(200).json({ ok: true, booking: r });
  }
  if (action === "cancel") {
    const id = await identify(true);
    if (id.err) return res.status(401).json({ error: id.err });
    const bid = String(body.booking_id || "");
    if (!/^[0-9a-f-]{36}$/.test(bid)) return res.status(400).json({ error: "Richiesta non valida" });
    const isPt = body.kind === "pt";
    let info = null;
    try {
      const ir = isPt ? await sb("GET", "gym_pt_bookings?id=eq." + bid + "&member_id=eq." + id.member.id + "&select=starts_at") : await sb("GET", "gym_bookings?id=eq." + bid + "&member_id=eq." + id.member.id + "&select=starts_at,gym_schedule(gym_courses(name))");
      info = ir.ok && ir.data && ir.data[0] ? ir.data[0] : null;
    } catch (e) { info = null; }
    const r = await rpc(isPt ? "gym_pt_cancel" : "gym_cancel", { p_business: biz.id, p_member: id.member.id, p_booking: bid, p_cutoff_min: conf.cutoff_min, p_by_owner: false });
    if (!r || r.ok !== true) return res.status(409).json({ error: (r && r.message) || "Disdetta non riuscita.", code: r && r.code });
    if (info) await notify(biz.id, "cancelled", id.member.first_name + " " + id.member.last_name, isPt ? "Personal 1:1" : (info.gym_schedule && info.gym_schedule.gym_courses ? info.gym_schedule.gym_courses.name : "Lezione"), info.starts_at);
    return res.status(200).json({ ok: true, refunded: !!r.refunded });
  }
  return res.status(400).json({ error: "Richiesta non valida" });
}

async function summary(biz, member, conf) {
  const tz = biz.timezone, today = todayStr(tz);
  const [plans, br, pr] = await Promise.all([
    memberPlans(member.id),
    sb("GET", "gym_bookings?member_id=eq." + member.id + "&status=eq.confirmed&session_date=gte." + today + "&order=starts_at.asc&select=id,schedule_id,session_date,starts_at,gym_schedule(starts_at_time,gym_courses(name,category))"),
    sb("GET", "gym_pt_bookings?member_id=eq." + member.id + "&status=eq.confirmed&session_date=gte." + today + "&order=starts_at.asc&select=id,session_date,start_time,starts_at"),
  ]);
  const st = memberStatus(plans, today, conf.expiry_days);
  const now = Date.now();
  const mapB = (b, pt) => ({
    id: b.id, kind: pt ? "pt" : "class", date: b.session_date, time: hm(pt ? b.start_time : (b.gym_schedule && b.gym_schedule.starts_at_time)),
    name: pt ? "Personal 1:1" : ((b.gym_schedule && b.gym_schedule.gym_courses && b.gym_schedule.gym_courses.name) || "Lezione"),
    can_cancel: new Date(b.starts_at).getTime() - conf.cutoff_min * 60000 > now, _t: new Date(b.starts_at).getTime(),
  });
  const bookings = (br.ok && Array.isArray(br.data) ? br.data : []).filter((b) => new Date(b.starts_at).getTime() > now).map((b) => mapB(b, false))
    .concat((pr.ok && Array.isArray(pr.data) ? pr.data : []).filter((b) => new Date(b.starts_at).getTime() > now).map((b) => mapB(b, true)))
    .sort((a, b) => a._t - b._t).map((b) => { delete b._t; return b; });
  const live = plans.filter((p) => !p.cancelled);
  const lastEnd = live.map((p) => p.ends_on).filter(Boolean).sort().pop() || null;
  return {
    member: { first_name: member.first_name, last_name: member.last_name }, status: st,
    expired: st.s === "bad" || st.s === "none", ends_on: lastEnd,
    plans: plans.filter((p) => !p.cancelled && (planValidOn(p, today) || (p.ends_on || "9999") >= addDays(today, -30))).map((p) => ({ line: planLine(p), covers: p.covers, valid: planValidOn(p, today), max_entries: p.max_entries || null, max_per_week: p.max_per_week || null })),
    bookings, today,
  };
}

// ================= statistiche =================
const PT_PRICE_DEFAULT = 20;
function monthStart(d, k) { const [y, m] = d.split("-").map(Number); const x = new Date(Date.UTC(y, m - 1 + k, 1)); return x.toISOString().slice(0, 10); }
function monthEnd(d, k) { return addDays(monthStart(d, k + 1), -1); }
async function statsFor(biz, conf, period) {
  const tz = biz.timezone || "Europe/Rome", today = todayStr(tz);
  period = period === "week" || period === "year" ? period : "month";
  const ptPrice = conf.pt_price;
  // finestra corrente e precedente
  let from, prevFrom, prevTo, buckets = [];
  if (period === "year") {
    from = monthStart(today, -11); prevFrom = monthStart(today, -23); prevTo = addDays(from, -1);
    for (let i = 0; i < 12; i++) buckets.push({ from: monthStart(today, i - 11), to: i === 11 ? today : monthEnd(today, i - 11) });
  } else {
    const span = period === "week" ? 7 : 30;
    from = addDays(today, -(span - 1)); prevFrom = addDays(from, -span); prevTo = addDays(from, -1);
    for (let i = 0; i < span; i++) { const d = addDays(from, i); buckets.push({ from: d, to: d }); }
  }
  const [mb, mp, sr, bk, pt, cl] = await Promise.all([
    sb("GET", "gym_members?business_id=eq." + biz.id + "&active=eq.true&select=id,first_name,last_name,created_at"),
    sbAll("gym_member_plans?business_id=eq." + biz.id + "&cancelled=eq.false&select=id,member_id,kind,covers,starts_on,ends_on,entries_left,cancelled,plan_name,price_paid"),
    sb("GET", "gym_schedule?business_id=eq." + biz.id + "&active=eq.true&select=id,weekday,starts_at_time,capacity,gym_courses(id,name,category,capacity,duration_min,active)"),
    sbAll("gym_bookings?business_id=eq." + biz.id + "&status=eq.confirmed&session_date=gte." + prevFrom + "&session_date=lte." + today + "&select=id,schedule_id,session_date,member_id,no_show"),
    sbAll("gym_pt_bookings?business_id=eq." + biz.id + "&status=eq.confirmed&session_date=gte." + prevFrom + "&session_date=lte." + today + "&select=id,session_date,start_time,member_id,no_show"),
    sb("GET", "gym_cancelled_sessions?business_id=eq." + biz.id + "&session_date=gte." + prevFrom + "&session_date=lte." + today + "&select=schedule_id,session_date"),
  ]);
  if (![mb, mp, sr, bk, pt, cl].every((x) => x.ok)) throw new Error("Errore statistiche");
  const scheds = (sr.data || []).filter((s) => s.gym_courses && s.gym_courses.active);
  const sById = {}; scheds.forEach((s) => { sById[s.id] = s; });
  const cancelled = new Set((cl.data || []).map((c) => c.schedule_id + "|" + c.session_date));
  const members = mb.data || [], plans = mp.data || [];
  const nameOf = {}; members.forEach((m) => { nameOf[m.id] = m.first_name + " " + (m.last_name || "").charAt(0) + "."; });
  const capOf = (s) => s.capacity || s.gym_courses.capacity || 20;
  // capienza dei giorni (lezioni tenute fino a oggi)
  const capByDay = (d) => { const wd = weekdayOf(d); let c = 0; scheds.forEach((s) => { if (s.weekday === wd && !cancelled.has(s.id + "|" + d)) c += capOf(s); }); return c; };
  const inW = (d, a, b) => d >= a && d <= b;
  // dati per giorno
  const day = {};
  const D = (d) => day[d] || (day[d] = { lessons: 0, pt: 0, subs: 0, ptRev: 0, subsN: 0 });
  (bk.data || []).forEach((x) => { if (sById[x.schedule_id] && !cancelled.has(x.schedule_id + "|" + x.session_date)) D(x.session_date).lessons++; });
  (pt.data || []).forEach((x) => { const d = D(x.session_date); d.pt++; d.ptRev += ptPrice; });
  plans.forEach((p) => { if (p.starts_on && p.starts_on <= today) { const d = D(p.starts_on); d.subs += Number(p.price_paid) || 0; d.subsN++; } });
  const sum = (a, b, k) => { let t = 0; for (let d = a; d <= b; d = addDays(d, 1)) if (day[d]) t += day[d][k]; return t; };
  const capSum = (a, b) => { let t = 0; for (let d = a; d <= b; d = addDays(d, 1)) t += capByDay(d); return t; };
  const win = (a, b) => {
    const lessons = sum(a, b, "lessons"), ptn = sum(a, b, "pt"), subs = sum(a, b, "subs"), subsN = sum(a, b, "subsN"), cap = capSum(a, b);
    return { lessons, ptn, subs, subsN, ptRev: ptn * ptPrice, revenue: subs + ptn * ptPrice, bookings: lessons + ptn, fill: cap ? Math.round(lessons / cap * 100) : 0, cap };
  };
  const cur = win(from, today), prev = win(prevFrom, prevTo);
  // iscritti: prima iscrizione, rinnovi, nuovi
  const firstPlan = {}; plans.forEach((p) => { if (!firstPlan[p.member_id] || p.starts_on < firstPlan[p.member_id]) firstPlan[p.member_id] = p.starts_on; });
  const isNew = (p) => firstPlan[p.member_id] === p.starts_on;
  const newIn = (a, b) => plans.filter((p) => inW(p.starts_on, a, b) && isNew(p)).length;
  const renIn = (a, b) => plans.filter((p) => inW(p.starts_on, a, b) && !isNew(p)).length;
  // serie
  const series = buckets.map((bu) => {
    const w = win(bu.from, bu.to), d = parse(bu.from);
    return { from: bu.from, to: bu.to, subs: w.subs, pt: w.ptRev, subsN: w.subsN, ptN: w.ptn, lessons: w.lessons, fill: w.fill, news: newIn(bu.from, bu.to), ren: renIn(bu.from, bu.to), label: d };
  });
  // corsi
  const byCourse = {};
  scheds.forEach((s) => {
    const c = byCourse[s.gym_courses.name] || (byCourse[s.gym_courses.name] = { name: s.gym_courses.name, category: s.gym_courses.category, booked: 0, seats: 0, sessions: 0 });
    for (let d = from; d <= today; d = addDays(d, 1)) if (weekdayOf(d) === s.weekday && !cancelled.has(s.id + "|" + d)) { c.seats += capOf(s); c.sessions++; }
  });
  (bk.data || []).forEach((x) => { const s = sById[x.schedule_id]; if (s && inW(x.session_date, from, today) && !cancelled.has(x.schedule_id + "|" + x.session_date)) byCourse[s.gym_courses.name].booked++; });
  const courses = Object.values(byCourse).filter((c) => c.seats > 0).map((c) => ({ name: c.name, category: c.category, booked: c.booked, seats: c.seats, sessions: c.sessions, pct: Math.min(100, Math.round(c.booked / c.seats * 100)) })).sort((a, b) => b.pct - a.pct);
  // giorni della settimana
  const wk = [1, 2, 3, 4, 5, 6, 7].map((w) => { let l = 0, c = 0, n = 0; for (let d = from; d <= today; d = addDays(d, 1)) if (weekdayOf(d) === w) { const cc = capByDay(d); if (cc) { n++; c += cc; l += (day[d] ? day[d].lessons : 0); } } return { wd: w, pct: c ? Math.round(l / c * 100) : null, booked: l, cap: c, days: n }; });
  // fasce orarie (lezioni + personal), giorno x ora
  const heat = {}; let heatMax = 0;
  const bump = (wdv, h) => { const k = wdv + "|" + h; heat[k] = (heat[k] || 0) + 1; if (heat[k] > heatMax) heatMax = heat[k]; };
  (bk.data || []).forEach((x) => { const s = sById[x.schedule_id]; if (s && inW(x.session_date, from, today) && !cancelled.has(x.schedule_id + "|" + x.session_date)) bump(weekdayOf(x.session_date), Number(hm(s.starts_at_time).slice(0, 2))); });
  (pt.data || []).forEach((x) => { if (inW(x.session_date, from, today)) bump(weekdayOf(x.session_date), Number(hm(x.start_time).slice(0, 2))); });
  const hours = Array.from(new Set(Object.keys(heat).map((k) => Number(k.split("|")[1])))).sort((a, b) => a - b);
  const heatRows = hours.map((h) => ({ h, v: [1, 2, 3, 4, 5, 6].map((w) => heat[w + "|" + h] || 0) }));
  // crescita iscritti (attivi a fine mese, ultimi 12 mesi)
  const growth = []; 
  for (let i = 11; i >= 0; i--) {
    const end = i === 0 ? today : monthEnd(today, -i); const d = parse(monthStart(today, -i));
    const act = new Set(); plans.forEach((p) => { if (p.starts_on <= end && (p.kind === "time" ? (p.ends_on || "9999") >= end : (p.entries_left > 0 || p.ends_on >= end))) act.add(p.member_id); });
    growth.push({ date: end, label: d, active: act.size });
  }
  // stato attuale
  const by = {}; plans.forEach((p) => { (by[p.member_id] = by[p.member_id] || []).push(p); });
  const status = { ok: 0, warn: 0, bad: 0, none: 0 };
  members.forEach((m) => { const st = memberStatus(by[m.id] || [], today, conf.expiry_days).s; status[st] = (status[st] || 0) + 1; });
  // più assidui nel periodo
  const cnt = {}; (bk.data || []).forEach((x) => { if (inW(x.session_date, from, today)) cnt[x.member_id] = (cnt[x.member_id] || 0) + 1; });
  (pt.data || []).forEach((x) => { if (inW(x.session_date, from, today)) cnt[x.member_id] = (cnt[x.member_id] || 0) + 1; });
  const top = Object.keys(cnt).map((id) => ({ name: nameOf[id] || "—", n: cnt[id] })).sort((a, b) => b.n - a.n).slice(0, 5);
  // assenze
  let past = 0, ns = 0;
  (bk.data || []).concat(pt.data || []).forEach((x) => { if (inW(x.session_date, from, addDays(today, -1))) { past++; if (x.no_show) ns++; } });
  return {
    period, today, from, pt_price: ptPrice,
    cur, prev, series, courses, weekday: wk, heat: { hours: heatRows, max: heatMax },
    growth, status, top, members: members.length,
    news: { cur: newIn(from, today), prev: newIn(prevFrom, prevTo) }, renewals: { cur: renIn(from, today), prev: renIn(prevFrom, prevTo) },
    noshow: { n: ns, of: past, pct: past ? Math.round(ns / past * 1000) / 10 : 0 },
  };
}
function parse(d) { return d; }

// ================= pagina e dati del titolare =================
async function handleOwner(req, res, q) {
  const biz = await bizByToken(String(q.t || "").trim());
  if (!biz) return res.status(404).json({ error: "Link non valido" });
  const tz = biz.timezone || "Europe/Rome", today = todayStr(tz);
  const conf = cfg(biz);

  if (req.method === "GET" && q.data === "1") {
    const [pl, mb, mp, co, sc] = await Promise.all([
      sb("GET", "gym_plans?business_id=eq." + biz.id + "&active=eq.true&order=created_at.asc&select=id,name,kind,days,entries,price_eur,covers,max_entries,max_per_week"),
      sb("GET", "gym_members?business_id=eq." + biz.id + "&active=eq.true&order=last_name.asc,first_name.asc&select=id,first_name,last_name,phone,notes,created_at"),
      sb("GET", "gym_member_plans?business_id=eq." + biz.id + "&cancelled=eq.false&select=id,member_id,plan_id,plan_name,kind,covers,starts_on,ends_on,entries_total,entries_left,price_paid,cancelled,created_at,max_entries,max_per_week&order=starts_on.desc"),
      sb("GET", "gym_courses?business_id=eq." + biz.id + "&active=eq.true&order=name.asc&select=id,name,category,description,duration_min,capacity"),
      sb("GET", "gym_schedule?business_id=eq." + biz.id + "&active=eq.true&order=weekday.asc,starts_at_time.asc&select=id,course_id,weekday,starts_at_time,capacity"),
    ]);
    if (![pl, mb, mp, co, sc].every((x) => x.ok)) return res.status(502).json({ error: "Errore lettura dati" });
    const byMember = {}; (mp.data || []).forEach((p) => { (byMember[p.member_id] = byMember[p.member_id] || []).push(p); });
    // ingressi usati (lezioni + Personal) nell'abbonamento in corso e in questa settimana
    const mon = addDays(today, 1 - weekdayOf(today)), sun = addDays(mon, 6), since = addDays(today, -62);
    const [ub, up] = await Promise.all([
      sbAll("gym_bookings?business_id=eq." + biz.id + "&status=eq.confirmed&session_date=gte." + since + "&select=id,member_id,session_date"),
      sbAll("gym_pt_bookings?business_id=eq." + biz.id + "&status=eq.confirmed&session_date=gte." + since + "&select=id,member_id,session_date"),
    ]);
    const used = {}; ub.data.concat(up.data).forEach((x) => { (used[x.member_id] = used[x.member_id] || []).push(x.session_date); });
    const members = (mb.data || []).map((m) => {
      const plans = byMember[m.id] || [];
      const cur = plans.filter((p) => planValidOn(p, today))[0] || plans[0] || null;
      const ds = used[m.id] || [];
      const usage = { period: cur ? ds.filter((d) => d >= cur.starts_on && (!cur.ends_on || d <= cur.ends_on)).length : 0, week: ds.filter((d) => d >= mon && d <= sun).length, max_period: cur && cur.max_entries ? cur.max_entries : null, max_week: cur && cur.max_per_week ? cur.max_per_week : null };
      return { usage, id: m.id, first_name: m.first_name, last_name: m.last_name, phone: m.phone, notes: m.notes || "", status: memberStatus(plans, today, conf.expiry_days), created_at: m.created_at, plans: plans.map((p) => Object.assign({}, p, { line: planLine(p), valid: planValidOn(p, today) })) };
    });
    const cl = await sb("GET", "gym_cancelled_sessions?business_id=eq." + biz.id + "&session_date=gte." + today + "&order=session_date.asc&select=schedule_id,session_date,reason");
    const closures = {}; ((cl.ok && cl.data) || []).forEach((c) => { const x = closures[c.session_date] || (closures[c.session_date] = { date: c.session_date, reason: c.reason || "", count: 0 }); x.count++; if (c.reason && !x.reason) x.reason = c.reason; });
    const cats = Array.from(new Set(DEFAULT_CATEGORIES.concat((co.data || []).map((c) => c.category))));
    return res.status(200).json({
      business: { name: biz.name, slug: biz.slug, public_link: "/api/palestra?b=" + biz.slug },
      today, settings: conf, plans: pl.data, members, courses: co.data, schedule: (sc.data || []).map((s) => Object.assign({}, s, { time: hm(s.starts_at_time) })), categories: cats, plan_categories: cats.concat(['personal']), closures: Object.values(closures),
    });
  }
  // Calendario: lezioni + Personal per un intervallo (giorno / settimana / mese). Il mese porta solo i conteggi.
  if (req.method === "GET" && q.cal === "1") {
    const from = String(q.from || ""), to = String(q.to || "");
    if (!isDate(from) || !isDate(to) || to < from || addDays(from, 45) < to) return res.status(400).json({ error: "Date non valide" });
    const light = q.light === "1";
    const data = await loadRange(biz, from, to, light);
    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const ss = sessionsOf(biz, data, d);
      const pt = ptSlotsOf(biz, conf, data, d);
      days.push({
        date: d, closed: !ss.length,
        sessions: ss.map((x) => light ? { schedule_id: x.schedule_id, time: x.time, duration_min: x.duration_min, course: x.course, capacity: x.capacity, taken: x.taken, cancelled: x.cancelled, started: x.started } : ownerSession(x)),
        pt: light ? { total: pt.length, booked: pt.filter((x) => x._bk).length } : pt.map(ownerPt),
      });
    }
    return res.status(200).json({ from, to, days, today });
  }
  // Scheda iscritto: ingressi usati, prossime prenotazioni e storico
  if (req.method === "GET" && q.member) {
    const mid = /^[0-9a-f-]{36}$/.test(String(q.member)) ? String(q.member) : null;
    if (!mid) return res.status(400).json({ error: "Richiesta non valida" });
    const since = addDays(today, -90);
    const [bk, pk, plans] = await Promise.all([
      sbAll("gym_bookings?business_id=eq." + biz.id + "&member_id=eq." + mid + "&session_date=gte." + since + "&select=id,session_date,starts_at,status,no_show,gym_schedule(starts_at_time,gym_courses(name,category))"),
      sbAll("gym_pt_bookings?business_id=eq." + biz.id + "&member_id=eq." + mid + "&session_date=gte." + since + "&select=id,session_date,start_time,starts_at,status,no_show"),
      memberPlans(mid),
    ]);
    const items = bk.data.map((x) => ({ id: x.id, kind: "class", date: x.session_date, time: hm(x.gym_schedule && x.gym_schedule.starts_at_time), name: (x.gym_schedule && x.gym_schedule.gym_courses && x.gym_schedule.gym_courses.name) || "Lezione", category: x.gym_schedule && x.gym_schedule.gym_courses ? x.gym_schedule.gym_courses.category : "", status: x.status, no_show: !!x.no_show, starts_at: x.starts_at }))
      .concat(pk.data.map((x) => ({ id: x.id, kind: "pt", date: x.session_date, time: hm(x.start_time), name: "Personal 1:1", category: "personal", status: x.status, no_show: !!x.no_show, starts_at: x.starts_at })))
      .filter((x) => x.status === "confirmed").sort((a, b) => (a.starts_at < b.starts_at ? -1 : 1));
    const nowIso = new Date().toISOString();
    const cur = plans.filter((p) => !p.cancelled && planValidOn(p, today))[0] || plans.filter((p) => !p.cancelled)[0] || null;
    const dates = items.map((x) => x.date);
    const mon = addDays(today, 1 - weekdayOf(today)), sun = addDays(mon, 6);
    const usage = {
      week: dates.filter((d) => d >= mon && d <= sun).length,
      period: cur ? dates.filter((d) => d >= cur.starts_on && (!cur.ends_on || d <= cur.ends_on)).length : 0,
      max_week: cur ? cur.max_per_week || null : null, max_period: cur ? cur.max_entries || null : null,
    };
    return res.status(200).json({ upcoming: items.filter((x) => x.starts_at > nowIso), past: items.filter((x) => x.starts_at <= nowIso).reverse().slice(0, 40), usage });
  }
  if (req.method === "GET" && q.day) {
    const date = String(q.day);
    if (!isDate(date)) return res.status(400).json({ error: "Data non valida" });
    const sessions = await daySessions(biz, date);
    return res.status(200).json({ date, sessions: sessions.map(ownerSession) });
  }
  if (req.method === "GET" && q.week) {
    const from = String(q.week);
    if (!isDate(from)) return res.status(400).json({ error: "Data non valida" });
    const to = addDays(from, 6);
    const data = await loadRange(biz, from, to);
    const days = [];
    for (let i = 0; i < 7; i++) { const d = addDays(from, i); days.push({ date: d, sessions: sessionsOf(biz, data, d).map(ownerSession) }); }
    return res.status(200).json({ from, days });
  }
  if (req.method === "GET" && q.stats === "1") return res.status(200).json(await statsFor(biz, conf, String(q.period || "month")));
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });

  const b = req.body || {};
  const a = String(b.action || "");
  const uuid = (v) => (/^[0-9a-f-]{36}$/.test(String(v || "")) ? String(v) : null);
  const bad = (m) => res.status(400).json({ error: m });
  const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
  const ok = () => res.status(200).json({ ok: true });

  if (a === "plan_save") {
    const name = clean(b.name, 60); if (!name) return bad("Scrivi il nome dell'abbonamento.");
    const kind = b.kind === "entries" ? "entries" : "time";
    const covers = (Array.isArray(b.covers) ? b.covers : []).map((c) => clean(c, 30).toLowerCase()).filter(Boolean);
    if (!covers.length) return bad("Scegli almeno un tipo di corso incluso.");
    const row = { name, kind, covers, price_eur: b.price_eur === "" || b.price_eur == null ? null : num(b.price_eur, 0, 100000) };
    if (kind === "time") { row.days = num(b.days, 1, 3660); row.entries = null; if (!row.days) return bad("Indica la durata in giorni."); }
    else { row.entries = num(b.entries, 1, 1000); row.days = null; if (!row.entries) return bad("Indica quanti ingressi."); }
    const lim = (v, max) => (v === "" || v == null ? null : (num(v, 1, max) == null ? undefined : Math.round(num(v, 1, max))));
    row.max_entries = lim(b.max_entries, 1000); row.max_per_week = lim(b.max_per_week, 50);
    if (row.max_entries === undefined || row.max_per_week === undefined) return bad("Limite non valido.");
    const id = uuid(b.id);
    const r = id ? await sb("PATCH", "gym_plans?id=eq." + id + "&business_id=eq." + biz.id, row, "return=minimal") : await sb("POST", "gym_plans", Object.assign({ business_id: biz.id }, row), "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Salvataggio non riuscito" });
  }
  if (a === "plan_delete") {
    const id = uuid(b.id); if (!id) return bad("Richiesta non valida");
    const r = await sb("PATCH", "gym_plans?id=eq." + id + "&business_id=eq." + biz.id, { active: false }, "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Operazione non riuscita" });
  }
  if (a === "member_save") {
    const first = clean(b.first_name, 60), last = clean(b.last_name, 60), phone = clean(b.phone, 30);
    if (!first || !last) return bad("Scrivi nome e cognome.");
    const key = phoneKey(phone); if (key.length < 8) return bad("Scrivi un numero di telefono valido.");
    const row = { first_name: first, last_name: last, phone, phone_key: key, notes: clean(b.notes, 300) || null };
    const id = uuid(b.id);
    const r = id ? await sb("PATCH", "gym_members?id=eq." + id + "&business_id=eq." + biz.id, row, "return=representation") : await sb("POST", "gym_members", Object.assign({ business_id: biz.id }, row), "return=representation");
    if (!r.ok) return res.status(r.status === 409 ? 409 : 500).json({ error: r.status === 409 ? "Esiste già un iscritto con questo numero di telefono." : "Salvataggio non riuscito" });
    return res.status(200).json({ ok: true, id: Array.isArray(r.data) && r.data[0] ? r.data[0].id : id });
  }
  if (a === "member_delete") {
    const id = uuid(b.id); if (!id) return bad("Richiesta non valida");
    const now = new Date().toISOString();
    const bk = await sb("GET", "gym_bookings?member_id=eq." + id + "&business_id=eq." + biz.id + "&status=eq.confirmed&starts_at=gt." + enc(now) + "&select=id");
    for (const x of (bk.ok && Array.isArray(bk.data) ? bk.data : [])) { try { await rpc("gym_cancel", { p_business: biz.id, p_member: id, p_booking: x.id, p_cutoff_min: 0, p_by_owner: true }); } catch (e) { /* si continua */ } }
    const pt = await sb("GET", "gym_pt_bookings?member_id=eq." + id + "&business_id=eq." + biz.id + "&status=eq.confirmed&starts_at=gt." + enc(now) + "&select=id");
    for (const x of (pt.ok && Array.isArray(pt.data) ? pt.data : [])) { try { await rpc("gym_pt_cancel", { p_business: biz.id, p_member: id, p_booking: x.id, p_cutoff_min: 0, p_by_owner: true }); } catch (e) { /* si continua */ } }
    const r = await sb("PATCH", "gym_members?id=eq." + id + "&business_id=eq." + biz.id, { active: false, phone_key: "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }, "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Operazione non riuscita" });
  }
  if (a === "member_plan_add") {
    const mid = uuid(b.member_id), pid = uuid(b.plan_id); if (!mid || !pid) return bad("Richiesta non valida");
    const starts = isDate(b.starts_on) ? String(b.starts_on) : today;
    const [pr, mr] = await Promise.all([sb("GET", "gym_plans?id=eq." + pid + "&business_id=eq." + biz.id + "&select=*"), sb("GET", "gym_members?id=eq." + mid + "&business_id=eq." + biz.id + "&select=id")]);
    if (!pr.ok || !pr.data || !pr.data.length || !mr.ok || !mr.data || !mr.data.length) return bad("Dati non trovati");
    const p = pr.data[0];
    const row = { business_id: biz.id, member_id: mid, plan_id: p.id, plan_name: p.name, kind: p.kind, covers: p.covers, starts_on: starts, price_paid: b.price_paid === "" || b.price_paid == null ? p.price_eur : num(b.price_paid, 0, 100000), max_entries: p.max_entries || null, max_per_week: p.max_per_week || null };
    if (p.kind === "time") row.ends_on = isDate(b.ends_on) && b.ends_on >= starts ? String(b.ends_on) : addDays(starts, p.days - 1);
    else { row.entries_total = p.entries; row.entries_left = p.entries; row.ends_on = null; }
    const r = await sb("POST", "gym_member_plans", row, "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Salvataggio non riuscito" });
  }
  if (a === "member_plan_update") {
    const id = uuid(b.id); if (!id) return bad("Richiesta non valida");
    const upd = {};
    if (b.ends_on != null) { if (!isDate(b.ends_on)) return bad("Data non valida"); upd.ends_on = String(b.ends_on); }
    if (b.entries_left != null) { const n = num(b.entries_left, 0, 1000); if (n == null) return bad("Numero non valido"); upd.entries_left = n; }
    if (b.cancelled === true) upd.cancelled = true;
    if (!Object.keys(upd).length) return bad("Niente da cambiare");
    const r = await sb("PATCH", "gym_member_plans?id=eq." + id + "&business_id=eq." + biz.id, upd, "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Operazione non riuscita" });
  }
  if (a === "course_save") {
    const name = clean(b.name, 60); if (!name) return bad("Scrivi il nome del corso.");
    const category = clean(b.category, 30).toLowerCase() || "corsi";
    const dur = num(b.duration_min, 10, 240), cap = num(b.capacity, 1, 200);
    if (!dur || !cap) return bad("Durata e posti non validi.");
    const row = { name, category, description: clean(b.description, 200) || null, duration_min: Math.round(dur), capacity: Math.round(cap) };
    const id = uuid(b.id);
    const r = id ? await sb("PATCH", "gym_courses?id=eq." + id + "&business_id=eq." + biz.id, row, "return=minimal") : await sb("POST", "gym_courses", Object.assign({ business_id: biz.id }, row), "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Salvataggio non riuscito" });
  }
  if (a === "course_delete") {
    const id = uuid(b.id); if (!id) return bad("Richiesta non valida");
    await sb("PATCH", "gym_schedule?course_id=eq." + id + "&business_id=eq." + biz.id, { active: false }, "return=minimal");
    const r = await sb("PATCH", "gym_courses?id=eq." + id + "&business_id=eq." + biz.id, { active: false }, "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Operazione non riuscita" });
  }
  if (a === "schedule_add") {
    const cid = uuid(b.course_id), wd = num(b.weekday, 1, 7), t = /^\d{2}:\d{2}$/.test(String(b.time || "")) ? String(b.time) : null;
    if (!cid || !wd || !t) return bad("Scegli corso, giorno e ora.");
    const cap = b.capacity === "" || b.capacity == null ? null : num(b.capacity, 1, 200);
    const dup = await sb("GET", "gym_schedule?business_id=eq." + biz.id + "&course_id=eq." + cid + "&weekday=eq." + wd + "&starts_at_time=eq." + t + ":00&active=eq.true&select=id");
    if (dup.ok && dup.data && dup.data.length) return bad("Questa lezione c'è già.");
    const r = await sb("POST", "gym_schedule", { business_id: biz.id, course_id: cid, weekday: wd, starts_at_time: t, capacity: cap }, "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Salvataggio non riuscito" });
  }
  if (a === "schedule_delete") {
    const id = uuid(b.id); if (!id) return bad("Richiesta non valida");
    // le prenotazioni future su questa lezione vengono disdette (con rimborso dell'ingresso)
    const now = new Date().toISOString();
    const bk = await sb("GET", "gym_bookings?schedule_id=eq." + id + "&business_id=eq." + biz.id + "&status=eq.confirmed&starts_at=gt." + enc(now) + "&select=id,member_id");
    for (const x of (bk.ok && Array.isArray(bk.data) ? bk.data : [])) { try { await rpc("gym_cancel", { p_business: biz.id, p_member: x.member_id, p_booking: x.id, p_cutoff_min: 0, p_by_owner: true }); } catch (e) { /* si continua */ } }
    const r = await sb("PATCH", "gym_schedule?id=eq." + id + "&business_id=eq." + biz.id, { active: false }, "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Operazione non riuscita" });
  }
  if (a === "schedule_update") {
    // posti sempre modificabili; giorno e ora solo se non ci sono prenotazioni future (altrimenti gli orari già confermati non tornerebbero)
    const id = uuid(b.id); if (!id) return bad("Richiesta non valida");
    const cur = await sb("GET", "gym_schedule?id=eq." + id + "&business_id=eq." + biz.id + "&active=eq.true&select=id,course_id,weekday,starts_at_time,capacity");
    if (!cur.ok || !cur.data || !cur.data.length) return bad("Lezione non trovata.");
    const row = {};
    if (b.capacity !== undefined) { if (b.capacity === "" || b.capacity === null) row.capacity = null; else { const c = num(b.capacity, 1, 200); if (c == null) return bad("Posti non validi."); row.capacity = Math.round(c); } }
    const wd = b.weekday != null ? num(b.weekday, 1, 7) : cur.data[0].weekday;
    const t = b.time != null ? (/^\d{2}:\d{2}$/.test(String(b.time)) ? String(b.time) : null) : hm(cur.data[0].starts_at_time);
    if (!wd || !t) return bad("Giorno o ora non validi.");
    if (wd !== cur.data[0].weekday || t !== hm(cur.data[0].starts_at_time)) {
      const nowIso = new Date().toISOString();
      const fb = await sb("GET", "gym_bookings?schedule_id=eq." + id + "&business_id=eq." + biz.id + "&status=eq.confirmed&starts_at=gt." + enc(nowIso) + "&select=id&limit=1");
      if (fb.ok && fb.data && fb.data.length) return bad("Ci sono prenotazioni future su questa lezione: annulla prima la lezione, poi creane una nuova all'orario giusto.");
      const dup = await sb("GET", "gym_schedule?business_id=eq." + biz.id + "&course_id=eq." + cur.data[0].course_id + "&weekday=eq." + wd + "&starts_at_time=eq." + t + ":00&active=eq.true&id=neq." + id + "&select=id");
      if (dup.ok && dup.data && dup.data.length) return bad("Questa lezione c'è già.");
      row.weekday = wd; row.starts_at_time = t;
    }
    if (!Object.keys(row).length) return ok();
    const r = await sb("PATCH", "gym_schedule?id=eq." + id + "&business_id=eq." + biz.id, row, "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Salvataggio non riuscito" });
  }
  if (a === "session_cancel") {
    const id = uuid(b.schedule_id); if (!id || !isDate(b.date)) return bad("Richiesta non valida");
    const reason = clean(b.reason, 100) || null;
    const r = await sb("POST", "gym_cancelled_sessions?on_conflict=schedule_id,session_date", { schedule_id: id, session_date: b.date, business_id: biz.id, reason }, "resolution=merge-duplicates,return=minimal");
    if (!r.ok) return res.status(500).json({ error: "Operazione non riuscita" });
    const bk = await sb("GET", "gym_bookings?schedule_id=eq." + id + "&session_date=eq." + b.date + "&business_id=eq." + biz.id + "&status=eq.confirmed&select=id,member_id");
    for (const x of (bk.ok && Array.isArray(bk.data) ? bk.data : [])) { try { await rpc("gym_cancel", { p_business: biz.id, p_member: x.member_id, p_booking: x.id, p_cutoff_min: 0, p_by_owner: true }); } catch (e) { /* si continua */ } }
    return res.status(200).json({ ok: true, notified: (bk.data || []).length });
  }
  if (a === "session_restore") {
    const id = uuid(b.schedule_id); if (!id || !isDate(b.date)) return bad("Richiesta non valida");
    const r = await sb("DELETE", "gym_cancelled_sessions?schedule_id=eq." + id + "&session_date=eq." + b.date + "&business_id=eq." + biz.id);
    return r.ok ? ok() : res.status(500).json({ error: "Operazione non riuscita" });
  }
  if (a === "booking_cancel") {
    const id = uuid(b.booking_id); if (!id) return bad("Richiesta non valida");
    const r = await rpc("gym_cancel", { p_business: biz.id, p_member: uuid(b.member_id) || "00000000-0000-0000-0000-000000000000", p_booking: id, p_cutoff_min: 0, p_by_owner: true });
    return r && r.ok ? res.status(200).json({ ok: true, refunded: !!r.refunded }) : res.status(409).json({ error: (r && r.message) || "Non riuscito" });
  }
  if (a === "booking_add") {
    const mid = uuid(b.member_id), sid = uuid(b.schedule_id); if (!mid || !sid || !isDate(b.date)) return bad("Richiesta non valida");
    const r = await rpc("gym_book", { p_business: biz.id, p_member: mid, p_schedule: sid, p_date: b.date });
    return r && r.ok ? ok() : res.status(409).json({ error: (r && r.message) || "Non riuscito" });
  }
  if (a === "closure_add") {
    if (!isDate(b.from) || !isDate(b.to) || b.to < b.from || b.from < today) return bad("Scegli le date: dal giorno di oggi in poi.");
    const reason = clean(b.reason, 100) || null;
    const sc = await sb("GET", "gym_schedule?business_id=eq." + biz.id + "&active=eq.true&select=id,weekday");
    if (!sc.ok) return res.status(500).json({ error: "Operazione non riuscita" });
    let removed = 0, lessons = 0;
    for (let d = String(b.from), n = 0; d <= String(b.to) && n < 90; d = addDays(d, 1), n++) {
      for (const s of (sc.data || []).filter((x) => x.weekday === weekdayOf(d))) {
        await sb("POST", "gym_cancelled_sessions?on_conflict=schedule_id,session_date", { schedule_id: s.id, session_date: d, business_id: biz.id, reason }, "resolution=merge-duplicates,return=minimal");
        lessons++;
        const bk = await sb("GET", "gym_bookings?schedule_id=eq." + s.id + "&session_date=eq." + d + "&business_id=eq." + biz.id + "&status=eq.confirmed&select=id,member_id");
        for (const x of (bk.ok && Array.isArray(bk.data) ? bk.data : [])) { try { await rpc("gym_cancel", { p_business: biz.id, p_member: x.member_id, p_booking: x.id, p_cutoff_min: 0, p_by_owner: true }); removed++; } catch (e) { /* si continua */ } }
      }
    }
    return res.status(200).json({ ok: true, lessons, removed });
  }
  if (a === "closure_delete") {
    if (!isDate(b.from) || !isDate(b.to)) return bad("Richiesta non valida");
    const r = await sb("DELETE", "gym_cancelled_sessions?business_id=eq." + biz.id + "&session_date=gte." + b.from + "&session_date=lte." + b.to);
    return r.ok ? ok() : res.status(500).json({ error: "Operazione non riuscita" });
  }
  if (a === "pt_book") {
    const mid = uuid(b.member_id); const t = String(b.time || "");
    if (!mid || !isDate(b.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return bad("Richiesta non valida");
    const r = await rpc("gym_pt_book", { p_business: biz.id, p_member: mid, p_date: b.date, p_time: t });
    return r && r.ok ? ok() : res.status(409).json({ error: (r && r.message) || "Non riuscito" });
  }
  if (a === "pt_cancel") {
    const id = uuid(b.booking_id); if (!id) return bad("Richiesta non valida");
    const r = await rpc("gym_pt_cancel", { p_business: biz.id, p_member: uuid(b.member_id) || "00000000-0000-0000-0000-000000000000", p_booking: id, p_cutoff_min: 0, p_by_owner: true });
    return r && r.ok ? ok() : res.status(409).json({ error: (r && r.message) || "Non riuscito" });
  }
  if (a === "booking_noshow") {
    const id = uuid(b.booking_id); if (!id) return bad("Richiesta non valida");
    const table = b.kind === "pt" ? "gym_pt_bookings" : "gym_bookings";
    const r = await sb("PATCH", table + "?id=eq." + id + "&business_id=eq." + biz.id, { no_show: b.value !== false }, "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Operazione non riuscita" });
  }
  if (a === "settings_save") {
    const g = Object.assign({}, (biz.booking_rules && biz.booking_rules.gym) || {});
    if (b.cutoff_hours != null) { const hours = num(b.cutoff_hours, 0, 72); if (hours == null) return bad("Valore non valido"); g.cutoff_min = Math.round(hours * 60); }
    if (b.expiry_days != null) { const d = num(b.expiry_days, 1, 30); if (d == null) return bad("Giorni non validi"); g.expiry_days = Math.round(d); }
    if (b.pt_hours != null) {
      const list = (Array.isArray(b.pt_hours) ? b.pt_hours : []).map(String);
      if (list.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) return bad("Orari non validi");
      g.pt_hours = Array.from(new Set(list)).sort();
    }
    const rules = Object.assign({}, biz.booking_rules && typeof biz.booking_rules === "object" ? biz.booking_rules : {}, { gym: g });
    const r = await sb("PATCH", "businesses?id=eq." + biz.id, { booking_rules: rules }, "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Salvataggio non riuscito" });
  }
  return bad("Richiesta non valida");
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Referrer-Policy", "no-referrer");
  const q = req.query || {};
  const wantsData = req.method === "POST" || q.data === "1" || q.info === "1" || q.stats === "1" || q.cal === "1" || !!q.member || !!q.day || !!q.week;
  if (!wantsData) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (q.t) { res.statusCode = 302; res.setHeader("Location", "/api/agenda?t=" + encodeURIComponent(String(q.t))); return res.end(); }
    return res.status(200).send(pages.BOOK);
  }
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return res.status(503).json({ error: "Configurazione mancante" });
    if (q.t) return await handleOwner(req, res, q);
    if (q.b) return await handlePublic(req, res, q);
    return res.status(400).json({ error: "Richiesta non valida" });
  } catch (e) {
    console.error("palestra:", e && e.message);
    return res.status(500).json({ error: "Errore temporaneo. Riprova tra poco." });
  }
};
// Le lezioni nel calendario di Lia: ogni lezione e' un "appuntamento" (nome corso + posti), cosi' la dashboard resta quella di sempre
module.exports.calendarAppointments = async function (biz, date, days) {
  const to = addDays(date, days - 1);
  const data = await loadRange(biz, date, to);
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(date, i);
    sessionsOf(biz, data, d).forEach((s) => {
      out.push({
        id: "gym:" + s.schedule_id + ":" + d,
        starts_at: s.starts_at,
        ends_at: new Date(new Date(s.starts_at).getTime() + (s.duration_min || 60) * 60000).toISOString(),
        customer_name: s.course.name + (s.cancelled ? " (annullata)" : " · " + s.taken + "/" + s.capacity),
        customer_phone: null, customer_address: null, notes: null,
        services: { name: s.course.category ? s.course.category.charAt(0).toUpperCase() + s.course.category.slice(1) : "Lezione" },
        resources: null,
      });
    });
  }
  return out;
};
// Abbonamenti in scadenza per la campanella: calcolati al momento, senza job. Un avviso per abbonamento.
module.exports.expiringEvents = async function (biz) {
  const g = (biz.booking_rules && biz.booking_rules.gym) || {};
  const e = Number(g.expiry_days);
  const days = Number.isInteger(e) && e >= 1 && e <= 30 ? e : DEFAULT_EXPIRY_DAYS;
  const today = todayStr(biz.timezone || "Europe/Rome"), limit = addDays(today, days);
  const [pr, mr] = await Promise.all([
    sbAll("gym_member_plans?business_id=eq." + biz.id + "&cancelled=eq.false&kind=eq.time&ends_on=gte." + today + "&ends_on=lte." + limit + "&select=id,member_id,ends_on,plan_name"),
    sbAll("gym_members?business_id=eq." + biz.id + "&active=eq.true&select=id,first_name,last_name,phone"),
  ]);
  if (!pr.ok || !mr.ok) return [];
  const byId = {}; mr.data.forEach((m) => { byId[m.id] = m; });
  // se l'iscritto ha già un altro abbonamento che copre oltre la scadenza (rinnovo), non serve avvisare
  const all = await sbAll("gym_member_plans?business_id=eq." + biz.id + "&cancelled=eq.false&ends_on=gt." + limit + "&select=member_id");
  const renewed = new Set((all.data || []).map((x) => x.member_id));
  return pr.data.filter((p) => byId[p.member_id] && !renewed.has(p.member_id)).map((p) => {
    const m = byId[p.member_id];
    const left = Math.round((Date.parse(p.ends_on) - Date.parse(today)) / 864e5);
    return {
      id: "sub:" + p.id, event_type: "sub_expiring", member_id: m.id, customer_name: m.first_name + " " + m.last_name, customer_phone: m.phone,
      service_name: p.plan_name, ends_on: p.ends_on, days_left: left,
      starts_at: startUtc(p.ends_on, "12:00", biz.timezone || "Europe/Rome").toISOString(),
      // l'avviso nasce quando l'abbonamento entra nella finestra di preavviso
      created_at: startUtc(addDays(p.ends_on, -days), "08:00", biz.timezone || "Europe/Rome").toISOString(),
    };
  }).sort((a, b) => (a.ends_on < b.ends_on ? -1 : 1));
};
module.exports._test = { eligibility, memberStatus, planValidOn, namesMatch, phoneKey, capsMessage, ptSlotsOf, statsFor };
