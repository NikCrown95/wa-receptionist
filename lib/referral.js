// lib/referral.js
//
// Logica del sistema referral (link "invita un amico" delle attivita' + link delle persone esterne).
// Usata sia dalla super dashboard (api/admin/clients.js) sia dalla dashboard dell'attivita' (api/agenda.js).
//
// Non apre connessioni da sola: riceve due funzioni dal chiamante
//   get(path)               -> array di righe (tutte le pagine) da Supabase REST
//   send(method, path, body)-> esegue una scrittura/rpc e restituisce il json
// cosi' funziona con gli helper diversi dei due file.

const MS_DAY = 86400000;

function baseUrl() {
  return String(process.env.REFERRAL_BASE_URL || process.env.PUBLIC_URL || 'https://wa-receptionist-sigma.vercel.app').replace(/\/+$/, '');
}

function referralLink(code) {
  return baseUrl() + '/registrati.html?ref=' + encodeURIComponent(String(code || ''));
}

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

async function planPrices(get) {
  const rows = await get('plans?select=name,price_eur');
  const by = {};
  (rows || []).forEach((p) => { by[p.name] = Number(p.price_eur); });
  return { base: by['Base'] || 0, premium: by['Base+Lia'] || 0 };
}

async function trialDays(get) {
  try {
    const rows = await get("app_settings?key=eq.trial_days&select=value");
    const n = parseInt(rows && rows[0] && rows[0].value, 10);
    return n >= 1 && n <= 365 ? n : 30;
  } catch (e) {
    return 30;
  }
}

// ------------------------------------------------------------------
// Super dashboard: tutto quello che serve alla pagina "Referral"
// ------------------------------------------------------------------
async function adminOverview(get) {
  const [refs, biz, partners, subs, prices, tdays] = await Promise.all([
    get('referrals?select=*&order=created_at.desc,id.asc'),
    get('businesses?select=id,name,referral_code&order=id.asc'),
    get('referral_partners?select=*&order=created_at.desc,id.asc'),
    get('subscriptions?select=business_id,status,trial_ends_at,started_at&order=started_at.desc,id.asc'),
    planPrices(get),
    trialDays(get),
  ]);

  const bizById = {};
  (biz || []).forEach((b) => { bizById[b.id] = b; });
  const partnerById = {};
  (partners || []).forEach((p) => { partnerById[p.id] = p; });
  const subOf = {};
  (subs || []).forEach((s) => { if (!subOf[s.business_id]) subOf[s.business_id] = s; }); // la piu' recente

  const referred = (refs || []).map((r) => {
    const refBiz = r.referrer_business_id ? bizById[r.referrer_business_id] : null;
    const partner = r.partner_id ? partnerById[r.partner_id] : null;
    const cur = r.referred_business_id ? bizById[r.referred_business_id] : null;
    const sub = r.referred_business_id ? subOf[r.referred_business_id] : null;
    return {
      id: r.id,
      business_id: r.referred_business_id || null,
      name: (cur && cur.name) || r.referred_name || 'Attivita\' eliminata',
      via_kind: r.partner_id ? 'partner' : 'business',
      via_id: r.partner_id || r.referrer_business_id || null,
      via_name: partner ? partner.name : (refBiz ? refBiz.name : 'Attivita\' eliminata'),
      status: r.status,
      created_at: r.created_at,
      paid_at: r.paid_at,
      trial_ends_at: sub && sub.status === 'trial' ? sub.trial_ends_at : null,
      sub_status: sub ? sub.status : null,
      reward_eur: r.reward_eur == null ? null : Number(r.reward_eur),
      reward_paid_at: r.reward_paid_at,
    };
  });

  // crediti Premium accumulati dalle attivita' che invitano
  const byBiz = {};
  (refs || []).forEach((r) => {
    if (!r.referrer_business_id) return;
    const x = byBiz[r.referrer_business_id] || (byBiz[r.referrer_business_id] = { invited: 0, trial: 0, paid: 0 });
    x.invited += 1;
    if (r.status === 'paid') x.paid += 1; else x.trial += 1;
  });
  const credits = Object.keys(byBiz).map((id) => {
    const b = bizById[id];
    const x = byBiz[id];
    return {
      business_id: id,
      name: b ? b.name : 'Attivita\' eliminata',
      code: b ? b.referral_code : null,
      link: b && b.referral_code ? referralLink(b.referral_code) : null,
      invited: x.invited,
      in_trial: x.trial,
      paid: x.paid,
      credit_months: x.paid,
      credit_value_eur: round2(x.paid * prices.premium),
    };
  }).sort((a, b) => b.credit_months - a.credit_months || b.invited - a.invited || a.name.localeCompare(b.name, 'it'));

  // persone esterne
  const byPartner = {};
  (refs || []).forEach((r) => {
    if (!r.partner_id) return;
    const x = byPartner[r.partner_id] || (byPartner[r.partner_id] = { registered: 0, trial: 0, paid: 0, earned: 0, settled: 0 });
    x.registered += 1;
    if (r.status === 'paid') {
      x.paid += 1;
      const rw = Number(r.reward_eur || 0);
      x.earned += rw;
      if (r.reward_paid_at) x.settled += rw;
    } else x.trial += 1;
  });
  const people = (partners || []).map((p) => {
    const x = byPartner[p.id] || { registered: 0, trial: 0, paid: 0, earned: 0, settled: 0 };
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      link: referralLink(p.code),
      reward_eur: Number(p.reward_eur),
      note: p.note || '',
      active: p.active !== false,
      created_at: p.created_at,
      registered: x.registered,
      in_trial: x.trial,
      paid: x.paid,
      earned_eur: round2(x.earned),
      settled_eur: round2(x.settled),
      due_eur: round2(x.earned - x.settled),
    };
  });

  const totalPaid = referred.filter((r) => r.status === 'paid').length;
  return {
    settings: { trial_days: tdays, base_price: prices.base, premium_price: prices.premium },
    summary: {
      registered: referred.length,
      in_trial: referred.length - totalPaid,
      paid: totalPaid,
      credit_months: credits.reduce((s, c) => s + c.credit_months, 0),
      credit_value_eur: round2(credits.reduce((s, c) => s + c.credit_value_eur, 0)),
      partners_due_eur: round2(people.reduce((s, p) => s + p.due_eur, 0)),
    },
    referred,
    credits,
    partners: people,
  };
}

// ------------------------------------------------------------------
// Azioni della super dashboard sulle persone esterne
// ------------------------------------------------------------------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function bad(msg) { const e = new Error(msg); e.validation = true; return e; }

function slugName(name) {
  return String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'amico';
}

function cleanReward(v, fallback) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(String(v).replace(',', '.'));
  if (!isFinite(n) || n < 0 || n > 10000) throw bad('Il premio deve essere un importo tra 0 e 10000 euro.');
  return round2(n);
}

async function partnerAction(body, { get, send }) {
  const action = String(body.action || '');

  if (action === 'partner_create') {
    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 80) throw bad('Scrivi il nome della persona (da 2 a 80 caratteri).');
    const prices = await planPrices(get);
    const reward = cleanReward(body.reward_eur, prices.base);
    const note = body.note ? String(body.note).trim().slice(0, 300) : null;
    // il codice e' "nome-xxxx"; se per caso esiste gia' (anche come codice di un'attivita') riprovo
    for (let i = 0; i < 6; i++) {
      const code = slugName(name) + '-' + Math.random().toString(16).slice(2, 6);
      const clash = await get('businesses?referral_code=eq.' + encodeURIComponent(code) + '&select=id&limit=1');
      if (clash && clash.length) continue;
      try {
        const rows = await send('POST', 'referral_partners', { name, code, reward_eur: reward, note }, 'return=representation');
        const p = Array.isArray(rows) ? rows[0] : rows;
        return { ok: true, id: p && p.id, code, link: referralLink(code) };
      } catch (e) {
        if (/duplicate|unique/i.test(String(e && e.message))) continue;
        throw e;
      }
    }
    throw new Error('Non sono riuscito a generare un codice libero: riprova.');
  }

  const id = String(body.id || '');
  if (!UUID.test(id)) throw bad('Persona non valida.');

  if (action === 'partner_update') {
    const patch = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim().replace(/\s+/g, ' ');
      if (name.length < 2 || name.length > 80) throw bad('Il nome deve avere da 2 a 80 caratteri.');
      patch.name = name;
    }
    if (body.reward_eur !== undefined) patch.reward_eur = cleanReward(body.reward_eur, 0);
    if (body.note !== undefined) patch.note = String(body.note || '').trim().slice(0, 300) || null;
    if (body.active !== undefined) patch.active = body.active === true;
    if (!Object.keys(patch).length) throw bad('Niente da modificare.');
    await send('PATCH', 'referral_partners?id=eq.' + id, patch);
    return { ok: true };
  }

  if (action === 'partner_payout') {
    // segna come consegnati i premi maturati e non ancora pagati
    const due = await get('referrals?partner_id=eq.' + id + '&status=eq.paid&reward_paid_at=is.null&select=id,reward_eur');
    if (!due.length) throw bad('Non c\'e\' nessun premio da pagare a questa persona.');
    const total = round2(due.reduce((s, r) => s + Number(r.reward_eur || 0), 0));
    await send('PATCH', 'referrals?partner_id=eq.' + id + '&status=eq.paid&reward_paid_at=is.null', { reward_paid_at: new Date().toISOString() });
    return { ok: true, paid_count: due.length, paid_eur: total };
  }

  throw bad('Azione non riconosciuta.');
}

// ------------------------------------------------------------------
// Primo pagamento di un'attivita' uscita dalla prova: se era arrivata da un link, matura il premio.
// Non deve mai far fallire "Segna come pagato".
// ------------------------------------------------------------------
async function onFirstPayment(businessId, send) {
  try {
    const r = await send('POST', 'rpc/referral_on_paid', { p_business: businessId });
    return r || null;
  } catch (e) {
    console.error('referral_on_paid non eseguito:', e && e.message);
    return null;
  }
}

// ------------------------------------------------------------------
// Dashboard dell'attivita': suo codice, suo link e crediti accumulati
// ------------------------------------------------------------------
async function businessInfo(businessId, get) {
  const [mine, refs, prices] = await Promise.all([
    get('businesses?id=eq.' + businessId + '&select=referral_code'),
    get('referrals?referrer_business_id=eq.' + businessId + '&select=referred_business_id,referred_name,status,created_at,paid_at&order=created_at.desc,id.asc'),
    planPrices(get),
  ]);
  const code = mine && mine[0] ? mine[0].referral_code : null;
  const paid = (refs || []).filter((r) => r.status === 'paid').length;
  return {
    code,
    link: code ? referralLink(code) : null,
    credit_months: paid,
    credit_value_eur: round2(paid * prices.premium),
    premium_price: prices.premium,
    invited: (refs || []).length,
    in_trial: (refs || []).length - paid,
    list: (refs || []).slice(0, 50).map((r) => ({
      name: r.referred_name || 'Attivita\'',
      status: r.status,
      created_at: r.created_at,
      paid_at: r.paid_at,
    })),
  };
}

// ------------------------------------------------------------------
// Scheda singola attivita' nella super dashboard: da chi e' arrivata e a chi ha portato lei
// ------------------------------------------------------------------
async function businessDetailInfo(businessId, get) {
  const [mine, incoming, outgoing] = await Promise.all([
    get('businesses?id=eq.' + businessId + '&select=referral_code'),
    get('referrals?referred_business_id=eq.' + businessId + '&select=referrer_business_id,partner_id,status,created_at,paid_at&limit=1'),
    get('referrals?referrer_business_id=eq.' + businessId + '&select=status'),
  ]);
  let from = null;
  const inc = incoming && incoming[0];
  if (inc) {
    let name = null;
    if (inc.partner_id) {
      const p = await get('referral_partners?id=eq.' + inc.partner_id + '&select=name');
      name = p && p[0] ? p[0].name : null;
    } else if (inc.referrer_business_id) {
      const b = await get('businesses?id=eq.' + inc.referrer_business_id + '&select=name');
      name = b && b[0] ? b[0].name : null;
    }
    from = {
      kind: inc.partner_id ? 'partner' : 'business',
      name: name || '—',
      business_id: inc.referrer_business_id || null,
      status: inc.status,
      created_at: inc.created_at,
      paid_at: inc.paid_at,
    };
  }
  const paid = (outgoing || []).filter((r) => r.status === 'paid').length;
  const code = mine && mine[0] ? mine[0].referral_code : null;
  return {
    from,
    code,
    link: code ? referralLink(code) : null,
    invited: (outgoing || []).length,
    paid,
    credit_months: paid,
  };
}

// Per la lista delle attivita': chi ha portato chi (solo per quelle arrivate da un link)
async function sourcesByBusiness(get) {
  const [refs, biz, partners] = await Promise.all([
    get('referrals?referred_business_id=not.is.null&select=referred_business_id,referrer_business_id,partner_id,status'),
    get('businesses?select=id,name&order=id.asc'),
    get('referral_partners?select=id,name'),
  ]);
  const bn = {}; (biz || []).forEach((b) => { bn[b.id] = b.name; });
  const pn = {}; (partners || []).forEach((p) => { pn[p.id] = p.name; });
  const out = {};
  (refs || []).forEach((r) => {
    out[r.referred_business_id] = {
      via: r.partner_id ? pn[r.partner_id] : bn[r.referrer_business_id],
      kind: r.partner_id ? 'partner' : 'business',
      status: r.status,
    };
  });
  return out;
}

module.exports = {
  baseUrl, referralLink, planPrices, trialDays,
  adminOverview, partnerAction, onFirstPayment,
  businessInfo, businessDetailInfo, sourcesByBusiness,
  MS_DAY,
};
