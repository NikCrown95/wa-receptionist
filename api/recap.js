// api/recap.js  (Lia: recap del mattino per il titolare, su Telegram)
// Parte da solo ogni giorno (vedi vercel.json). Per provarlo a mano:
//   https://TUO-SITO.vercel.app/api/recap?key=IL_TUO_CRON_SECRET
// Variabili su Vercel: CRON_SECRET, TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SECRET_KEY.

const { sb, agendaText, sendTelegram } = require("../lib/owner.js");

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.authorization || "";
  const key = (req.query || {}).key;
  if (!secret || (auth !== "Bearer " + secret && key !== secret)) {
    return res.status(401).send("no");
  }

  try {
    const r = await sb(
      "GET",
      "businesses?active=eq.true&recap_enabled=eq.true&owner_telegram_chat_id=not.is.null" +
        "&select=id,name,timezone,owner_telegram_chat_id"
    );
    if (!r.ok || !Array.isArray(r.data)) return res.status(500).json({ error: "Errore lettura attività" });

    let sent = 0;
    let failed = 0;
    for (const biz of r.data) {
      try {
        const text = await agendaText(biz, 0, { greeting: true });
        const ok = await sendTelegram(biz.owner_telegram_chat_id, text);
        if (ok) sent++;
        else failed++;
      } catch (e) {
        console.error("Recap fallito per", biz.name, e);
        failed++;
      }
    }
    return res.status(200).json({ sent: sent, failed: failed });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Errore" });
  }
};
