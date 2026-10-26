// lib/courts.js  (Prenolia: campi sportivi - calendario del circolo)
// Legge le prenotazioni dei campi per la dashboard del titolare e permette di annullarle o inserirne una a mano.
// Tabelle: courts, court_hours, court_bookings (vedi supabase/migrations/20261024_courts.sql).
// Le funzioni ricevono "sb" (il client del database di agenda.js) e l'attivita' "biz", cosi' non dipendono da altro.

const MAX_DAYS = 31;

function tzOffsetMs(utcMs, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
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
function todayIn(tz) { return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); }
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function localParts(iso, tz) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(iso));
  const g = (t) => p.find((x) => x.type === t).value;
  return { date: g("year") + "-" + g("month") + "-" + g("day"), time: g("hour") + ":" + g("minute") };
}
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(new Date(s + "T00:00:00Z"));
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || ""));
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ""));
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");

// Regole del circolo salvate in businesses.booking_rules.courts
function rulesOf(biz) {
  const r = (biz.booking_rules && biz.booking_rules.courts) || {};
  const lim = Number(r.member_daily_limit_min);
  return {
    sport: r.sport || "tennis",
    fit: r.fit === true,
    open_to: r.open_to === "members" ? "members" : "all",
    member_daily_limit_min: Number.isInteger(lim) && lim > 0 ? lim : null,
  };
}

async function loadCourts(sb, biz) {
  const r = await sb("GET", "courts?business_id=eq." + biz.id + "&active=eq.true&order=sort_order.asc,created_at.asc&select=id,name,sport,surface,indoor,slot_min,price_eur,court_hours(weekday,opens,closes)");
  if (!r.ok || !Array.isArray(r.data)) return { error: r.status === 404 ? "Le tabelle dei campi non esistono ancora." : "Errore nella lettura dei campi." };
  return {
    courts: r.data.map((c) => {
      const hours = {};
      (c.court_hours || []).forEach((h) => {
        const k = String(h.weekday);
        (hours[k] = hours[k] || []).push([String(h.opens).slice(0, 5), String(h.closes).slice(0, 5)]);
      });
      Object.keys(hours).forEach((k) => hours[k].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
      return { id: c.id, name: c.name, sport: c.sport, surface: c.surface || null, indoor: c.indoor === true, slot_min: c.slot_min, price_eur: c.price_eur == null ? null : Number(c.price_eur), hours };
    }),
  };
}


// ---------- chiusure straordinarie (tornei, manutenzione...) ----------
async function loadClosures(sb, biz, fromDate, toDate) {
  const r = await sb("GET", "court_closures?business_id=eq." + biz.id + "&ends_on=gte." + fromDate + "&starts_on=lte." + toDate + "&order=starts_on.asc&limit=500&select=id,court_id,starts_on,ends_on,from_time,to_time,reason");
  if (!r.ok || !Array.isArray(r.data)) return [];   // se la tabella non c'e' ancora, nessuna chiusura
  return r.data.map((c) => ({ id: c.id, court_id: c.court_id || null, starts_on: c.starts_on, ends_on: c.ends_on, from: c.from_time ? String(c.from_time).slice(0, 5) : null, to: c.to_time ? String(c.to_time).slice(0, 5) : null, reason: c.reason || null }));
}
// la chiusura che copre quel campo, giorno e fascia (in minuti dalla mezzanotte), oppure null
function closureHit(closures, courtId, date, s, e) {
  return (closures || []).find((c) => (!c.court_id || c.court_id === courtId) && date >= c.starts_on && date <= c.ends_on &&
    (c.from ? mins(c.from) : 0) < e && (c.to ? mins(c.to) : 1440) > s) || null;
}

const BOOKING_COLS = "id,court_id,starts_at,ends_at,status,first_name,last_name,phone,email,players,members,fit_declared,price_eur,channel,notes,created_at";

function shape(b, tz) {
  const s = localParts(b.starts_at, tz), e = localParts(b.ends_at, tz);
  return {
    id: b.id, court_id: b.court_id, date: s.date, start: s.time, end: e.time, starts_at: b.starts_at, ends_at: b.ends_at,
    first_name: b.first_name, last_name: b.last_name, phone: b.phone, email: b.email || null,
    players: b.players, members: b.members, fit_declared: b.fit_declared === true,
    price_eur: b.price_eur == null ? null : Number(b.price_eur), channel: b.channel, notes: b.notes || null, created_at: b.created_at,
  };
}

// GET: campi + prenotazioni confermate da "from" per "days" giorni
async function week(sb, biz, q) {
  const tz = biz.timezone || "Europe/Rome";
  const today = todayIn(tz);
  const from = isDate(q.from) ? String(q.from) : today;
  const days = Math.min(Math.max(parseInt(q.days, 10) || 7, 1), MAX_DAYS);
  const cs = await loadCourts(sb, biz);
  if (cs.error) return { status: 503, body: { error: cs.error } };
  const a = zonedTimeToUtc(from, "00:00", tz).toISOString();
  const b = zonedTimeToUtc(addDays(from, days), "00:00", tz).toISOString();
  const r = await sb("GET", "court_bookings?business_id=eq." + biz.id + "&status=eq.confirmed&starts_at=gte." + encodeURIComponent(a) + "&starts_at=lt." + encodeURIComponent(b) + "&order=starts_at.asc&limit=3000&select=" + BOOKING_COLS);
  if (!r.ok || !Array.isArray(r.data)) return { status: 503, body: { error: "Errore nella lettura delle prenotazioni." } };
  const closures = await loadClosures(sb, biz, from, addDays(from, days - 1));
  return { status: 200, body: { timezone: tz, today, from, days, club: Object.assign({ name: biz.name }, rulesOf(biz)), courts: cs.courts, closures, bookings: r.data.map((x) => shape(x, tz)) } };
}

// POST: annulla una prenotazione
async function cancel(sb, biz, body) {
  const id = String((body && body.id) || "");
  if (!isUuid(id)) return { status: 400, body: { error: "Prenotazione non valida." } };
  const r = await sb("PATCH", "court_bookings?id=eq." + id + "&business_id=eq." + biz.id + "&status=eq.confirmed", { status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_by: "titolare" }, "return=representation");
  if (!r.ok) return { status: 500, body: { error: "Non sono riuscito ad annullare la prenotazione." } };
  if (!Array.isArray(r.data) || !r.data.length) return { status: 404, body: { error: "Prenotazione non trovata o gia' annullata." } };
  return { status: 200, body: { ok: true } };
}

// POST: prenotazione inserita a mano dal titolare (telefono, di persona)
async function create(sb, biz, body) {
  const tz = biz.timezone || "Europe/Rome";
  body = body || {};
  const first = String(body.first_name || "").trim().slice(0, 60), last = String(body.last_name || "").trim().slice(0, 60);
  const phone = String(body.phone || "").trim().slice(0, 30);
  if (!first || !last) return { status: 400, body: { error: "Scrivi nome e cognome." } };
  if (!phone) return { status: 400, body: { error: "Scrivi il telefono." } };
  if (!isUuid(body.court_id)) return { status: 400, body: { error: "Scegli il campo." } };
  if (!isDate(body.date) || !isTime(body.time)) return { status: 400, body: { error: "Giorno o ora non validi." } };
  const hours = Number(body.hours || 1);
  if (!Number.isInteger(hours) || hours < 1 || hours > 4) return { status: 400, body: { error: "La durata deve essere da 1 a 4 slot." } };
  let players = body.players == null || body.players === "" ? null : Number(body.players);
  let members = body.members == null || body.members === "" ? null : Number(body.members);
  if (players !== null && (!Number.isInteger(players) || players < 1 || players > 22)) return { status: 400, body: { error: "Numero di giocatori non valido." } };
  if (members !== null && (!Number.isInteger(members) || members < 0 || (players !== null && members > players))) return { status: 400, body: { error: "I soci non possono essere piu' dei giocatori." } };

  const cs = await loadCourts(sb, biz);
  if (cs.error) return { status: 503, body: { error: cs.error } };
  const court = cs.courts.find((c) => c.id === body.court_id);
  if (!court) return { status: 404, body: { error: "Campo non trovato." } };
  const dayN = ((new Date(body.date + "T00:00:00Z").getUTCDay() + 6) % 7) + 1; // 1=lunedi ... 7=domenica
  const startM = mins(body.time), endM = startM + hours * court.slot_min;
  const within = (court.hours[String(dayN)] || []).some((h) => startM >= mins(h[0]) && endM <= mins(h[1]));
  if (!within) return { status: 400, body: { error: "Il campo e' chiuso in quell'orario." } };

  const hitC = closureHit(await loadClosures(sb, biz, body.date, body.date), court.id, body.date, startM, endM);
  if (hitC) return { status: 400, body: { error: "Il campo e' chiuso in quell'orario" + (hitC.reason ? " (" + hitC.reason + ")" : "") + "." } };
  const startsAt = zonedTimeToUtc(body.date, body.time, tz);
  const endsAt = new Date(startsAt.getTime() + hours * court.slot_min * 60000);
  const price = court.price_eur == null ? null : court.price_eur * hours;
  const row = {
    business_id: biz.id, court_id: court.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), status: "confirmed",
    first_name: first, last_name: last, phone, email: body.email ? String(body.email).trim().slice(0, 120) : null,
    players, members, fit_declared: false, price_eur: price, channel: "manual", notes: body.notes ? String(body.notes).trim().slice(0, 300) : null,
  };
  const r = await sb("POST", "court_bookings", row, "return=representation");
  if (!r.ok) {
    if (r.status === 409) return { status: 409, body: { error: "Il campo e' gia' occupato in quell'orario." } };
    return { status: 500, body: { error: "Non sono riuscito a salvare la prenotazione." } };
  }
  const saved = Array.isArray(r.data) ? r.data[0] : r.data;
  return { status: 200, body: { ok: true, booking: shape(saved, tz) } };
}


// ---------- pagina pubblica di prenotazione ----------
const { phoneProblem, emailProblem } = require("./validate.js");
function advanceDays(biz) { const v = Number(biz.max_advance_days); return Number.isFinite(v) && v >= 1 ? Math.min(Math.floor(v), 180) : 14; }
function leadMin(biz) { const v = Number(biz.min_notice_min); return Number.isFinite(v) && v >= 0 ? Math.min(v, 2880) : 60; }
const MAX_FUTURE_PER_PHONE = 5;

async function info(sb, biz) {
  const cs = await loadCourts(sb, biz);
  if (cs.error) return { status: 503, body: { error: cs.error } };
  const tz = biz.timezone || "Europe/Rome", today = todayIn(tz), adv = advanceDays(biz);
  return { status: 200, body: {
    name: biz.name, tagline: biz.public_tagline || "", address: biz.address || "", phone: biz.public_phone || "", timezone: tz,
    today, last_day: addDays(today, adv), club: rulesOf(biz),
    courts: cs.courts.map((c) => ({ id: c.id, name: c.name, surface: c.surface, indoor: c.indoor, slot_min: c.slot_min, price_eur: c.price_eur, hours: c.hours })),
  } };
}

// Orari liberi di un giorno, per campo. Non espone nessun dato di chi ha gia' prenotato.
async function freeDay(sb, biz, date) {
  const tz = biz.timezone || "Europe/Rome", today = todayIn(tz);
  if (!isDate(date)) return { status: 400, body: { error: "Giorno non valido." } };
  if (date < today || date > addDays(today, advanceDays(biz))) return { status: 200, body: { date, courts: [] } };
  const cs = await loadCourts(sb, biz);
  if (cs.error) return { status: 503, body: { error: cs.error } };
  const a = zonedTimeToUtc(date, "00:00", tz), b = zonedTimeToUtc(addDays(date, 1), "00:00", tz);
  const r = await sb("GET", "court_bookings?business_id=eq." + biz.id + "&status=eq.confirmed&starts_at=lt." + encodeURIComponent(b.toISOString()) + "&ends_at=gt." + encodeURIComponent(a.toISOString()) + "&limit=3000&select=court_id,starts_at,ends_at");
  if (!r.ok || !Array.isArray(r.data)) return { status: 503, body: { error: "Errore nella lettura delle prenotazioni." } };
  const closures = await loadClosures(sb, biz, date, date);
  const minStart = Date.now() + leadMin(biz) * 60000;
  const dayN = ((new Date(date + "T00:00:00Z").getUTCDay() + 6) % 7) + 1;
  return { status: 200, body: { date, courts: cs.courts.map((c) => {
    const taken = r.data.filter((x) => x.court_id === c.id).map((x) => [new Date(x.starts_at).getTime(), new Date(x.ends_at).getTime()]);
    const slots = [];
    (c.hours[String(dayN)] || []).forEach((h) => {
      for (let m = mins(h[0]); m + c.slot_min <= mins(h[1]); m += c.slot_min) {
        const s = zonedTimeToUtc(date, hhmm(m), tz).getTime(), e = s + c.slot_min * 60000;
        if (s < minStart) continue;
        if (taken.some((t) => t[0] < e && t[1] > s)) continue;
        if (closureHit(closures, c.id, date, m, m + c.slot_min)) continue;
        slots.push({ time: hhmm(m), end: hhmm(m + c.slot_min) });
      }
    });
    return { id: c.id, slots };
  }) } };
}

// Giorni del mese con almeno un orario libero per un campo (per il calendario della pagina pubblica).
async function freeMonth(sb, biz, courtId, ym) {
  const tz = biz.timezone || "Europe/Rome", today = todayIn(tz), last = addDays(today, advanceDays(biz));
  if (!/^\d{4}-\d{2}$/.test(String(ym || "")) || !isUuid(courtId)) return { status: 400, body: { error: "Richiesta non valida." } };
  const cs = await loadCourts(sb, biz);
  if (cs.error) return { status: 503, body: { error: cs.error } };
  const c = cs.courts.find((x) => x.id === courtId);
  if (!c) return { status: 404, body: { error: "Campo non trovato." } };
  const first = ym + "-01", nextMonth = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 1)).toISOString().slice(0, 10), lastDay = addDays(nextMonth, -1);
  const a = zonedTimeToUtc(first, "00:00", tz), b = zonedTimeToUtc(nextMonth, "00:00", tz);
  const r = await sb("GET", "court_bookings?business_id=eq." + biz.id + "&court_id=eq." + courtId + "&status=eq.confirmed&starts_at=lt." + encodeURIComponent(b.toISOString()) + "&ends_at=gt." + encodeURIComponent(a.toISOString()) + "&limit=3000&select=starts_at,ends_at");
  if (!r.ok || !Array.isArray(r.data)) return { status: 503, body: { error: "Errore nella lettura delle prenotazioni." } };
  const closures = await loadClosures(sb, biz, first, lastDay);
  const taken = r.data.map((x) => [new Date(x.starts_at).getTime(), new Date(x.ends_at).getTime()]);
  const minStart = Date.now() + leadMin(biz) * 60000;
  const free = [], open = [];
  for (let d = first; d <= lastDay; d = addDays(d, 1)) {
    if (d < today || d > last) continue;
    const dayN = ((new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7) + 1;
    let any = false, anyFree = false;
    (c.hours[String(dayN)] || []).forEach((h) => {
      for (let m = mins(h[0]); m + c.slot_min <= mins(h[1]); m += c.slot_min) {
        if (closureHit(closures, c.id, d, m, m + c.slot_min)) continue;
        any = true;
        const s = zonedTimeToUtc(d, hhmm(m), tz).getTime(), e = s + c.slot_min * 60000;
        if (s < minStart || taken.some((t) => t[0] < e && t[1] > s)) continue;
        anyFree = true;
      }
    });
    if (any) open.push(d);
    if (anyFree) free.push(d);
  }
  return { status: 200, body: { court_id: courtId, month: ym, free, open } };
}

// Prenotazione fatta dal cliente (pagina pubblica). Restituisce anche i dati per email e avviso al titolare.
async function book(sb, biz, body) {
  const tz = biz.timezone || "Europe/Rome", rules = rulesOf(biz);
  body = body || {};
  const first = String(body.first_name || "").trim().slice(0, 60), last = String(body.last_name || "").trim().slice(0, 60);
  if (!first || !last) return { status: 400, body: { error: "Scrivi nome e cognome." } };
  const pp = phoneProblem(body.phone); if (pp) return { status: 400, body: { error: pp } };
  const ep = emailProblem(body.email); if (ep) return { status: 400, body: { error: ep } };
  const phone = String(body.phone).trim().slice(0, 30), email = String(body.email || "").trim().toLowerCase().slice(0, 120);
  if (!isUuid(body.court_id)) return { status: 400, body: { error: "Scegli il campo." } };
  if (!isDate(body.date) || !isTime(body.time)) return { status: 400, body: { error: "Giorno o ora non validi." } };
  const players = Number(body.players), members = Number(body.members);
  if (!Number.isInteger(players) || players < 1 || players > 22) return { status: 400, body: { error: "Indica quanti giocatori siete." } };
  if (body.members === "" || body.members == null || !Number.isInteger(members) || members < 0 || members > players) return { status: 400, body: { error: "Indica quanti dei giocatori sono soci del circolo (da 0 a " + players + ")." } };
  if (rules.open_to === "members" && members < 1) return { status: 400, body: { error: "Questo circolo accetta prenotazioni solo se almeno un giocatore e' socio." } };
  if (rules.fit && body.cert_ok !== undefined && body.cert_ok !== true) return { status: 400, body: { error: "Per giocare serve il certificato medico valido: conferma con la spunta." } };
  if (rules.fit && body.fit_ok !== true) return { status: 400, body: { error: "Per giocare serve la tessera FIT: conferma con la spunta." } };

  const cs = await loadCourts(sb, biz);
  if (cs.error) return { status: 503, body: { error: cs.error } };
  const court = cs.courts.find((c) => c.id === body.court_id);
  if (!court) return { status: 404, body: { error: "Campo non trovato." } };
  const today = todayIn(tz);
  if (body.date < today || body.date > addDays(today, advanceDays(biz))) return { status: 400, body: { error: "Questo giorno non e' prenotabile." } };
  const dayN = ((new Date(body.date + "T00:00:00Z").getUTCDay() + 6) % 7) + 1;
  const startM = mins(body.time), endM = startM + court.slot_min;
  const onGrid = (court.hours[String(dayN)] || []).some((h) => startM >= mins(h[0]) && endM <= mins(h[1]) && (startM - mins(h[0])) % court.slot_min === 0);
  if (!onGrid) return { status: 400, body: { error: "Questo orario non e' disponibile." } };
  if (closureHit(await loadClosures(sb, biz, body.date, body.date), court.id, body.date, startM, endM)) return { status: 400, body: { error: "Questo orario non e' disponibile." } };
  const startsAt = zonedTimeToUtc(body.date, body.time, tz), endsAt = new Date(startsAt.getTime() + court.slot_min * 60000);
  if (startsAt.getTime() < Date.now() + leadMin(biz) * 60000) return { status: 400, body: { error: "Questo orario e' troppo vicino: scegline uno piu' avanti o chiama il circolo." } };

  const mine = await sb("GET", "court_bookings?business_id=eq." + biz.id + "&status=eq.confirmed&phone=eq." + encodeURIComponent(phone) + "&ends_at=gt." + encodeURIComponent(new Date().toISOString()) + "&select=starts_at,ends_at,members&limit=50");
  if (!mine.ok || !Array.isArray(mine.data)) return { status: 503, body: { error: "Errore nella lettura delle prenotazioni." } };
  if (mine.data.length >= MAX_FUTURE_PER_PHONE) return { status: 429, body: { error: "Hai gia' " + MAX_FUTURE_PER_PHONE + " prenotazioni in programma. Per altre chiama il circolo." } };
  if (rules.member_daily_limit_min && members >= 1) {
    const used = mine.data.filter((x) => x.members >= 1 && localParts(x.starts_at, tz).date === body.date).reduce((t, x) => t + (new Date(x.ends_at) - new Date(x.starts_at)) / 60000, 0);
    if (used + court.slot_min > rules.member_daily_limit_min) return { status: 409, body: { error: "I soci possono prenotare al massimo " + (rules.member_daily_limit_min >= 60 ? (rules.member_daily_limit_min / 60).toString().replace(".", ",") + (rules.member_daily_limit_min === 60 ? " ora" : " ore") : rules.member_daily_limit_min + " minuti") + " di campo al giorno e per questo giorno hai gia' una prenotazione." } };
  }
  const row = {
    business_id: biz.id, court_id: court.id, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), status: "confirmed",
    first_name: first, last_name: last, phone, email: email || null, players, members, fit_declared: rules.fit === true, price_eur: court.price_eur,
    channel: "web", notes: body.notes ? String(body.notes).trim().slice(0, 300) : null,
  };
  const r = await sb("POST", "court_bookings", row, "return=representation");
  if (!r.ok) {
    if (r.status === 409) return { status: 409, body: { error: "Questo orario e' appena stato preso. Scegline un altro." } };
    return { status: 500, body: { error: "Non sono riuscito a salvare la prenotazione. Riprova." } };
  }
  const saved = shape(Array.isArray(r.data) ? r.data[0] : r.data, tz);
  return { status: 200, body: { ok: true, booking: { court: court.name, date: saved.date, start: saved.start, end: saved.end, price_eur: court.price_eur, players, members } }, _mail: { court, saved, email, first, rules, startsAt, endsAt } };
}

// ---------- impostazioni del circolo (dashboard del titolare) ----------
const SPORTS = ["tennis", "padel", "calcio", "altro"];
const MAX_COURTS = 30;
const validHM = (t) => isTime(t);
function cleanHours(h) {
  const out = {};
  if (!h || typeof h !== "object") return out;
  for (let d = 1; d <= 7; d++) {
    const arr = Array.isArray(h[String(d)]) ? h[String(d)] : [];
    const rows = [];
    for (const x of arr.slice(0, 3)) {
      if (!Array.isArray(x) || !validHM(x[0]) || !validHM(x[1]) || mins(x[0]) >= mins(x[1])) return null;
      rows.push([x[0], x[1]]);
    }
    rows.sort((a, b) => mins(a[0]) - mins(b[0]));
    for (let i = 1; i < rows.length; i++) if (mins(rows[i][0]) < mins(rows[i - 1][1])) return null;
    out[String(d)] = rows;
  }
  return out;
}

async function settings(sb, biz) {
  const tz = biz.timezone || "Europe/Rome", today = todayIn(tz);
  const r = await sb("GET", "courts?business_id=eq." + biz.id + "&order=sort_order.asc,created_at.asc&select=id,name,sport,surface,indoor,slot_min,price_eur,active,court_hours(weekday,opens,closes)");
  if (!r.ok || !Array.isArray(r.data)) return { status: 503, body: { error: r.status === 404 ? "Le tabelle dei campi non esistono ancora." : "Errore nella lettura dei campi." } };
  const courts = r.data.map((c) => {
    const hours = {};
    (c.court_hours || []).forEach((h) => { (hours[String(h.weekday)] = hours[String(h.weekday)] || []).push([String(h.opens).slice(0, 5), String(h.closes).slice(0, 5)]); });
    Object.keys(hours).forEach((k) => hours[k].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
    return { id: c.id, name: c.name, sport: c.sport, surface: c.surface || "", indoor: c.indoor === true, slot_min: c.slot_min, price_eur: c.price_eur == null ? null : Number(c.price_eur), active: c.active !== false, hours };
  });
  const closures = await loadClosures(sb, biz, today, addDays(today, 730));
  // prenotazioni gia' fissate che cadono dentro una chiusura (per avvisare i clienti)
  let clash = {};
  if (closures.length) {
    const a = zonedTimeToUtc(today, "00:00", tz).toISOString(), b = zonedTimeToUtc(addDays(closures.reduce((m, c) => (c.ends_on > m ? c.ends_on : m), today), 1), "00:00", tz).toISOString();
    const bk = await sb("GET", "court_bookings?business_id=eq." + biz.id + "&status=eq.confirmed&starts_at=gte." + encodeURIComponent(a) + "&starts_at=lt." + encodeURIComponent(b) + "&limit=3000&select=court_id,starts_at,ends_at");
    if (bk.ok && Array.isArray(bk.data)) bk.data.forEach((x) => {
      const sp = localParts(x.starts_at, tz), ep = localParts(x.ends_at, tz);
      const hit = closureHit(closures, x.court_id, sp.date, mins(sp.time), sp.date === ep.date ? mins(ep.time) : 1440);
      if (hit) clash[hit.id] = (clash[hit.id] || 0) + 1;
    });
  }
  return { status: 200, body: { today, club: rulesOf(biz), courts, closures: closures.map((c) => Object.assign({}, c, { bookings: clash[c.id] || 0 })) } };
}

async function saveRules(sb, biz, body) {
  const cur = (biz.booking_rules && biz.booking_rules.courts) || {};
  const open_to = body.open_to === "members" ? "members" : "all";
  let lim = null;
  if (body.member_daily_limit_min !== null && body.member_daily_limit_min !== undefined && body.member_daily_limit_min !== "") {
    lim = Number(body.member_daily_limit_min);
    if (!Number.isInteger(lim) || lim < 30 || lim > 480) return { status: 400, body: { error: "Il limite giornaliero non e' valido." } };
  }
  const next = Object.assign({}, cur, { sport: SPORTS.includes(cur.sport) ? cur.sport : "tennis", fit: body.fit === true, open_to, member_daily_limit_min: lim });
  const rules = Object.assign({}, biz.booking_rules || {}, { courts: next });
  const r = await sb("PATCH", "businesses?id=eq." + biz.id, { booking_rules: rules }, "return=minimal");
  if (!r.ok) return { status: 500, body: { error: "Non sono riuscito a salvare le regole." } };
  biz.booking_rules = rules;
  return { status: 200, body: { ok: true } };
}

async function saveCourt(sb, biz, body) {
  const name = String(body.name || "").trim().slice(0, 60);
  if (!name) return { status: 400, body: { error: "Scrivi il nome del campo." } };
  const surface = String(body.surface || "").trim().slice(0, 40) || null;
  const slot = Number(body.slot_min);
  if (!Number.isInteger(slot) || slot < 30 || slot > 240 || slot % 15 !== 0) return { status: 400, body: { error: "La durata dello slot deve essere tra 30 e 240 minuti." } };
  let price = null;
  if (body.price_eur !== null && body.price_eur !== undefined && body.price_eur !== "") {
    price = Number(body.price_eur);
    if (!Number.isFinite(price) || price < 0 || price > 1000) return { status: 400, body: { error: "Il prezzo non e' valido." } };
    price = Math.round(price * 100) / 100;
  }
  const hours = cleanHours(body.hours);
  if (!hours) return { status: 400, body: { error: "Controlla gli orari: l'apertura deve essere prima della chiusura e le fasce non si devono sovrapporre." } };
  const rules = rulesOf(biz);
  const row = { name, surface, indoor: body.indoor === true, slot_min: slot, price_eur: price, active: body.active !== false };
  let id = body.id;
  if (id) {
    if (!isUuid(id)) return { status: 400, body: { error: "Campo non valido." } };
    const r = await sb("PATCH", "courts?id=eq." + id + "&business_id=eq." + biz.id, row, "return=representation");
    if (!r.ok) return { status: 500, body: { error: "Non sono riuscito a salvare il campo." } };
    if (!Array.isArray(r.data) || !r.data.length) return { status: 404, body: { error: "Campo non trovato." } };
  } else {
    const all = await sb("GET", "courts?business_id=eq." + biz.id + "&select=sort_order&order=sort_order.desc&limit=" + MAX_COURTS);
    if (!all.ok || !Array.isArray(all.data)) return { status: 503, body: { error: "Errore nella lettura dei campi." } };
    if (all.data.length >= MAX_COURTS) return { status: 400, body: { error: "Hai raggiunto il massimo di " + MAX_COURTS + " campi." } };
    const next = all.data.length ? (Number(all.data[0].sort_order) || 0) + 1 : 0;
    const r = await sb("POST", "courts", Object.assign({ business_id: biz.id, sport: SPORTS.includes(rules.sport) ? rules.sport : "tennis", sort_order: next }, row), "return=representation");
    if (!r.ok || !Array.isArray(r.data) || !r.data[0]) return { status: 500, body: { error: "Non sono riuscito a creare il campo." } };
    id = r.data[0].id;
  }
  const del = await sb("DELETE", "court_hours?court_id=eq." + id, null, "return=minimal");
  if (!del.ok) return { status: 500, body: { error: "Non sono riuscito a salvare gli orari." } };
  const rows = [];
  Object.keys(hours).forEach((d) => hours[d].forEach((h) => rows.push({ court_id: id, weekday: Number(d), opens: h[0], closes: h[1] })));
  if (rows.length) {
    const ins = await sb("POST", "court_hours", rows, "return=minimal");
    if (!ins.ok) return { status: 500, body: { error: "Non sono riuscito a salvare gli orari." } };
  }
  return { status: 200, body: { ok: true, id } };
}

async function addClosure(sb, biz, body) {
  const tz = biz.timezone || "Europe/Rome";
  if (!isDate(body.starts_on)) return { status: 400, body: { error: "Scegli il primo giorno della chiusura." } };
  const ends = isDate(body.ends_on) ? body.ends_on : body.starts_on;
  if (ends < body.starts_on) return { status: 400, body: { error: "L'ultimo giorno non puo' essere prima del primo." } };
  if (ends < todayIn(tz)) return { status: 400, body: { error: "La chiusura e' gia' passata." } };
  if (new Date(ends + "T00:00:00Z") - new Date(body.starts_on + "T00:00:00Z") > 400 * 86400000) return { status: 400, body: { error: "Il periodo e' troppo lungo." } };
  let from = null, to = null;
  if ((body.from || body.to)) {
    if (!isTime(body.from) || !isTime(body.to) || mins(body.from) >= mins(body.to)) return { status: 400, body: { error: "Controlla le ore: la fine deve essere dopo l'inizio, oppure lasciale vuote per chiudere tutto il giorno." } };
    from = body.from; to = body.to;
  }
  let court = null;
  if (body.court_id) {
    if (!isUuid(body.court_id)) return { status: 400, body: { error: "Campo non valido." } };
    const c = await sb("GET", "courts?id=eq." + body.court_id + "&business_id=eq." + biz.id + "&select=id&limit=1");
    if (!c.ok || !Array.isArray(c.data) || !c.data.length) return { status: 404, body: { error: "Campo non trovato." } };
    court = body.court_id;
  }
  const cnt = await sb("GET", "court_closures?business_id=eq." + biz.id + "&ends_on=gte." + todayIn(tz) + "&select=id&limit=201");
  if (cnt.ok && Array.isArray(cnt.data) && cnt.data.length > 200) return { status: 400, body: { error: "Hai troppe chiusure in programma: eliminane qualcuna." } };
  const r = await sb("POST", "court_closures", { business_id: biz.id, court_id: court, starts_on: body.starts_on, ends_on: ends, from_time: from, to_time: to, reason: String(body.reason || "").trim().slice(0, 120) || null }, "return=minimal");
  if (!r.ok) return { status: 500, body: { error: "Non sono riuscito a salvare la chiusura." } };
  return { status: 200, body: { ok: true } };
}

async function deleteClosure(sb, biz, body) {
  if (!isUuid(body.id)) return { status: 400, body: { error: "Chiusura non valida." } };
  const r = await sb("DELETE", "court_closures?id=eq." + body.id + "&business_id=eq." + biz.id, null, "return=minimal");
  if (!r.ok) return { status: 500, body: { error: "Non sono riuscito a eliminare la chiusura." } };
  return { status: 200, body: { ok: true } };
}

// Dopo una prenotazione riuscita: avviso al titolare e, se c'e' l'email, conferma al cliente. Non blocca mai. Restituisce true se l'email e' partita.
async function afterBook(biz, o) {
  const m = o && o._mail;
  if (!m) return false;
  try { await require("./push.js").notifyNewBooking(biz.id, { name: m.first + " " + m.saved.last_name, service: m.court.name, startsAt: m.saved.starts_at, timezone: biz.timezone }); } catch (e) { /* non blocca */ }
  if (!m.email) return false;
  try {
    const mail = require("./mail.js");
    const b = o.body.booking, sport = { tennis: "Tennis", padel: "Padel", calcio: "Calcio", altro: "" }[m.court.sport] || "";
    const extra = [["Giocatori", b.players + " (di cui " + b.members + (b.members === 1 ? " socio)" : " soci)")]];
    if (m.rules.fit) extra.push(["Da portare", "Tessera FIT e certificato medico di tutti i giocatori"]);
    extra.push(["Pagamento", "Al circolo" + (b.price_eur != null ? ", " + String(b.price_eur).replace(".", ",") + " €" : "")]);
    const em = mail.appointmentEmail({ kind: "confirm", bizName: biz.name, bizPhone: biz.public_phone || "", bizAddress: biz.address || "", customerName: m.first, service: m.court.name + (sport ? " · " + sport : ""), startsAt: m.startsAt.toISOString(), endsAt: m.endsAt.toISOString(), tz: biz.timezone, extraRows: extra, cancelLimitH: 0 });
    return await Promise.race([mail.sendMail(m.email, em.subject, em.html, em.text, biz.name), new Promise((ok) => setTimeout(() => ok(false), 4500))]);
  } catch (e) { console.error("Email di conferma non inviata:", e && e.message); return false; }
}

module.exports = { week, cancel, create, rulesOf, hhmm, info, freeDay, freeMonth, book, settings, saveRules, saveCourt, addClosure, deleteClosure, afterBook };
