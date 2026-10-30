// Prova del centro di controllo (api/admin/system.js?view=control) con dati finti: node scripts/test-control-view.js
const path = require('path');
const repo = path.join(__dirname, '..');
const clientsPath = require.resolve(path.join(repo, 'api/admin/clients.js'));
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const H = 3600000, D = 86400000;
const apps = [];
for (let i = 0; i < 900; i++) apps.push({ created_at: iso(now - Math.random() * 28 * D), business_id: 'b' + (i % 5), status: i % 11 ? 'confirmed' : 'cancelled', channel: ['whatsapp','selfservice','manuale','webchat'][i % 4] });
const todayRows = [];
for (let i = 0; i < 40; i++) todayRows.push({ created_at: iso(now - Math.random() * 6 * H), status: 'confirmed', channel: ['whatsapp','selfservice','telegram'][i % 3] });
const subs = [
  { id: 1, business_id: 'b0', status: 'active', started_at: iso(now - 60 * D), trial_ends_at: iso(now - 46 * D), current_period_end: iso(now + 4 * D), cancelled_at: null, plans: { price_eur: 29 }, businesses: { name: 'Salone Elena' } },
  { id: 2, business_id: 'b1', status: 'trial', started_at: iso(now - 12 * D), trial_ends_at: iso(now + 2 * D), current_period_end: null, cancelled_at: null, plans: { price_eur: 29 }, businesses: { name: 'Barber Marco' } },
];
const access = [{ business_id: 'b0', state: 'active', sub_status: 'active', allowed: true }, { business_id: 'b1', state: 'active', sub_status: 'trial', allowed: true }, { business_id: 'b2', state: 'suspended', sub_status: 'active', allowed: false }, { business_id: 'b3', state: 'unmanaged', sub_status: null, allowed: true }];
const calls = [];
function route(p) {
  calls.push(p);
  if (p.startsWith('appointments?') && p.includes('created_at=lt.')) return apps;
  if (p.startsWith('appointments?')) return todayRows;
  if (p.startsWith('subscriptions?')) return subs;
  if (p.startsWith('service_access_v?')) return access;
  if (p.startsWith('businesses?select=id,name')) return [{ id: 'b0', name: 'Salone Elena' }, { id: 'b1', name: 'Barber Marco' }];
  if (p.startsWith('businesses?select=id,created_at')) return [{ id: 'b0', created_at: iso(now - 90 * D) }, { id: 'b1', created_at: iso(now - 12 * D) }];
  if (p.startsWith('app_settings')) return [{ key: 'credit_balance_eur', value: '25' }, { key: 'credit_set_at', value: iso(now - 5 * D) }];
  if (p.startsWith('ai_usage_costed_v?select=at,cost_eur')) return [{ at: iso(now - 3 * D), cost_eur: 2.1 }];
  if (p.startsWith('ai_usage_costed_v?select=at&')) return [{ at: iso(now - 4 * 60000) }];
  if (p.startsWith('admin_expiries')) return [{ id: 'x', name: 'Dominio prenolia.it', note: null, due_date: new Date(now + 18 * D).toISOString().slice(0, 10) }];
  if (p.startsWith('chat_messages?')) return [{ created_at: iso(now - 4 * 60000), customer_phone: '+393331112222' }, { created_at: iso(now - 1 * 60000), customer_phone: 'web:abc' }];
  if (p.startsWith('support_requests?')) return [{ id: 's', created_at: iso(now - 12 * 60000), business_name: 'Salone Elena' }];
  if (p.startsWith('stripe_events?')) return [{ received_at: iso(now - 3 * H) }];
  if (p.startsWith('admin_alerts_sent?')) return [];
  return [];
}
const mock = { sb: async (p) => route(p), sbAll: async (p) => route(p), authenticate: async () => ({ role: 'owner' }), cfg: () => ({ url: 'http://x', key: 'k' }) };
require.cache[clientsPath] = { id: clientsPath, filename: clientsPath, loaded: true, exports: mock };
global.fetch = async (url) => ({ ok: true, headers: { get: () => '0-0/7' } });
const handler = require(path.join(repo, 'api/admin/system.js'));
let out;
const res = { setHeader() {}, status(c) { this.code = c; return this; }, json(j) { out = j; } };
handler({ method: 'GET', query: { view: 'control' }, headers: {} }, res).then(() => {
  console.log('status', res.code, 'warnings', JSON.stringify(out.warnings));
  console.log(JSON.stringify({ cells: out.cells.map((c) => [c.key, c.value, c.state, c.sub]), kpis: { ...out.kpis, mrr_series: out.kpis.mrr_series.slice(-3), bookings_series: out.kpis.bookings_series.length, accounts_series: out.kpis.accounts_series.slice(-2), trials_series: out.kpis.trials_series.slice(-3) }, today: { total: out.today.total, hour_now: out.today.hour_now, hrs: out.today.hours.length, ch: out.today.channels }, last_hour: out.last_hour, funnel: out.funnel.map((f) => f.key + ':' + f.n).join(' '), agenda: out.agenda.map((a) => a.date + ' ' + a.kind + ' ' + a.title), risk: out.at_risk }, null, 1));
}).catch((e) => { console.error('FAIL', e); process.exit(1); });
