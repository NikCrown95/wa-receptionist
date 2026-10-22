// lib/recap-data.js  (Prenolia: dati del pannello di Lia, l'icona accanto alla campanella)
//
// Il pannello di Lia mostra due cose, calcolate in un colpo solo da api/agenda.js con ?recap=1:
//  1. Il recap del mese: UNO solo, l'ultimo giorno del mese (resta anche il giorno 1 del mese dopo).
//     Pochi numeri: appuntamenti (e confronto col mese prima), incasso stimato dai prezzi dei servizi,
//     quota prenotata online dai clienti, clienti nuovi, servizio piu' richiesto.
//  2. Gli avvisi: chiusure e assenze (lunedi'), "come ti trovi" (una volta) e abbonamento in scadenza
//     (da 5 giorni prima).
// Il recap di mattina e di sera non c'e' piu'. Non scrive niente nel database.
// Per le palestre il pannello non esiste: le loro notifiche restano tutte sulla campanella.

const LIA_CHANNELS = ["whatsapp", "telegram", "web", "webchat"];
// Canali con cui prenota il cliente da solo: Lia (chat) e calendario online. "manuale" = inserito dal titolare, escluso.
const ONLINE_CHANNELS = LIA_CHANNELS.concat(["selfservice"]);
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const DAY_MS = 86400000;
const NOTICE_HOURS = 5; // un avviso gia' letto sparisce dopo 5 ore, uno non letto resta (vedi sotto)

function localYmd(date, tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
const { apptUnits } = require("./staff.js");
const promos = require("./promos.js");
function price(a) { return promos.unitPrice(a) * apptUnits(a); }
function money(n) { return Math.round(n * 100) / 100; }
function ymdMonth(ymd) { return ymd.slice(0, 7); }
function prevMonth(ym) {
  let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1;
  if (m < 1) { m = 12; y -= 1; }
  return y + "-" + String(m).padStart(2, "0");
}
function nextMonth(ym) {
  let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) + 1;
  if (m > 12) { m = 1; y += 1; }
  return y + "-" + String(m).padStart(2, "0");
}
function lastDayOf(ym) {
  // giorno 0 del mese dopo = ultimo giorno di questo mese
  return new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate();
}

// Quale mese raccontare oggi? L'ultimo giorno del mese: quello in corso. Il giorno 1: quello appena finito. Altrimenti nessuno.
function monthToShow(today) {
  const ym = ymdMonth(today), day = Number(today.slice(8, 10));
  if (day === lastDayOf(ym)) return { ym: ym, lastDay: day };
  if (day === 1) { const p = prevMonth(ym); return { ym: p, lastDay: lastDayOf(p) }; }
  return null;
}

// Legge tutte le righe, a pagine da 1000 (Supabase ne restituisce al massimo 1000 per richiesta).
async function getAll(sb, path, maxPages) {
  const out = [];
  for (let p = 0; p < (maxPages || 8); p++) {
    const r = await sb("GET", path + "&limit=1000&offset=" + p * 1000);
    if (!r.ok || !Array.isArray(r.data)) return out.length ? out : null;
    out.push.apply(out, r.data);
    if (r.data.length < 1000) break;
  }
  return out;
}

async function buildMonth(biz, d, today, tz) {
  const pick = monthToShow(today);
  if (!pick) return null;
  const sb = d.sb, enc = encodeURIComponent, bid = biz.id;
  const pcol = (await promos.hasCol(sb)) ? ",promo_price_eur" : "";
  const ym = pick.ym, pm = prevMonth(ym), nm = nextMonth(ym);
  const start = d.zonedTimeToUtc(ym + "-01", "00:00", tz);
  const end = d.zonedTimeToUtc(nm + "-01", "00:00", tz);
  const prevStart = d.zonedTimeToUtc(pm + "-01", "00:00", tz);

  const range = (a, b) => "&starts_at=gte." + enc(a.toISOString()) + "&starts_at=lt." + enc(b.toISOString());
  const base = "appointments?business_id=eq." + bid + "&status=eq.confirmed";
  const [cur, prev] = await Promise.all([
    getAll(sb, base + range(start, end) + "&order=starts_at.asc&select=id,channel,units,starts_at,customer_phone" + pcol + ",services(name,price_eur)"),
    getAll(sb, base + range(prevStart, start) + "&select=id"),
  ]);
  if (!cur) return null;

  // I giorni di chiusura (giorno senza orari di apertura, ferie o chiusura di giornata intera) non contano mai nell'incasso
  let closedYmd = null, openWd = null;
  try {
    const bl = await getAll(sb, "business_blocks?business_id=eq." + bid + "&date=gte." + ym + "-01&date=lte." + ym + "-" + String(lastDayOf(ym)).padStart(2, "0") + "&select=date,starts_at,ends_at", 2);
    closedYmd = new Set((bl || []).filter((b) => (new Date(b.ends_at) - new Date(b.starts_at)) >= 23 * 3600 * 1000).map((b) => String(b.date).slice(0, 10)));
    const rs = await sb("GET", "resources?business_id=eq." + bid + "&select=id");
    const ids = rs.ok && Array.isArray(rs.data) ? rs.data.map((x) => x.id).filter(Boolean) : [];
    if (ids.length) {
      const oh = await sb("GET", "opening_hours?resource_id=in.(" + ids.join(",") + ")&select=weekday");
      if (oh.ok && Array.isArray(oh.data) && oh.data.length) openWd = new Set(oh.data.map((h) => Number(h.weekday)));
    }
  } catch (e) { closedYmd = null; openWd = null; }
  function isClosedDay(a) {
    const ymd = localYmd(new Date(a.starts_at), tz);
    if (closedYmd && closedYmd.has(ymd)) return true;
    if (openWd) { const wd = new Date(ymd + "T12:00:00Z").getUTCDay() || 7; if (!openWd.has(wd)) return true; }
    return false;
  }

  const total = cur.length;
  const prevCount = prev ? prev.length : 0;
  const deltaPct = prev && prevCount > 0 ? Math.round(((total - prevCount) / prevCount) * 100) : null;
  const revenue = money(cur.reduce((s, a) => s + (isClosedDay(a) ? 0 : price(a)), 0));
  const online = cur.filter((a) => ONLINE_CHANNELS.indexOf(a.channel) >= 0);
  const lia = cur.filter((a) => LIA_CHANNELS.indexOf(a.channel) >= 0);

  // Clienti nuovi: la prima visita in assoluto cade in questo mese
  const phones = Array.from(new Set(cur.map((a) => a.customer_phone).filter(Boolean)));
  let newClients = 0;
  if (phones.length) {
    const known = new Set();
    for (let i = 0; i < phones.length; i += 60) {
      const part = phones.slice(i, i + 60);
      const rows = await getAll(sb, "appointments?business_id=eq." + bid + "&status=eq.confirmed&starts_at=lt." + enc(start.toISOString()) +
        "&customer_phone=in." + enc("(" + part.map((p) => '"' + String(p).replace(/"/g, "") + '"').join(",") + ")") + "&select=customer_phone", 4);
      (rows || []).forEach((x) => known.add(x.customer_phone));
    }
    newClients = phones.filter((p) => !known.has(p)).length;
  }

  // Servizio piu' richiesto
  const bySvc = {};
  cur.forEach((a) => { const n = a.services && a.services.name; if (n) bySvc[n] = (bySvc[n] || 0) + 1; });
  const top = Object.keys(bySvc).sort((a, b) => bySvc[b] - bySvc[a])[0] || null;

  const mn = MONTHS[Number(ym.slice(5, 7)) - 1];
  return {
    key: ym,
    label: mn.charAt(0).toUpperCase() + mn.slice(1) + " " + ym.slice(0, 4),
    last_day: pick.lastDay + " " + mn,
    prev_label: MONTHS[Number(pm.slice(5, 7)) - 1],
    empty: total === 0,
    appointments: { count: total, prev_count: prevCount, delta_pct: deltaPct },
    revenue: revenue,
    online: { count: online.length, pct: total ? Math.round((online.length / total) * 100) : 0, lia: lia.length },
    new_clients: newClients,
    top_service: top ? { name: top, count: bySvc[top] } : null,
  };
}

// Scadenza dell'abbonamento (stessa regola del conto alla rovescia in "Scheda attivita'"): prova o rinnovo, la data piu' lontana.
function subscriptionNotice(biz, now) {
  const sub = biz.__sub;
  if (!sub || sub.status === "cancelled" || sub.suspended) return null;
  const trial = sub.status === "trial";
  let endIso = trial ? sub.trial_ends_at : sub.period_end;
  if (!trial && sub.courtesy_until && (!endIso || new Date(sub.courtesy_until) > new Date(endIso))) endIso = sub.courtesy_until;
  if (!endIso) return null;
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(endMs)) return null;
  const ms = endMs - now.getTime();
  if (ms <= 0) return null; // gia' scaduto: lo dice la Scheda attivita'
  const days = Math.ceil(ms / DAY_MS);
  if (days > 5) return null;
  return { type: "sub_expiring", id: "sub:" + String(endIso).slice(0, 10), created_at: now.toISOString(), meta: { days: days, ends_at: endIso, trial: trial } };
}

// Avvisi di Lia. Il promemoria del lunedi' e il "come ti trovi" sono righe di notification_events (le crea il cron / la campanella).
async function buildNotices(biz, d, now) {
  const sb = d.sb, bid = biz.id, out = [];
  try {
    const since = new Date(now.getTime() - 7 * DAY_MS).toISOString();
    const r = await sb("GET", "notification_events?business_id=eq." + bid + "&event_type=eq.closures_reminder&created_at=gte." + encodeURIComponent(since) + "&order=created_at.desc&limit=1&select=id,event_type,created_at,meta");
    if (r.ok && Array.isArray(r.data) && r.data[0]) out.push({ type: "closures_reminder", id: "e" + r.data[0].id, created_at: r.data[0].created_at, meta: r.data[0].meta || null });
  } catch (e) { /* un avviso in meno, il resto funziona */ }
  try {
    const r = await sb("GET", "notification_events?business_id=eq." + bid + "&event_type=eq.feedback_ask&order=created_at.desc&limit=1&select=id,event_type,created_at,meta");
    const fb = r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
    if (fb && !(fb.meta && fb.meta.done) && now.getTime() - Date.parse(fb.created_at) <= 45 * DAY_MS) out.push({ type: "feedback_ask", id: "e" + fb.id, created_at: fb.created_at, meta: fb.meta || null });
  } catch (e) { /* idem */ }
  const sub = subscriptionNotice(biz, now);
  if (sub) out.push(sub);
  return out;
}

async function buildLiaPanel(biz, d) {
  const now = new Date();
  // Palestre: Lia raccoglie i promemoria (chiusure del lunedi', abbonamenti in scadenza); la campanella resta solo per le prenotazioni
  if (biz.business_type === "palestra") {
    const base = await buildNotices(biz, d, now);
    let exp = [];
    try {
      exp = (await require("./palestra.js").expiringEvents(biz)).slice(0, 40).map(function (x) {
        return { type: "member_expiring", id: x.id, created_at: x.created_at, meta: { member_id: x.member_id, name: x.customer_name, plan: x.service_name, ends_on: x.ends_on, days_left: x.days_left } };
      });
    } catch (e) { /* un avviso in meno */ }
    let med = [];
    try {
      med = (await require("./palestra.js").medicalExpiringEvents(biz)).slice(0, 60).map(function (x) {
        return { type: "medical_expiring", id: x.id, created_at: x.created_at, meta: { member_id: x.member_id, name: x.customer_name, until: x.until, days_left: x.days_left } };
      });
    } catch (e) { /* un avviso in meno */ }
    return { now: now.toISOString(), today: localYmd(now, biz.timezone || "Europe/Rome"), hidden: false, gym: true, team: false, month: null, notices: base.concat(exp, med), notice_hours: NOTICE_HOURS };
  }
  const tz = biz.timezone || "Europe/Rome";
  const today = localYmd(now, tz);
  const [month, notices] = await Promise.all([
    buildMonth(biz, d, today, tz).catch(() => null),
    buildNotices(biz, d, now),
  ]);
  return { now: now.toISOString(), today: today, hidden: false, team: biz.team_mode === "team", month: month, notices: notices, notice_hours: NOTICE_HOURS };
}

module.exports = { buildLiaPanel, monthToShow, subscriptionNotice };
