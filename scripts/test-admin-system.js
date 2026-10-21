// Prova di api/admin/system.js con un finto Supabase: node scripts/test-admin-system.js
// Non chiama la rete: sostituisce fetch con risposte finte e controlla che le quattro viste funzionino.
process.env.ADMIN_API_KEY = 'k'; process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SECRET_KEY = 'sk';
const assert = require('assert');
const now = Date.now(), iso = (m) => new Date(now - m * 60000).toISOString();
const B1 = 'd4d96a5d-8b0f-4245-b0f0-53cb88897f9a', B2 = 'aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb';
const settings = { credit_balance_eur: '2.60', credit_set_at: iso(60 * 24 * 2), resend_limit_month: '3000', resend_limit_day: '100' };
const calls = [];
const data = (path) => {
  const rows = rawData(path), m = /business_id=eq\.([0-9a-f-]{36})/.exec(path);
  return m && Array.isArray(rows) ? rows.filter((x) => !x.business_id || x.business_id === m[1]) : rows;
};
const rawData = (path) => {
  calls.push(path);
  const t = path.split('?')[0];
  if (t === 'businesses') return [{ id: B1, name: 'Barbiere Mario', business_type: 'barbiere', created_at: iso(5) }, { id: B2, name: 'Salone Luna', business_type: 'parrucchiere', created_at: iso(900) }];
  if (t === 'appointments') return [{ id: 'a1', created_at: iso(3), starts_at: iso(-1500), customer_name: 'Giulia Bianchi', channel: 'selfservice', source: 'qr', status: 'confirmed', business_id: B1, services: { name: 'Taglio' } }, { id: 'a2', created_at: iso(8), starts_at: iso(-3000), customer_name: 'Marco', channel: 'manuale', source: null, status: 'confirmed', business_id: B2, services: null }];
  if (t === 'chat_messages') return [1, 2, 3].map((i) => ({ id: 'm' + i, created_at: iso(20 - i), customer_phone: 'web:abc', business_id: B1 })).concat([{ id: 'm9', created_at: iso(400), customer_phone: 'tg:1', business_id: B2 }]);
  if (t === 'notification_events') return [{ id: 'n1', created_at: iso(30), event_type: 'cancelled', customer_name: 'Anna Rossi', service_name: 'Barba', starts_at: iso(-60), business_id: B1 }];
  if (t === 'support_requests') return [{ id: 'r1', created_at: iso(50), topic: 'Aiuto con gli orari', kind: 'support', business_name: 'Salone Luna', business_id: B2 }];
  if (t === 'gym_bookings') return [];
  if (t === 'stripe_events') return path.includes('payment_failed') ? [{ id: 'e1', received_at: iso(1000) }] : [{ id: 'e2', type: 'invoice.paid', received_at: iso(60) }];
  if (t === 'subscriptions') return path.includes('cancelled_at=not.is.null') ? [] : path.includes('plans(') ? [{ id: 's1', status: 'active', plans: { price_eur: 24.99 } }, { id: 's2', business_id: B2, status: 'trial', businesses: { name: 'Salone Luna' }, trial_ends_at: new Date(now + 2 * 864e5).toISOString() }] : [{ id: 's1', business_id: B1, status: 'active', current_period_end: new Date(now + 20 * 3600e3).toISOString(), businesses: { name: 'Barbiere Mario' } }, { id: 's2', business_id: B2, status: 'trial', trial_ends_at: new Date(now + 2 * 864e5).toISOString(), businesses: { name: 'Salone Luna' } }];
  if (t === 'shop_orders') return [{ id: 'o1', created_at: iso(10), business_id: B1, business_name: 'Barbiere Mario', total_eur: 15 }];
  if (t === 'app_settings') return Object.keys(settings).filter((k) => path.includes(k)).map((k) => ({ key: k, value: settings[k] }));
  if (t === 'ai_usage_costed_v') return Array.from({ length: 10 }, (_, i) => ({ at: new Date(now - i * 864e5 - 3600e3).toISOString(), cost_eur: 0.64 }));
  if (t === 'admin_expiries') return [{ id: 'x1', name: 'Dominio prenolia.it', note: 'Aruba', due_date: new Date(now + 9 * 864e5).toISOString().slice(0, 10) }];
  if (t === 'admin_alerts_sent') return [];
  if (t === 'service_access_v') return [{ business_id: B1, state: 'active', allowed: true, businesses: { name: 'Barbiere Mario' } }, { business_id: B2, state: 'suspended', allowed: false, businesses: { name: 'Salone Luna' } }];
  return [];
};
global.fetch = async (url, opts) => {
  const path = String(url).replace('https://x.supabase.co/rest/v1/', '');
  const method = (opts && opts.method) || 'GET';
  if (method === 'HEAD') return { ok: true, status: 200, headers: { get: () => '*/' + (path.startsWith('email_log') ? 2340 : path.includes('customer_email') ? 40 : 100) } };
  const body = method === 'GET' ? data(path) : null;
  return { ok: true, status: 200, text: async () => (body ? JSON.stringify(body) : '') };
};
const handler = require('../api/admin/system.js');
const run = async (method, query, body) => {
  let out = {}; const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(j) { out.json = j; } };
  await handler({ method, query: query || {}, headers: { 'x-admin-key': 'k' }, body }, res); return out;
};
(async () => {
  let r = await run('GET', { view: 'feed' });
  assert.strictEqual(r.code, 200); const ev = r.json.events;
  const types = ev.map((e) => e.type);
  ['acc', 'app', 'app_manual', 'chat', 'can', 'req', 'pay'].forEach((t) => assert.ok(types.includes(t), 'manca ' + t));
  assert.strictEqual(ev.filter((e) => e.type === 'chat' && e.business_id === B1).length, 1, 'chat raggruppate');
  assert.ok(ev.find((e) => e.type === 'chat' && e.business_id === B1).title.startsWith('3 messaggi'));
  assert.ok(ev.some((e) => e.detail.includes('Giulia B.')), 'solo iniziale del cognome');
  assert.ok(!JSON.stringify(ev).includes('Bianchi'), 'nessun cognome per intero');
  assert.ok(ev.every((e, i) => i === 0 || ev[i - 1].at >= e.at), 'ordinato per data');
  assert.ok(ev.some((e) => e.title === 'Nuovo ordine dallo Shop'));
  r = await run('GET', { view: 'feed', business: B1, since: iso(100) });
  assert.ok(r.json.events.every((e) => e.business_id === B1) && !r.json.events.some((e) => e.type === 'acc'));
  assert.ok(calls.some((c) => c.startsWith('appointments') && c.includes('business_id=eq.' + B1) && c.includes('created_at=gt.')));
  r = await run('GET', { view: 'feed', business: "x'; drop" }); assert.ok(!calls.slice(-9).some((c) => c.includes('drop')), 'id non valido ignorato');

  r = await run('GET', { view: 'system' }); assert.strictEqual(r.code, 200);
  assert.strictEqual(r.json.credit.configured, true); assert.ok(r.json.credit.days_left <= 7, JSON.stringify(r.json.credit));
  assert.strictEqual(r.json.resend.month_sent, 2340); assert.strictEqual(r.json.resend.pct, 78);
  assert.strictEqual(r.json.expiries.length, 1); assert.strictEqual(r.json.calc.businesses, 1);
  r = await run('GET', { view: 'problems' }); assert.strictEqual(r.code, 200);
  const k = r.json.problems.map((p) => p.key);
  assert.ok(k.includes('credit') && k.includes('exp:x1') && k.includes('susp:' + B2) && k.includes('trial:' + B2) && k.includes('ren:' + B1), k.join());
  assert.ok(r.json.counts.crit + r.json.counts.warn + r.json.counts.info === r.json.problems.length);
  r = await run('GET', { view: 'home' }); assert.strictEqual(r.code, 200);
  assert.strictEqual(r.json.mrr, 24.99); assert.strictEqual(r.json.trials, 1); assert.strictEqual(r.json.trials_soon, 1);
  assert.ok(r.json.channels_today.some((c) => c.label === 'Calendario pubblico'));

  // modifiche: validazioni
  r = await run('POST', {}, { action: 'set_credit', balance: 'abc' }); assert.strictEqual(r.code, 400);
  r = await run('POST', {}, { action: 'set_credit', balance: '12,50' }); assert.strictEqual(r.code, 200);
  r = await run('POST', {}, { action: 'expiry_add', name: '', due_date: '2026-12-01' }); assert.strictEqual(r.code, 400);
  r = await run('POST', {}, { action: 'expiry_add', name: 'Dominio', due_date: '2026-12-01' }); assert.strictEqual(r.code, 200);
  r = await run('POST', {}, { action: 'expiry_delete', id: 'non-un-uuid' }); assert.strictEqual(r.code, 400);
  r = await run('POST', {}, { action: 'set_resend', limit_month: '50', limit_day: '10' }); assert.strictEqual(r.code, 400);
  r = await run('GET', { view: 'boh' }); assert.strictEqual(r.code, 400);
  console.log('OK: feed, sistema, problemi, panoramica e modifiche funzionano con dati finti');
})().catch((e) => { console.error('ERRORE', e.message); process.exit(1); });
