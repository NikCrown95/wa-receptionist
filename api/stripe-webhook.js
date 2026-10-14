// api/stripe-webhook.js — Stripe ci avvisa di pagamenti, rinnovi e disdette; qui aggiorniamo l'abbonamento.
//
// URL da dare a Stripe: https://prenolia.it/api/stripe-webhook
// Eventi da attivare: checkout.session.completed, invoice.paid, invoice.payment_failed,
//                     customer.subscription.updated, customer.subscription.deleted
//
// Regole:
//  - la firma si controlla sul testo esatto ricevuto (per questo la lettura automatica del corpo e' spenta)
//  - ogni evento si elabora una sola volta (tabella stripe_events)
//  - si considera "pagato" solo un addebito reale (importo > 0): la fattura da 0 € all'inizio della prova non conta
//  - la disdetta fa restare attivo il piano fino a fine periodo: lo stato diventa "cancelled" solo quando Stripe lo chiude davvero

const stripe = require("../lib/stripe.js");
const billing = require("../lib/billing.js");
const { sb } = billing;

function rawBody(req) {
  return new Promise((resolve) => {
    if (typeof req.body === "string") return resolve(req.body);
    if (Buffer.isBuffer(req.body)) return resolve(req.body.toString("utf8"));
    if (req.readable === false && req.body && typeof req.body === "object") return resolve(JSON.stringify(req.body));
    const chunks = [];
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(""));
  });
}

const iso = (unix) => (unix ? new Date(Number(unix) * 1000).toISOString() : null);
const enc = encodeURIComponent;

function subIdOf(inv) {
  return inv.subscription || (inv.parent && inv.parent.subscription_details && inv.parent.subscription_details.subscription) || null;
}
function metaBizOf(obj) {
  const m1 = obj.metadata && obj.metadata.business_id;
  const sd = obj.subscription_details || (obj.parent && obj.parent.subscription_details) || null;
  const m2 = sd && sd.metadata && sd.metadata.business_id;
  return m1 || m2 || obj.client_reference_id || null;
}
function periodEndOf(inv) {
  let end = 0;
  ((inv.lines && inv.lines.data) || []).forEach((l) => { if (l.period && l.period.end > end) end = l.period.end; });
  return end || (inv.period_end || 0);
}
function subPeriodEnd(sub) {
  return sub.current_period_end || (sub.items && sub.items.data && sub.items.data[0] && sub.items.data[0].current_period_end) || 0;
}

async function findRow(o) {
  if (o.subId) {
    const r = await sb("GET", "subscriptions?stripe_subscription_id=eq." + enc(o.subId) + "&select=" + billing.SUB_FIELDS + "&limit=1");
    if (r.ok && Array.isArray(r.data) && r.data.length) return r.data[0];
  }
  if (o.businessId) {
    const row = await billing.latestSub(o.businessId);
    if (row) return row;
  }
  if (o.customerId) {
    const r = await sb("GET", "subscriptions?stripe_customer_id=eq." + enc(o.customerId) + "&select=" + billing.SUB_FIELDS + "&order=started_at.desc&limit=1");
    if (r.ok && Array.isArray(r.data) && r.data.length) return r.data[0];
  }
  return null;
}

async function patch(row, fields) {
  const r = await sb("PATCH", "subscriptions?id=eq." + enc(row.id), fields);
  if (!r.ok) throw new Error("aggiornamento abbonamento non riuscito (" + r.status + ")");
}

async function mailOnce(businessId, key, kind, extra) {
  if (await billing.alreadySent(businessId, key)) return;
  const ok = await billing.sendBillingMail(businessId, kind, extra).catch(() => false);
  if (ok) await billing.markSent(businessId, key, kind);
}

const HANDLERS = {
  // Il titolare ha completato il pagamento (o la prova con carta): colleghiamo Stripe all'attivita'
  async "checkout.session.completed"(s) {
    if (s.mode && s.mode !== "subscription") return;
    const businessId = metaBizOf(s);
    if (!businessId || !s.subscription) return;
    const row = await findRow({ businessId });
    if (!row) return;
    await patch(row, { stripe_customer_id: s.customer || null, stripe_subscription_id: s.subscription, cancel_at_period_end: false });
    const inTrial = row.status === "trial" && row.trial_ends_at && new Date(row.trial_ends_at).getTime() > Date.now() + 86400000;
    await mailOnce(businessId, "welcome:" + s.id, "welcome", inTrial ? { firstChargeAt: row.trial_ends_at } : {});
  },

  // Pagamento riuscito: il piano e' attivo fino alla fine del periodo pagato
  async "invoice.paid"(inv) {
    if (!(inv.amount_paid > 0)) return;
    const row = await findRow({ subId: subIdOf(inv), businessId: metaBizOf(inv), customerId: inv.customer });
    if (!row) { console.error("invoice.paid senza abbonamento collegato", inv.id); return; }
    const end = periodEndOf(inv);
    const f = { status: "active", cancelled_at: null };
    if (end) f.current_period_end = iso(end);
    if (!row.stripe_subscription_id && subIdOf(inv)) f.stripe_subscription_id = subIdOf(inv);
    if (!row.stripe_customer_id && inv.customer) f.stripe_customer_id = inv.customer;
    await patch(row, f);
    // referral: il primo mese pagato fa scattare il premio (la funzione ignora chi non e' stato invitato)
    await sb("POST", "rpc/referral_on_paid", { p_business: row.business_id }).catch(() => {});
  },

  // Pagamento fallito: avvisiamo il titolare una volta per fattura. Lo stato non si tocca: decide la scadenza + tolleranza.
  async "invoice.payment_failed"(inv) {
    const row = await findRow({ subId: subIdOf(inv), businessId: metaBizOf(inv), customerId: inv.customer });
    if (!row || row.status === "cancelled") return;
    const end = row.status === "trial" ? row.trial_ends_at : row.current_period_end;
    const graceEnds = end ? new Date(new Date(end).getTime() + (Number(row.grace_days) || 3) * 86400000).toISOString() : null;
    await mailOnce(row.business_id, "pf:" + inv.id, "payment_failed", { graceEnds });
  },

  // Cambio di stato: soprattutto "disdetta a fine periodo" (e il suo annullamento)
  async "customer.subscription.updated"(sub, ev) {
    const row = await findRow({ subId: sub.id, businessId: metaBizOf(sub), customerId: sub.customer });
    if (!row) return;
    const willCancel = !!(sub.cancel_at_period_end || sub.cancel_at);
    const fields = {};
    if (!!row.cancel_at_period_end !== willCancel) fields.cancel_at_period_end = willCancel;
    if (!row.stripe_subscription_id) fields.stripe_subscription_id = sub.id;
    if (!row.stripe_customer_id && sub.customer) fields.stripe_customer_id = sub.customer;
    if (Object.keys(fields).length) await patch(row, fields);
    const before = ev && ev.data && ev.data.previous_attributes;
    if (willCancel && !row.cancel_at_period_end && before && ("cancel_at_period_end" in before || "cancel_at" in before)) {
      const end = sub.cancel_at || subPeriodEnd(sub);
      await mailOnce(row.business_id, "cancel:" + sub.id + ":" + end, "cancelled", { endsAt: iso(end) || row.current_period_end });
    }
  },

  // Stripe ha chiuso l'abbonamento (fine periodo dopo la disdetta, o troppi pagamenti falliti)
  async "customer.subscription.deleted"(sub) {
    const row = await findRow({ subId: sub.id });
    if (!row) return;
    await patch(row, { status: "cancelled", cancelled_at: new Date().toISOString(), cancel_at_period_end: false });
  },
};

async function handle(ev) {
  const h = HANDLERS[ev.type];
  if (h) await h(ev.data && ev.data.object ? ev.data.object : {}, ev);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return res.status(503).json({ error: "Webhook non configurato" });

  const raw = await rawBody(req);
  if (!stripe.verifySignature(raw, req.headers["stripe-signature"], secret)) return res.status(400).json({ error: "Firma non valida" });
  let ev;
  try { ev = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: "Corpo non valido" }); }
  if (!ev || !ev.id || !ev.type) return res.status(400).json({ error: "Evento non valido" });

  // gia' elaborato? (Stripe puo' inviare lo stesso evento piu' volte)
  const ins = await sb("POST", "stripe_events", { id: ev.id, type: ev.type }, "return=minimal");
  if (!ins.ok) {
    if (ins.status === 409) return res.status(200).json({ ok: true, duplicate: true });
    console.error("stripe_events", ins.status, ins.data);
    return res.status(500).json({ error: "Errore database" });
  }
  try {
    await handle(ev);
    return res.status(200).json({ ok: true });
  } catch (e) {
    // si libera l'evento cosi' il nuovo tentativo di Stripe viene elaborato davvero
    await sb("DELETE", "stripe_events?id=eq." + enc(ev.id)).catch(() => {});
    console.error("stripe-webhook", ev.type, e && e.message);
    return res.status(500).json({ error: "Errore nell'elaborazione" });
  }
};

// Il corpo deve arrivare "grezzo": la firma di Stripe si controlla sul testo esatto.
module.exports.config = { api: { bodyParser: false } };
