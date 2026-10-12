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
const DEFAULT_CATEGORIES = ["corsi", "circuiti", "hyrox"];

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
function memberStatus(plans, today) {
  const live = plans.filter((p) => !p.cancelled);
  const valid = live.filter((p) => planValidOn(p, today));
  if (!live.length) return { s: "none", label: "Nessun abbonamento", detail: "Da inserire" };
  if (!valid.length) {
    const last = live.map((p) => p.ends_on).filter(Boolean).sort().pop();
    const noEntries = live.every((p) => p.kind === "entries" && (p.entries_left || 0) <= 0);
    return { s: "bad", label: "Scaduto", detail: noEntries ? "Ingressi finiti" : last ? "Scaduto il " + itDate(last) : "Non attivo" };
  }
  const soon = valid.filter((p) => p.kind === "time" && p.ends_on <= addDays(today, 7));
  const low = valid.filter((p) => p.kind === "entries" && (p.entries_left || 0) <= 2);
  const timeOk = valid.some((p) => p.kind === "time" && p.ends_on > addDays(today, 7));
  const best = valid.slice().sort((a, b) => (b.ends_on || "9999").localeCompare(a.ends_on || "9999"))[0];
  if (!timeOk && (soon.length || low.length)) return { s: "warn", label: "In scadenza", detail: soon.length ? "Scade il " + itDate(soon[0].ends_on) : (low[0].entries_left + (low[0].entries_left === 1 ? " ingresso rimasto" : " ingressi rimasti")) };
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
  return { cutoff_min: Number.isInteger(c) && c >= 0 && c <= 72 * 60 ? c : DEFAULT_CUTOFF_MIN, days_ahead: DAYS_AHEAD };
}

// Lezioni con posti occupati: si leggono programma, prenotazioni e annullamenti una volta sola per tutto l'intervallo
async function loadRange(biz, from, to) {
  const [sr, br, cr] = await Promise.all([
    sb("GET", "gym_schedule?business_id=eq." + biz.id + "&active=eq.true&select=id,weekday,starts_at_time,capacity,gym_courses(id,name,category,description,duration_min,capacity,active)&order=starts_at_time.asc"),
    sb("GET", "gym_bookings?business_id=eq." + biz.id + "&session_date=gte." + from + "&session_date=lte." + to + "&status=eq.confirmed&select=id,schedule_id,session_date,member_id,gym_members(first_name,last_name,phone)"),
    sb("GET", "gym_cancelled_sessions?business_id=eq." + biz.id + "&session_date=gte." + from + "&session_date=lte." + to + "&select=schedule_id,session_date,reason"),
  ]);
  if (!sr.ok || !br.ok || !cr.ok) throw new Error("Errore lettura programma");
  return { sched: sr.data || [], bookings: br.data || [], cancelled: cr.data || [] };
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
    attendees: s._bk.map((b) => ({ booking_id: b.id, member_id: b.member_id, name: b.gym_members ? b.gym_members.first_name + " " + b.gym_members.last_name : "?", phone: b.gym_members ? b.gym_members.phone : "" })),
  };
}

// Avvisi nella campanella (best effort: se non riesce, la prenotazione resta valida)
async function notify(bizId, type, memberName, courseName, startsAt) {
  try {
    await sb("POST", "notification_events", { business_id: bizId, event_type: type, customer_name: memberName, service_name: courseName, starts_at: startsAt, channel: "selfservice" }, "return=minimal");
  } catch (e) { /* si ignora */ }
}

async function memberPlans(memberId) {
  const r = await sb("GET", "gym_member_plans?member_id=eq." + memberId + "&order=starts_on.desc&select=id,plan_id,plan_name,kind,covers,starts_on,ends_on,entries_total,entries_left,price_paid,cancelled,created_at");
  return r.ok && Array.isArray(r.data) ? r.data : [];
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
  if (action === "day") {
    const date = String(body.date || "");
    const bad = window(date);
    if (bad) return res.status(400).json({ error: bad });
    const id = await identify(false);
    if (id.err) return res.status(401).json({ error: id.err });
    const sessions = await daySessions(biz, date);
    const plans = id.member ? await memberPlans(id.member.id) : null;
    const out = sessions.map((s) => {
      const mine = id.member ? s._bk.find((b) => b.member_id === id.member.id) : null;
      let can = null;
      if (id.member) {
        if (s.cancelled) can = { ok: false, message: s.cancel_reason ? "Lezione annullata: " + s.cancel_reason : "Lezione annullata." };
        else if (s.started) can = { ok: false, message: "La lezione è già iniziata." };
        else if (mine) can = { ok: false, code: "already", message: "" };
        else if (s.taken >= s.capacity) can = { ok: false, code: "full", message: "Lezione al completo." };
        else can = eligibility(plans, s.course.category, date);
      }
      return { schedule_id: s.schedule_id, time: s.time, duration_min: s.duration_min, course: s.course, capacity: s.capacity, taken: s.taken, cancelled: s.cancelled, started: s.started, mine: mine ? mine.id : null, can };
    });
    return res.status(200).json({ date, sessions: out, open: acc.allowed !== false });
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
  if (action === "cancel") {
    const id = await identify(true);
    if (id.err) return res.status(401).json({ error: id.err });
    const bid = String(body.booking_id || "");
    if (!/^[0-9a-f-]{36}$/.test(bid)) return res.status(400).json({ error: "Richiesta non valida" });
    let info = null;
    try { const ir = await sb("GET", "gym_bookings?id=eq." + bid + "&member_id=eq." + id.member.id + "&select=starts_at,gym_schedule(gym_courses(name))"); info = ir.ok && ir.data && ir.data[0] ? ir.data[0] : null; } catch (e) { info = null; }
    const r = await rpc("gym_cancel", { p_business: biz.id, p_member: id.member.id, p_booking: bid, p_cutoff_min: conf.cutoff_min, p_by_owner: false });
    if (!r || r.ok !== true) return res.status(409).json({ error: (r && r.message) || "Disdetta non riuscita.", code: r && r.code });
    if (info) await notify(biz.id, "cancelled", id.member.first_name + " " + id.member.last_name, info.gym_schedule && info.gym_schedule.gym_courses ? info.gym_schedule.gym_courses.name : "Lezione", info.starts_at);
    return res.status(200).json({ ok: true, refunded: !!r.refunded });
  }
  return res.status(400).json({ error: "Richiesta non valida" });
}

async function summary(biz, member, conf) {
  const tz = biz.timezone, today = todayStr(tz);
  const [plans, br] = await Promise.all([
    memberPlans(member.id),
    sb("GET", "gym_bookings?member_id=eq." + member.id + "&status=eq.confirmed&session_date=gte." + today + "&order=starts_at.asc&select=id,schedule_id,session_date,starts_at,gym_schedule(starts_at_time,gym_courses(name,category))"),
  ]);
  const st = memberStatus(plans, today);
  const now = Date.now();
  const bookings = (br.ok && Array.isArray(br.data) ? br.data : []).filter((b) => new Date(b.starts_at).getTime() > now).map((b) => ({
    id: b.id, date: b.session_date, time: hm(b.gym_schedule && b.gym_schedule.starts_at_time), name: (b.gym_schedule && b.gym_schedule.gym_courses && b.gym_schedule.gym_courses.name) || "Lezione",
    can_cancel: new Date(b.starts_at).getTime() - conf.cutoff_min * 60000 > now,
  }));
  return { member: { first_name: member.first_name, last_name: member.last_name }, status: st, plans: plans.filter((p) => !p.cancelled && (planValidOn(p, today) || p.ends_on >= addDays(today, -30))).map((p) => ({ line: planLine(p), covers: p.covers, valid: planValidOn(p, today) })), bookings, today };
}

// ================= statistiche =================
async function statsFor(biz) {
  const tz = biz.timezone || "Europe/Rome", today = todayStr(tz);
  const wd = weekdayOf(today), monday = addDays(today, 1 - wd), sunday = addDays(monday, 6);
  const monthFrom = today.slice(0, 8) + "01";
  const win = addDays(today, -28);
  const [mb, mp, wk, sold, hist, sc] = await Promise.all([
    sb("GET", "gym_members?business_id=eq." + biz.id + "&active=eq.true&select=id"),
    sb("GET", "gym_member_plans?business_id=eq." + biz.id + "&cancelled=eq.false&select=member_id,kind,covers,starts_on,ends_on,entries_left,cancelled,plan_name"),
    sb("GET", "gym_bookings?business_id=eq." + biz.id + "&status=eq.confirmed&session_date=gte." + monday + "&session_date=lte." + sunday + "&select=id"),
    sb("GET", "gym_member_plans?business_id=eq." + biz.id + "&cancelled=eq.false&created_at=gte." + enc(monthFrom + "T00:00:00Z") + "&select=price_paid"),
    sb("GET", "gym_bookings?business_id=eq." + biz.id + "&status=eq.confirmed&session_date=gte." + win + "&session_date=lt." + today + "&select=schedule_id"),
    sb("GET", "gym_schedule?business_id=eq." + biz.id + "&active=eq.true&select=id,weekday,capacity,gym_courses(name,capacity,active)"),
  ]);
  if (![mb, mp, wk, sold, hist, sc].every((x) => x.ok)) throw new Error("Errore statistiche");
  const by = {}; (mp.data || []).forEach((p) => { (by[p.member_id] = by[p.member_id] || []).push(p); });
  let active = 0, soon = 0, expired = 0;
  (mb.data || []).forEach((m) => { const st = memberStatus(by[m.id] || [], today).s; if (st === "ok") active++; else if (st === "warn") { active++; soon++; } else expired++; });
  const perSched = {}; (hist.data || []).forEach((b) => { perSched[b.schedule_id] = (perSched[b.schedule_id] || 0) + 1; });
  const occ = (weekday) => { let n = 0; for (let d = win; d < today; d = addDays(d, 1)) if (weekdayOf(d) === weekday) n++; return n; };
  const courses = {};
  (sc.data || []).filter((s) => s.gym_courses && s.gym_courses.active).forEach((s) => {
    const name = s.gym_courses.name, cap = s.capacity || s.gym_courses.capacity;
    const c = courses[name] || (courses[name] = { name, booked: 0, seats: 0 });
    c.booked += perSched[s.id] || 0; c.seats += occ(s.weekday) * cap;
  });
  const fill = Object.values(courses).filter((c) => c.seats > 0).map((c) => ({ name: c.name, pct: Math.min(100, Math.round(c.booked / c.seats * 100)) })).sort((a, b) => b.pct - a.pct);
  const revenue = (sold.data || []).reduce((t, r) => t + (Number(r.price_paid) || 0), 0);
  return { active, soon, expired, members: (mb.data || []).length, week_bookings: (wk.data || []).length, sold_month: (sold.data || []).length, revenue_month: Math.round(revenue * 100) / 100, fill };
}

// ================= pagina e dati del titolare =================
async function handleOwner(req, res, q) {
  const biz = await bizByToken(String(q.t || "").trim());
  if (!biz) return res.status(404).json({ error: "Link non valido" });
  const tz = biz.timezone || "Europe/Rome", today = todayStr(tz);
  const conf = cfg(biz);

  if (req.method === "GET" && q.data === "1") {
    const [pl, mb, mp, co, sc] = await Promise.all([
      sb("GET", "gym_plans?business_id=eq." + biz.id + "&active=eq.true&order=created_at.asc&select=id,name,kind,days,entries,price_eur,covers"),
      sb("GET", "gym_members?business_id=eq." + biz.id + "&active=eq.true&order=last_name.asc,first_name.asc&select=id,first_name,last_name,phone,notes,created_at"),
      sb("GET", "gym_member_plans?business_id=eq." + biz.id + "&cancelled=eq.false&select=id,member_id,plan_id,plan_name,kind,covers,starts_on,ends_on,entries_total,entries_left,price_paid,cancelled,created_at&order=starts_on.desc"),
      sb("GET", "gym_courses?business_id=eq." + biz.id + "&active=eq.true&order=name.asc&select=id,name,category,description,duration_min,capacity"),
      sb("GET", "gym_schedule?business_id=eq." + biz.id + "&active=eq.true&order=weekday.asc,starts_at_time.asc&select=id,course_id,weekday,starts_at_time,capacity"),
    ]);
    if (![pl, mb, mp, co, sc].every((x) => x.ok)) return res.status(502).json({ error: "Errore lettura dati" });
    const byMember = {}; (mp.data || []).forEach((p) => { (byMember[p.member_id] = byMember[p.member_id] || []).push(p); });
    const members = (mb.data || []).map((m) => {
      const plans = byMember[m.id] || [];
      return { id: m.id, first_name: m.first_name, last_name: m.last_name, phone: m.phone, notes: m.notes || "", status: memberStatus(plans, today), plans: plans.map((p) => Object.assign({}, p, { line: planLine(p), valid: planValidOn(p, today) })) };
    });
    const cl = await sb("GET", "gym_cancelled_sessions?business_id=eq." + biz.id + "&session_date=gte." + today + "&order=session_date.asc&select=schedule_id,session_date,reason");
    const closures = {}; ((cl.ok && cl.data) || []).forEach((c) => { const x = closures[c.session_date] || (closures[c.session_date] = { date: c.session_date, reason: c.reason || "", count: 0 }); x.count++; if (c.reason && !x.reason) x.reason = c.reason; });
    const cats = Array.from(new Set(DEFAULT_CATEGORIES.concat((co.data || []).map((c) => c.category))));
    return res.status(200).json({
      business: { name: biz.name, slug: biz.slug, public_link: "/api/palestra?b=" + biz.slug },
      today, settings: conf, plans: pl.data, members, courses: co.data, schedule: (sc.data || []).map((s) => Object.assign({}, s, { time: hm(s.starts_at_time) })), categories: cats, closures: Object.values(closures),
    });
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
  if (req.method === "GET" && q.stats === "1") return res.status(200).json(await statsFor(biz));
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
    const r = await sb("PATCH", "gym_members?id=eq." + id + "&business_id=eq." + biz.id, { active: false, phone_key: "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }, "return=minimal");
    return r.ok ? ok() : res.status(500).json({ error: "Operazione non riuscita" });
  }
  if (a === "member_plan_add") {
    const mid = uuid(b.member_id), pid = uuid(b.plan_id); if (!mid || !pid) return bad("Richiesta non valida");
    const starts = isDate(b.starts_on) ? String(b.starts_on) : today;
    const [pr, mr] = await Promise.all([sb("GET", "gym_plans?id=eq." + pid + "&business_id=eq." + biz.id + "&select=*"), sb("GET", "gym_members?id=eq." + mid + "&business_id=eq." + biz.id + "&select=id")]);
    if (!pr.ok || !pr.data || !pr.data.length || !mr.ok || !mr.data || !mr.data.length) return bad("Dati non trovati");
    const p = pr.data[0];
    const row = { business_id: biz.id, member_id: mid, plan_id: p.id, plan_name: p.name, kind: p.kind, covers: p.covers, starts_on: starts, price_paid: b.price_paid === "" || b.price_paid == null ? p.price_eur : num(b.price_paid, 0, 100000) };
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
  if (a === "settings_save") {
    const hours = num(b.cutoff_hours, 0, 72); if (hours == null) return bad("Valore non valido");
    const rules = Object.assign({}, biz.booking_rules && typeof biz.booking_rules === "object" ? biz.booking_rules : {}, { gym: Object.assign({}, (biz.booking_rules && biz.booking_rules.gym) || {}, { cutoff_min: Math.round(hours * 60) }) });
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
  const wantsData = req.method === "POST" || q.data === "1" || q.info === "1" || q.stats === "1" || !!q.day || !!q.week;
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
module.exports._test = { eligibility, memberStatus, planValidOn, namesMatch, phoneKey };
