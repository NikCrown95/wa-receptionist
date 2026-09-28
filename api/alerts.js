// api/alerts.js  (Lia: allarmi orari della Super Dashboard su Telegram)
//
// Chiamato da Vercel Cron ogni ora (vedi vercel.json). Controlla:
//   - clienti appena entrati in tolleranza o sospesi
//   - clienti che rinnovano domani (un avviso, il giorno prima)
//   - un costo AI di oggi molto piu' alto del solito
// Ogni allarme ha una "chiave" salvata in admin_alerts_sent: se la chiave esiste
// gia', non si rimanda lo stesso avviso. Protetto da CRON_SECRET, come /api/recap.

const { sb, sendTelegram } = require("../lib/owner.js");
const { buildAlerts } = require("../lib/alerts_logic.js");

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.authorization || "";
  const key = (req.query || {}).key;
  if (!secret || (auth !== "Bearer " + secret && key !== secret)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const out = { checked: true, candidates: 0, sent: 0, skipped_dupe: 0, failed: 0, chats: 0 };
  try {
    const [chatsRes, accessRes, subsRes, dailyRes] = await Promise.all([
      sb("GET", "admin_alert_chats?channel=eq.telegram&active=eq.true&select=chat_id"),
      sb("GET", "service_access_v?select=business_id,state,plan_name,grace_ends,businesses(name)"),
      sb("GET", "subscriptions?status=eq.active&select=business_id,status,current_period_end,plans(name),businesses(name)"),
      sb("GET", "ai_cost_daily_v?select=day,cost_eur&order=day.asc"),
    ]);

    const chats = (chatsRes.ok && Array.isArray(chatsRes.data) ? chatsRes.data : []).map((c) => c.chat_id);
    out.chats = chats.length;

    const businesses = (accessRes.ok && Array.isArray(accessRes.data) ? accessRes.data : []).map((r) => ({
      id: r.business_id, name: (r.businesses && r.businesses.name) || "Un\u2019attivit\u00e0", plan_name: r.plan_name, service_state: r.state, grace_ends: r.grace_ends,
    }));
    const subscriptions = (subsRes.ok && Array.isArray(subsRes.data) ? subsRes.data : []).map((r) => ({
      business_id: r.business_id, name: (r.businesses && r.businesses.name) || "Un\u2019attivit\u00e0", plan_name: r.plans && r.plans.name, status: r.status, current_period_end: r.current_period_end,
    }));
    const aiDaily = (dailyRes.ok && Array.isArray(dailyRes.data) ? dailyRes.data : []).map((r) => ({ day: String(r.day).slice(0, 10), cost: Number(r.cost_eur) || 0 }));

    const alerts = buildAlerts({ businesses, subscriptions, aiDaily }, new Date());
    out.candidates = alerts.length;

    if (!chats.length) {
      out.note = "Nessuna chat collegata: apri il link /start admin_... su Telegram.";
      return res.status(200).json(out);
    }

    for (const a of alerts) {
      // provo a "prenotare" la chiave: se esiste gia', l'ho gia' mandato
      const ins = await sb("POST", "admin_alerts_sent", { alert_key: a.alert_key, kind: a.kind, business_id: a.business_id, details: a.details || {} });
      if (!ins.ok) {
        if (ins.status === 409) { out.skipped_dupe++; continue; }
        out.failed++;
        continue;
      }
      let allOk = true;
      for (const chatId of chats) {
        const ok = await sendTelegram(chatId, a.text);
        if (!ok) allOk = false;
      }
      if (allOk) out.sent++; else out.failed++;
    }

    res.status(200).json(out);
  } catch (e) {
    console.error("alerts cron error", e);
    res.status(500).json({ error: "alerts_error", detail: String((e && e.message) || e) });
  }
};
