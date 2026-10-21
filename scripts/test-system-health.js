// Prova delle regole della Super Dashboard: node scripts/test-system-health.js
const h = require('../lib/system-health.js');
const assert = require('assert');
const now = new Date('2026-10-21T20:00:00Z');
const day = 86400000;

// credito: 10 euro scritti 3 giorni fa, spesi 1,50 al giorno
const costs = [];
for (let i = 13; i >= 0; i--) costs.push({ at: new Date(now - i * day - 3600000).toISOString(), cost: 1.5 });
let c = h.creditState({ balance: 10, setAt: new Date(now - 3 * day).toISOString(), costs }, now);
assert.strictEqual(c.configured, true);
assert.strictEqual(c.avg_daily, 1.5);
assert.ok(c.remaining < 10 && c.remaining > 0, 'il saldo scende da solo');
assert.ok(c.days_left >= 0 && c.days_left <= 6);
assert.strictEqual(h.creditState({ balance: null }, now).configured, false);
assert.strictEqual(h.creditState({ balance: 1, setAt: new Date(now - day).toISOString(), costs }, now).days_left, 0);

// resend: 2.400 email al 21 del mese su 3.000
let r = h.resendState({ monthSent: 2400, todaySent: 90, limitMonth: 3000, limitDay: 100 }, now);
assert.strictEqual(r.pct, 80);
assert.ok(r.projected > 3000);
assert.ok(r.exhaust_on && r.exhaust_on.startsWith('2026-10-'));

// problemi
const p = h.buildProblems({
  credit: { configured: true, remaining: 2.6, avg_daily: 0.64, days_left: 4 },
  resend: r, aiDown: [{ kind: 'credit' }],
  expiries: [{ id: 'e1', name: 'Dominio', due_date: '2026-10-30' }, { id: 'e2', name: 'Chiave', due_date: '2027-03-01' }, { id: 'e3', name: 'Vecchia', due_date: '2026-10-01' }],
  access: [1, 2, 3, 4].map((i) => ({ id: 's' + i, name: 'S' + i, state: 'suspended' })).concat([{ id: 'g1', name: 'G', state: 'grace', grace_ends: '2026-10-23T00:00:00Z' }]),
  trials: [{ id: 't', name: 'T', trial_ends_at: '2026-10-22T10:00:00Z' }], renewals: [{ id: 'r', name: 'R', current_period_end: '2026-10-22T10:00:00Z' }], failedPayments: [],
}, now);
const keys = p.map((x) => x.key);
assert.ok(keys.includes('credit') && keys.includes('ai_down:credit') && keys.includes('exp:e1') && keys.includes('exp:e3') && keys.includes('resend'));
assert.ok(!keys.includes('exp:e2'), 'scadenza lontana: nessun avviso');
assert.strictEqual(keys.filter((k) => k.startsWith('susp')).length, 1, 'le sospese sono raggruppate');
assert.ok(keys.includes('grace:g1') && keys.includes('trial:t') && keys.includes('ren:r'));
assert.strictEqual(p[0].severity, 'crit', 'i critici vengono prima');
assert.strictEqual(p.find((x) => x.key === 'exp:e1').severity, 'warn', '9 giorni: attenzione');
assert.strictEqual(p.find((x) => x.key === 'exp:e3').severity, 'crit', 'scaduta: urgente');
console.log('OK:', p.length, 'problemi,', keys.join(', '));
