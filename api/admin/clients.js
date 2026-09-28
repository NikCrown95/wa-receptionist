// api/admin/clients.js
//
// Elenco di TUTTE le attività (con o senza abbonamento) e creazione manuale
// di nuove attività dalla Super Dashboard.
//
//   GET  /api/admin/clients                -> { clients: [...] }
//   GET  /api/admin/clients?view=overview  -> { history, byType, planSplit } (pagina Andamento)
//   GET  /api/admin/clients?view=detail&id=UUID          -> scheda singola attivita'
//   GET  /api/admin/clients?view=conversation&id=UUID&contact=REF -> conversazione (registrata)
//   POST /api/admin/clients {action, id, ...} -> mark_paid | extend | suspend | reactivate | cancel | assign_plan
//   POST /api/admin/clients  -> crea attività + abbonamento
//        body: { name, type, plan: 'base'|'ai', status: 'active'|'trial', phone }
//
// Nessuna dipendenza: usa fetch nativo verso l'API REST di Supabase.
// Protetto dall'header x-admin-key (uguale a ADMIN_API_KEY su Vercel).
//
// Variabili d'ambiente (se i nomi nel tuo progetto sono diversi, le provo tutte):
//   SUPABASE_URL | NEXT_PUBLIC_SUPABASE_URL   (in mancanza uso l'URL del progetto "agenda")
//   SUPABASE_SERVICE_ROLE_KEY | SUPABASE_SERVICE_KEY | SUPABASE_SECRET_KEY | SUPABASE_KEY
//   ADMIN_API_KEY

const crypto = require('crypto');

const DEFAULT_URL = 'https://trtjbktdvupckyayxqli.supabase.co';

function keyOk(provided) {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected || typeof provided !== 'string') return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function cfg() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL).replace(/\/$/, '');
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_KEY;
  return { url, key };
}

async function sb(path, { method = 'GET', body, prefer, range } = {}) {
  const { url, key } = cfg();
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;
  if (range) { headers['Range-Unit'] = 'items'; headers.Range = range; }
  const resp = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await resp.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
  if (!resp.ok) {
    const err = new Error((json && (json.message || json.hint)) || text || `HTTP ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return json;
}

// Supabase restituisce al massimo 1000 righe per richiesta: scorro le pagine
// finche' ce ne sono, cosi' nessun dato viene troncato in silenzio.
async function sbAll(path) {
  const PAGE = 1000;
  let all = [];
  for (let i = 0; i < 100; i++) {
    const rows = (await sb(path, { range: `${i * PAGE}-${i * PAGE + PAGE - 1}` })) || [];
    all = all.concat(rows);
    if (rows.length < PAGE) return all;
  }
  const e = new Error('Troppi dati: superato il limite di 100.000 righe.');
  throw e;
}

const TYPE_LABEL = {
  parrucchiere: 'Parrucchiere',
  barbiere: 'Barbiere',
  estetista: 'Estetista',
  'personal trainer': 'Personal trainer',
  idraulico: 'Idraulico',
};
const typeLabel = (t) => {
  if (!t) return 'Altro';
  return TYPE_LABEL[t] || t.charAt(0).toUpperCase() + t.slice(1);
};

function nextMonthlyRenewal(startedAt, today) {
  const s = new Date(startedAt);
  let y = s.getUTCFullYear();
  let m = s.getUTCMonth();
  const day = Math.min(s.getUTCDate(), 28);
  for (let i = 0; i < 600; i++) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    const dt = new Date(Date.UTC(y, m, day));
    if (dt >= today) return dt;
  }
  return today;
}

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'attivita';
}

// Salute di un cliente: verde / giallo / rosso (na = non applicabile).
// Regole semplici e spiegabili: ogni giudizio porta con se' il motivo.
function computeHealth(x) {
  const reasons = [];
  if (x.status === 'cancelled') return { level: 'na', label: 'Annullato', reasons, upgrade: false };
  if (x.status === 'none') return { level: 'na', label: 'Senza piano', reasons, upgrade: false };

  let red = false;
  let yellow = false;
  const age = x.ageDays;

  if (x.status === 'past_due') { red = true; reasons.push('Pagamento in ritardo'); }
  if (x.serviceState === 'suspended') { red = true; reasons.push('Servizio sospeso'); }
  else if (x.serviceState === 'grace') { yellow = true; reasons.push('Abbonamento scaduto: in tolleranza'); }

  if (x.status === 'active' && age > 14) {
    if (x.lastDays === null) { red = true; reasons.push('Nessun appuntamento negli ultimi 30 giorni'); }
    else if (x.lastDays > 14) { red = true; reasons.push(`Nessun appuntamento da ${x.lastDays} giorni`); }
    else if (x.lastDays >= 8) { yellow = true; reasons.push(`Ultimo appuntamento ${x.lastDays} giorni fa`); }
  }
  if (x.status === 'trial') {
    if (x.appts30 === 0 && age > 7) { red = true; reasons.push('In prova da giorni, nessun appuntamento'); }
    if (x.trialDaysLeft !== null && x.trialDaysLeft <= 3 && x.trialDaysLeft >= 0) { yellow = true; reasons.push(`Prova in scadenza tra ${x.trialDaysLeft} giorni`); }
  }
  if (x.prev14 >= 6 && x.last14 <= x.prev14 * 0.5) {
    yellow = true;
    reasons.push(`Appuntamenti in calo (-${Math.round((1 - x.last14 / x.prev14) * 100)}%)`);
  }
  const missing = [];
  if (!x.hasServices) missing.push('servizi');
  if (!x.hasResource) missing.push('operatore');
  else if (!x.hasHours) missing.push('orari');
  if (x.plan === 'ai' && !x.hasWhatsapp) missing.push('WhatsApp collegato');
  if (missing.length) { yellow = true; reasons.push('Manca: ' + missing.join(', ')); }

  const level = red ? 'red' : yellow ? 'yellow' : 'green';
  const label = red ? 'A rischio' : yellow ? 'Da controllare' : 'In salute';
  const upgrade = x.plan === 'base' && x.status === 'active' && x.appts30 >= 20;
  return { level, label, reasons, upgrade };
}

async function listClients() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since = new Date(now.getTime() - 30 * 86400000).toISOString();

  const businesses = await sbAll(
    'businesses?select=id,name,business_type,owner_phone,owner_whatsapp,created_at,' +
      'subscriptions(status,started_at,cancelled_at,plans(name,price_eur)),' +
      'services(id),resources(id,active,opening_hours(id))' +
      '&order=created_at.desc,id.asc'
  );

  // Stato del servizio: la regola vera e' nella vista service_access_v del database.
  // Se la lettura fallisce la lista funziona lo stesso (colonna vuota), senza errori.
  const access = {};
  try {
    const rows = await sbAll('service_access_v?select=business_id,state,allowed,lia_allowed,paid_until,grace_ends&order=business_id.asc');
    rows.forEach((r) => { access[r.business_id] = r; });
  } catch (e) {
    console.error('service_access_v non leggibile:', e && e.message);
  }

  const appts = await sbAll(
    'appointments?select=business_id,starts_at&status=neq.cancelled' +
      `&starts_at=gte.${encodeURIComponent(since)}&starts_at=lte.${encodeURIComponent(now.toISOString())}` +
      '&order=id.asc'
  );
  const counts = {};
  const last14 = {};
  const prev14 = {};
  const lastAt = {};
  const t14 = now.getTime() - 14 * 86400000;
  const t28 = now.getTime() - 28 * 86400000;
  (appts || []).forEach((a) => {
    const id = a.business_id;
    const t = new Date(a.starts_at).getTime();
    counts[id] = (counts[id] || 0) + 1;
    if (t >= t14) last14[id] = (last14[id] || 0) + 1;
    else if (t >= t28) prev14[id] = (prev14[id] || 0) + 1;
    if (!lastAt[id] || t > lastAt[id]) lastAt[id] = t;
  });

  const clients = (businesses || []).map((b) => {
    const subs = (b.subscriptions || []).slice().sort((x, y) => new Date(y.started_at) - new Date(x.started_at));
    const sub = subs[0];
    let plan = null;
    let status = 'none';
    let renew = null;
    if (sub) {
      plan = sub.plans && sub.plans.name === 'Base+Lia' ? 'ai' : 'base';
      status = sub.status;
      if (status === 'cancelled') renew = new Date(sub.cancelled_at || sub.started_at);
      else if (status === 'trial') renew = new Date(new Date(sub.started_at).getTime() + 30 * 86400000);
      else renew = nextMonthlyRenewal(sub.started_at, today);
      const av = access[b.id];
      if (av && av.paid_until && status !== 'cancelled') renew = new Date(av.paid_until); // data reale salvata
    }
    const acc = access[b.id] || null;
    const activeRes = (b.resources || []).filter((r) => r.active !== false);
    const health = computeHealth({
      status,
      plan,
      serviceState: acc ? acc.state : null,
      appts30: counts[b.id] || 0,
      last14: last14[b.id] || 0,
      prev14: prev14[b.id] || 0,
      lastDays: lastAt[b.id] ? Math.floor((now.getTime() - lastAt[b.id]) / 86400000) : null,
      ageDays: sub ? Math.floor((now.getTime() - new Date(sub.started_at).getTime()) / 86400000) : 0,
      trialDaysLeft: status === 'trial' && renew ? Math.ceil((renew.getTime() - now.getTime()) / 86400000) : null,
      hasServices: (b.services || []).length > 0,
      hasResource: activeRes.length > 0,
      hasHours: activeRes.some((r) => (r.opening_hours || []).length > 0),
      hasWhatsapp: Boolean(b.owner_whatsapp),
    });
    return {
      id: b.id,
      name: b.name,
      type: typeLabel(b.business_type),
      plan,
      status,
      renew: renew ? renew.toISOString() : null,
      appts: counts[b.id] || 0,
      phone: b.owner_phone || '',
      email: '',
      health,
      service: acc ? { state: acc.state, allowed: acc.allowed, paid_until: acc.paid_until, grace_ends: acc.grace_ends } : null,
    };
  });
  return clients;
}



// ============================ SCHEDA SINGOLA ATTIVITA' ============================
const LIA_CHANNELS = ['whatsapp', 'telegram', 'web'];

function channelOfContact(c) {
  if (/^tg:/.test(c)) return 'telegram';
  if (/^web:/.test(c)) return 'web';
  return 'whatsapp';
}

// I contatti dei clienti finali si mostrano sempre mascherati.
function maskContact(c) {
  c = String(c || '');
  if (/^tg:/.test(c)) return 'Telegram ••' + c.slice(-3);
  if (/^web:/.test(c)) return 'Sito ••' + c.slice(-4);
  const digits = c.replace(/\D/g, '');
  return (c.startsWith('+') ? '+' : '') + '•••• ' + digits.slice(-3);
}

const notFound = (msg) => { const e = new Error(msg); e.notFound = true; return e; };

async function businessDetail(id) {
  if (!UUID.test(id)) throw fail('Attivita\' non valida.');
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 86400000).toISOString();
  const nowIso = now.toISOString();
  const warnings = [];
  // le parti non essenziali non devono mai far cadere l'intera scheda
  const soft = async (label, p, fallback) => {
    try { return await p; } catch (e) { warnings.push(label); console.error('detail:' + label, e && e.message); return fallback; }
  };
  const enc = encodeURIComponent;
  const apptSel = 'starts_at,status,channel,customer_name,customer_phone,services(name,price_eur)';

  const bizRows = await sb(
    `businesses?id=eq.${id}&select=id,name,slug,business_type,owner_phone,owner_whatsapp,owner_telegram_chat_id,` +
      'recap_enabled,recap_whatsapp,created_at,active,' +
      'services(id,name,duration_min,price_eur,active,at_customer_place),resources(id,name,active,opening_hours(weekday,opens,closes))'
  );
  if (!bizRows || !bizRows.length) throw notFound('Attivita\' non trovata.');
  const b = bizRows[0];

  const [subRows, acc, appts, upcoming, recent, msgs, logs] = await Promise.all([
    soft('abbonamento', sb(`subscriptions?business_id=eq.${id}&select=status,started_at,cancelled_at,trial_ends_at,courtesy_until,suspended_manually,grace_days,plans(name,price_eur)&order=started_at.desc&limit=1`), []),
    soft('stato servizio', accessRow(id), null),
    soft('appuntamenti', sbAll(`appointments?business_id=eq.${id}&starts_at=gte.${enc(since30)}&starts_at=lte.${enc(nowIso)}&select=${enc('starts_at,status,channel,services(name,price_eur)')}&order=id.asc`), []),
    soft('prossimi appuntamenti', sb(`appointments?business_id=eq.${id}&starts_at=gt.${enc(nowIso)}&status=neq.cancelled&select=${enc(apptSel)}&order=starts_at.asc&limit=8`), []),
    soft('ultimi appuntamenti', sb(`appointments?business_id=eq.${id}&starts_at=lte.${enc(nowIso)}&select=${enc(apptSel)}&order=starts_at.desc&limit=8`), []),
    soft('messaggi', sbAll(`chat_messages?business_id=eq.${id}&created_at=gte.${enc(since30)}&select=customer_phone,role,created_at&order=created_at.asc,id.asc`), []),
    soft('storico azioni', sb(`audit_logs?business_id=eq.${id}&select=at,actor,action,details&order=at.desc&limit=15`), []),
  ]);

  const sub = (subRows || [])[0] || null;
  const price = (a) => Number((a.services && a.services.price_eur) || 0);

  // ---- appuntamenti ultimi 30 giorni
  const confirmed = (appts || []).filter((a) => a.status !== 'cancelled');
  const cancelled = (appts || []).length - confirmed.length;
  const byChannel = {};
  let revenue = 0;
  let liaCount = 0;
  let liaRevenue = 0;
  confirmed.forEach((a) => {
    const ch = a.channel || 'altro';
    byChannel[ch] = (byChannel[ch] || 0) + 1;
    revenue += price(a);
    if (LIA_CHANNELS.includes(ch)) { liaCount += 1; liaRevenue += price(a); }
  });

  // ---- uso di Lia (messaggi)
  const perDay = {};
  for (let i = 29; i >= 0; i--) perDay[new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10)] = 0;
  const contacts = {};
  let fromCustomers = 0;
  let fromLia = 0;
  let lastMessageAt = null;
  (msgs || []).forEach((m) => {
    if (m.role === 'user') {
      fromCustomers += 1;
      const day = String(m.created_at).slice(0, 10);
      if (day in perDay) perDay[day] += 1;
    } else {
      fromLia += 1;
    }
    const k = m.customer_phone;
    if (!contacts[k]) contacts[k] = { count: 0, last: m.created_at, channel: channelOfContact(k) };
    contacts[k].count += 1;
    if (m.created_at > contacts[k].last) contacts[k].last = m.created_at;
    if (!lastMessageAt || m.created_at > lastMessageAt) lastMessageAt = m.created_at;
  });
  const contactKeys = Object.keys(contacts);
  const contactsByChannel = {};
  contactKeys.forEach((k) => { const ch = contacts[k].channel; contactsByChannel[ch] = (contactsByChannel[ch] || 0) + 1; });
  const conversations = contactKeys
    .map((k) => ({ ref: Buffer.from(k, 'utf8').toString('base64url'), label: maskContact(k), channel: contacts[k].channel, messages: contacts[k].count, last: contacts[k].last }))
    .sort((x, y) => (x.last < y.last ? 1 : -1))
    .slice(0, 30);

  // ---- configurazione
  const services = (b.services || []).filter((s) => s.active);
  const activeRes = (b.resources || []).filter((r) => r.active !== false);
  const hoursByDay = {};
  activeRes.forEach((r) => (r.opening_hours || []).forEach((h) => {
    (hoursByDay[h.weekday] = hoursByDay[h.weekday] || []).push(String(h.opens).slice(0, 5) + '–' + String(h.closes).slice(0, 5));
  }));
  const hours = Object.keys(hoursByDay).map(Number).sort((x, y) => x - y).map((d) => ({ weekday: d, ranges: Array.from(new Set(hoursByDay[d])).sort() }));

  const mapAppt = (a) => ({
    at: a.starts_at,
    service: (a.services && a.services.name) || '—',
    price: price(a),
    channel: a.channel || 'altro',
    status: a.status,
    customer: String(a.customer_name || '').split(' ')[0] || '—',
    phone: a.customer_phone ? maskContact(a.customer_phone) : '',
  });

  return {
    business: {
      id: b.id, name: b.name, slug: b.slug, type: typeLabel(b.business_type), created_at: b.created_at, active: b.active,
      phone: b.owner_phone || '',
    },
    subscription: sub ? {
      status: sub.status, plan: sub.plans ? sub.plans.name : null, price: sub.plans ? Number(sub.plans.price_eur) : null,
      started_at: sub.started_at, cancelled_at: sub.cancelled_at, trial_ends_at: sub.trial_ends_at,
      courtesy_until: sub.courtesy_until, suspended_manually: sub.suspended_manually, grace_days: sub.grace_days,
    } : null,
    service: acc ? { state: acc.state, allowed: acc.allowed, lia_allowed: acc.lia_allowed, paid_until: acc.paid_until, grace_ends: acc.grace_ends } : null,
    appointments30: {
      total: (appts || []).length, confirmed: confirmed.length, cancelled,
      cancel_rate: (appts || []).length ? Math.round((cancelled / appts.length) * 100) : 0,
      revenue: Math.round(revenue * 100) / 100, by_channel: byChannel,
    },
    lia30: {
      messages_from_customers: fromCustomers, messages_from_lia: fromLia, contacts: contactKeys.length,
      contacts_by_channel: contactsByChannel, bookings: liaCount, bookings_value: Math.round(liaRevenue * 100) / 100,
      per_day: Object.keys(perDay).map((d) => ({ d, n: perDay[d] })), last_message_at: lastMessageAt,
    },
    upcoming: (upcoming || []).map(mapAppt),
    recent: (recent || []).map(mapAppt),
    conversations,
    services: services.map((s) => ({ name: s.name, duration_min: s.duration_min, price: Number(s.price_eur), at_customer_place: !!s.at_customer_place })),
    hours,
    setup: {
      services: services.length > 0,
      resource: activeRes.length > 0,
      hours: hours.length > 0,
      whatsapp: Boolean(b.owner_whatsapp),
      telegram: Boolean(b.owner_telegram_chat_id),
      recap: Boolean(b.recap_enabled),
    },
    timeline: (logs || []).map((l) => ({ at: l.at, actor: l.actor, action: l.action, details: l.details || null })),
    warnings,
  };
}

// Lettura di una conversazione: dato sensibile dei clienti finali.
// Ogni apertura viene registrata; se il registro non funziona, NON si mostra nulla.
async function readConversation(id, ref) {
  if (!UUID.test(id)) throw fail('Attivita\' non valida.');
  let contact = '';
  try { contact = Buffer.from(String(ref || ''), 'base64url').toString('utf8'); } catch (e) { contact = ''; }
  if (!contact || contact.length > 120 || /[\u0000-\u001f]/.test(contact)) throw fail('Conversazione non valida.');
  try {
    await sb('audit_logs', { method: 'POST', body: { actor: 'admin', action: 'view_conversation', business_id: id, details: { contact: maskContact(contact) } } });
  } catch (e) {
    const err = new Error('Registro degli accessi non disponibile: per privacy non mostro la conversazione. Riprova tra poco.');
    throw err;
  }
  const rows = await sb(
    `chat_messages?business_id=eq.${id}&customer_phone=eq.${encodeURIComponent(contact)}&select=role,content,created_at&order=created_at.asc,id.asc`,
    { range: '0-499' }
  );
  return {
    contact: maskContact(contact),
    channel: channelOfContact(contact),
    messages: (rows || []).map((m) => ({ role: m.role, content: m.content, at: m.created_at })),
  };
}

// ============================ AZIONI ADMIN ============================
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function addMonths(date, n) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, dim));
  return d;
}

const fail = (msg) => { const e = new Error(msg); e.validation = true; return e; };

async function latestSub(businessId) {
  const rows = await sb(`subscriptions?business_id=eq.${businessId}&select=*&order=started_at.desc&limit=1`);
  return rows && rows[0] ? rows[0] : null;
}

async function accessRow(businessId) {
  const rows = await sb(`service_access_v?business_id=eq.${businessId}&select=state,allowed,lia_allowed,paid_until,grace_ends&limit=1`);
  return rows && rows[0] ? rows[0] : null;
}

async function audit(action, businessId, details) {
  try {
    await sb('audit_logs', { method: 'POST', body: { actor: 'admin', action, business_id: businessId, details } });
  } catch (e) {
    console.error('audit_logs non scritto:', e && e.message); // non deve mai bloccare l'azione
  }
}

async function patchSub(subId, fields) {
  await sb(`subscriptions?id=eq.${subId}`, { method: 'PATCH', body: fields });
}

async function planId(planKey) {
  const plans = await sb('plans?select=id,name');
  const p = (plans || []).find((x) => x.name === (planKey === 'ai' ? 'Base+Lia' : 'Base'));
  if (!p) throw new Error('Piano non trovato nella tabella plans.');
  return p.id;
}

async function runAction(body) {
  const action = String(body.action || '');
  const id = String(body.id || '');
  if (!UUID.test(id)) throw fail('Attivita\' non valida.');
  const now = new Date();
  const sub = await latestSub(id);

  if (action === 'assign_plan') {
    const planKey = body.plan === 'ai' ? 'ai' : body.plan === 'base' ? 'base' : null;
    if (!planKey) throw fail('Scegli un piano (Base o Base + Lia).');
    const pid = await planId(planKey);
    if (!sub) {
      const trial = body.status === 'trial';
      await sb('subscriptions', {
        method: 'POST',
        body: {
          business_id: id, plan_id: pid, status: trial ? 'trial' : 'active', started_at: now.toISOString(),
          current_period_end: trial ? null : addMonths(now, 1).toISOString(),
          trial_ends_at: trial ? new Date(now.getTime() + 30 * 86400000).toISOString() : null,
        },
      });
    } else {
      if (sub.status === 'cancelled') throw fail('Abbonamento annullato: usa prima "Riattiva".');
      await patchSub(sub.id, { plan_id: pid });
    }
    await audit('assign_plan', id, { plan: planKey, status: body.status || 'active' });
    return { ok: true, state: (await accessRow(id) || {}).state };
  }

  if (!sub) throw fail('Questa attivita\' non ha un abbonamento: assegna prima un piano.');

  if (action === 'mark_paid') {
    if (sub.status === 'cancelled') throw fail('Abbonamento annullato: usa "Riattiva".');
    const months = Math.min(12, Math.max(1, parseInt(body.months, 10) || 1));
    const row = await accessRow(id);
    const paid = row && row.paid_until ? new Date(row.paid_until) : null;
    // in prova o gia' scaduto: il nuovo periodo parte da oggi; se e' ancora coperto, si aggiunge in coda
    const base = sub.status !== 'trial' && paid && paid > now ? paid : now;
    const end = addMonths(base, months);
    await patchSub(sub.id, { status: 'active', current_period_end: end.toISOString(), courtesy_until: null, suspended_manually: false, suspended_at: null });
    await audit('mark_paid', id, { months, paid_until: end.toISOString() });
    return { ok: true, state: (await accessRow(id) || {}).state, paid_until: end.toISOString() };
  }

  if (action === 'extend') {
    if (sub.status === 'cancelled') throw fail('Abbonamento annullato: usa "Riattiva".');
    const days = parseInt(body.days, 10);
    if (!days || days < 1 || days > 60) throw fail('La proroga deve essere tra 1 e 60 giorni.');
    const row = await accessRow(id);
    const times = [now.getTime()];
    if (row && row.paid_until) times.push(new Date(row.paid_until).getTime());
    if (sub.courtesy_until) times.push(new Date(sub.courtesy_until).getTime());
    const until = new Date(Math.max.apply(null, times) + days * 86400000);
    await patchSub(sub.id, { courtesy_until: until.toISOString() });
    await audit('extend', id, { days, courtesy_until: until.toISOString() });
    return { ok: true, state: (await accessRow(id) || {}).state, courtesy_until: until.toISOString() };
  }

  if (action === 'suspend') {
    if (sub.status === 'cancelled') throw fail('Abbonamento gia\' annullato.');
    await patchSub(sub.id, { suspended_manually: true, suspended_at: now.toISOString() });
    await audit('suspend', id, {});
    return { ok: true, state: (await accessRow(id) || {}).state };
  }

  if (action === 'reactivate') {
    if (sub.status === 'cancelled') {
      await patchSub(sub.id, { status: 'active', cancelled_at: null, current_period_end: addMonths(now, 1).toISOString(), courtesy_until: null, suspended_manually: false, suspended_at: null });
    } else {
      await patchSub(sub.id, { suspended_manually: false, suspended_at: null });
    }
    await audit('reactivate', id, { was_cancelled: sub.status === 'cancelled' });
    const state = (await accessRow(id) || {}).state;
    return { ok: true, state, note: state === 'suspended' ? 'Ancora scaduto: segna come pagato o concedi una proroga.' : undefined };
  }

  if (action === 'cancel') {
    if (sub.status === 'cancelled') throw fail('Abbonamento gia\' annullato.');
    await patchSub(sub.id, { status: 'cancelled', cancelled_at: now.toISOString() });
    await audit('cancel', id, {});
    return { ok: true, state: (await accessRow(id) || {}).state };
  }

  throw fail('Azione non riconosciuta.');
}

async function createClient(body) {
  const name = String((body && body.name) || '').trim();
  const phone = String((body && body.phone) || '').trim();
  const KNOWN = ['parrucchiere', 'barbiere', 'estetista', 'personal trainer', 'idraulico'];
  const rawType = String((body && body.type) || '').trim().toLowerCase();
  const type = KNOWN.includes(rawType) ? rawType : 'altro';
  const planKey = body && body.plan === 'ai' ? 'ai' : 'base';
  const status = body && body.status === 'trial' ? 'trial' : 'active';
  const bad = (msg) => { const e = new Error(msg); e.validation = true; return e; };
  if (!name || !phone) throw bad('Servono almeno nome e telefono.');
  if (name.length < 2 || name.length > 80) throw bad('Il nome deve avere tra 2 e 80 caratteri.');
  if (!/^[+\d][\d\s().-]{4,29}$/.test(phone)) throw bad('Numero di telefono non valido.');
  const dup = await sb(`businesses?select=id&name=eq.${encodeURIComponent(name)}&limit=1`);
  if (dup && dup.length) throw bad('Esiste gia\' un\'attivita\' con questo nome.');

  const plans = await sb('plans?select=id,name');
  const plan = (plans || []).find((p) => p.name === (planKey === 'ai' ? 'Base+Lia' : 'Base'));
  if (!plan) {
    const e = new Error('Piano non trovato nella tabella plans.');
    e.status = 500;
    throw e;
  }

  const suffix = Math.random().toString(36).slice(2, 6);
  const created = await sb('businesses', {
    method: 'POST',
    prefer: 'return=representation',
    body: {
      name,
      slug: `${slugify(name)}-${suffix}`,
      business_type: type,
      timezone: 'Europe/Rome',
      owner_phone: phone,
      active: true,
    },
  });
  const business = Array.isArray(created) ? created[0] : created;

  try {
    await sb('subscriptions', {
      method: 'POST',
      body: { business_id: business.id, plan_id: plan.id, status, started_at: new Date().toISOString() },
    });
  } catch (err) {
    // rollback best-effort: niente attività "a metà"
    try { await sb(`businesses?id=eq.${business.id}`, { method: 'DELETE' }); } catch (e) { /* ignore */ }
    throw err;
  }
  return { ok: true, id: business.id };
}


async function overviewData() {
  const rows = await sbAll(
    'subscriptions?select=id,status,started_at,cancelled_at,plans(name,price_eur),businesses(name,business_type)&order=id.asc'
  );
  const list = rows || [];
  const monthKey = (d) => {
    const dt = new Date(d);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const mesi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const label = (key) => {
    const [y, m] = key.split('-').map(Number);
    return `${mesi[m - 1]} ${String(y).slice(2)}`;
  };
  const now = new Date();
  const months = [];
  if (list.length) {
    const first = new Date(Math.min(...list.map((r) => new Date(r.started_at))));
    let cur = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    while (cur <= last) {
      months.push(monthKey(cur));
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }
  }
  const price = (r) => Number((r.plans && r.plans.price_eur) || 0);
  const history = months.map((key) => {
    const [y, m] = key.split('-').map(Number);
    const monthEnd = new Date(Date.UTC(y, m, 1));
    const activeAtEnd = list.filter((r) => {
      const s = new Date(r.started_at);
      const c = r.cancelled_at ? new Date(r.cancelled_at) : null;
      return s < monthEnd && (!c || c >= monthEnd) && r.status !== 'trial';
    });
    return {
      m: label(key),
      new: list.filter((r) => monthKey(r.started_at) === key).length,
      lost: list.filter((r) => r.cancelled_at && monthKey(r.cancelled_at) === key).length,
      active: activeAtEnd.length,
      mrr: Math.round(activeAtEnd.reduce((s, r) => s + price(r), 0) * 100) / 100,
      base: activeAtEnd.filter((r) => r.plans && r.plans.name === 'Base').length,
      ai: activeAtEnd.filter((r) => r.plans && r.plans.name === 'Base+Lia').length,
    };
  });
  const activeNow = list.filter((r) => r.status === 'active');
  const byType = {};
  activeNow.forEach((r) => {
    const t = (r.businesses && r.businesses.business_type) || 'altro';
    byType[t] = (byType[t] || 0) + 1;
  });
  return {
    history,
    byType,
    planSplit: {
      base: activeNow.filter((r) => r.plans && r.plans.name === 'Base').length,
      ai: activeNow.filter((r) => r.plans && r.plans.name === 'Base+Lia').length,
    },
  };
}

module.exports = async function handler(req, res) {
  if (!keyOk(req.headers['x-admin-key'])) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  const { key } = cfg();
  if (!key) {
    res.status(500).json({
      error: 'missing_env_vars',
      detail: 'Manca la service key di Supabase tra le variabili d\'ambiente di Vercel (SUPABASE_SERVICE_ROLE_KEY).',
    });
    return;
  }

  try {
    if (req.method === 'GET') {
      if (req.query && req.query.view === 'overview') {
        res.status(200).json(await overviewData());
        return;
      }
      if (req.query && req.query.view === 'detail') {
        res.status(200).json(await businessDetail(String(req.query.id || '')));
        return;
      }
      if (req.query && req.query.view === 'conversation') {
        res.status(200).json(await readConversation(String(req.query.id || ''), String(req.query.contact || '')));
        return;
      }
      res.status(200).json({ clients: await listClients() });
      return;
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      if (body && body.action) {
        res.status(200).json(await runAction(body));
        return;
      }
      res.status(201).json(await createClient(body || {}));
      return;
    }
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('admin/clients error', err);
    res.status(err.validation ? 400 : err.notFound ? 404 : 500).json({
      error: 'clients_error',
      detail: String((err && err.message) || err),
    });
  }
};

module.exports.computeHealth = computeHealth;
