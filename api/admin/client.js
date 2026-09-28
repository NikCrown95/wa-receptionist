// api/admin/clients.js
//
// Elenco di TUTTE le attività (con o senza abbonamento) e creazione manuale
// di nuove attività dalla Super Dashboard.
//
//   GET  /api/admin/clients                -> { clients: [...] }
//   GET  /api/admin/clients?view=overview  -> { history, byType, planSplit } (pagina Andamento)
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

async function listClients() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const since = new Date(now.getTime() - 30 * 86400000).toISOString();

  const businesses = await sbAll(
    'businesses?select=id,name,business_type,owner_phone,created_at,' +
      'subscriptions(status,started_at,cancelled_at,plans(name,price_eur))' +
      '&order=created_at.desc,id.asc'
  );

  const appts = await sbAll(
    'appointments?select=business_id&status=neq.cancelled' +
      `&starts_at=gte.${encodeURIComponent(since)}&starts_at=lte.${encodeURIComponent(now.toISOString())}` +
      '&order=id.asc'
  );
  const counts = {};
  (appts || []).forEach((a) => { counts[a.business_id] = (counts[a.business_id] || 0) + 1; });

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
    }
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
    };
  });
  return clients;
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
      res.status(200).json({ clients: await listClients() });
      return;
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      res.status(201).json(await createClient(body || {}));
      return;
    }
    res.status(405).json({ error: 'method_not_allowed' });
  } catch (err) {
    console.error('admin/clients error', err);
    res.status(err.validation ? 400 : 500).json({
      error: 'clients_error',
      detail: String((err && err.message) || err),
    });
  }
};
