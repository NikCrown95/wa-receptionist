// Prova della pagina Promoter con un finto Supabase: node scripts/test-promoter.js
process.env.SUPABASE_URL = 'http://sb.test'; process.env.SUPABASE_SECRET_KEY = 'secret-test'; process.env.PUBLIC_URL = 'https://prenolia.test';
const assert = require('assert');
const promoter = require('../lib/promoter.js');
const referral = require('../lib/referral.js');

// ---------- finto database ----------
const DB = { referral_partners: [], referrals: [], businesses: [], subscriptions: [], audit_logs: [], auth_throttle: [], app_settings: [], plans: [{ name: 'Base', price_eur: 39.99 }, { name: 'Base+Lia', price_eur: 21.99 }] };
let seq = 1;
const uid = () => '00000000-0000-4000-8000-' + String(seq++).padStart(12, '0');
function rows(path) {
  const [t, qs = ''] = path.split('?');
  let r = (DB[t] || []).slice();
  const sp = new URLSearchParams(qs);
  for (const [k, v] of sp) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k)) continue;
    let m;
    if ((m = v.match(/^eq\.(.*)$/))) r = r.filter((x) => String(x[k]) === m[1]);
    else if ((m = v.match(/^in\.\((.*)\)$/))) { const set = m[1].split(','); r = r.filter((x) => set.includes(String(x[k]))); }
    else if (v === 'is.null') r = r.filter((x) => x[k] == null);
    else if (v === 'not.is.null') r = r.filter((x) => x[k] != null);
    else if ((m = v.match(/^neq\.(.*)$/))) r = r.filter((x) => String(x[k]) !== m[1]);
  }
  const lim = sp.get('limit'); if (lim) r = r.slice(0, +lim);
  return { t, rows: r, sp };
}
const log = [];
global.fetch = async (u, o = {}) => {
  const path = String(u).replace('http://sb.test/rest/v1/', ''); const method = (o.method || 'GET').toUpperCase();
  const body = o.body ? JSON.parse(o.body) : undefined;
  log.push(method + ' ' + path);
  const out = (st, d) => ({ ok: st < 300, status: st, text: async () => (d === undefined ? '' : JSON.stringify(d)), json: async () => d });
  if (DB.__failColumn && method !== 'GET' && body && Object.keys(body).some((k) => DB.__failColumn.includes(k))) return out(400, { message: 'column "assigned_manually" of relation "referrals" does not exist' });
  if (DB.__failColumn && method === 'GET' && DB.__failColumn.some((c) => path.includes(c))) return out(400, { message: 'column referrals.reward2_at does not exist' });
  const { t, rows: r } = rows(path);
  if (method === 'GET') {
    const rng = (o.headers && o.headers.Range) || '';
    if (rng && !rng.startsWith('0-')) return out(200, []);
    return out(200, r);
  }
  if (method === 'POST') {
    if (t === 'auth_throttle') { const i = DB.auth_throttle.findIndex((x) => x.key === body.key); if (i >= 0) DB.auth_throttle[i] = body; else DB.auth_throttle.push(body); return out(201); }
    const row = Object.assign({ id: uid(), created_at: new Date().toISOString() }, body); DB[t].push(row); return out(201, [row]);
  }
  if (method === 'PATCH') { r.forEach((x) => Object.assign(x, body)); return out(204); }
  if (method === 'DELETE') { DB[t] = DB[t].filter((x) => !r.includes(x)); return out(204); }
  return out(200, []);
};
const get = async (p) => (await (await fetch('http://sb.test/rest/v1/' + p, { headers: { Range: '0-999' } })).json());
const send = async (m, p, b) => { const r = await fetch('http://sb.test/rest/v1/' + p, { method: m, body: b === undefined ? undefined : JSON.stringify(b) }); const t = await r.text(); if (!r.ok) throw new Error(JSON.parse(t).message); return t ? JSON.parse(t) : null; };

const NOW = new Date('2026-10-30T10:00:00Z');
const D = (s) => new Date(s + 'T10:00:00Z').toISOString();
const ev = (ref, biz, sub, partnerReward = 21.99) => promoter.evaluate(ref, biz, sub, { now: NOW, trialDays: 14, partnerReward });
const B = (name, reg) => ({ id: uid(), name, business_type: 'parrucchiere', created_at: D(reg) });

(async () => {
  // ---- nomi e codici
  assert.ok(promoter.sameName('Marco Rossi', '  rossi   MARCO '));
  assert.ok(promoter.sameName('Nicolò D’Angelo', 'nicolo d angelo'));
  assert.ok(!promoter.sameName('Marco Rossi', 'Marco'));
  assert.ok(!promoter.sameName('', ''));
  assert.strictEqual(promoter.cleanCode(' Marco-3F9A '), 'marco-3f9a');
  assert.strictEqual(promoter.cleanCode('a b'), '');
  assert.strictEqual(promoter.addMonths(new Date('2026-01-31T10:00:00Z'), 1).toISOString().slice(0, 10), '2026-02-28');
  assert.strictEqual(promoter.addMonths(new Date('2026-10-17T10:00:00Z'), 12).toISOString().slice(0, 10), '2027-10-17');

  // ---- stato di ogni attivita' (i casi dell'anteprima approvata, "oggi" = 30 ottobre 2026)
  let v = ev({ status: 'paid', paid_at: D('2026-10-17'), created_at: D('2026-10-03'), reward_paid_at: D('2026-10-20') }, B('Elena', '2026-10-03'), { status: 'active', current_period_end: D('2026-11-17'), trial_ends_at: D('2026-10-17') });
  assert.strictEqual(v.phase, 'ok'); assert.strictEqual(v.months[0].state, 'cur'); assert.strictEqual(v.months[1].state, 'todo'); assert.strictEqual(v.paid_months, 1);
  assert.strictEqual(v.m1.state, 'got'); assert.strictEqual(v.m2.state, 'pend');

  v = ev({ status: 'paid', paid_at: D('2025-10-10'), created_at: D('2025-09-26'), reward_paid_at: D('2025-10-12') }, B('Corbo', '2025-09-26'), { status: 'active', current_period_end: D('2026-11-10') });
  assert.strictEqual(v.phase, 'ok'); assert.ok(v.months.every((m) => m.state === 'paid')); assert.strictEqual(v.m2.state, 'due'); assert.strictEqual(v.m2.mature, true);

  v = ev({ status: 'paid', paid_at: D('2026-06-18'), created_at: D('2026-06-04'), reward_paid_at: D('2026-06-20') }, B('Lara', '2026-06-04'), { status: 'active', current_period_end: D('2026-10-18') });
  assert.strictEqual(v.phase, 'late'); assert.strictEqual(v.late_n, 5); assert.strictEqual(v.months[4].state, 'late'); assert.strictEqual(v.months[3].state, 'paid'); assert.strictEqual(v.months[5].state, 'todo');

  v = ev({ status: 'paid', paid_at: D('2026-10-26'), created_at: D('2026-10-12') }, B('Gianni', '2026-10-12'), { status: 'active', current_period_end: D('2026-11-26') });
  assert.strictEqual(v.m1.state, 'due');

  v = ev({ status: 'trial', created_at: D('2026-10-24') }, B('Aurora', '2026-10-24'), { status: 'trial', trial_ends_at: D('2026-11-07') });
  assert.strictEqual(v.phase, 'trial'); assert.strictEqual(v.m1.state, 'pend'); assert.strictEqual(v.paid_at, null);

  v = ev({ status: 'trial', created_at: D('2026-10-02') }, B('Nails', '2026-10-02'), { status: 'cancelled', trial_ends_at: D('2026-10-16'), cancelled_at: D('2026-10-14') });
  assert.strictEqual(v.phase, 'lost'); assert.strictEqual(v.m1.state, 'void'); assert.strictEqual(v.m2.state, 'void');

  v = ev({ status: 'trial', created_at: D('2026-10-12') }, B('Attesa', '2026-10-12'), { status: 'trial', trial_ends_at: D('2026-10-28'), grace_days: 5 });
  assert.strictEqual(v.phase, 'waiting');
  v = ev({ status: 'trial', created_at: D('2026-09-01') }, B('Scaduta', '2026-09-01'), { status: 'trial', trial_ends_at: D('2026-09-15'), grace_days: 5 });
  assert.strictEqual(v.phase, 'lost');

  v = ev({ status: 'paid', paid_at: D('2026-08-01'), created_at: D('2026-07-18') }, B('Disdetta', '2026-07-18'), { status: 'cancelled', cancelled_at: D('2026-10-20'), current_period_end: D('2026-11-01') });
  assert.strictEqual(v.phase, 'ending'); assert.strictEqual(v.months[2].state, 'cur'); assert.strictEqual(v.months[3].state, 'lost');
  v = ev({ status: 'paid', paid_at: D('2026-08-01'), created_at: D('2026-07-18') }, B('Finita', '2026-07-18'), { status: 'cancelled', cancelled_at: D('2026-09-20'), current_period_end: D('2026-10-01') });
  assert.strictEqual(v.phase, 'lost'); assert.strictEqual(v.m1.state, 'due', 'la prima mensilita\' maturata resta');
  assert.strictEqual(v.m2.state, 'void', 'se se ne va prima di un anno, la seconda non matura');

  v = ev({ status: 'paid', paid_at: D('2026-08-01'), created_at: D('2026-07-18') }, null, null);
  assert.strictEqual(v.phase, 'lost', 'attivita\' eliminata');

  // pagamento in anticipo di tutto l'anno: tutti i mesi risultano pagati, ma la seconda mensilita' aspetta l'anniversario
  v = ev({ status: 'paid', paid_at: D('2026-10-01'), created_at: D('2026-09-10') }, B('Annuale', '2026-09-10'), { status: 'active', current_period_end: D('2027-10-01') });
  assert.ok(v.months.every((m) => m.state === 'paid' || m.state === 'cur')); assert.strictEqual(v.m2.state, 'pend');

  // ---- accesso e pagina
  const partner = { id: uid(), name: 'Marco Rossi', code: 'marco-3f9a', reward_eur: 21.99, active: true, created_at: D('2026-09-01') };
  const other = { id: uid(), name: 'Anna Verdi', code: 'anna-77aa', reward_eur: 21.99, active: true, created_at: D('2026-09-01') };
  DB.referral_partners.push(partner, other);
  const now = Date.now(), dayMs = 86400000, iso = (n) => new Date(now + n * dayMs).toISOString();
  const bTrial = { id: uid(), name: 'Studio <b>Aurora</b>', business_type: 'dentista', created_at: iso(-6) };
  const bPaid = { id: uid(), name: 'Salone Elena', business_type: 'parrucchiere', created_at: iso(-400) };
  const bOld = { id: uid(), name: 'Corbo', business_type: 'estetista', created_at: iso(-440) };
  DB.businesses.push(bTrial, bPaid, bOld);
  DB.subscriptions.push(
    { id: uid(), business_id: bTrial.id, status: 'trial', started_at: iso(-6), trial_ends_at: iso(8) },
    { id: uid(), business_id: bPaid.id, status: 'active', started_at: iso(-390), current_period_end: iso(20) },
    { id: uid(), business_id: bOld.id, status: 'active', started_at: iso(-430), current_period_end: iso(10) });
  DB.referrals.push(
    { id: uid(), referred_business_id: bTrial.id, referred_name: 'x', partner_id: partner.id, code: partner.code, status: 'trial', created_at: iso(-6) },
    { id: uid(), referred_business_id: bPaid.id, referred_name: 'x', partner_id: partner.id, code: partner.code, status: 'paid', paid_at: iso(-380), reward_eur: 21.99, created_at: iso(-400) },
    { id: uid(), referred_business_id: bOld.id, referred_name: 'x', partner_id: partner.id, code: partner.code, status: 'paid', paid_at: iso(-420), reward_eur: 21.99, reward_paid_at: iso(-410), created_at: iso(-440) });

  const handler = require('../api/promoter.js');
  const call = async (method, body, cookie) => {
    const out = { headers: {} };
    const res = { setHeader(k, v) { out.headers[k.toLowerCase()] = v; }, status(c) { out.code = c; return this; }, json(j) { out.json = j; return this; } };
    await handler({ method, body, headers: { cookie: cookie || '', 'x-forwarded-for': '1.2.3.4' } }, res);
    return out;
  };
  const cookieOf = (o) => String(o.headers['set-cookie']).split(';')[0];

  let r = await call('GET');
  assert.strictEqual(r.code, 401);
  r = await call('POST', { action: 'login', name: 'Marco Verdi', code: 'marco-3f9a' });
  assert.strictEqual(r.code, 401); assert.strictEqual(r.json.error, 'Nome o codice non corretti.');
  r = await call('POST', { action: 'login', name: 'Marco Rossi', code: 'anna-77aa' });
  assert.strictEqual(r.code, 401);
  r = await call('POST', { action: 'login', name: 'Marco Rossi', code: 'inesistente' });
  assert.strictEqual(r.json.error, 'Nome o codice non corretti.', 'stesso messaggio: non rivela cosa e\' sbagliato');
  r = await call('POST', { action: 'login', name: 'rossi MARCO', code: ' MARCO-3F9A ' });
  assert.strictEqual(r.code, 200); assert.ok(/HttpOnly/.test(r.headers['set-cookie']) && /Secure/.test(r.headers['set-cookie']));
  const ck = cookieOf(r);

  r = await call('GET', undefined, ck);
  assert.strictEqual(r.code, 200, JSON.stringify(r.json));
  assert.strictEqual(r.json.partner.name, 'Marco Rossi');
  assert.strictEqual(r.json.totals.registered, 3); assert.strictEqual(r.json.totals.in_trial, 1); assert.strictEqual(r.json.totals.paid, 2);
  const names = r.json.businesses.map((b) => b.name);
  assert.ok(names.includes('Studio <b>Aurora</b>'));
  assert.ok(!JSON.stringify(r.json).includes('customer'), 'nessun dato dei clienti');
  const paidB = r.json.businesses.find((b) => b.name === 'Salone Elena');
  assert.strictEqual(paidB.m1.state, 'due'); assert.strictEqual(paidB.m2.state, 'due', 'dopo piu\' di un anno ed ancora iscritta: matura la seconda');
  const oldB = r.json.businesses.find((b) => b.name === 'Corbo');
  assert.strictEqual(oldB.m1.state, 'got');
  assert.strictEqual(r.json.totals.due, 21.99 * 3, 'prima+seconda di Elena + seconda di Corbo = 3 mensilita\'');
  assert.strictEqual(r.json.totals.got, 21.99);
  assert.ok(DB.referrals.filter((x) => x.reward2_at).length === 2, 'la seconda mensilita\' e\' scritta sulle righe');
  const w = log.filter((l) => l.startsWith('PATCH referrals')).length;
  await call('GET', undefined, ck);
  assert.strictEqual(log.filter((l) => l.startsWith('PATCH referrals')).length, w, 'letture ripetute non riscrivono');

  // un'altra persona non vede le attivita' di Marco
  const ra = await call('POST', { action: 'login', name: 'Anna Verdi', code: 'anna-77aa' });
  const rb = await call('GET', undefined, cookieOf(ra));
  assert.strictEqual(rb.json.totals.registered, 0);
  // cookie manomesso o codice cambiato
  assert.strictEqual((await call('GET', undefined, ck.slice(0, -3) + 'abc')).code, 401);
  partner.code = 'marco-new1';
  assert.strictEqual((await call('GET', undefined, ck)).code, 401, 'se cambi il codice la vecchia sessione non vale piu\'');
  partner.code = 'marco-3f9a';
  assert.strictEqual((await call('POST', { action: 'logout' })).code, 200);

  // troppi tentativi
  let last;
  for (let i = 0; i < 9; i++) last = await call('POST', { action: 'login', name: 'Tizio Caio', code: 'marco-3f9a' });
  assert.strictEqual(last.code, 429);
  r = await call('POST', { action: 'login', name: 'Marco Rossi', code: 'marco-3f9a' });
  assert.strictEqual(r.code, 429, 'anche con i dati giusti, finche\' e\' bloccato');
  DB.auth_throttle.length = 0;

  // ---- assegnazione a mano
  const ctx = { get, send };
  const bNew = { id: uid(), name: 'Barbiere Gianni', business_type: 'barbiere', created_at: iso(-90) };
  const bTry = { id: uid(), name: 'Nuova in prova', business_type: 'estetista', created_at: iso(-2) };
  const bViaBiz = { id: uid(), name: 'Invitata da attivita\'', business_type: 'barbiere', created_at: iso(-30) };
  DB.businesses.push(bNew, bTry, bViaBiz);
  DB.subscriptions.push({ id: uid(), business_id: bNew.id, status: 'active', started_at: iso(-80), current_period_end: iso(5) }, { id: uid(), business_id: bTry.id, status: 'trial', started_at: iso(-2), trial_ends_at: iso(12) }, { id: uid(), business_id: bViaBiz.id, status: 'active', started_at: iso(-20), current_period_end: iso(10) });
  DB.audit_logs.push({ business_id: bNew.id, action: 'mark_paid', created_at: iso(-75) });
  DB.referrals.push({ id: uid(), referred_business_id: bViaBiz.id, referrer_business_id: bOld.id, code: 'x', status: 'paid', paid_at: iso(-15) });

  let a = await referral.partnerAction({ action: 'partner_assign', id: partner.id, business_id: bNew.id }, ctx);
  assert.strictEqual(a.ok, true); assert.strictEqual(a.status, 'paid');
  let row = DB.referrals.find((x) => x.referred_business_id === bNew.id);
  assert.strictEqual(row.partner_id, partner.id); assert.strictEqual(row.assigned_manually, true); assert.strictEqual(row.reward_eur, 21.99);
  assert.strictEqual(row.paid_at, iso(-75), 'primo pagamento = primo "segnato come pagato"');
  assert.strictEqual(row.created_at, bNew.created_at, 'registrazione = quella vera dell\'attivita\'');

  await assert.rejects(() => referral.partnerAction({ action: 'partner_assign', id: partner.id, business_id: bNew.id }, ctx), /già assegnata/);
  await assert.rejects(() => referral.partnerAction({ action: 'partner_assign', id: other.id, business_id: bViaBiz.id }, ctx), /altra attività/);
  await assert.rejects(() => referral.partnerAction({ action: 'partner_assign', id: partner.id, business_id: 'zzz' }, ctx), /Scegli/);

  a = await referral.partnerAction({ action: 'partner_assign', id: partner.id, business_id: bTry.id, paid_on: '2020-01-01' }, ctx);
  assert.strictEqual(a.status, 'trial', 'in prova: resta in prova, la data del pagamento non conta');
  row = DB.referrals.find((x) => x.referred_business_id === bTry.id);
  assert.strictEqual(row.paid_at, null); assert.strictEqual(row.reward_eur, null);
  // poi paga: il normale "segna come pagato" la fa maturare (referral_on_paid cerca status 'trial')
  assert.strictEqual(row.status, 'trial');

  // data scelta a mano per una gia' paganti
  const bMan = { id: uid(), name: 'Con data', business_type: 'barbiere', created_at: iso(-300) };
  DB.businesses.push(bMan); DB.subscriptions.push({ id: uid(), business_id: bMan.id, status: 'active', started_at: iso(-280), current_period_end: iso(3) });
  await assert.rejects(() => referral.partnerAction({ action: 'partner_assign', id: partner.id, business_id: bMan.id, paid_on: '2999-01-01' }, ctx), /futuro/);
  await assert.rejects(() => referral.partnerAction({ action: 'partner_assign', id: partner.id, business_id: bMan.id, paid_on: '12/05/2026' }, ctx), /non valida/);
  await referral.partnerAction({ action: 'partner_assign', id: partner.id, business_id: bMan.id, paid_on: '2026-02-10' }, ctx);
  assert.strictEqual(DB.referrals.find((x) => x.referred_business_id === bMan.id).paid_at.slice(0, 10), '2026-02-10');

  // spostare da un promoter a un altro (premio non ancora pagato)
  a = await referral.partnerAction({ action: 'partner_assign', id: other.id, business_id: bNew.id }, ctx);
  assert.strictEqual(a.moved, true); assert.strictEqual(DB.referrals.find((x) => x.referred_business_id === bNew.id).partner_id, other.id);
  assert.strictEqual(DB.referrals.filter((x) => x.referred_business_id === bNew.id).length, 1, 'una sola riga per attivita\'');
  // ... ma non se gli hai gia' pagato il premio
  DB.referrals.find((x) => x.referred_business_id === bNew.id).reward_paid_at = iso(-1);
  await assert.rejects(() => referral.partnerAction({ action: 'partner_assign', id: partner.id, business_id: bNew.id }, ctx), /già pagato/);
  await assert.rejects(() => referral.partnerAction({ action: 'partner_unassign', business_id: bNew.id }, ctx), /già pagato/);
  await referral.partnerAction({ action: 'partner_unassign', business_id: bTry.id }, ctx);
  assert.ok(!DB.referrals.some((x) => x.referred_business_id === bTry.id));

  // colonne nuove non ancora create: messaggio chiaro, nessun danno
  DB.__failColumn = ['assigned_manually', 'reward2_at'];
  const bX = { id: uid(), name: 'X', business_type: 'barbiere', created_at: iso(-10) };
  DB.businesses.push(bX); DB.subscriptions.push({ id: uid(), business_id: bX.id, status: 'trial', started_at: iso(-10), trial_ends_at: iso(4) });
  await assert.rejects(() => referral.partnerAction({ action: 'partner_assign', id: partner.id, business_id: bX.id }, ctx), /20261103_promoter\.sql/);
  assert.strictEqual(await promoter.settle(get, send, {}), 0, 'senza le colonne nuove non fa nulla e non va in errore');
  delete DB.__failColumn;

  // ---- super dashboard: totali e pagamento (entrambe le mensilita')
  const ov = await referral.adminOverview(get, send);
  const pm = ov.partners.find((p) => p.id === partner.id);
  assert.strictEqual(ov.promoter_url, 'https://prenolia.test/promoter');
  assert.ok(ov.business_options.some((b) => b.id === bX.id));
  assert.ok(pm.second >= 2 && pm.earned_eur > 0 && pm.due_eur > 0);
  const before = pm.due_eur;
  const pay = await referral.partnerAction({ action: 'partner_payout', id: partner.id }, ctx);
  assert.ok(pay.ok && Math.abs(pay.paid_eur - before) < 0.011, 'paga esattamente quanto era da pagare: ' + pay.paid_eur + ' vs ' + before);
  const ov2 = await referral.adminOverview(get, send);
  assert.strictEqual(ov2.partners.find((p) => p.id === partner.id).due_eur, 0);
  await assert.rejects(() => referral.partnerAction({ action: 'partner_payout', id: partner.id }, ctx), /nessun premio/);
  // nuovo promoter: premio di base = un mese di Smart
  const c = await referral.partnerAction({ action: 'partner_create', name: 'Luca Neri' }, ctx);
  assert.strictEqual(DB.referral_partners.find((p) => p.code === c.code).reward_eur, 21.99);

  console.log('OK: promoter — mesi calcolati, accesso e limiti, assegnazione a mano, seconda mensilità e pagamenti');
})().catch((e) => { console.error('ERRORE', e && e.stack || e); process.exit(1); });
