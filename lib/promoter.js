// lib/promoter.js
//
// Logica della pagina "Promoter": le persone fisiche che portano attivita' a Prenolia.
//   - prima mensilita': matura quando l'attivita' esce dalla prova e paga (lo fa lib/referral.js -> referral_on_paid)
//   - seconda mensilita': matura un anno dopo il primo pagamento, se l'attivita' e' ancora iscritta
// Qui c'e' il calcolo (mese per mese) usato dalla pagina del promoter, la maturazione della seconda mensilita'
// e il collegamento a mano di un'attivita' a un promoter.
//
// Come lib/referral.js non apre connessioni da solo: riceve get(path) -> righe e send(method, path, body, prefer).

const TOLERANCE_MS = 3 * 86400000; // un pagamento registrato qualche giorno dopo non deve sembrare un mese saltato
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(msg) { const e = new Error(msg); e.validation = true; return e; }
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// +n mesi mantenendo il giorno (31 gen + 1 mese = 28/29 feb, non 3 marzo)
function addMonths(d, n) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()));
}
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// "Marco Rossi", "rossi marco", "MARCO  ROSSI" -> stessa chiave. Accenti e punteggiatura ignorati.
function nameKey(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    .split(' ').filter(Boolean).sort().join(' ');
}
function sameName(a, b) {
  const ka = nameKey(a), kb = nameKey(b);
  return !!ka && ka === kb;
}
function cleanCode(c) {
  const s = String(c || '').trim().toLowerCase().replace(/\s+/g, '-'); // "corona 10" vale come "corona-10"
  return /^[a-z0-9-]{3,40}$/.test(s) ? s : '';
}

// ------------------------------------------------------------------
// Stato di una singola attivita' portata da un promoter
//   ref      riga di referrals
//   biz      riga di businesses (null se l'attivita' e' stata eliminata)
//   sub      abbonamento piu' recente (o null)
//   o        { now, trialDays, partnerReward }
// ------------------------------------------------------------------
function evaluate(ref, biz, sub, o) {
  const now = o.now || new Date();
  const reward = round2(o.partnerReward);
  const reg = new Date((biz && biz.created_at) || ref.created_at);
  const paidAt = ref.status === 'paid' && ref.paid_at ? new Date(ref.paid_at) : null;
  const refPaid = ref.status === 'paid';

  let trialEnd = sub && sub.trial_ends_at ? new Date(sub.trial_ends_at) : addDays(reg, o.trialDays || 14);
  if (paidAt && trialEnd > paidAt) trialEnd = paidAt;

  const gone = !biz;
  const cancelled = gone || !!(sub && sub.status === 'cancelled');
  const suspended = !!(sub && sub.suspended_manually);
  const periodEnd = sub && sub.status !== 'trial' && sub.current_period_end ? new Date(sub.current_period_end) : null;
  const graceDays = sub && sub.grace_days != null ? Number(sub.grace_days) : 5;

  // "coperto" = pagato fino a quella data
  const coveredAt = (end) => (periodEnd ? periodEnd.getTime() >= end.getTime() - TOLERANCE_MS : !cancelled);

  const months = [];
  let paidMonths = 0, lateN = 0;
  if (paidAt) {
    for (let i = 1; i <= 12; i++) {
      const start = addMonths(paidAt, i - 1), end = addMonths(paidAt, i);
      let st;
      if (coveredAt(end) && !(suspended && start <= now)) st = end <= now ? 'paid' : (start <= now ? 'cur' : 'paid');
      else if (cancelled) st = 'lost';
      else if (start <= now) st = 'late';
      else st = 'todo';
      if (st === 'late' && !lateN) lateN = i;
      if (st === 'paid' || st === 'cur') paidMonths++;
      months.push({ n: i, start: start.toISOString(), state: st });
    }
  } else {
    for (let i = 1; i <= 12; i++) months.push({ n: i, start: null, state: cancelled ? 'lost' : 'todo' });
  }

  const coveredNow = periodEnd ? periodEnd >= now : !cancelled;
  let phase;
  if (!paidAt) {
    if (cancelled) phase = 'lost';
    else if (trialEnd > now) phase = 'trial';
    else if (now.getTime() > trialEnd.getTime() + graceDays * 86400000) phase = 'lost';
    else phase = 'waiting';
  } else if (cancelled && !coveredNow) phase = 'lost';
  else if (cancelled) phase = 'ending';
  else if (lateN) phase = 'late';
  else phase = 'ok';

  // prima mensilita'
  const m1 = { eur: ref.reward_eur != null ? round2(ref.reward_eur) : reward, state: 'pend' };
  if (refPaid) m1.state = ref.reward_paid_at ? 'got' : 'due';
  else if (phase === 'lost') m1.state = 'void';

  // seconda mensilita' (un anno dopo il primo pagamento)
  const anniv = paidAt ? addMonths(paidAt, 12) : null;
  const m2 = { eur: ref.reward2_eur != null ? round2(ref.reward2_eur) : reward, state: 'pend', mature: false };
  if (ref.reward2_at) m2.state = ref.reward2_paid_at ? 'got' : 'due';
  else if (!paidAt) m2.state = phase === 'lost' ? 'void' : 'pend';
  else {
    const cancelledBefore = cancelled && (!periodEnd || periodEnd.getTime() < anniv.getTime() - TOLERANCE_MS);
    if (cancelledBefore) m2.state = 'void';
    else if (now >= anniv) {
      if (coveredAt(anniv) && !suspended) { m2.state = 'due'; m2.mature = true; }
      else if (now.getTime() > (periodEnd || anniv).getTime() + graceDays * 86400000) m2.state = 'void';
      else m2.state = 'pend';
    } else m2.state = phase === 'lost' ? 'void' : 'pend';
  }

  return {
    reg: reg.toISOString(),
    trial_end: trialEnd.toISOString(),
    paid_at: paidAt ? paidAt.toISOString() : null,
    anniv: anniv ? anniv.toISOString() : null,
    covered_until: paidAt && periodEnd ? periodEnd.toISOString() : null,
    phase, months, paid_months: paidMonths, late_n: lateN, m1, m2,
  };
}

// ------------------------------------------------------------------
// Carica attivita' e abbonamenti per un insieme di referrals (a blocchi, per non fare URL enormi)
// ------------------------------------------------------------------
function chunk(a, n) { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; }

async function loadContext(get, refs) {
  const ids = [...new Set((refs || []).map((r) => r.referred_business_id).filter(Boolean))];
  const pids = [...new Set((refs || []).map((r) => r.partner_id).filter(Boolean))];
  const bizById = {}, subOf = {}, partnerById = {};
  for (const part of chunk(ids, 40)) {
    const list = '(' + part.join(',') + ')';
    const [b, s] = await Promise.all([
      get('businesses?id=in.' + list + '&select=id,name,business_type,created_at'),
      get('subscriptions?business_id=in.' + list + '&select=business_id,status,started_at,trial_ends_at,current_period_end,cancelled_at,grace_days,suspended_manually&order=started_at.desc,id.asc'),
    ]);
    (b || []).forEach((x) => { bizById[x.id] = x; });
    (s || []).forEach((x) => { if (!subOf[x.business_id]) subOf[x.business_id] = x; }); // la piu' recente
  }
  for (const part of chunk(pids, 40)) {
    const p = await get('referral_partners?id=in.(' + part.join(',') + ')&select=id,name,code,reward_eur,active');
    (p || []).forEach((x) => { partnerById[x.id] = x; });
  }
  return { bizById, subOf, partnerById };
}

// ------------------------------------------------------------------
// Seconda mensilita': un anno dopo il primo pagamento, se l'attivita' e' ancora iscritta, "matura" e viene
// scritta sulla riga. Si puo' chiamare quante volte si vuole: scrive una volta sola.
// Se le colonne nuove non ci sono ancora (script SQL non eseguito) non fa nulla.
// ------------------------------------------------------------------
async function settle(get, send, opts) {
  opts = opts || {};
  const now = opts.now || new Date();
  const who = opts.partnerId ? 'eq.' + opts.partnerId : 'not.is.null';
  let refs;
  try {
    refs = await get('referrals?partner_id=' + who + '&status=eq.paid&reward2_at=is.null&paid_at=not.is.null&select=*');
  } catch (e) { return 0; }
  if (!refs || !refs.length) return 0;
  const ctx = await loadContext(get, refs);
  const tdays = opts.trialDays || 14;
  let n = 0;
  for (const r of refs) {
    const p = ctx.partnerById[r.partner_id];
    const v = evaluate(r, r.referred_business_id ? ctx.bizById[r.referred_business_id] : null, r.referred_business_id ? ctx.subOf[r.referred_business_id] : null,
      { now, trialDays: tdays, partnerReward: p ? p.reward_eur : 0 });
    if (!v.m2.mature) continue;
    try {
      await send('PATCH', 'referrals?id=eq.' + r.id + '&reward2_at=is.null', { reward2_at: now.toISOString(), reward2_eur: v.m2.eur });
      n++;
    } catch (e) { console.error('seconda mensilita\' non scritta:', e && e.message); }
  }
  return n;
}

// ------------------------------------------------------------------
// Dati per la pagina del promoter (e per la prova)
// ------------------------------------------------------------------
// Account dimostrativo (nota che inizia con "[demo]"): attivita' simulate, non toccano il database vero ne' le statistiche.
function demoData(now) {
  const day = 86400000, at = (n) => new Date(now.getTime() + n * day).toISOString();
  const refs = [], bizById = {}, subOf = {};
  const add = (name, type, regDays, sub, ref) => {
    const id = 'demo-' + (refs.length + 1);
    bizById[id] = { id, name, business_type: type, created_at: at(regDays) };
    subOf[id] = Object.assign({ business_id: id, started_at: at(regDays) }, sub);
    refs.push(Object.assign({ id, referred_business_id: id, referred_name: name, created_at: at(regDays) }, ref));
  };
  add('Salone Elena', 'parrucchiere', -27, { status: 'active', trial_ends_at: at(-13), current_period_end: at(18) }, { status: 'paid', paid_at: at(-13), reward_eur: 21.99, reward_paid_at: at(-9) });
  add('Centro Estetico Corbo', 'estetista', -400, { status: 'active', trial_ends_at: at(-386), current_period_end: at(11) }, { status: 'paid', paid_at: at(-386), reward_eur: 21.99, reward_paid_at: at(-380) });
  add('Barbiere Gianni', 'barbiere', -18, { status: 'active', trial_ends_at: at(-4), current_period_end: at(26) }, { status: 'paid', paid_at: at(-4), reward_eur: 21.99 });
  add('Studio Dentistico Aurora', 'dentista', -6, { status: 'trial', trial_ends_at: at(8) }, { status: 'trial' });
  add('Nail Bar Giulia', 'estetista', -2, { status: 'trial', trial_ends_at: at(12) }, { status: 'trial' });
  add('Salone Nuvola', 'parrucchiere', -28, { status: 'cancelled', trial_ends_at: at(-14), cancelled_at: at(-16) }, { status: 'trial' });
  return { refs, ctx: { bizById, subOf, partnerById: {} } };
}

async function viewFor(partner, get, opts) {
  opts = opts || {};
  const now = opts.now || new Date();
  const demo = /^\[demo\]/i.test(String(partner.note || ''));
  let refs, ctx;
  if (demo) ({ refs, ctx } = demoData(now));
  else {
    refs = await get('referrals?partner_id=eq.' + partner.id + '&select=*&order=created_at.desc,id.asc');
    ctx = await loadContext(get, refs);
  }
  const reward = Number(partner.reward_eur);
  const items = (refs || []).map((r) => {
    const biz = r.referred_business_id ? ctx.bizById[r.referred_business_id] : null;
    const v = evaluate(r, biz, r.referred_business_id ? ctx.subOf[r.referred_business_id] : null, { now, trialDays: opts.trialDays || 14, partnerReward: reward });
    return Object.assign({
      id: r.id,
      name: (biz && biz.name) || r.referred_name || 'Attività',
      type: biz ? biz.business_type || null : null,
      paid: r.status === 'paid',
    }, v);
  }).sort((a, b) => new Date(b.reg) - new Date(a.reg));

  let due = 0, got = 0, pot = 0;
  items.forEach((i) => [i.m1, i.m2].forEach((m) => {
    if (m.state === 'due') due += m.eur; else if (m.state === 'got') got += m.eur; else if (m.state === 'pend') pot += m.eur;
  }));
  return {
    now: now.toISOString(),
    partner: { name: partner.name, reward_eur: reward },
    totals: {
      registered: items.length,
      in_trial: items.filter((i) => !i.paid && (i.phase === 'trial' || i.phase === 'waiting')).length,
      paid: items.filter((i) => i.paid).length,
      due: round2(due), got: round2(got), pot: round2(pot),
    },
    businesses: items,
  };
}

// ------------------------------------------------------------------
// Collegare a mano un'attivita' a un promoter (anche se non si e' registrata col suo codice)
// ------------------------------------------------------------------
const NEED_SQL = 'Prima esegui in Supabase lo script SQL 20261103_promoter.sql, poi riprova.';
const isMissingColumn = (e) => /column .* does not exist|could not find the .* column|schema cache/i.test(String(e && e.message));

async function assign(partnerId, businessId, paidOn, { get, send }) {
  if (!UUID.test(String(businessId || ''))) throw bad('Scegli un\'attività.');
  const [prt, biz, subs, exist] = await Promise.all([
    get('referral_partners?id=eq.' + partnerId + '&select=*'),
    get('businesses?id=eq.' + businessId + '&select=id,name,created_at'),
    get('subscriptions?business_id=eq.' + businessId + '&select=status,started_at&order=started_at.desc,id.asc&limit=1'),
    get('referrals?referred_business_id=eq.' + businessId + '&select=*'),
  ]);
  const partner = prt && prt[0], business = biz && biz[0];
  if (!partner) throw bad('Persona non trovata.');
  if (!business) throw bad('Attività non trovata.');
  const sub = subs && subs[0];
  const paying = !!(sub && sub.status !== 'trial' && sub.status !== 'cancelled');

  const old = exist && exist[0];
  if (old) {
    if (old.partner_id === partnerId) throw bad('Questa attività è già assegnata a questa persona.');
    if (old.referrer_business_id) throw bad('È arrivata dal link di un\'altra attività, che ne ha già il credito: non la sposto.');
    if (old.reward_paid_at || old.reward2_paid_at) throw bad('Al promoter che l\'aveva portata hai già pagato il premio: non posso spostarla.');
  }

  // data del primo pagamento: quella che scrivi tu, altrimenti il primo "segnato come pagato", altrimenti l'inizio dell'abbonamento
  let paidAt = null;
  if (paying) {
    if (paidOn) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(paidOn))) throw bad('Data del primo pagamento non valida.');
      paidAt = new Date(paidOn + 'T12:00:00Z');
      if (isNaN(paidAt) || paidAt.getTime() > Date.now() + 86400000) throw bad('La data del primo pagamento non può essere nel futuro.');
    } else if (old && old.status === 'paid' && old.paid_at) {
      paidAt = new Date(old.paid_at);
    } else {
      let first = null;
      try {
        const a = await get('audit_logs?business_id=eq.' + businessId + '&action=eq.mark_paid&select=created_at&order=created_at.asc&limit=1');
        first = a && a[0] ? a[0].created_at : null;
      } catch (e) { /* senza storico si usa l'inizio dell'abbonamento */ }
      paidAt = new Date(first || (sub && sub.started_at) || Date.now());
    }
  }
  const reward = round2(partner.reward_eur);
  const fields = {
    partner_id: partner.id, code: partner.code, referrer_business_id: null, referred_name: business.name,
    status: paying ? 'paid' : 'trial', paid_at: paidAt ? paidAt.toISOString() : null, reward_eur: paying ? reward : null,
    reward2_eur: null, reward2_at: null, assigned_manually: true,
  };
  try {
    if (old) await send('PATCH', 'referrals?id=eq.' + old.id, fields);
    else await send('POST', 'referrals', Object.assign({ referred_business_id: businessId, created_at: business.created_at }, fields), 'return=minimal');
  } catch (e) {
    if (isMissingColumn(e)) throw bad(NEED_SQL);
    if (/duplicate|unique/i.test(String(e && e.message))) throw bad('Questa attività è già collegata a un promoter.');
    throw e;
  }
  return { ok: true, status: fields.status, paid_at: fields.paid_at, moved: !!old, business: business.name, partner: partner.name };
}

async function unassign(businessId, { get, send }) {
  if (!UUID.test(String(businessId || ''))) throw bad('Attività non valida.');
  const rows = await get('referrals?referred_business_id=eq.' + businessId + '&partner_id=not.is.null&select=*');
  const r = rows && rows[0];
  if (!r) throw bad('Questa attività non è collegata a nessun promoter.');
  if (r.reward_paid_at || r.reward2_paid_at) throw bad('Al promoter hai già pagato un premio per questa attività: non posso toglierla.');
  await send('DELETE', 'referrals?id=eq.' + r.id);
  return { ok: true };
}

module.exports = { evaluate, settle, viewFor, loadContext, assign, unassign, nameKey, sameName, cleanCode, addMonths, UUID, NEED_SQL };
