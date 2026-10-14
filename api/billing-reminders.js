// api/billing-reminders.js — email di servizio sull'abbonamento (una volta al giorno, vedi vercel.json):
//   - 3 giorni prima della fine della prova gratuita (solo a chi non ha ancora attivato l'abbonamento)
//   - quando l'abbonamento e' scaduto e si entra nei giorni di tolleranza
//   - quando la tolleranza finisce e il servizio va in pausa
// Protetto da CRON_SECRET come gli altri. Resta spento finche' non imposti BILLING_EMAILS=1 su Vercel.
// Ogni email parte una sola volta (registro in audit_logs).

const billing = require("../lib/billing.js");
const { sb } = billing;

const DAY = 86400000;

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.authorization || "";
  const key = (req.query || {}).key;
  if (!secret || (auth !== "Bearer " + secret && key !== secret)) return res.status(401).json({ error: "unauthorized" });
  if (process.env.BILLING_EMAILS !== "1") return res.status(200).json({ skipped: "BILLING_EMAILS non attivo" });

  const out = { checked: 0, trial_ending: 0, grace: 0, suspended: 0, failed: 0 };
  try {
    const r = await sb("GET", "subscriptions?status=in.(trial,active,past_due)&select=" + billing.SUB_FIELDS + "&order=started_at.desc&limit=2000");
    if (!r.ok || !Array.isArray(r.data)) return res.status(500).json({ error: "lettura abbonamenti non riuscita" });
    const seen = new Set();
    const now = Date.now();
    for (const s of r.data) {
      if (seen.has(s.business_id)) continue; // solo l'abbonamento piu' recente di ogni attivita'
      seen.add(s.business_id);
      if (s.suspended_manually) continue;
      const base = s.status === "trial" ? s.trial_ends_at : s.current_period_end;
      if (!base) continue;
      out.checked++;
      const end = new Date(base).getTime();
      const grace = (Number(s.grace_days) || 3) * DAY;
      const hasStripe = !!s.stripe_subscription_id;
      let kind = null, extra = {}, k = null;

      if (s.status === "trial" && !hasStripe && end - now > 2 * DAY && end - now <= 3 * DAY) {
        kind = "trial_ending"; k = "trial_ending:" + s.id; extra = { endsAt: base, graceDays: Number(s.grace_days) || 3 };
      } else if (now > end && now <= end + grace && (!hasStripe || now > end + DAY)) {
        kind = "grace"; k = "grace:" + s.id + ":" + new Date(end).toISOString().slice(0, 10); extra = { graceEnds: new Date(end + grace).toISOString(), graceDays: Number(s.grace_days) || 3 };
      } else if (now > end + grace && now <= end + grace + 3 * DAY) {
        kind = "suspended"; k = "suspended:" + s.id + ":" + new Date(end).toISOString().slice(0, 10);
      }
      if (!kind) continue;
      try {
        if (await billing.alreadySent(s.business_id, k)) continue;
        const ok = await billing.sendBillingMail(s.business_id, kind, extra);
        if (ok) { await billing.markSent(s.business_id, k, kind); out[kind]++; }
      } catch (e) { out.failed++; console.error("billing-reminders", kind, e && e.message); }
    }
    return res.status(200).json(out);
  } catch (e) {
    console.error("billing-reminders", e && e.message);
    return res.status(500).json({ error: "errore" });
  }
};
