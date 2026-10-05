// api/admin/clients.js
//
// Elenco di TUTTE le attività (con o senza abbonamento) e creazione manuale
// di nuove attività dalla Super Dashboard.
//
//   GET  /api/admin/clients                -> { clients: [...] }
//   GET  /api/admin/clients?view=overview  -> { history, byType, planSplit } (pagina Andamento)
//   GET  /api/admin/clients?view=margin                  -> costi AI e margine per cliente
//   POST /api/admin/clients {action:'set_setting'|'set_price', ...} -> cambio, spese fisse, listino
//   GET  /api/admin/clients?view=money                   -> soldi: MRR, movimento, rinnovi, incasso a rischio
//   GET  /api/admin/clients?view=lia                     -> uso di Lia su tutte le attivita'
//   GET  /api/admin/clients?view=detail&id=UUID          -> scheda singola attivita'
//   GET  /api/admin/clients?view=conversation&id=UUID&contact=REF -> conversazione (registrata)
//   POST /api/admin/clients {action, id, ...} -> mark_paid | extend | suspend | reactivate | cancel | assign_plan
//   POST /api/admin/clients  -> crea attività + abbonamento
//        body: { name, type, plan: 'base'|'ai', status: 'active'|'trial', phone }
//
// Nessuna dipendenza: usa fetch nativo verso l'API REST di Supabase.
// Accesso: login vero (token di Supabase Auth + elenco admin_users con ruolo owner/support).
// Fino a quando esiste ADMIN_API_KEY su Vercel, vale anche la vecchia chiave (header x-admin-key):
// e' l'uscita di emergenza. Per chiuderla basta cancellare la variabile ADMIN_API_KEY.
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


// ============================ ACCESSO ============================
const authCache = new Map();
const AUTH_CACHE_MS = 60 * 1000;

// Restituisce: { actor, role } se puo' entrare; { forbidden, email } se il login e' valido ma l'account
// non e' autorizzato; { unavailable } se non si riesce a verificare (si nega: mai aprire per errore); null se non valido.
async function authFromToken(token) {
  if (!token || token.length > 4000) return null;
  const hit = authCache.get(token);
  if (hit && Date.now() - hit.at < AUTH_CACHE_MS) return hit.value;
  const { url, key } = cfg();
  if (!key) return { unavailable: true };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  let user;
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, signal: ctrl.signal });
    if (r.status === 401 || r.status === 403) return null;
    if (!r.ok) return { unavailable: true };
    user = await r.json();
  } catch (e) {
    return { unavailable: true };
  } finally {
    clearTimeout(timer);
  }
  const email = String((user && user.email) || '').toLowerCase();
  if (!email || !(user.email_confirmed_at || user.confirmed_at)) return null;
  let rows;
  try {
    rows = await sb(`admin_users?email=eq.${encodeURIComponent(email)}&active=eq.true&select=role&limit=1`);
  } catch (e) {
    return { unavailable: true };
  }
  if (!rows || !rows.length) return { forbidden: true, email };
  const value = { actor: email, role: rows[0].role === 'owner' ? 'owner' : 'support', via: 'login' };
  if (authCache.size > 200) authCache.clear();
  authCache.set(token, { at: Date.now(), value });
  return value;
}

async function authenticate(req) {
  const h = (req && req.headers) || {};
  const bearer = /^Bearer\s+(.+)$/i.exec(String(h.authorization || ''));
  if (bearer) return authFromToken(bearer[1].trim());
  if (keyOk(h['x-admin-key'])) return { actor: 'chiave-admin', role: 'owner', via: 'key' };
  return null;
}
function authCacheClear() { authCache.clear(); }

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
async function readConversation(id, ref, ctx) {
  if (!UUID.test(id)) throw fail('Attivita\' non valida.');
  let contact = '';
  try { contact = Buffer.from(String(ref || ''), 'base64url').toString('utf8'); } catch (e) { contact = ''; }
  if (!contact || contact.length > 120 || /[\u0000-\u001f]/.test(contact)) throw fail('Conversazione non valida.');
  try {
    await sb('audit_logs', { method: 'POST', body: { actor: (ctx && ctx.actor) || 'admin', action: 'view_conversation', business_id: id, details: { contact: maskContact(contact) } } });
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


// ============================ USO DI LIA (tutte le attivita') ============================
// I conteggi pesanti li fa il database (viste lia_*_v): qui arrivano righe gia' aggregate.
async function liaOverview() {
  const now = new Date();
  const warnings = [];
  const soft = async (label, p, fallback) => {
    try { return await p; } catch (e) { warnings.push(label); console.error('lia:' + label, e && e.message); return fallback; }
  };
  const [biz, access, usage, daily, heat, bookings] = await Promise.all([
    sbAll('businesses?select=id,name,business_type,subscriptions(status,started_at,plans(name))&order=id.asc'),
    soft('stato servizio', sbAll('service_access_v?select=business_id,state,allowed,lia_allowed,plan_name&order=business_id.asc'), []),
    soft('uso per attivita', sbAll('lia_usage_v?select=*&order=business_id.asc'), []),
    soft('messaggi al giorno', sbAll('lia_daily_v?select=*&order=day.asc,channel.asc'), []),
    soft('orari di punta', sbAll('lia_heat_v?select=*&order=dow.asc,hour.asc'), []),
    soft('prenotazioni', sbAll('lia_bookings_v?select=*&order=business_id.asc,channel.asc'), []),
  ]);

  const accMap = {}; (access || []).forEach((a) => { accMap[a.business_id] = a; });
  const useMap = {}; (usage || []).forEach((u) => { useMap[u.business_id] = u; });
  const bk = {}; // per attivita': { lia: {n, v, nPrev, vPrev}, all: {...} }
  const byChannelBookings = {};
  let allN = 0, allV = 0, liaN = 0, liaV = 0, liaNPrev = 0, liaVPrev = 0;
  (bookings || []).forEach((r) => {
    const n = Number(r.bookings) || 0, v = Number(r.value) || 0, np = Number(r.bookings_prev) || 0, vp = Number(r.value_prev) || 0;
    const e = (bk[r.business_id] = bk[r.business_id] || { lia_n: 0, lia_v: 0, lia_np: 0, lia_vp: 0 });
    byChannelBookings[r.channel] = (byChannelBookings[r.channel] || 0) + n;
    allN += n; allV += v;
    if (LIA_CHANNELS.includes(r.channel)) { e.lia_n += n; e.lia_v += v; e.lia_np += np; e.lia_vp += vp; liaN += n; liaV += v; liaNPrev += np; liaVPrev += vp; }
  });

  // messaggi per giorno e canale (30 giorni sempre presenti)
  const dayMap = {};
  for (let i = 29; i >= 0; i--) dayMap[new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10)] = { whatsapp: 0, telegram: 0, web: 0 };
  const msgByChannel = { whatsapp: 0, telegram: 0, web: 0 };
  (daily || []).forEach((r) => {
    const d = String(r.day).slice(0, 10);
    const n = Number(r.user_msgs) || 0;
    if (!dayMap[d] || dayMap[d][r.channel] === undefined) return; // fuori dai 30 giorni: ignorato ovunque
    dayMap[d][r.channel] += n;
    msgByChannel[r.channel] += n;
  });
  const per_day = Object.keys(dayMap).map((d) => ({ d, whatsapp: dayMap[d].whatsapp, telegram: dayMap[d].telegram, web: dayMap[d].web }));

  // mappa di calore 7 giorni x 24 ore
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0));
  (heat || []).forEach((r) => {
    const d = Number(r.dow) - 1, h = Number(r.hour);
    if (d >= 0 && d < 7 && h >= 0 && h < 24) matrix[d][h] += Number(r.n) || 0;
  });

  // classifica e "pagano Lia ma non la usano"
  let msgs = 0, msgsPrev = 0, msgsLia = 0, contacts = 0;
  const rows = [];
  const idle = [];
  let withLia = 0, usingLia = 0;
  (biz || []).forEach((b) => {
    const subs = (b.subscriptions || []).slice().sort((x, y) => new Date(y.started_at) - new Date(x.started_at));
    const sub = subs[0];
    const planName = sub && sub.plans ? sub.plans.name : null;
    const acc = accMap[b.id] || null;
    const u = useMap[b.id] || { user_msgs: 0, lia_msgs: 0, contacts: 0, user_msgs_prev: 0 };
    const um = Number(u.user_msgs) || 0, up = Number(u.user_msgs_prev) || 0;
    msgs += um; msgsPrev += up; msgsLia += Number(u.lia_msgs) || 0; contacts += Number(u.contacts) || 0;
    const e = bk[b.id] || { lia_n: 0, lia_v: 0 };
    const hasLiaPlan = planName === 'Base+Lia' && sub && sub.status !== 'cancelled' && (!acc || acc.lia_allowed !== false);
    if (hasLiaPlan) { withLia += 1; if (um > 0) usingLia += 1; else idle.push({ id: b.id, name: b.name, type: typeLabel(b.business_type), state: acc ? acc.state : null }); }
    if (um > 0 || e.lia_n > 0) {
      rows.push({
        id: b.id, name: b.name, type: typeLabel(b.business_type),
        plan: planName === 'Base+Lia' ? 'ai' : planName === 'Base' ? 'base' : null,
        messages: um, contacts: Number(u.contacts) || 0, bookings: e.lia_n, value: Math.round(e.lia_v * 100) / 100,
        trend: up > 0 ? Math.round(((um - up) / up) * 100) : null,
      });
    }
  });
  rows.sort((x, y) => y.messages - x.messages || y.bookings - x.bookings);

  const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
  return {
    totals: {
      messages: msgs, messages_prev: msgsPrev, messages_trend: pct(msgs, msgsPrev), lia_replies: msgsLia, contacts,
      bookings: liaN, bookings_value: Math.round(liaV * 100) / 100, bookings_trend: pct(liaN, liaNPrev), value_trend: pct(liaV, liaVPrev),
      all_bookings: allN, all_value: Math.round(allV * 100) / 100,
      share_pct: allN ? Math.round((liaN / allN) * 100) : 0,
      businesses_with_lia: withLia, businesses_using_lia: usingLia,
    },
    per_day, messages_by_channel: msgByChannel, bookings_by_channel: byChannelBookings, heat: matrix,
    ranking: rows.slice(0, 10), idle, warnings,
  };
}


// ============================ SOLDI ============================
// Movimento dell'incasso mensile ricostruito da eventi: nuovi, upgrade, downgrade, persi, riattivati.
// Le date/importi storici vengono dalle colonne dell'abbonamento; dal momento in cui si usano i pulsanti
// (cambio piano, annulla, riattiva) ogni evento e' registrato con i prezzi e conta con precisione.
function buildMrrEvents(subs, logs) {
  const evByBiz = {};
  (logs || []).forEach((l) => { (evByBiz[l.business_id] = evByBiz[l.business_id] || []).push(l); });
  const events = [];
  (subs || []).forEach((s) => {
    if (s.status === 'trial') return; // in prova adesso: non e' incasso, qualunque sia lo storico
    const ev = (evByBiz[s.business_id] || []).slice().sort((a, b) => new Date(a.at) - new Date(b.at));
    const curPrice = Number((s.plans && s.plans.price_eur) || 0);
    const d = (l) => l.details || {};
    const created = ev.find((l) => l.action === 'assign_plan' && d(l).was_new);
    const changes = ev.filter((l) => l.action === 'assign_plan' && !d(l).was_new && d(l).from_price != null && d(l).to_price != null);
    const conv = ev.find((l) => l.action === 'mark_paid' && d(l).was_trial);
    let p = changes.length ? Number(d(changes[0]).from_price) : (created && d(created).to_price != null && !d(created).from_price ? Number(d(created).to_price) : curPrice);
    if (created && d(created).to_price != null && !changes.length) p = Number(d(created).to_price);

    let startT = new Date(s.started_at);
    const startedAsTrial = created && d(created).status === 'trial';
    if (startedAsTrial) {
      if (conv) startT = new Date(conv.at);
      else if (s.status === 'trial') startT = null; // ancora in prova: non e' incasso
    }
    if (!startT) return;
    events.push({ t: startT, type: 'new', amount: p });

    const items = [];
    changes.forEach((l) => items.push({ t: new Date(l.at), kind: 'change', from: Number(d(l).from_price), to: Number(d(l).to_price) }));
    const cancels = ev.filter((l) => l.action === 'cancel');
    cancels.forEach((l) => items.push({ t: new Date(l.at), kind: 'cancel', price: d(l).price }));
    ev.filter((l) => l.action === 'reactivate' && d(l).was_cancelled).forEach((l) => items.push({ t: new Date(l.at), kind: 'react', price: d(l).price }));
    if (s.status === 'cancelled' && s.cancelled_at) {
      const ct = new Date(s.cancelled_at).getTime();
      if (!cancels.some((l) => Math.abs(new Date(l.at).getTime() - ct) < 120000)) items.push({ t: new Date(s.cancelled_at), kind: 'cancel', price: null });
    }
    items.sort((a, b) => a.t - b.t);
    let active = true;
    items.forEach((it) => {
      if (it.t < startT) return;
      if (it.kind === 'change') {
        if (active) { const delta = it.to - it.from; if (delta > 0) events.push({ t: it.t, type: 'expansion', amount: delta }); else if (delta < 0) events.push({ t: it.t, type: 'contraction', amount: -delta }); }
        p = it.to;
      } else if (it.kind === 'cancel') {
        if (active) { events.push({ t: it.t, type: 'churn', amount: it.price != null ? Number(it.price) : p }); active = false; }
      } else if (it.kind === 'react') {
        if (!active) { events.push({ t: it.t, type: 'reactivation', amount: it.price != null ? Number(it.price) : p }); active = true; }
      }
    });
  });
  return events;
}

function monthlyMovement(events, now, months) {
  const key = (t) => `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
  const mesi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const keys = [];
  let cur = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  for (let i = 0; i < months; i++) { keys.push(key(cur)); cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1)); }
  const firstKey = keys[0];
  const rows = {};
  keys.forEach((k) => { rows[k] = { new: 0, expansion: 0, contraction: 0, churn: 0, reactivation: 0, new_n: 0, churn_n: 0, react_n: 0 }; });
  let base = 0, baseN = 0;
  events.slice().sort((a, b) => a.t - b.t).forEach((e) => {
    const k = key(e.t);
    if (k < firstKey) {
      if (e.type === 'new' || e.type === 'expansion' || e.type === 'reactivation') base += e.amount; else base -= e.amount;
      if (e.type === 'new' || e.type === 'reactivation') baseN += 1; else if (e.type === 'churn') baseN -= 1;
    } else if (rows[k]) {
      rows[k][e.type] += e.amount;
      if (e.type === 'new') rows[k].new_n += 1; else if (e.type === 'churn') rows[k].churn_n += 1; else if (e.type === 'reactivation') rows[k].react_n += 1;
    }
  });
  let run = base, runN = baseN;
  return keys.map((k) => {
    const r = rows[k];
    const start = run, startN = runN;
    run = start + r.new + r.expansion + r.reactivation - r.contraction - r.churn;
    runN = startN + r.new_n + r.react_n - r.churn_n;
    const round = (x) => Math.round(x * 100) / 100;
    const [y, m] = k.split('-').map(Number);
    return { m: `${mesi[m - 1]} ${String(y).slice(2)}`, key: k, start: round(start), new: round(r.new), expansion: round(r.expansion), contraction: round(r.contraction), churn: round(r.churn), reactivation: round(r.reactivation), end: round(run), start_n: startN, new_n: r.new_n, churn_n: r.churn_n, end_n: runN };
  });
}

async function moneyOverview() {
  const now = new Date();
  const warnings = [];
  const soft = async (label, p, fallback) => {
    try { return await p; } catch (e) { warnings.push(label); console.error('money:' + label, e && e.message); return fallback; }
  };
  const [clients, subs, plans, logs] = await Promise.all([
    listClients(),
    sbAll('subscriptions?select=id,business_id,status,started_at,cancelled_at,plans(name,price_eur)&order=id.asc'),
    sb('plans?select=name,price_eur'),
    soft('storico azioni', sbAll('audit_logs?select=at,action,business_id,details&action=in.(assign_plan,cancel,reactivate,mark_paid)&order=at.asc,id.asc'), []),
  ]);
  const priceByKey = { base: 0, ai: 0 };
  (plans || []).forEach((p) => { if (p.name === 'Base') priceByKey.base = Number(p.price_eur); if (p.name === 'Base+Lia') priceByKey.ai = Number(p.price_eur); });
  const round = (x) => Math.round(x * 100) / 100;
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);

  // ---- chi paga adesso
  const price = (c) => (c.plan ? priceByKey[c.plan] || 0 : 0);
  const paying = clients.filter((c) => c.status === 'active' && c.plan && (!c.service || c.service.state === 'active' || c.service.state === 'grace'));
  const mrr = paying.reduce((s, c) => s + price(c), 0);
  const mrrBase = paying.filter((c) => c.plan === 'base').reduce((s, c) => s + price(c), 0);
  const mrrAi = paying.filter((c) => c.plan === 'ai').reduce((s, c) => s + price(c), 0);
  const byType = {};
  paying.forEach((c) => { byType[c.type] = round((byType[c.type] || 0) + price(c)); });

  // ---- movimento mensile (12 mesi)
  const events = buildMrrEvents(subs, logs);
  const movement = monthlyMovement(events, now, 12);
  const last = movement[movement.length - 1];
  const prevFull = movement.length > 1 ? movement[movement.length - 2] : null;
  const subsActiveSum = (subs || []).filter((s) => s.status === 'active').reduce((sum, s) => sum + Number((s.plans && s.plans.price_eur) || 0), 0);
  const reconciles = Math.abs(last.end - subsActiveSum) < 0.01;
  if (!reconciles) warnings.push('movimento non quadra con gli abbonamenti attivi');
  const win6 = movement.slice(-7, -1); // ultimi 6 mesi completi
  const churnN6 = win6.reduce((s, r) => s + r.churn_n, 0);
  const startN6 = win6.reduce((s, r) => s + r.start_n, 0);
  const churnLogo6 = startN6 > 0 ? churnN6 / startN6 : null;
  const arpa = paying.length ? mrr / paying.length : 0;

  // ---- rinnovi
  const t7 = now.getTime() + 7 * 86400000, t30 = now.getTime() + 30 * 86400000, t45 = now.getTime() + 45 * 86400000;
  const items = clients
    .filter((c) => c.plan && (c.status === 'active' || c.status === 'trial') && c.renew)
    .map((c) => ({ date: c.renew, id: c.id, name: c.name, plan: c.plan, amount: price(c), state: c.service ? c.service.state : null, kind: c.status === 'trial' ? 'conversione' : 'rinnovo' }));
  const overdue = items.filter((i) => new Date(i.date).getTime() < now.getTime() && (i.state === 'grace' || i.state === 'suspended')).sort((a, b) => new Date(a.date) - new Date(b.date));
  const upcoming = items.filter((i) => { const t = new Date(i.date).getTime(); return t >= now.getTime() && t <= t45; }).sort((a, b) => new Date(a.date) - new Date(b.date));
  const sum = (arr, f) => arr.filter(f).reduce((s, i) => s + i.amount, 0);
  const cnt = (arr, f) => arr.filter(f).length;
  // "prossimi giorni" = da adesso in avanti: gli scaduti stanno a parte (overdue)
  const inRange = (i, end) => { const t = new Date(i.date).getTime(); return t >= now.getTime() && t <= end; };
  const renew7 = (i) => i.kind === 'rinnovo' && inRange(i, t7);
  const renew30 = (i) => i.kind === 'rinnovo' && inRange(i, t30);
  const conv14 = (i) => i.kind === 'conversione' && inRange(i, now.getTime() + 14 * 86400000);

  // ---- incasso a rischio
  const graceList = paying.filter((c) => c.service && c.service.state === 'grace');
  const redList = paying.filter((c) => c.health && c.health.level === 'red');
  const atRiskMap = {};
  graceList.forEach((c) => { atRiskMap[c.id] = { id: c.id, name: c.name, amount: price(c), reasons: ['Abbonamento scaduto: in tolleranza'] }; });
  redList.forEach((c) => { const e = atRiskMap[c.id] || (atRiskMap[c.id] = { id: c.id, name: c.name, amount: price(c), reasons: [] }); (c.health.reasons || []).forEach((r) => { if (!e.reasons.includes(r)) e.reasons.push(r); }); });
  const atRisk = Object.keys(atRiskMap).map((k) => atRiskMap[k]).sort((a, b) => b.amount - a.amount);
  const suspended = clients.filter((c) => c.status === 'active' && c.plan && c.service && c.service.state === 'suspended');

  return {
    kpis: {
      mrr: round(mrr), arr: round(mrr * 12), paying: paying.length, arpa: round(arpa),
      mrr_base: round(mrrBase), mrr_ai: round(mrrAi), ai_share_pct: mrr ? Math.round((mrrAi / mrr) * 100) : 0,
      growth_pct: prevFull && prevFull.end > 0 ? pct(last.end - prevFull.end, prevFull.end) : null,
      churn_rev_pct: prevFull ? pct(prevFull.churn, prevFull.start) : null,
      churn_logo_pct: prevFull ? pct(prevFull.churn_n, prevFull.start_n) : null,
      nrr_pct: prevFull && prevFull.start > 0 ? pct(prevFull.start + prevFull.expansion - prevFull.contraction - prevFull.churn, prevFull.start) : null,
      ltv_estimate: churnLogo6 && churnLogo6 > 0 ? Math.round(arpa / churnLogo6) : null,
      prev_month_label: prevFull ? prevFull.m : null,
    },
    movement,
    reconciles,
    by_type: byType,
    renewals: {
      next7: { count: cnt(items, renew7), amount: round(sum(items, renew7)) },
      next30: { count: cnt(items, renew30), amount: round(sum(items, renew30)) },
      trials14: { count: cnt(items, conv14), amount: round(sum(items, conv14)) },
      overdue, upcoming,
    },
    at_risk: {
      grace: { count: graceList.length, amount: round(graceList.reduce((s, c) => s + price(c), 0)) },
      unhealthy: { count: redList.length, amount: round(redList.reduce((s, c) => s + price(c), 0)) },
      total: { count: atRisk.length, amount: round(atRisk.reduce((s, e) => s + e.amount, 0)) },
      suspended: { count: suspended.length, amount: round(suspended.reduce((s, c) => s + price(c), 0)) },
      list: atRisk.slice(0, 10),
    },
    warnings,
  };
}


// ============================ COSTI E MARGINE ============================
// Margine per cliente = incasso del cliente - costo AI (30 giorni) - costo messaggi.
// Le spese fisse (Vercel, Supabase...) pesano sull'azienda, non sul singolo cliente.
async function marginOverview() {
  const now = new Date();
  const warnings = [];
  const soft = async (label, p, fallback) => {
    try { return await p; } catch (e) { warnings.push(label); console.error('margin:' + label, e && e.message); return fallback; }
  };
  const [clients, plans, costRows, daily, models, msgRows, settings, prices, first] = await Promise.all([
    listClients(),
    sb('plans?select=name,price_eur'),
    soft('costi AI per attivita', sbAll('ai_cost_business_v?select=*&order=business_id.asc'), []),
    soft('costi AI al giorno', sbAll('ai_cost_daily_v?select=*&order=day.asc'), []),
    soft('costi AI per modello', sbAll('ai_cost_model_v?select=*&order=model.asc'), []),
    soft('messaggi per canale', sbAll('lia_msgs_channel_v?select=*&order=business_id.asc,channel.asc'), []),
    soft('impostazioni costi', sb('cost_settings?select=key,label,value,updated_at,set_by_user&order=key.asc'), []),
    soft('listino prezzi', sb('ai_prices?select=*&order=model.asc'), []),
    soft('primo utilizzo', sb('ai_usage?select=at&order=at.asc&limit=1'), []),
  ]);
  const round = (x, d = 2) => { const f = Math.pow(10, d); return Math.round(x * f) / f; };
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  const priceByKey = { base: 0, ai: 0 };
  (plans || []).forEach((p) => { if (p.name === 'Base') priceByKey.base = Number(p.price_eur); if (p.name === 'Base+Lia') priceByKey.ai = Number(p.price_eur); });
  const set = {}; (settings || []).forEach((s) => { set[s.key] = s; });
  const val = (k) => (set[k] ? Number(set[k].value) : 0);

  const aiBy = {}; (costRows || []).forEach((r) => { aiBy[r.business_id] = r; });
  const msgCost = {}; const msgCount = {};
  let waMsgs = 0, userMsgs = 0;
  (msgRows || []).forEach((r) => {
    const n = (Number(r.user_msgs) || 0) + (Number(r.lia_msgs) || 0);
    msgCount[r.business_id] = (msgCount[r.business_id] || 0) + n;
    msgCost[r.business_id] = (msgCost[r.business_id] || 0) + n * val('msg_eur_' + r.channel);
    userMsgs += Number(r.user_msgs) || 0;
    if (r.channel === 'whatsapp') waMsgs += n;
  });

  const rows = [];
  let mrr = 0, aiTotal = 0, msgTotal = 0, calls = 0;
  (costRows || []).forEach((r) => { aiTotal += Number(r.cost_eur) || 0; calls += Number(r.calls) || 0; });
  Object.keys(msgCost).forEach((k) => { msgTotal += msgCost[k]; });
  clients.forEach((c) => {
    const paying = c.status === 'active' && c.plan && (!c.service || c.service.state === 'active' || c.service.state === 'grace');
    const revenue = paying ? priceByKey[c.plan] || 0 : 0;
    mrr += revenue;
    const ai = aiBy[c.id] ? Number(aiBy[c.id].cost_eur) || 0 : 0;
    const msg = msgCost[c.id] || 0;
    if (!revenue && !ai && !msg) return;
    const cost = ai + msg;
    rows.push({
      id: c.id, name: c.name, type: c.type, plan: c.plan, paying: !!paying, revenue: round(revenue),
      ai_cost: round(ai, 4), msg_cost: round(msg, 4), cost: round(cost, 4), margin: round(revenue - cost),
      margin_pct: revenue > 0 ? pct(revenue - cost, revenue) : null,
      calls: aiBy[c.id] ? Number(aiBy[c.id].calls) || 0 : 0, messages: msgCount[c.id] || 0,
    });
  });
  rows.sort((a, b) => a.margin - b.margin || a.name.localeCompare(b.name));

  const fixedKeys = ['fixed_vercel', 'fixed_supabase', 'fixed_twilio', 'fixed_other'];
  const fixed = fixedKeys.reduce((s, k) => s + val(k), 0);
  const variable = aiTotal + msgTotal;
  const liaPaying = rows.filter((r) => r.paying && r.plan === 'ai');
  const liaAvgCost = liaPaying.length ? liaPaying.reduce((s, r) => s + r.cost, 0) / liaPaying.length : null;

  const unpricedModels = (models || []).filter((m) => m.priced === false).map((m) => ({ model: m.model, calls: Number(m.calls) || 0 }));
  const firstAt = first && first[0] ? first[0].at : null;
  const todo = [];
  if (!firstAt) todo.push('Nessun costo AI registrato finora: il conteggio parte da quando carichi la modifica al backend.');
  if (unpricedModels.length) todo.push('Manca il prezzo di questi modelli: ' + unpricedModels.map((m) => m.model).join(', ') + '.');
  if (waMsgs > 0 && val('msg_eur_whatsapp') === 0 && !(set.msg_eur_whatsapp && set.msg_eur_whatsapp.set_by_user)) todo.push('Imposta quanto costa un messaggio WhatsApp: ora è contato a zero.');
  if (set.usd_eur && !set.usd_eur.set_by_user) todo.push('Controlla il cambio dollaro/euro: è un valore di partenza.');
  if (set.fixed_supabase && Number(set.fixed_supabase.value) === 0 && !set.fixed_supabase.set_by_user) todo.push('Inserisci quanto paghi Supabase al mese (0 se è gratis).');

  return {
    totals: {
      mrr: round(mrr), ai_cost: round(aiTotal, 4), msg_cost: round(msgTotal, 4), variable_cost: round(variable, 4), fixed_cost: round(fixed),
      net: round(mrr - variable - fixed), net_margin_pct: pct(mrr - variable - fixed, mrr), variable_margin_pct: pct(mrr - variable, mrr),
      calls, user_msgs: userMsgs, ai_cost_per_msg: userMsgs > 0 ? round(aiTotal / userMsgs, 5) : null,
      lia_clients: liaPaying.length, lia_avg_cost: liaAvgCost != null ? round(liaAvgCost, 4) : null,
      lia_avg_margin: liaAvgCost != null ? round(priceByKey.ai - liaAvgCost) : null, lia_price: priceByKey.ai,
      losing: rows.filter((r) => r.margin < 0).length,
    },
    clients: rows.slice(0, 20),
    clients_total: rows.length,
    per_day: (daily || []).map((d) => ({ d: String(d.day).slice(0, 10), cost: round(Number(d.cost_eur) || 0, 4), calls: Number(d.calls) || 0 })),
    by_model: (models || []).map((m) => ({ model: m.model, priced: m.priced !== false, calls: Number(m.calls) || 0, cost: round(Number(m.cost_eur) || 0, 4), tokens_in: Number(m.tokens_in) || 0, tokens_out: Number(m.tokens_out) || 0 })),
    settings: (settings || []).map((s) => ({ key: s.key, label: s.label, value: Number(s.value), updated_at: s.updated_at, set_by_user: !!s.set_by_user })),
    prices: (prices || []).map((p) => ({ model: p.model, input: Number(p.input_per_mtok), output: Number(p.output_per_mtok), cache_write: Number(p.cache_write_per_mtok), cache_read: Number(p.cache_read_per_mtok) })),
    tracking: { started_at: firstAt, has_data: !!firstAt },
    todo, warnings,
  };
}

// Modifica di cambio, costi fissi, costo messaggi e listino prezzi (con registro delle modifiche)
async function runSettingsAction(body, ctx) {
  const action = String(body.action);
  const num = (v, label, max) => {
    const n = Number(String(v).replace(',', '.'));
    if (!Number.isFinite(n) || n < 0 || n > max) throw fail(label + ' non è valido (serve un numero tra 0 e ' + max + ').');
    return n;
  };
  if (action === 'set_setting') {
    const key = String(body.key || '');
    if (!/^[a-z_]{3,40}$/.test(key)) throw fail('Impostazione non valida.');
    const cur = await sb(`cost_settings?key=eq.${encodeURIComponent(key)}&select=key,value`);
    if (!cur || !cur.length) throw fail('Impostazione sconosciuta.');
    const value = num(body.value, 'Il valore', key === 'usd_eur' ? 10 : 100000);
    if (key === 'usd_eur' && value === 0) throw fail('Il cambio non può essere zero.');
    await sb(`cost_settings?key=eq.${encodeURIComponent(key)}`, { method: 'PATCH', body: { value, updated_at: new Date().toISOString(), set_by_user: true } });
    await audit('set_setting', null, { key, from: Number(cur[0].value), to: value }, ctx && ctx.actor);
    return { ok: true };
  }
  if (action === 'set_price') {
    const model = String(body.model || '').trim();
    if (!/^[A-Za-z0-9._-]{3,80}$/.test(model)) throw fail('Nome del modello non valido.');
    const row = {
      model, updated_at: new Date().toISOString(),
      input_per_mtok: num(body.input, 'Il prezzo di input', 1000), output_per_mtok: num(body.output, 'Il prezzo di output', 1000),
      cache_write_per_mtok: num(body.cache_write == null ? 0 : body.cache_write, 'Il prezzo di scrittura cache', 1000),
      cache_read_per_mtok: num(body.cache_read == null ? 0 : body.cache_read, 'Il prezzo di lettura cache', 1000),
    };
    await sb('ai_prices?on_conflict=model', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: row });
    await audit('set_price', null, { model, input: row.input_per_mtok, output: row.output_per_mtok }, ctx && ctx.actor);
    return { ok: true };
  }
  throw fail('Azione non riconosciuta.');
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
  const rows = await sb(`subscriptions?business_id=eq.${businessId}&select=*,plans(name,price_eur)&order=started_at.desc&limit=1`);
  return rows && rows[0] ? rows[0] : null;
}

async function accessRow(businessId) {
  const rows = await sb(`service_access_v?business_id=eq.${businessId}&select=state,allowed,lia_allowed,paid_until,grace_ends&limit=1`);
  return rows && rows[0] ? rows[0] : null;
}

async function audit(action, businessId, details, actor) {
  try {
    await sb('audit_logs', { method: 'POST', body: { actor: actor || 'admin', action, business_id: businessId, details } });
  } catch (e) {
    console.error('audit_logs non scritto:', e && e.message); // non deve mai bloccare l'azione
  }
}

async function patchSub(subId, fields) {
  await sb(`subscriptions?id=eq.${subId}`, { method: 'PATCH', body: fields });
}

async function planInfo(planKey) {
  const plans = await sb('plans?select=id,name,price_eur');
  const p = (plans || []).find((x) => x.name === (planKey === 'ai' ? 'Base+Lia' : 'Base'));
  if (!p) throw new Error('Piano non trovato nella tabella plans.');
  return { id: p.id, name: p.name, price: Number(p.price_eur) };
}
const subPrice = (sub) => Number((sub && sub.plans && sub.plans.price_eur) || 0);

async function runAction(body, ctx) {
  const action = String(body.action || '');
  const id = String(body.id || '');
  if (!UUID.test(id)) throw fail('Attivita\' non valida.');
  const now = new Date();
  const sub = await latestSub(id);

  if (action === 'assign_plan') {
    const planKey = body.plan === 'ai' ? 'ai' : body.plan === 'base' ? 'base' : null;
    if (!planKey) throw fail('Scegli un piano (Base o Base + Lia).');
    const plan = await planInfo(planKey);
    const pid = plan.id;
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
    await audit('assign_plan', id, {
      plan: planKey, status: body.status || 'active', was_new: !sub,
      from_plan: sub && sub.plans ? sub.plans.name : null, from_price: sub ? subPrice(sub) : null,
      to_plan: plan.name, to_price: plan.price,
    }, ctx && ctx.actor);
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
    await audit('mark_paid', id, { months, paid_until: end.toISOString(), was_trial: sub.status === 'trial', price: subPrice(sub) }, ctx && ctx.actor);
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
    await audit('extend', id, { days, courtesy_until: until.toISOString() }, ctx && ctx.actor);
    return { ok: true, state: (await accessRow(id) || {}).state, courtesy_until: until.toISOString() };
  }

  if (action === 'suspend') {
    if (sub.status === 'cancelled') throw fail('Abbonamento gia\' annullato.');
    await patchSub(sub.id, { suspended_manually: true, suspended_at: now.toISOString() });
    await audit('suspend', id, {}, ctx && ctx.actor);
    return { ok: true, state: (await accessRow(id) || {}).state };
  }

  if (action === 'reactivate') {
    if (sub.status === 'cancelled') {
      await patchSub(sub.id, { status: 'active', cancelled_at: null, current_period_end: addMonths(now, 1).toISOString(), courtesy_until: null, suspended_manually: false, suspended_at: null });
    } else {
      await patchSub(sub.id, { suspended_manually: false, suspended_at: null });
    }
    await audit('reactivate', id, { was_cancelled: sub.status === 'cancelled', price: subPrice(sub) }, ctx && ctx.actor);
    const state = (await accessRow(id) || {}).state;
    return { ok: true, state, note: state === 'suspended' ? 'Ancora scaduto: segna come pagato o concedi una proroga.' : undefined };
  }

  if (action === 'cancel') {
    if (sub.status === 'cancelled') throw fail('Abbonamento gia\' annullato.');
    await patchSub(sub.id, { status: 'cancelled', cancelled_at: now.toISOString() });
    await audit('cancel', id, { price: subPrice(sub) }, ctx && ctx.actor);
    return { ok: true, state: (await accessRow(id) || {}).state };
  }

  throw fail('Azione non riconosciuta.');
}

async function createClient(body, ctx) {
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
  await audit('create_client', business.id, { name, plan: planKey, status, type }, ctx && ctx.actor);
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

// ============================ RICHIESTE DEI CLIENTI ============================
// Le scrive api/agenda.js (azione support_request) nella tabella support_requests.
const REQ_KINDS = ['support', 'plan_change', 'subscription_cancel', 'account_delete', 'whatsapp_activation'];
const REQ_STATUS = ['new', 'in_progress', 'done'];

async function requestCounts() {
  const rows = (await sb('support_requests?select=status&limit=5000')) || [];
  const c = { new: 0, in_progress: 0, done: 0 };
  rows.forEach((r) => { if (c[r.status] !== undefined) c[r.status]++; });
  return c;
}

async function listRequests(query) {
  const status = String((query && query.status) || '');
  const kind = String((query && query.kind) || '');
  let path = 'support_requests?select=id,created_at,business_id,business_name,kind,topic,message,contact,meta,status,handled_by,handled_at&order=created_at.desc&limit=300';
  if (status === 'open') path += '&status=in.(new,in_progress)';
  else if (REQ_STATUS.includes(status)) path += `&status=eq.${status}`;
  if (REQ_KINDS.includes(kind)) path += `&kind=eq.${kind}`;
  let rows, counts;
  try {
    rows = (await sb(path)) || [];
    counts = await requestCounts();
  } catch (e) {
    if (e && (e.status === 404 || /support_requests/.test(String(e.message || '')))) {
      return { setup_needed: true, requests: [], counts: { new: 0, in_progress: 0, done: 0 } };
    }
    throw e;
  }
  // arricchimento con i dati dell'attivita' (telefono, piano)
  const ids = Array.from(new Set(rows.map((r) => r.business_id).filter((id) => UUID.test(String(id || '')))));
  const biz = {};
  if (ids.length) {
    try {
      const bs = (await sb(`businesses?id=in.(${ids.join(',')})&select=id,name,owner_phone,owner_whatsapp,subscriptions(status,started_at,current_period_end,plans(name,price_eur))`)) || [];
      bs.forEach((b) => {
        const subs = (b.subscriptions || []).slice().sort((x, y) => new Date(y.started_at) - new Date(x.started_at));
        const sub = subs[0] || null;
        biz[b.id] = {
          id: b.id,
          name: b.name,
          phone: b.owner_phone || null,
          whatsapp: b.owner_whatsapp || null,
          plan: sub && sub.plans ? (sub.plans.name === 'Base+Lia' ? 'Premium' : 'Base') : null,
          plan_status: sub ? sub.status : null,
          renew: sub ? sub.current_period_end || null : null,
        };
      });
    } catch (e) {
      console.error('richieste: dati attivita non letti:', e && e.message); // la lista funziona lo stesso
    }
  }
  return {
    counts,
    requests: rows.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      kind: r.kind,
      topic: r.topic || null,
      message: r.message || '',
      contact: r.contact || null,
      meta: r.meta || null,
      status: r.status,
      handled_by: r.handled_by || null,
      handled_at: r.handled_at || null,
      business: biz[r.business_id] || (r.business_id ? { id: r.business_id, name: r.business_name || null } : { id: null, name: r.business_name || null }),
    })),
  };
}

async function setRequestStatus(body, ctx) {
  const id = String(body.id || '');
  const status = String(body.status || '');
  if (!UUID.test(id)) throw fail('Richiesta non valida.');
  if (!REQ_STATUS.includes(status)) throw fail('Stato non valido.');
  const fields = status === 'new'
    ? { status, handled_by: null, handled_at: null }
    : { status, handled_by: ctx.actor, handled_at: new Date().toISOString() };
  const rows = await sb(`support_requests?id=eq.${id}`, { method: 'PATCH', body: fields, prefer: 'return=representation' });
  if (!rows || !rows.length) { const e = new Error('Richiesta non trovata.'); e.notFound = true; throw e; }
  await audit('request_status', rows[0].business_id || null, { request_id: id, status, kind: rows[0].kind }, ctx.actor);
  return { ok: true, id, status, handled_by: fields.handled_by, handled_at: fields.handled_at };
}

// ============================ ORDINI DELLO SHOP ============================
// Li scrive api/agenda.js (azione order dello Shop) nella tabella shop_orders.
const ORDER_STATUS = ['new', 'paid', 'shipped', 'cancelled'];

async function orderCounts() {
  const rows = (await sb('shop_orders?select=status&limit=5000')) || [];
  const c = { new: 0, paid: 0, shipped: 0, cancelled: 0 };
  rows.forEach((r) => { if (c[r.status] !== undefined) c[r.status]++; });
  return c;
}

async function listOrders(query) {
  const status = String((query && query.status) || '');
  let path = 'shop_orders?select=id,number,created_at,business_id,business_name,items,total_eur,shipping,snapshot,status,handled_at&order=created_at.desc&limit=300';
  if (status === 'open') path += '&status=in.(new,paid)';
  else if (ORDER_STATUS.includes(status)) path += `&status=eq.${status}`;
  let rows, counts;
  try {
    rows = (await sb(path)) || [];
    counts = await orderCounts();
  } catch (e) {
    if (e && (e.status === 404 || /shop_orders/.test(String(e.message || '')))) {
      return { setup_needed: true, orders: [], counts: { new: 0, paid: 0, shipped: 0, cancelled: 0 } };
    }
    throw e;
  }
  return {
    counts,
    orders: rows.map((r) => ({
      id: r.id,
      code: 'LIA-' + (1000 + Number(r.number)),
      created_at: r.created_at,
      business_id: r.business_id,
      business_name: r.business_name,
      items: r.items || [],
      total: Number(r.total_eur),
      shipping: r.shipping || {},
      snapshot: r.snapshot || {},
      status: r.status,
      handled_at: r.handled_at,
    })),
  };
}

async function setOrderStatus(body, ctx) {
  const id = String(body.id || '');
  const status = String(body.status || '');
  if (!UUID.test(id)) throw fail('Ordine non valido.');
  if (!ORDER_STATUS.includes(status)) throw fail('Stato non valido.');
  const rows = await sb(`shop_orders?id=eq.${id}`, { method: 'PATCH', body: { status, handled_at: new Date().toISOString() }, prefer: 'return=representation' });
  if (!rows || !rows.length) { const e = new Error('Ordine non trovato.'); e.notFound = true; throw e; }
  await audit('order_status', rows[0].business_id || null, { order_id: id, status }, ctx.actor);
  return { ok: true, id, status };
}

module.exports = async function handler(req, res) {
  if (res.setHeader) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
  }

  const auth = await authenticate(req);
  if (auth && auth.unavailable) {
    res.status(503).json({ error: 'auth_unavailable', detail: 'Non riesco a verificare l\'accesso in questo momento. Riprova tra poco.' });
    return;
  }
  if (auth && auth.forbidden) {
    res.status(403).json({ error: 'forbidden', detail: 'Questo account non è autorizzato ad entrare.' });
    return;
  }
  if (!auth) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const ctx = { actor: auth.actor, role: auth.role };
  const owner = ctx.role === 'owner';

  const { key } = cfg();
  if (!key) {
    res.status(500).json({
      error: 'missing_env_vars',
      detail: 'Manca la service key di Supabase tra le variabili d\'ambiente di Vercel (SUPABASE_SECRET_KEY).',
    });
    return;
  }

  try {
    if (req.method === 'GET') {
      const view = req.query && req.query.view;
      if (view === 'me') { res.status(200).json({ email: ctx.actor, role: ctx.role, via: auth.via }); return; }
      if (view === 'overview') { res.status(200).json(await overviewData()); return; }
      if (view === 'margin') { res.status(200).json(await marginOverview()); return; }
      if (view === 'money') { res.status(200).json(await moneyOverview()); return; }
      if (view === 'lia') { res.status(200).json(await liaOverview()); return; }
      if (view === 'requests') { res.status(200).json(await listRequests(req.query || {})); return; }
      if (view === 'requests_count') {
        let n = 0;
        try { n = ((await sb('support_requests?status=eq.new&select=id&limit=500')) || []).length; } catch (e) { n = 0; }
        res.status(200).json({ new: n });
        return;
      }
      if (view === 'orders') { res.status(200).json(await listOrders(req.query || {})); return; }
      if (view === 'orders_count') {
        let n = 0;
        try { n = ((await sb('shop_orders?status=eq.new&select=id&limit=500')) || []).length; } catch (e) { n = 0; }
        res.status(200).json({ new: n });
        return;
      }
      if (view === 'detail') { res.status(200).json(await businessDetail(String(req.query.id || ''))); return; }
      if (view === 'conversation') {
        if (!owner) { res.status(403).json({ error: 'forbidden', detail: 'Le conversazioni dei clienti finali sono riservate al titolare.' }); return; }
        res.status(200).json(await readConversation(String(req.query.id || ''), String(req.query.contact || ''), ctx));
        return;
      }
      res.status(200).json({ clients: await listClients() });
      return;
    }
    if (req.method === 'POST') {
      if (!owner) { res.status(403).json({ error: 'forbidden', detail: 'Il tuo account può solo consultare, non modificare.' }); return; }
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      if (body && body.action === 'order_status') {
        res.status(200).json(await setOrderStatus(body, ctx));
        return;
      }
      if (body && body.action === 'request_status') {
        res.status(200).json(await setRequestStatus(body, ctx));
        return;
      }
      if (body && (body.action === 'set_setting' || body.action === 'set_price')) {
        res.status(200).json(await runSettingsAction(body, ctx));
        return;
      }
      if (body && body.action) {
        res.status(200).json(await runAction(body, ctx));
        return;
      }
      res.status(201).json(await createClient(body || {}, ctx));
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

module.exports.buildMrrEvents = buildMrrEvents;
module.exports.monthlyMovement = monthlyMovement;

module.exports.authCacheClear = authCacheClear;

module.exports.listRequests = listRequests;
module.exports.setRequestStatus = setRequestStatus;
