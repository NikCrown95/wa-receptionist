// api/admin/system.js  (Prenolia: super dashboard - diretta, problemi, sistema)
//
//   GET  /api/admin/system?view=feed[&since=ISO][&business=UUID][&limit=N]  -> attivita' in diretta
//   GET  /api/admin/system?view=problems                                       -> elenco per la campanella
//   GET  /api/admin/system?view=system                                         -> credito AI, email Resend, scadenze
//   GET  /api/admin/system?view=home                                           -> numeri della Panoramica
//   POST /api/admin/system {action: set_credit | set_resend | expiry_add | expiry_update | expiry_delete, ...}
//
// Stesso accesso delle altre API admin (login vero + elenco admin_users). Le modifiche solo al titolare.
// Del testo scritto dai clienti finali NON mostro nulla: solo che qualcuno ha scritto, dove e quando.

const clients = require('./clients.js');
const health = require('../../lib/system-health.js');

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
  const ev = [];

  apps.forEach((a) => {
    const manual = a.channel === 'manuale';
    const ch = a.source && SOURCE_LABEL[a.source] ? SOURCE_LABEL[a.source] : (CHANNEL_LABEL[a.channel] || 'Prenotazione');
    ev.push({ id: 'a' + a.id, type: manual ? 'app_manual' : 'app', at: iso(a.created_at), business_id: a.business_id, business: nameOf(a.business_id),
      title: manual ? 'Appuntamento inserito' : 'Nuovo appuntamento',
      detail: shortName(a.customer_name) + ' · ' + ((a.services && a.services.name) || 'Servizio') + ' · ' + fmtWhen(a.starts_at), channel: ch });
  });
  gym.forEach((g) => {
    ev.push({ id: 'g' + g.id, type: 'app', at: iso(g.created_at), business_id: g.business_id, business: nameOf(g.business_id),
      title: 'Prenotazione lezione', detail: 'Lezione in palestra · ' + fmtWhen(g.starts_at), channel: 'Palestra' });
  });
  cancels.forEach((c) => {
    ev.push({ id: 'c' + c.id, type: 'can', at: iso(c.created_at), business_id: c.business_id, business: nameOf(c.business_id),
      title: 'Appuntamento annullato', detail: shortName(c.customer_name) + (c.service_name ? ' · ' + c.service_name : '') + (c.starts_at ? ' · ' + fmtWhen(c.starts_at) : '') });
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
  const [credit, resend, exp, down, access, subs, failed] = await Promise.all([
    soft(creditData(now), null),
    soft(resendData(now), null),
    soft(expiries(), []),
    soft(sbAll(`admin_alerts_sent?select=kind,details,sent_at&kind=eq.ai_down&sent_at=gte.${q(sinceAi)}&order=sent_at.desc`), []),
    soft(sbAll('service_access_v?select=business_id,state,grace_ends,businesses(name)&order=business_id.asc'), []),
    soft(sbAll('subscriptions?select=id,business_id,status,trial_ends_at,current_period_end,businesses(name)&status=in.(trial,active)&order=id.asc'), []),
    soft(sbAll(`stripe_events?select=id,received_at&type=eq.invoice.payment_failed&received_at=gte.${q(since7)}`), []),
  ]);
  const aiDown = [];
  const seen = {};
  (down || []).forEach((d) => {
    const st = d.details && d.details.status;
    const kind = st === 401 || st === 403 ? 'key' : st === 404 ? 'model' : 'credit';
    if (!seen[kind]) { seen[kind] = 1; aiDown.push({ kind, at: d.sent_at }); }
  });
  const problems = health.buildProblems({
    credit, resend, aiDown, expiries: exp, failedPayments: failed,
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
      if (view === 'home') { res.status(200).json(await homeView()); return; }
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
