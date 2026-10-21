// Prova dell'eliminazione di un'attivita' con un finto Supabase: node scripts/test-delete-business.js
process.env.ADMIN_API_KEY = 'k'; process.env.SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SECRET_KEY = 'sk';
const assert = require('assert');
const ID = 'aaaaaaaa-1111-4222-8333-bbbbbbbbbbbb';
let sub = null; const log = [];
global.fetch = async (url, opts) => {
  const path = String(url).replace('https://x.supabase.co/rest/v1/', ''), method = (opts && opts.method) || 'GET';
  log.push(method + ' ' + path + (opts && opts.body ? ' ' + opts.body : ''));
  if (method === 'HEAD') return { ok: true, headers: { get: () => '*/42' } };
  const t = path.split('?')[0];
  let body = [];
  if (method === 'GET' && t === 'businesses') body = [{ id: ID, name: 'Salone  Luna', slug: 'salone-luna', business_type: 'parrucchiere' }];
  if (method === 'GET' && t === 'subscriptions') body = sub ? [sub] : [];
  return { ok: true, status: 200, text: async () => (method === 'GET' ? JSON.stringify(body) : '') };
};
const handler = require('../api/admin/clients.js');
const run = async (b) => { const out = {}; const res = { setHeader() {}, status(c) { out.code = c; return this; }, json(j) { out.json = j; } };
  await handler({ method: 'POST', query: {}, headers: { 'x-admin-key': 'k' }, body: b }, res); return out; };
const deleted = () => log.some((l) => l.startsWith('DELETE businesses?id=eq.' + ID));
(async () => {
  let r = await run({ action: 'delete_business', id: ID, confirm_name: 'sbagliato' });
  assert.strictEqual(r.code, 400); assert.ok(!deleted(), 'nome sbagliato: non cancella');
  r = await run({ action: 'delete_business', id: ID, confirm_name: '' });
  assert.strictEqual(r.code, 400); assert.ok(!deleted(), 'nome vuoto: non cancella');
  r = await run({ action: 'delete_business', id: 'non-uuid', confirm_name: 'Salone Luna' });
  assert.strictEqual(r.code, 400); assert.ok(!deleted());
  sub = { id: 's', status: 'active', stripe_subscription_id: 'sub_123' };
  r = await run({ action: 'delete_business', id: ID, confirm_name: 'salone luna' });
  assert.strictEqual(r.code, 400); assert.ok(/Stripe/.test(r.json.detail)); assert.ok(!deleted(), 'Stripe attivo: non cancella');
  sub = { id: 's', status: 'cancelled', stripe_subscription_id: 'sub_123' };
  r = await run({ action: 'delete_business', id: ID, confirm_name: '  SALONE luna ' });
  assert.strictEqual(r.code, 200, JSON.stringify(r.json)); assert.ok(deleted(), 'nome giusto (anche maiuscole e spazi): cancella');
  assert.strictEqual(r.json.counts.appuntamenti, 42);
  const audit = log.find((l) => l.startsWith('POST audit_logs'));
  assert.ok(audit && audit.includes('"action":"delete_business"') && audit.includes('"business_id":null') && audit.includes('Salone  Luna'), 'registrata nello storico');
  console.log('OK: l\'eliminazione chiede il nome giusto, rispetta Stripe e lascia traccia nello storico');
})().catch((e) => { console.error('ERRORE', e.message); process.exit(1); });
