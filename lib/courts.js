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
  return { status: 200, body: { timezone: tz, today, from, days, club: Object.assign({ name: biz.name }, rulesOf(biz)), courts: cs.courts, bookings: r.data.map((x) => shape(x, tz)) } };
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
        slots.push({ time: hhmm(m), end: hhmm(m + c.slot_min) });
      }
    });
    return { id: c.id, slots };
  }) } };
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
  if (rules.fit && body.fit_ok !== true) return { status: 400, body: { error: "Per giocare serve la tessera FIT e il certificato medico: conferma con la spunta." } };

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

module.exports = { week, cancel, create, rulesOf, hhmm, info, freeDay, book };
