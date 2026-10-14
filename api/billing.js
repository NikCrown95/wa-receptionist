// api/billing.js — abbonamento del titolare: stato, attivazione (Stripe Checkout) e gestione (Portale clienti Stripe).
// Si entra con il codice segreto dell'agenda (?t=...), come per il resto dell'agenda.
//
//   GET  /api/billing?t=...                      -> stato dell'abbonamento
//   POST /api/billing?t=...  {action:"checkout"} -> { url } pagina di pagamento Stripe
//   POST /api/billing?t=...  {action:"portal"}   -> { url } portale: carta, fatture, disdetta

const stripe = require("../lib/stripe.js");
const billing = require("../lib/billing.js");
const site = require("../lib/site.js");
const { sb } = billing;

const MIN_TRIAL_MS = 49 * 3600 * 1000; // Stripe accetta una prova residua solo se dura almeno 48 ore

function view(sub, configured) {
  const has = !!(sub && sub.stripe_subscription_id);
  const cancelled = !!(sub && sub.status === "cancelled");
  return {
    configured,
    status: sub ? sub.status : null,
    trial_ends_at: sub ? sub.trial_ends_at : null,
    period_end: sub ? sub.current_period_end : null,
    cancel_at_period_end: !!(sub && sub.cancel_at_period_end),
    has_stripe: has,
    price_eur: sub && sub.plans ? Number(sub.plans.price_eur) : null,
    can_subscribe: configured && !!sub && (!has || cancelled),
    can_manage: configured && !!(sub && sub.stripe_customer_id),
  };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const q = req.query || {};
  const token = String(q.t || "").trim();
  if (!/^[a-f0-9]{32,128}$/.test(token)) return res.status(404).json({ error: "Link non valido" });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return res.status(503).json({ error: "Servizio non configurato" });

  try {
    const br = await sb("GET", "businesses?agenda_token=eq." + token + "&active=eq.true&select=id,name&limit=1");
    if (!br.ok || !Array.isArray(br.data) || !br.data.length) return res.status(404).json({ error: "Link non valido" });
    const biz = br.data[0];
    const sub = await billing.latestSub(biz.id);
    const configured = stripe.configured();

    if (req.method === "GET") return res.status(200).json(view(sub, configured));
    if (req.method !== "POST") return res.status(405).json({ error: "Metodo non consentito" });

    const action = String((req.body || {}).action || "");
    if (!configured) return res.status(503).json({ error: "I pagamenti online non sono ancora attivi. Scrivici dall'assistenza e ti attiviamo l'abbonamento." });
    if (!sub) return res.status(409).json({ error: "Piano non ancora configurato. Scrivi all'assistenza." });
    const base = site.baseUrl();
    const back = base + "/api/agenda?t=" + token;

    if (action === "checkout") {
      if (sub.stripe_subscription_id && sub.status !== "cancelled") return res.status(409).json({ error: "Hai già un abbonamento attivo.", can_manage: true });
      const priceId = process.env.STRIPE_PRICE_ID;
      const cents = Math.round(Number(sub.plans && sub.plans.price_eur) * 100);
      if (!priceId && !(cents > 0)) return res.status(500).json({ error: "Prezzo non configurato" });
      const params = {
        mode: "subscription",
        locale: "it",
        client_reference_id: biz.id,
        metadata: { business_id: biz.id },
        success_url: back + "&abbonamento=ok",
        cancel_url: back + "&abbonamento=no",
        billing_address_collection: "required",
        tax_id_collection: { enabled: true },
        line_items: [priceId
          ? { price: priceId, quantity: 1 }
          : { quantity: 1, price_data: { currency: "eur", unit_amount: cents, recurring: { interval: "month" }, product_data: { name: "Prenolia Smart" } } }],
        subscription_data: { metadata: { business_id: biz.id } },
      };
      if (sub.stripe_customer_id) {
        params.customer = sub.stripe_customer_id;
        params.customer_update = { name: "auto", address: "auto" };
      } else {
        const email = await billing.ownerEmail(biz.id);
        if (email) params.customer_email = email;
      }
      // Se la prova non e' finita il primo addebito parte alla fine della prova: nessun giorno regalato, nessun doppio pagamento.
      if (sub.status === "trial" && sub.trial_ends_at && new Date(sub.trial_ends_at).getTime() - Date.now() >= MIN_TRIAL_MS) {
        params.subscription_data.trial_end = Math.floor(new Date(sub.trial_ends_at).getTime() / 1000);
      }
      const s = await stripe.call("POST", "/checkout/sessions", params);
      return res.status(200).json({ url: s.url });
    }

    if (action === "portal") {
      if (!sub.stripe_customer_id) return res.status(409).json({ error: "Non c'è ancora un abbonamento da gestire." });
      const p = await stripe.call("POST", "/billing_portal/sessions", { customer: sub.stripe_customer_id, return_url: back + "&abbonamento=ok", locale: "it" });
      return res.status(200).json({ url: p.url });
    }

    return res.status(400).json({ error: "Richiesta non valida" });
  } catch (e) {
    console.error("billing error", e && e.message);
    return res.status(502).json({ error: "Non riesco a collegarmi al pagamento in questo momento. Riprova tra poco." });
  }
};
