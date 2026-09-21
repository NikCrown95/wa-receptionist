// api/recap.js  (Lia: recap del mattino per il titolare, su Telegram e/o WhatsApp)
// Parte da solo ogni giorno (vedi vercel.json). Per provarlo a mano:
//   https://TUO-SITO.vercel.app/api/recap?key=IL_TUO_CRON_SECRET
// Variabili su Vercel: CRON_SECRET, TELEGRAM_BOT_TOKEN, SUPABASE_URL, SUPABASE_SECRET_KEY.
// Per WhatsApp (spento finché non lo configuri): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_WHATSAPP_FROM e, se usi un modello approvato, TWILIO_RECAP_TEMPLATE_SID.

const { sb, agendaBundle, sendTelegram, sendWhatsAppRecap } = require("../lib/owner.js");

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
      "businesses?active=eq.true&recap_enabled=eq.true" +
        "&or=(owner_telegram_chat_id.not.is.null,owner_whatsapp.not.is.null)" +
        "&select=id,name,timezone,owner_telegram_chat_id,owner_whatsapp,recap_whatsapp"
    );
    if (!r.ok || !Array.isArray(r.data)) return res.status(500).json({ error: "Errore lettura attività" });

    const out = { telegram: 0, whatsapp: 0, failed: 0 };
    for (const biz of r.data) {
      try {
        const bundle = await agendaBundle(biz, 0, { greeting: true });
        if (biz.owner_telegram_chat_id) {
          if (await sendTelegram(biz.owner_telegram_chat_id, bundle.text)) out.telegram++;
          else out.failed++;
        }
        if (biz.recap_whatsapp && biz.owner_whatsapp && process.env.TWILIO_WHATSAPP_FROM) {
          if (await sendWhatsAppRecap(biz.owner_whatsapp, bundle)) out.whatsapp++;
          else out.failed++;
        }
      } catch (e) {
        console.error("Recap fallito per", biz.name, e);
        out.failed++;
      }
    }
    return res.status(200).json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Errore" });
  }
};
