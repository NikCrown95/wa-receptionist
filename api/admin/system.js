// api/admin/system.js  (Prenolia: super dashboard - diretta, problemi, sistema)
//
//   GET  /api/admin/system?view=feed[&since=ISO][&business=UUID][&limit=N]  -> attivita' in diretta
//   GET  /api/admin/system?view=problems                                       -> elenco per la campanella
//   GET  /api/admin/system?view=system                                         -> credito AI, email Resend, scadenze
//   GET  /api/admin/system?view=home                                           -> numeri della Panoramica (vecchia)
//   GET  /api/admin/system?view=control                                        -> centro di controllo: sistemi, andamento, ore, abbonamenti, scadenze, rischio
//   POST /api/admin/system {action: set_credit | set_resend | expiry_add | expiry_update | expiry_delete, ...}
//
// Stesso accesso delle altre API admin (login vero + elenco admin_users). Le modifiche solo al titolare.
// Del testo scritto dai clienti finali NON mostro nulla: solo che qualcuno ha scritto, dove e quando.

const clients = require('./clients.js');
const health = require('../../lib/system-health.js');
const push = require('../../lib/push.js');
const { isMedical } = require('../../lib/verticals.js');

const { sb, sbAll, authenticate, cfg } = clients;

const TYPE_LABEL = {
  parrucchiere: 'Parrucchiere', barbiere: 'Barbiere', estetista: 'Estetista', cartomante: 'Cartomanzia e astrologia',
  palestra: 'Palestra', idraulico: 'Idraulico', 'personal trainer': 'Personal trainer', dentista: 'Dentista', tennis: 'Campi sportivi',
};
const CHANNEL_LABEL = {
  whatsapp: 'WhatsApp', telegram: 'Telegram', web: 'Chat del sito', webchat: 'Chat del sito',
  selfservice: 'Calendario pubblico', manuale: 'Inserito dal titolare',
};
const SOURCE_LABEL = { qr: 'QR', vetrina: 'QR in vetrina' };

const iso = (d) => new Date(d).toISOString();
const q = (v) => encodeURIComponent(v);
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));

// "Giulia Bianchi" -> "Giulia B." (nessun cognome intero nella diretta)
function shortName(n) {
  const p = String(n || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return 'Un cliente';
  return p.length === 1 ? p[0] : p[0] + ' ' + p[p.length - 1].charAt(0).toUpperCase() + '.';
}
const fmtWhen = (d) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(d));

async function bizMap() {
  const rows = (await sbAll('businesses?select=id,name,business_type&order=id.asc')) || [];
  const m = {};
  rows.forEach((b) => { m[b.id] = b; });
  return m;
}

// ----------------------------- DIRETTA -----------------------------
async function feed(query) {
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 60, 1), 150);
  const per = Math.min(limit, 80);
  let sinceQ = '';
  if (query.since) {
    const t = new Date(String(query.since));
    if (!isNaN(t)) sinceQ = t.toISOString();
  }
  const biz = isUuid(query.business) ? String(query.business) : '';
  const bizQ = biz ? `&business_id=eq.${biz}` : '';
  const when = (col) => (sinceQ ? `&${col}=gt.${q(sinceQ)}` : '');
  const warnings = [];
  const soft = async (label, p) => { try { return (await p) || []; } catch (e) { warnings.push(label); console.error('system:feed:' + label, e && e.message); return []; } };

  const [bmap, apps, chats, cancels, newBiz, reqs, gym, stripe, cancelsSub, shop] = await Promise.all([
    soft('attivita', bizMap().then((m) => [m])),
    soft('appuntamenti', sb(`appointments?select=id,created_at,starts_at,customer_name,channel,source,status,business_id,services(name)&order=created_at.desc&limit=${per}${bizQ}${when('created_at')}`)),
    soft('chat', sb(`chat_messages?select=id,created_at,customer_phone,business_id&role=eq.user&order=created_at.desc&limit=${per * 3}${bizQ}${when('created_at')}`)),
    soft('annullamenti', sb(`notification_events?select=id,created_at,event_type,customer_name,service_name,starts_at,business_id&event_type=in.(cancelled,rental_cancelled)&order=created_at.desc&limit=${per}${bizQ}${when('created_at')}`)),
    biz ? [] : soft('nuovi account', sb(`businesses?select=id,name,business_type,created_at&order=created_at.desc&limit=${per}${when('created_at')}`)),
    biz ? soft('richieste', sb(`support_requests?select=id,created_at,topic,kind,business_name,business_id&business_id=eq.${biz}&order=created_at.desc&limit=${per}${when('created_at')}`)) : soft('richieste', sb(`support_requests?select=id,created_at,topic,kind,business_name,business_id&order=created_at.desc&limit=${per}${when('created_at')}`)),
    soft('palestra', sb(`gym_bookings?select=id,created_at,starts_at,business_id&order=created_at.desc&limit=${per}${bizQ}${when('created_at')}`)),
    biz ? [] : soft('pagamenti', sb(`stripe_events?select=id,type,received_at&type=in.(invoice.paid,invoice.payment_failed,checkout.session.completed)&order=received_at.desc&limit=20${sinceQ ? `&received_at=gt.${q(sinceQ)}` : ''}`)),
    soft('disdette', sb(`subscriptions?select=id,cancelled_at,business_id&cancelled_at=not.is.null&order=cancelled_at.desc&limit=20${biz ? `&business_id=eq.${biz}` : ''}${sinceQ ? `&cancelled_at=gt.${q(sinceQ)}` : ''}`)),
    biz ? [] : soft('ordini', sb(`shop_orders?select=id,created_at,business_id,business_name,total_eur&order=created_at.desc&limit=20${when('created_at')}`)),
  ]);
  const B = (bmap && bmap[0]) || {};
  const nameOf = (id) => (B[id] && B[id].name) || 'Un’attività';
  const isMed = (id) => !!(B[id] && isMedical(B[id].business_type)); // studi sanitari: niente nomi dei pazienti ne' servizi
  const ev = [];

  apps.forEach((a) => {
    const manual = a.channel === 'manuale';
    const ch = a.source && SOURCE_LABEL[a.source] ? SOURCE_LABEL[a.source] : (CHANNEL_LABEL[a.channel] || 'Prenotazione');
    ev.push({ id: 'a' + a.id, type: manual ? 'app_manual' : 'app', at: iso(a.created_at), business_id: a.business_id, business: nameOf(a.business_id),
      title: manual ? 'Appuntamento inserito' : 'Nuovo appuntamento',
      detail: isMed(a.business_id) ? 'Appuntamento · ' + fmtWhen(a.starts_at) : shortName(a.customer_name) + ' · ' + ((a.services && a.services.name) || 'Servizio') + ' · ' + fmtWhen(a.starts_at), channel: ch });
  });
  gym.forEach((g) => {
    ev.push({ id: 'g' + g.id, type: 'app', at: iso(g.created_at), business_id: g.business_id, business: nameOf(g.business_id),
      title: 'Prenotazione lezione', detail: 'Lezione in palestra · ' + fmtWhen(g.starts_at), channel: 'Palestra' });
  });
  cancels.forEach((c) => {
    ev.push({ id: 'c' + c.id, type: 'can', at: iso(c.created_at), business_id: c.business_id, business: nameOf(c.business_id),
      title: 'Appuntamento annullato', detail: isMed(c.business_id) ? (c.starts_at ? fmtWhen(c.starts_at) : 'Appuntamento') : shortName(c.customer_name) + (c.service_name ? ' · ' + c.service_name : '') + (c.starts_at ? ' · ' + fmtWhen(c.starts_at) : '') });
  });
  // chat: i messaggi della stessa persona entro 30 minuti diventano un solo evento ("3 messaggi")
  const groups = [];
  const lastBy = {};
  chats.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).forEach((m) => {
    const k = m.business_id + '|' + m.customer_phone;
    const g = lastBy[k];
    if (g && new Date(m.created_at) - new Date(g.last) < 30 * 60000) { g.n++; g.last = m.created_at; g.id = m.id; return; }
    const ph = String(m.customer_phone || '');
    const ch = ph.startsWith('web:') ? 'Chat del sito' : ph.startsWith('tg:') ? 'Telegram' : 'WhatsApp';
    const ng = { id: m.id, n: 1, last: m.created_at, business_id: m.business_id, ch };
    lastBy[k] = ng; groups.push(ng);
  });
  groups.forEach((g) => {
    ev.push({ id: 'm' + g.id, type: 'chat', at: iso(g.last), business_id: g.business_id, business: nameOf(g.business_id),
      title: g.n > 1 ? g.n + ' messaggi a Lia' : 'Messaggio a Lia', detail: 'Un cliente ha scritto a Lia', channel: g.ch });
  });
  newBiz.forEach((b) => {
    ev.push({ id: 'b' + b.id, type: 'acc', at: iso(b.created_at), business_id: b.id, business: b.name,
      title: 'Nuovo account', detail: b.name + ' · ' + (TYPE_LABEL[b.business_type] || b.business_type || 'Attività') });
  });
  reqs.forEach((r) => {
    ev.push({ id: 'r' + r.id, type: 'req', at: iso(r.created_at), business_id: r.business_id, business: r.business_name || nameOf(r.business_id),
      title: 'Nuova richiesta', detail: (r.topic || r.kind || 'Messaggio dal cliente') });
  });
  stripe.forEach((s) => {
    const failed = s.type === 'invoice.payment_failed';
    ev.push({ id: 's' + s.id, type: 'pay', at: iso(s.received_at), business_id: null, business: 'Stripe',
      title: failed ? 'Pagamento non riuscito' : 'Pagamento ricevuto', detail: failed ? 'Controlla il cliente su Stripe' : (s.type === 'checkout.session.completed' ? 'Nuovo abbonamento' : 'Rinnovo incassato') });
  });
  shop.forEach((o) => {
    ev.push({ id: 'o' + o.id, type: 'pay', at: iso(o.created_at), business_id: o.business_id, business: o.business_name || nameOf(o.business_id),
      title: 'Nuovo ordine dallo Shop', detail: (o.business_name || nameOf(o.business_id)) + (o.total_eur != null ? ' · ' + String(o.total_eur).replace('.', ',') + ' €' : '') });
  });
  cancelsSub.forEach((s) => {
    ev.push({ id: 'd' + s.id, type: 'can_sub', at: iso(s.cancelled_at), business_id: s.business_id, business: nameOf(s.business_id),
      title: 'Abbonamento disdetto', detail: nameOf(s.business_id) + ' ha disdetto l’abbonamento' });
  });

  ev.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return { events: ev.slice(0, limit), now: new Date().toISOString(), warnings };
}

// ----------------------------- DATI "SISTEMA" -----------------------------
async function settings(keys) {
  const rows = (await sb(`app_settings?key=in.(${keys.map(q).join(',')})&select=key,value`)) || [];
  const m = {};
  rows.forEach((r) => { m[r.key] = r.value; });
  return m;
}

async function creditData(now) {
  const s = await settings(['credit_balance_eur', 'credit_set_at']);
  const since = new Date(now.getTime() - 14 * 86400000);
  const setAt = s.credit_set_at ? new Date(s.credit_set_at) : null;
  const from = setAt && setAt < since ? setAt : since;
  const costs = (await sbAll(`ai_usage_costed_v?select=at,cost_eur&at=gte.${q(from.toISOString())}&order=at.asc`)) || [];
  return health.creditState({ balance: s.credit_balance_eur == null ? null : Number(s.credit_balance_eur), setAt: s.credit_set_at, costs: costs.map((c) => ({ at: c.at, cost: c.cost_eur })) }, now);
}

async function countRows(table, qs) {
  const { url, key } = cfg();
  const r = await fetch(`${url}/rest/v1/${table}?${qs}`, { method: 'HEAD', headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' } });
  if (!r.ok) { const e = new Error(table + ' HTTP ' + r.status); e.status = r.status; throw e; }
  const n = Number((r.headers.get('content-range') || '').split('/')[1]);
  return Number.isFinite(n) ? n : 0;
}

async function resendData(now) {
  const s = await settings(['resend_limit_month', 'resend_limit_day']);
  const today = health.romeDay(now);
  const monthStart = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, 1) - 3 * 3600000).toISOString();
  const dayStart = new Date(Date.parse(today + 'T00:00:00Z') - 3 * 3600000).toISOString();
  const head = (qs) => countRows('email_log', qs);
  const [monthSent, todaySent] = await Promise.all([head(`select=id&at=gte.${q(monthStart)}`), head(`select=id&at=gte.${q(dayStart)}`)]);
  return health.resendState({ monthSent, todaySent, limitMonth: s.resend_limit_month, limitDay: s.resend_limit_day }, now);
}

async function expiries() {
  return (await sb('admin_expiries?active=eq.true&select=id,name,note,due_date&order=due_date.asc&limit=200')) || [];
}

async function systemView() {
  const now = new Date();
  const warnings = [];
  const soft = async (label, p, fb) => { try { return await p; } catch (e) { warnings.push(label); console.error('system:' + label, e && e.message); return fb; } };
  const [credit, resend, exp, calc] = await Promise.all([
    soft('credito', creditData(now), null),
    soft('email', resendData(now), null),
    soft('scadenze', expiries(), []),
    soft('calcolatore', calculatorBase(now), null),
  ]);
  return { credit, resend, expiries: exp, calc, warnings };
}

// numeri reali per precompilare il calcolatore: attivita' attive, prenotazioni per attivita', quante lasciano l'email
async function calculatorBase(now) {
  const since = new Date(now.getTime() - 30 * 86400000).toISOString();
  const [access, total, withMail] = await Promise.all([
    sbAll('service_access_v?select=business_id,allowed&order=business_id.asc'),
    countRows('appointments', `select=id&created_at=gte.${q(since)}`),
    countRows('appointments', `select=id&customer_email=not.is.null&created_at=gte.${q(since)}`),
  ]);
  const active = (access || []).filter((a) => a.allowed).length;
  return { businesses: active, bookings_30d: total, with_email_30d: withMail,
    per_business: active ? Math.round(total / active) : 0, email_pct: total ? Math.round((withMail / total) * 100) : 0 };
}

// ----------------------------- PROBLEMI -----------------------------
async function problemsView() {
  const now = new Date();
  const soft = async (p, fb) => { try { return await p; } catch (e) { console.error('system:problems', e && e.message); return fb; } };
  const sinceAi = new Date(now.getTime() - 12 * 3600000).toISOString();
  const since7 = new Date(now.getTime() - 7 * 86400000).toISOString();
  const [credit, resend, exp, down, access, subs, failed, supportNew] = await Promise.all([
    soft(creditData(now), null),
    soft(resendData(now), null),
    soft(expiries(), []),
    soft(sbAll(`admin_alerts_sent?select=kind,details,sent_at&kind=eq.ai_down&sent_at=gte.${q(sinceAi)}&order=sent_at.desc`), []),
    soft(sbAll('service_access_v?select=business_id,state,grace_ends,businesses(name)&order=business_id.asc'), []),
    soft(sbAll('subscriptions?select=id,business_id,status,trial_ends_at,current_period_end,businesses(name)&status=in.(trial,active)&order=id.asc'), []),
    soft(sbAll(`stripe_events?select=id,received_at&type=eq.invoice.payment_failed&received_at=gte.${q(since7)}`), []),
    soft(sbAll('support_requests?select=id,created_at,business_name,topic,message&kind=eq.support&status=eq.new&order=created_at.desc'), []),
  ]);
  const aiDown = [];
  const seen = {};
  (down || []).forEach((d) => {
    const st = d.details && d.details.status;
    const kind = st === 401 || st === 403 ? 'key' : st === 404 ? 'model' : 'credit';
    if (!seen[kind]) { seen[kind] = 1; aiDown.push({ kind, at: d.sent_at }); }
  });
  const problems = health.buildProblems({
    credit, resend, aiDown, expiries: exp, failedPayments: failed, supportNew,
    access: (access || []).map((a) => ({ id: a.business_id, name: (a.businesses && a.businesses.name) || 'Un’attività', state: a.state, grace_ends: a.grace_ends })),
    trials: (subs || []).filter((s) => s.status === 'trial' && s.trial_ends_at).map((s) => ({ id: s.business_id, name: (s.businesses && s.businesses.name) || 'Un’attività', trial_ends_at: s.trial_ends_at })),
    renewals: (subs || []).filter((s) => s.status === 'active' && s.current_period_end).map((s) => ({ id: s.business_id, name: (s.businesses && s.businesses.name) || 'Un’attività', current_period_end: s.current_period_end })),
  }, now);
  return { problems, counts: { crit: problems.filter((p) => p.severity === 'crit').length, warn: problems.filter((p) => p.severity === 'warn').length, info: problems.filter((p) => p.severity === 'info').length } };
}

// ----------------------------- PANORAMICA -----------------------------
async function homeView() {
  const now = new Date();
  const today = health.romeDay(now);
  const dayStart = new Date(Date.parse(today + 'T00:00:00Z') - 3 * 3600000).toISOString();
  const soft = async (p, fb) => { try { return await p; } catch (e) { console.error('system:home', e && e.message); return fb; } };
  const [subs, todayApps, access] = await Promise.all([
    soft(sbAll('subscriptions?select=id,status,started_at,cancelled_at,trial_ends_at,current_period_end,plans(price_eur)&order=id.asc'), []),
    soft(sbAll(`appointments?select=channel,status&created_at=gte.${q(dayStart)}&order=id.asc`), []),
    soft(sbAll('service_access_v?select=business_id,state,allowed&order=business_id.asc'), []),
  ]);
  const paying = (subs || []).filter((s) => s.status === 'active' && !s.cancelled_at);
  const mrr = paying.reduce((s, r) => s + Number((r.plans && r.plans.price_eur) || 0), 0);
  const trials = (subs || []).filter((s) => s.status === 'trial');
  const trialsSoon = trials.filter((s) => s.trial_ends_at && health.daysBetween(today, health.romeDay(s.trial_ends_at)) <= 3 && health.daysBetween(today, health.romeDay(s.trial_ends_at)) >= 0).length;
  const channels = {};
  (todayApps || []).forEach((a) => { if (a.status === 'cancelled' || a.status === 'annullato') return; const k = CHANNEL_LABEL[a.channel] || 'Altro'; channels[k] = (channels[k] || 0) + 1; });
  const by = Object.keys(channels).map((k) => ({ label: k, n: channels[k] })).sort((a, b) => b.n - a.n);
  return {
    mrr: Math.round(mrr * 100) / 100, active: (access || []).filter((a) => a.state === 'active').length || paying.length,
    trials: trials.length, trials_soon: trialsSoon, bookings_today: by.reduce((s, x) => s + x.n, 0), channels_today: by,
  };
}


// ----------------------------- CENTRO DI CONTROLLO -----------------------------
// Tutto quello che serve alla Panoramica in una sola chiamata. Lo storico (ultime 4 settimane) si ricalcola
// al massimo ogni 10 minuti; quello che cambia di continuo (oggi, ultima ora, sistemi) si legge ogni volta.
const memo = {};
async function cached(key, ms, fn) {
  const m = memo[key];
  if (m && Date.now() - m.t < ms) return m.v;
  const v = await fn();
  memo[key] = { t: Date.now(), v };
  return v;
}
const romeDayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' });
const romeHourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false });
const dayOf = (t) => romeDayFmt.format(new Date(t));
const hourOf = (t) => parseInt(romeHourFmt.format(new Date(t)), 10) % 24;
const addDays = (day, n) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
// istante in cui comincia il giorno "YYYY-MM-DD" a Roma (gestisce ora legale e solare)
function romeStart(day) {
  const base = Date.parse(day + 'T00:00:00Z');
  for (const off of [2, 1, 3, 0]) {
    const t = base - off * 3600000;
    if (dayOf(t) === day && dayOf(t - 1) !== day) return new Date(t);
  }
  return new Date(base - 2 * 3600000);
}
const itNum = (n) => String(n).replace('.', ',');
const itDate = (d) => { const p = String(d).slice(0, 10).split('-').map(Number); return p[2] + '/' + p[1]; };
function ago(t, now) {
  const m = Math.floor((now.getTime() - new Date(t).getTime()) / 60000);
  if (m < 1) return 'adesso';
  if (m < 60) return m + ' min fa';
  const h = Math.floor(m / 60);
  if (h < 48) return h + (h === 1 ? ' ora fa' : ' ore fa');
  const d = Math.floor(h / 24);
  return d + ' giorni fa';
}
const isCancelledStatus = (st) => st === 'cancelled' || st === 'annullato';

async function controlView() {
  const now = new Date();
  const today = dayOf(now);
  const warnings = [];
  const soft = async (label, p, fb) => { try { return await p; } catch (e) { warnings.push(label); console.error('system:control:' + label, e && e.message); return fb; } };
  const todayStart = romeStart(today);
  const histFrom = romeStart(addDays(today, -28));
  const hourAgo = new Date(now.getTime() - 3600000).toISOString();

  const [hist, todayApps, subs, access, bizRows, credit, resend, exp, chatsToday, lastChats, lastAi, aiDown, failed, stripeLast, supportNew, hAccounts, hChats, hCancels, dbMs, bmap] = await Promise.all([
    soft('storico', cached('hist:' + today, 600000, () => sbAll(`appointments?select=created_at,business_id,status&created_at=gte.${q(histFrom.toISOString())}&created_at=lt.${q(todayStart.toISOString())}&order=id.asc`)), []),
    soft('oggi', sbAll(`appointments?select=created_at,channel,status&created_at=gte.${q(todayStart.toISOString())}&order=id.asc`), []),
    soft('abbonamenti', sbAll('subscriptions?select=id,business_id,status,started_at,trial_ends_at,current_period_end,cancelled_at,cancel_at_period_end,plans(price_eur),businesses(name)&order=id.asc'), []),
    soft('accessi', sbAll('service_access_v?select=business_id,state,sub_status,allowed&order=business_id.asc'), []),
    soft('account', sbAll('businesses?select=id,created_at&order=created_at.asc'), []),
    soft('credito', creditData(now), null),
    soft('email', resendData(now), null),
    soft('scadenze', expiries(), []),
    soft('chat oggi', countRows('chat_messages', `select=id&role=eq.user&created_at=gte.${q(todayStart.toISOString())}`), 0),
    soft('whatsapp', sb('chat_messages?select=created_at,customer_phone&role=eq.user&order=created_at.desc&limit=200'), []),
    soft('lia', sb('ai_usage_costed_v?select=at&order=at.desc&limit=1'), []),
    soft('lia errori', sbAll(`admin_alerts_sent?select=kind,details,sent_at&kind=eq.ai_down&sent_at=gte.${q(new Date(now.getTime() - 12 * 3600000).toISOString())}&order=sent_at.desc`), []),
    soft('pagamenti', countRows('stripe_events', `select=id&type=eq.invoice.payment_failed&received_at=gte.${q(new Date(now.getTime() - 7 * 86400000).toISOString())}`), 0),
    soft('pagamenti ultimo', sb('stripe_events?select=received_at&order=received_at.desc&limit=1'), []),
    soft('assistenza', sbAll('support_requests?select=id,created_at,business_name&kind=eq.support&status=eq.new&order=created_at.desc'), []),
    soft('ora account', countRows('businesses', `select=id&created_at=gte.${q(hourAgo)}`), 0),
    soft('ora chat', countRows('chat_messages', `select=id&role=eq.user&created_at=gte.${q(hourAgo)}`), 0),
    soft('ora annullamenti', countRows('notification_events', `select=id&event_type=in.(cancelled,rental_cancelled)&created_at=gte.${q(hourAgo)}`), 0),
    (async () => { const t0 = Date.now(); try { await countRows('businesses', 'select=id'); return Date.now() - t0; } catch (e) { warnings.push('database'); return null; } })(),
    soft('attivita', bizMap(), {}),
  ]);

  // ---- prenotazioni: per giorno, per ora, tipico
  const live = (r) => !isCancelledStatus(r.status);
  const perDay = {};
  const perDayHour = {};
  (hist || []).filter(live).forEach((r) => {
    const d = dayOf(r.created_at);
    perDay[d] = (perDay[d] || 0) + 1;
    (perDayHour[d] = perDayHour[d] || new Array(24).fill(0))[hourOf(r.created_at)]++;
  });
  const days14 = [];
  for (let i = 14; i >= 1; i--) days14.push(addDays(today, -i));
  const bookingsSeries = days14.map((d) => perDay[d] || 0);
  const typical = new Array(24).fill(0);
  [1, 2, 3, 4].forEach((k) => { const row = perDayHour[addDays(today, -7 * k)]; if (row) row.forEach((v, h) => { typical[h] += v / 4; }); });
  const hours = new Array(24).fill(0);
  const channels = {};
  let lastHourBookings = 0;
  (todayApps || []).filter(live).forEach((a) => {
    hours[hourOf(a.created_at)]++;
    const k = CHANNEL_LABEL[a.channel] || 'Altro';
    channels[k] = (channels[k] || 0) + 1;
    if (new Date(a.created_at).toISOString() >= hourAgo) lastHourBookings++;
  });
  const totalToday = hours.reduce((a, b) => a + b, 0);
  const hNow = hourOf(now);
  const typicalSoFar = typical.slice(0, hNow + 1).reduce((a, b) => a + b, 0);
  const vsTypical = typicalSoFar >= 3 ? Math.round((totalToday / typicalSoFar - 1) * 100) : null;
  const byChannel = Object.keys(channels).map((k) => ({ label: k, n: channels[k] })).sort((a, b) => b.n - a.n);

  // ---- abbonamenti
  const paying = (subs || []).filter((s) => s.status === 'active' && !s.cancelled_at);
  const price = (s) => Number((s.plans && s.plans.price_eur) || 0);
  const mrr = Math.round(paying.reduce((a, s) => a + price(s), 0) * 100) / 100;
  const trialsNow = (subs || []).filter((s) => s.status === 'trial');
  const trialsSoon = trialsNow.filter((s) => { if (!s.trial_ends_at) return false; const d = health.daysBetween(today, dayOf(s.trial_ends_at)); return d >= 0 && d <= 3; });
  const days14i = []; for (let i = 13; i >= 0; i--) days14i.push(addDays(today, -i));
  const endOf = (d) => romeStart(addDays(d, 1)).getTime() - 1;
  const mrrSeries = days14i.map((d) => {
    const t = endOf(d);
    return Math.round((subs || []).filter((s) => s.started_at && new Date(s.started_at).getTime() <= t && (!s.trial_ends_at || new Date(s.trial_ends_at).getTime() <= t) && (!s.cancelled_at || new Date(s.cancelled_at).getTime() > t) && (s.status === 'active' || s.status === 'cancelled')).reduce((a, s) => a + price(s), 0) * 100) / 100;
  });
  mrrSeries[mrrSeries.length - 1] = mrr; // l'ultimo punto e' sempre il valore vero
  const trialSeries = days14i.map((d) => {
    const t = endOf(d);
    return (subs || []).filter((s) => s.started_at && s.trial_ends_at && new Date(s.started_at).getTime() <= t && new Date(s.trial_ends_at).getTime() > t && (!s.cancelled_at || new Date(s.cancelled_at).getTime() > t)).length;
  });
  trialSeries[trialSeries.length - 1] = trialsNow.length;
  const accountSeries = days14i.map((d) => { const t = endOf(d); return (bizRows || []).filter((b) => new Date(b.created_at).getTime() <= t).length; });
  const acc = access || [];
  const cnt = (f) => acc.filter(f).length;
  const funnel = [
    { key: 'paid', label: 'Abbonamento attivo', n: cnt((a) => a.state === 'active' && a.sub_status === 'active') },
    { key: 'trial', label: 'In prova gratuita', n: cnt((a) => a.state === 'active' && a.sub_status === 'trial') },
    { key: 'grace', label: 'Periodo di grazia', n: cnt((a) => a.state === 'grace') },
    { key: 'susp', label: 'Sospese', n: cnt((a) => a.state === 'suspended') },
    { key: 'canc', label: 'Disdette', n: cnt((a) => a.state === 'cancelled') },
    { key: 'free', label: 'Senza abbonamento', n: cnt((a) => a.state === 'unmanaged') },
  ];
  const activeNow = cnt((a) => a.state === 'active');

  // ---- scadenze dei prossimi 30 giorni
  const B = bmap || {};
  const agenda = [];
  (subs || []).forEach((s) => {
    const name = (s.businesses && s.businesses.name) || (B[s.business_id] && B[s.business_id].name) || 'Un’attività';
    if (s.status === 'trial' && s.trial_ends_at) { const d = health.daysBetween(today, dayOf(s.trial_ends_at)); if (d >= 0 && d <= 30) agenda.push({ date: dayOf(s.trial_ends_at), days: d, kind: 'trial', title: name, detail: 'Fine della prova gratuita', id: s.business_id }); }
    if (s.status === 'active' && !s.cancelled_at && s.current_period_end) { const d = health.daysBetween(today, dayOf(s.current_period_end)); if (d >= 0 && d <= 30) agenda.push({ date: dayOf(s.current_period_end), days: d, kind: 'renewal', title: name, detail: s.cancel_at_period_end ? 'Fine abbonamento (disdetto)' : 'Rinnovo dell’abbonamento', id: s.business_id }); }
  });
  (exp || []).forEach((e) => { const d = health.daysBetween(today, String(e.due_date).slice(0, 10)); if (d >= 0 && d <= 30) agenda.push({ date: String(e.due_date).slice(0, 10), days: d, kind: 'expiry', title: e.name, detail: e.note || 'Dal registro delle scadenze' }); });
  agenda.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // ---- attivita' a rischio: usano meno Prenolia di prima
  const byBiz = {};
  (hist || []).filter(live).forEach((r) => { (byBiz[r.business_id] = byBiz[r.business_id] || []).push(new Date(r.created_at).getTime()); });
  const subByBiz = {};
  (subs || []).forEach((s) => { subByBiz[s.business_id] = s; });
  const D = 86400000, nowMs = now.getTime();
  const risk = [];
  acc.filter((a) => a.allowed && a.state !== 'unmanaged').forEach((a) => {
    const times = byBiz[a.business_id] || [];
    const last7 = times.filter((t) => nowMs - t < 7 * D).length;
    const prev = times.filter((t) => nowMs - t >= 7 * D && nowMs - t < 28 * D).length;
    const lastT = times.length ? Math.max.apply(null, times) : null;
    const sub = subByBiz[a.business_id];
    const name = (B[a.business_id] && B[a.business_id].name) || 'Un’attività';
    const daysSince = lastT ? Math.floor((nowMs - lastT) / D) : null;
    if (a.sub_status === 'trial' && sub && sub.started_at && nowMs - new Date(sub.started_at).getTime() > 5 * D && last7 === 0) {
      const left = sub.trial_ends_at ? health.daysBetween(today, dayOf(sub.trial_ends_at)) : null;
      risk.push({ id: a.business_id, name, severity: 'crit', score: 3, reason: (left != null && left >= 0 ? (left === 0 ? 'La prova finisce oggi. ' : 'La prova finisce tra ' + left + (left === 1 ? ' giorno. ' : ' giorni. ')) : '') + (daysSince == null ? 'Nessuna prenotazione dall’inizio della prova.' : 'Nessuna prenotazione da ' + daysSince + (daysSince === 1 ? ' giorno.' : ' giorni.')) });
    } else if (prev >= 6 && last7 === 0) {
      risk.push({ id: a.business_id, name, severity: 'warn', score: 2, reason: 'Nessuna prenotazione da ' + (daysSince == null ? 'oltre 4 settimane' : daysSince + (daysSince === 1 ? ' giorno' : ' giorni')) + ', prima ne riceveva circa ' + Math.round(prev / 3) + ' a settimana.' });
    } else if (prev >= 12 && last7 * 3 <= prev * 0.4) {
      const drop = Math.round((1 - (last7 * 3) / prev) * 100);
      risk.push({ id: a.business_id, name, severity: 'warn', score: 1, reason: 'Prenotazioni in calo del ' + drop + '% rispetto alle tre settimane precedenti.' });
    }
  });
  risk.sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : 1));

  // ---- celle dei sistemi
  const cells = [];
  if (!credit) cells.push({ key: 'credit', label: 'Credito AI', value: 'non leggibile', sub: 'Esegui lo script SQL della Super Dashboard e ricarica.', state: 'warn', gauge: null, href: '/admin/sistema.html' });
  else if (!credit.configured) cells.push({ key: 'credit', label: 'Credito AI', value: 'da impostare', sub: 'Scrivi il saldo di Anthropic: ti avviso prima che finisca.', state: 'warn', gauge: null, href: '/admin/sistema.html' });
  else {
    const st = credit.remaining <= 0 || (credit.days_left != null && credit.days_left <= 3) ? 'crit' : (credit.days_left != null && credit.days_left <= 7 ? 'warn' : 'ok');
    cells.push({ key: 'credit', label: 'Credito AI', state: st, href: '/admin/sistema.html',
      value: credit.remaining <= 0 ? 'esaurito' : (credit.days_left == null ? itNum(credit.remaining) + ' €' : (credit.days_left === 0 ? 'finisce oggi' : credit.days_left + (credit.days_left === 1 ? ' giorno' : ' giorni'))),
      sub: 'Restano ' + itNum(credit.remaining) + ' € · consumo ' + itNum(credit.avg_daily) + ' € al giorno', gauge: credit.days_left == null ? 100 : Math.min(100, Math.round(credit.days_left / 30 * 100)) });
  }
  const downKinds = {};
  (aiDown || []).forEach((d) => { const stt = d.details && d.details.status; downKinds[stt === 401 || stt === 403 ? 'key' : stt === 404 ? 'model' : 'credit'] = 1; });
  const downTxt = downKinds.credit ? 'Credito esaurito' : downKinds.key ? 'Chiave non valida' : downKinds.model ? 'Modello non trovato' : '';
  const lastAiAt = (lastAi && lastAi[0] && lastAi[0].at) || null;
  cells.push({ key: 'lia', label: 'Lia', state: downTxt ? 'crit' : 'ok', href: '/admin/lia.html', value: downTxt ? 'Non risponde' : 'Operativa',
    sub: downTxt ? downTxt + ' nelle ultime 12 ore' : (lastAiAt ? 'Ultima risposta ' + ago(lastAiAt, now) : 'Nessuna risposta registrata'), gauge: downTxt ? 0 : 100 });
  cells.push(!resend
    ? { key: 'mail', label: 'Email Resend', value: 'non leggibile', sub: 'Esegui lo script SQL della Super Dashboard e ricarica.', state: 'warn', gauge: null, href: '/admin/sistema.html' }
    : { key: 'mail', label: 'Email Resend', value: resend.pct + '%', state: resend.pct >= 100 ? 'crit' : resend.pct >= 80 ? 'warn' : 'ok', href: '/admin/sistema.html',
        sub: resend.month_sent + ' su ' + resend.limit_month + ' questo mese', gauge: Math.min(100, resend.pct) });
  const lastPay = stripeLast && stripeLast[0] && stripeLast[0].received_at;
  cells.push({ key: 'pay', label: 'Pagamenti', state: failed > 0 ? 'warn' : 'ok', href: '/admin/soldi.html', value: failed > 0 ? failed + (failed === 1 ? ' fallito' : ' falliti') : 'Regolari',
    sub: (failed > 0 ? 'Negli ultimi 7 giorni' : '0 falliti negli ultimi 7 giorni') + (lastPay ? ' · ultimo evento ' + ago(lastPay, now) : ''), gauge: null });
  const sup = supportNew || [];
  cells.push({ key: 'support', label: 'Assistenza', state: sup.length ? 'warn' : 'ok', href: '/admin/richieste.html', value: sup.length ? sup.length + (sup.length === 1 ? ' nuova' : ' nuove') : 'Nessuna',
    sub: sup.length ? (sup[0].business_name || 'Un’attività') + ' · ' + ago(sup[0].created_at, now) : 'Nessuna richiesta da leggere', gauge: null });
  const ex0 = (exp || [])[0];
  if (ex0) {
    const d = health.daysBetween(today, String(ex0.due_date).slice(0, 10));
    cells.push({ key: 'expiry', label: 'Scadenze', state: d <= 7 ? 'crit' : d <= 30 ? 'warn' : 'ok', href: '/admin/sistema.html', value: d < 0 ? 'scaduta' : (d === 0 ? 'oggi' : d + (d === 1 ? ' giorno' : ' giorni')),
      sub: ex0.name + ' · ' + itDate(ex0.due_date), gauge: d < 0 ? 100 : Math.max(4, Math.min(100, Math.round((1 - d / 90) * 100))) });
  } else cells.push({ key: 'expiry', label: 'Scadenze', state: 'ok', href: '/admin/sistema.html', value: 'Nessuna', sub: 'Aggiungi domini, chiavi e abbonamenti da tenere d’occhio.', gauge: null });
  cells.push(dbMs == null
    ? { key: 'db', label: 'Database', state: 'crit', value: 'non risponde', sub: 'La lettura di prova è fallita', gauge: 100, href: '/admin/sistema.html' }
    : { key: 'db', label: 'Database', state: dbMs < 600 ? 'ok' : dbMs < 2000 ? 'warn' : 'crit', value: dbMs + ' ms', sub: 'Tempo di risposta in questo momento', gauge: Math.min(100, Math.round(dbMs / 10)), href: '/admin/sistema.html' });
  const waMsg = (lastChats || []).filter((m) => !/^(web|tg):/.test(String(m.customer_phone || '')))[0];
  const waAge = waMsg ? (nowMs - new Date(waMsg.created_at).getTime()) / D : null;
  cells.push({ key: 'wa', label: 'WhatsApp', state: waMsg == null ? 'warn' : waAge > 3 ? 'warn' : 'ok', href: '/admin/lia.html', value: waMsg == null ? 'Nessun messaggio' : (waAge > 3 ? 'Silenzioso' : 'Attivo'),
    sub: waMsg ? 'Ultimo messaggio ' + ago(waMsg.created_at, now) : 'Nessun messaggio WhatsApp recente', gauge: null });

  const delta = (arr) => arr[arr.length - 1] - arr[0];
  return {
    now: now.toISOString(), warnings, cells,
    kpis: {
      mrr, mrr_series: mrrSeries, mrr_delta: Math.round(delta(mrrSeries) * 100) / 100,
      active: activeNow, accounts_total: (bizRows || []).length, accounts_series: accountSeries, accounts_delta: delta(accountSeries),
      bookings_today: totalToday, bookings_vs_typical: vsTypical, bookings_series: bookingsSeries,
      trials: trialsNow.length, trials_soon: trialsSoon.length, trials_series: trialSeries,
    },
    today: { hours, typical: typical.map((v) => Math.round(v * 10) / 10), hour_now: hNow, channels: byChannel, total: totalToday },
    last_hour: { accounts: hAccounts, bookings: lastHourBookings, chats: hChats, cancels: hCancels },
    funnel, total_businesses: acc.length, agenda: agenda.slice(0, 12), at_risk: risk.slice(0, 6),
  };
}

// ----------------------------- ANNUNCI -----------------------------
async function announcements() {
  try {
    const rows = await sb('announcements?select=id,kind,title,message,created_at,expires_at,active&order=created_at.desc&limit=15');
    const now = Date.now();
    return { table: true, items: (rows || []).map((r) => ({ ...r, live: !!r.active && Date.parse(r.expires_at) > now })) };
  } catch (e) {
    if (e && (e.status === 404 || /announcements/.test(String(e.message || '')))) return { table: false, items: [] };
    throw e;
  }
}

// ----------------------------- MODIFICHE -----------------------------
const eurNum = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
const bad = (m) => { const e = new Error(m); e.validation = true; return e; };

async function upsertSetting(key, value) {
  await sb('app_settings?on_conflict=key', { method: 'POST', body: [{ key, value: String(value), updated_at: new Date().toISOString() }], prefer: 'resolution=merge-duplicates,return=minimal' });
}

async function act(body, ctx) {
  const a = String(body.action || '');
  if (a === 'set_credit') {
    const n = String(body.balance == null ? '' : body.balance).trim() === '' ? NaN : eurNum(body.balance);
    if (!Number.isFinite(n) || n < 0 || n > 100000) throw bad('Scrivi il saldo in euro, per esempio 25 o 12,50.');
    await upsertSetting('credit_balance_eur', Math.round(n * 100) / 100);
    await upsertSetting('credit_set_at', new Date().toISOString());
    return { ok: true, credit: await creditData(new Date()) };
  }
  if (a === 'set_resend') {
    const m = parseInt(body.limit_month, 10), d = parseInt(body.limit_day, 10);
    if (!(m >= 100 && m <= 10000000) || !(d >= 1 && d <= 1000000)) throw bad('Limiti non validi: scrivi numeri interi, per esempio 3000 al mese e 100 al giorno.');
    await upsertSetting('resend_limit_month', m);
    await upsertSetting('resend_limit_day', d);
    return { ok: true, resend: await resendData(new Date()) };
  }
  if (a === 'expiry_add' || a === 'expiry_update') {
    const name = String(body.name || '').trim().slice(0, 80), note = String(body.note || '').trim().slice(0, 160), due = String(body.due_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || isNaN(new Date(due))) throw bad('Scegli una data valida.');
    if (a === 'expiry_add') {
      if (!name) throw bad('Scrivi cosa scade (per esempio "Dominio prenolia.it").');
      await sb('admin_expiries', { method: 'POST', body: { name, note: note || null, due_date: due }, prefer: 'return=minimal' });
    } else {
      if (!isUuid(body.id)) throw bad('Scadenza non valida.');
      const patch = { due_date: due };
      if (name) patch.name = name;
      if (body.note !== undefined) patch.note = note || null;
      await sb(`admin_expiries?id=eq.${body.id}`, { method: 'PATCH', body: patch, prefer: 'return=minimal' });
    }
    return { ok: true, expiries: await expiries() };
  }
  if (a === 'expiry_delete') {
    if (!isUuid(body.id)) throw bad('Scadenza non valida.');
    await sb(`admin_expiries?id=eq.${body.id}`, { method: 'PATCH', body: { active: false }, prefer: 'return=minimal' });
    return { ok: true, expiries: await expiries() };
  }
  if (a === 'push_subscribe') {
    const sub = body.subscription || {}, keys = sub.keys || {};
    const endpoint = String(sub.endpoint || '').trim(), p256dh = String(keys.p256dh || '').trim(), authKey = String(keys.auth || '').trim();
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 1500 || !p256dh || !authKey || p256dh.length > 200 || authKey.length > 100) throw bad('Dispositivo non valido.');
    await sb('admin_push_subscriptions?on_conflict=endpoint', { method: 'POST', body: { endpoint, p256dh, auth: authKey, actor: String(ctx.actor || '').slice(0, 200), user_agent: String(body.ua || '').slice(0, 200) }, prefer: 'resolution=merge-duplicates,return=minimal' });
    return { ok: true };
  }
  if (a === 'push_unsubscribe') {
    const ep = String(body.endpoint || '').trim();
    if (!ep || ep.length > 1500) throw bad('Dispositivo non valido.');
    await sb(`admin_push_subscriptions?endpoint=eq.${q(ep)}`, { method: 'DELETE', prefer: 'return=minimal' });
    return { ok: true };
  }
  if (a === 'push_test') {
    if (!push.isConfigured()) throw bad('Le notifiche non sono configurate sul server.');
    const sent = await push.sendToAdmins({ title: 'Notifica di prova', body: 'Prenolia Admin: le notifiche funzionano.', url: '/admin/', tag: 'lia-admin-test-' + Date.now(), kind: 'test' });
    if (sent.error) throw bad('Notifiche non disponibili: manca la tabella dei dispositivi.');
    return sent;
  }
  if (a === 'announce_send') {
    const kind = ['maintenance', 'news', 'notice'].includes(body.kind) ? body.kind : null;
    const title = String(body.title || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const message = String(body.message || '').replace(/[ \t]+/g, ' ').trim().slice(0, 400);
    const days = Math.min(30, Math.max(1, parseInt(body.days, 10) || 7));
    if (!kind) throw bad('Scegli il tipo di annuncio.');
    if (message.length < 5) throw bad('Scrivi il testo dell\u2019annuncio.');
    const expires = new Date(Date.now() + days * 86400000).toISOString();
    try {
      await sb('announcements', { method: 'POST', body: { kind, title: title || null, message, expires_at: expires, created_by: String(ctx.actor || '').slice(0, 200) }, prefer: 'return=minimal' });
    } catch (e) { if (e && (e.status === 404 || /announcements/.test(String(e.message || '')))) throw bad('Manca la tabella degli annunci: esegui in Supabase lo script 20261104_announcements.sql.'); throw e; }
    return { ok: true, announcements: await announcements() };
  }
  if (a === 'announce_stop') {
    if (!isUuid(body.id)) throw bad('Annuncio non valido.');
    await sb(`announcements?id=eq.${body.id}`, { method: 'PATCH', body: { active: false }, prefer: 'return=minimal' });
    return { ok: true, announcements: await announcements() };
  }
  throw bad('Azione non riconosciuta.');
}

// ----------------------------- INGRESSO -----------------------------
module.exports = async function handler(req, res) {
  if (res.setHeader) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
  }
  const auth = await authenticate(req);
  if (auth && auth.unavailable) { res.status(503).json({ error: 'auth_unavailable', detail: 'Non riesco a verificare l\'accesso in questo momento. Riprova tra poco.' }); return; }
  if (auth && auth.forbidden) { res.status(403).json({ error: 'forbidden', detail: 'Questo account non è autorizzato ad entrare.' }); return; }
  if (!auth) { res.status(401).json({ error: 'unauthorized' }); return; }
  if (!cfg().key) { res.status(500).json({ error: 'missing_env_vars', detail: 'Manca la service key di Supabase tra le variabili d\'ambiente di Vercel.' }); return; }
  const owner = auth.role === 'owner';
  try {
    if (req.method === 'GET') {
      const view = (req.query && req.query.view) || '';
      if (view === 'feed') { res.status(200).json(await feed(req.query || {})); return; }
      if (view === 'problems') { res.status(200).json(await problemsView()); return; }
      if (view === 'system') { res.status(200).json(await systemView()); return; }
      if (view === 'push') {
        let devices = 0, table = true;
        try { const rows = await sb('admin_push_subscriptions?select=id&limit=50'); devices = (rows || []).length; } catch (e) { table = !(e && (e.status === 404 || /admin_push_subscriptions/.test(String(e.message || '')))); }
        const configured = push.isConfigured();
        res.status(200).json({ configured, key: configured ? push.publicKey() : '', table, devices });
        return;
      }
      if (view === 'home') { res.status(200).json(await homeView()); return; }
      if (view === 'announcements') { res.status(200).json(await announcements()); return; }
      if (view === 'control') { res.status(200).json(await controlView()); return; }
      res.status(400).json({ error: 'bad_view' });
      return;
    }
    if (req.method === 'POST') {
      if (!owner) { res.status(403).json({ error: 'forbidden', detail: 'Il tuo account può solo consultare, non modificare.' }); return; }
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      res.status(200).json(await act(body || {}, { actor: auth.actor }));
      return;
    }
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('admin/system error', err);
    res.status(err.validation ? 400 : 500).json({ error: 'system_error', detail: String((err && err.message) || err) });
  }
};

module.exports.shortName = shortName;
