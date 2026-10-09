// lib/recap-data.js  (Prenolia: dati del recap giornaliero, mattina e sera, per l'icona di Lia nella dashboard)
//
// Calcola tutto in un colpo solo per "oggi" (nel fuso orario dell'attivita'):
//  - appuntamenti, incasso stimato (prezzi dei servizi), confronto con lo stesso giorno della settimana scorsa
//  - slot liberi rimasti
//  - prenotazioni prese da Lia quando l'attivita' era chiusa ("fuori orario")
//  - lavoro di Lia (conversazioni, prenotazioni, valore, totale del mese)
//  - clienti nuovi
//  - da dove hanno prenotato i clienti (WhatsApp, Telegram, webchat, QR in vetrina, altro)
// Non scrive niente nel database. Lo chiama api/agenda.js con ?recap=1.

const LIA_CHANNELS = ["whatsapp", "telegram", "web", "webchat"];
const DAY_NAMES = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

function localParts(date, tz) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(date);
  const g = (t) => p.find((x) => x.type === t).value;
  return { ymd: g("year") + "-" + g("month") + "-" + g("day"), min: Number(g("hour")) * 60 + Number(g("minute")) };
}
function hm(str) { const a = String(str).slice(0, 5).split(":").map(Number); return a[0] * 60 + a[1]; }
function price(a) { return Number(a && a.services && a.services.price_eur) || 0; }
function money(n) { return Math.round(n * 100) / 100; }

async function buildRecap(biz, d) {
  const sb = d.sb;
  const tz = biz.timezone || "Europe/Rome";
  const now = new Date();
  const lp = localParts(now, tz);
  const today = lp.ymd;
  const nowMin = lp.min;
  const dayStart = d.zonedTimeToUtc(today, "00:00", tz);
  const dayEnd = d.zonedTimeToUtc(d.addDays(today, 1), "00:00", tz);
  const lastWeekStart = d.zonedTimeToUtc(d.addDays(today, -7), "00:00", tz);
  const lastWeekEnd = d.zonedTimeToUtc(d.addDays(today, -6), "00:00", tz);
  const monthStart = d.zonedTimeToUtc(today.slice(0, 8) + "01", "00:00", tz);
  const yesterdayStart = d.zonedTimeToUtc(d.addDays(today, -1), "00:00", tz);
  const liaSince = new Date(Math.min(monthStart.getTime(), yesterdayStart.getTime()));
  const enc = encodeURIComponent;
  const bid = biz.id;

  // Lia attiva? (senza, il recap resta ma senza le parti su Lia)
  let lia = false;
  try { const acc = await d.getAccess(bid); lia = !!(acc && acc.lia_allowed); } catch (e) { lia = false; }

  // Orari di apertura: tutte le persone/risorse dell'attivita'
  const resources = Array.isArray(biz.resources) ? biz.resources : [];
  function intervalsFor(ymd) {
    const wd = d.weekdayOf(ymd);
    const out = [];
    resources.forEach((r) => (r.opening_hours || []).forEach((h) => {
      if (h.weekday === wd) out.push([hm(h.opens), hm(h.closes)]);
    }));
    return out;
  }
  function isOpenAt(date) {
    const p = localParts(date, tz);
    return intervalsFor(p.ymd).some((iv) => p.min >= iv[0] && p.min < iv[1]);
  }
  const todayIv = intervalsFor(today);
  const closeMin = todayIv.length ? Math.max.apply(null, todayIv.map((iv) => iv[1])) : null;

  // Ultima chiusura prima di adesso (per "mentre eri via")
  let lastClose = new Date(now.getTime() - 14 * 3600000);
  for (let off = 0; off >= -2; off--) {
    const ymd = d.addDays(today, off);
    const iv = intervalsFor(ymd);
    if (!iv.length) continue;
    const t = d.zonedTimeToUtc(ymd, String(Math.floor(Math.max.apply(null, iv.map((x) => x[1])) / 60)).padStart(2, "0") + ":" + String(Math.max.apply(null, iv.map((x) => x[1])) % 60).padStart(2, "0"), tz);
    if (t.getTime() <= now.getTime()) { lastClose = t; break; }
  }

  // ---- Query ----
  const apBase = "appointments?business_id=eq." + bid + "&starts_at=gte." + enc(dayStart.toISOString()) + "&starts_at=lt." + enc(dayEnd.toISOString()) +
    "&select=id,status,channel,created_at,starts_at,customer_phone,customer_name,services(name,price_eur)";
  const qToday = async () => {
    let r = await sb("GET", apBase.replace("channel,", "channel,source,") + "&limit=1000");
    if (!r.ok && r.status === 400) r = await sb("GET", apBase + "&limit=1000"); // colonna source non ancora creata
    return r.ok && Array.isArray(r.data) ? r.data : [];
  };
  const qLastWeek = async () => {
    const r = await sb("GET", "appointments?business_id=eq." + bid + "&status=eq.confirmed&starts_at=gte." + enc(lastWeekStart.toISOString()) + "&starts_at=lt." + enc(lastWeekEnd.toISOString()) + "&select=services(price_eur)&limit=1000");
    return r.ok && Array.isArray(r.data) ? r.data : [];
  };
  const qLia = async () => {
    const r = await sb("GET", "appointments?business_id=eq." + bid + "&status=eq.confirmed&channel=in.(" + LIA_CHANNELS.join(",") + ")&created_at=gte." + enc(liaSince.toISOString()) + "&select=id,created_at,services(price_eur)&limit=3000");
    return r.ok && Array.isArray(r.data) ? r.data : [];
  };
  const qConv = async () => {
    const r = await sb("GET", "chat_messages?business_id=eq." + bid + "&role=eq.user&created_at=gte." + enc(dayStart.toISOString()) + "&select=customer_phone&limit=5000");
    return r.ok && Array.isArray(r.data) ? r.data : [];
  };
  const qOwner = async () => {
    const r = await sb("GET", "resources?business_id=eq." + bid + "&is_owner=eq.true&select=name&limit=1");
    return r.ok && Array.isArray(r.data) && r.data[0] ? String(r.data[0].name || "").trim().split(/\s+/)[0] : "";
  };
  const qSlots = async () => {
    try {
      const svcs = (biz.services || []).filter((s) => s.active !== false && s.duration_min > 0);
      if (!svcs.length) return null;
      const shortest = svcs.slice().sort((a, b) => a.duration_min - b.duration_min)[0];
      const slots = await d.freeSlotsFor(biz, shortest, today);
      // slot consecutivi della stessa persona = un unico "buco"
      const byRes = {};
      slots.forEach((s) => { (byRes[s.resource_id] = byRes[s.resource_id] || []).push(hm(s.time)); });
      const starts = [];
      let count = 0;
      Object.keys(byRes).forEach((k) => {
        const arr = byRes[k].sort((a, b) => a - b);
        arr.forEach((m, i) => { if (i === 0 || m - arr[i - 1] > 15) { count++; starts.push(m); } });
      });
      starts.sort((a, b) => a - b);
      const uniq = starts.filter((m, i) => i === 0 || m !== starts[i - 1]);
      return { count: count, times: uniq.slice(0, 3).map((m) => String(Math.floor(m / 60)) + ":" + String(m % 60).padStart(2, "0")) };
    } catch (e) { return null; }
  };

  const [todayAp, lastWeekAp, liaAp, conv, ownerName, slots] = await Promise.all([qToday(), qLastWeek(), qLia(), qConv(), qOwner().catch(() => ""), qSlots()]);

  const confirmed = todayAp.filter((a) => a.status === "confirmed");
  const cancelled = todayAp.filter((a) => a.status !== "confirmed");
  const revenue = money(confirmed.reduce((s, a) => s + price(a), 0));
  const lastWeek = money(lastWeekAp.reduce((s, a) => s + price(a), 0));
  const deltaPct = lastWeek > 0 ? Math.round(((revenue - lastWeek) / lastWeek) * 100) : null;
  const firstTime = confirmed.length
    ? (function () { const t = confirmed.map((a) => new Date(a.starts_at)).sort((a, b) => a - b)[0]; const p = localParts(t, tz); return String(Math.floor(p.min / 60)) + ":" + String(p.min % 60).padStart(2, "0"); })()
    : null;

  // Canali di prenotazione degli appuntamenti di oggi
  const ch = { whatsapp: 0, telegram: 0, webchat: 0, qr: 0, other: 0 };
  confirmed.forEach((a) => {
    if (a.channel === "whatsapp") ch.whatsapp++;
    else if (a.channel === "telegram") ch.telegram++;
    else if (a.channel === "web" || a.channel === "webchat") ch.webchat++;
    else if (a.channel === "selfservice" && a.source === "qr") ch.qr++;
    else ch.other++;
  });

  // Clienti nuovi: prima volta in assoluto che compaiono oggi
  const phones = Array.from(new Set(confirmed.map((a) => a.customer_phone).filter(Boolean)));
  let newClients = 0;
  if (phones.length) {
    const r = await sb("GET", "appointments?business_id=eq." + bid + "&status=eq.confirmed&starts_at=lt." + enc(dayStart.toISOString()) +
      "&customer_phone=in.(" + enc(phones.map((p) => '"' + String(p).replace(/"/g, "") + '"').join(",")) + ")&select=customer_phone&limit=3000");
    const seen = new Set(r.ok && Array.isArray(r.data) ? r.data.map((x) => x.customer_phone) : []);
    newClients = phones.filter((p) => !seen.has(p)).length;
  }

  // Lia
  const created = (a) => new Date(a.created_at);
  const liaToday = liaAp.filter((a) => created(a) >= dayStart && created(a) < dayEnd);
  const liaMonth = liaAp.filter((a) => created(a) >= monthStart);
  const nightMorning = liaAp.filter((a) => created(a) >= lastClose && created(a) <= now && !isOpenAt(created(a)));
  const nightEvening = liaToday.filter((a) => !isOpenAt(created(a)));
  const sumV = (arr) => money(arr.reduce((s, a) => s + price(a), 0));
  const convPhones = new Set(conv.map((c) => c.customer_phone).filter(Boolean));

  // Quando mostrare cosa: la sera comincia alla chiusura (o alle 19 se oggi non ci sono orari)
  const eveningFrom = closeMin != null ? closeMin : 19 * 60;
  const view = nowMin >= eveningFrom ? "s" : "m";
  const morningUntil = Math.min(13 * 60, eveningFrom);
  const period = nowMin >= eveningFrom ? "s" : (nowMin >= 5 * 60 && nowMin < morningUntil ? "m" : null);
  const empty = confirmed.length === 0 && cancelled.length === 0 && nightEvening.length === 0 && nightMorning.length === 0;

  return {
    now: now.toISOString(),
    today: today,
    weekday: DAY_NAMES[new Date(dayStart.getTime() + 12 * 3600000).getUTCDay()] || "",
    owner: ownerName || "",
    lia: lia,
    view: view,
    period: period,
    key: today + ":" + (period || "-"),
    empty: empty,
    appointments: { confirmed: confirmed.length, cancelled: cancelled.length, first: firstTime },
    revenue: { today: revenue, last_week: lastWeek, delta_pct: deltaPct },
    slots: slots,
    night: { morning: { count: nightMorning.length, value: sumV(nightMorning) }, evening: { count: nightEvening.length, value: sumV(nightEvening) } },
    lia_stats: { conversations: convPhones.size, bookings: liaToday.length, value: sumV(liaToday), month_bookings: liaMonth.length, month_value: sumV(liaMonth) },
    new_clients: { fresh: newClients, served: phones.length },
    channels: ch,
  };
}

module.exports = { buildRecap };
