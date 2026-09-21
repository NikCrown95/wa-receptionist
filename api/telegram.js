// api/telegram.js  (Lia v5: canale Telegram)
// Variabile su Vercel: TELEGRAM_WEBHOOK_SECRET (una parola segreta scelta da te).
// Link per i clienti: https://t.me/NOME_DEL_BOT?start=SLUG_DELL_ATTIVITA

const { handleMessage, getBusiness, sb } = require("../lib/lia.js");

module.exports = async (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  if (!secret || req.headers["x-telegram-bot-api-secret-token"] !== secret) {
    return res.status(401).send("no");
  }

  const msg = (req.body || {}).message;
  if (!msg || !msg.chat) return res.status(200).json({ ok: true });

  const chatId = msg.chat.id;
  const contactId = "tg:" + chatId;
  const reply = (text) => res.status(200).json({ method: "sendMessage", chat_id: chatId, text: text });

  try {
    if (typeof msg.text !== "string") return reply("Per ora capisco solo i messaggi scritti. Scrivimi pure cosa ti serve.");
    const text = msg.text.trim();

    // Il cliente arriva dal link/QR di un'attività: "/start slug"
    const m = text.match(/^\/start(?:@\w+)?(?:\s+([a-zA-Z0-9-]{1,60}))?$/);
    if (m) {
      let biz = null;
      if (m[1]) {
        biz = await getBusiness(m[1].toLowerCase());
        if (!biz) return reply("Non trovo questa attività. Controlla il link o il QR che hai usato.");
        await sb("POST", "contact_business", { contact_id: contactId, business_id: biz.id, updated_at: new Date().toISOString() }, "resolution=merge-duplicates");
      } else {
        biz = await getBusiness(process.env.BUSINESS_SLUG || "barbiere-mario");
      }
      const nome = biz ? biz.name : "questa attività";
      return reply("Ciao! Sono la segretaria virtuale di " + nome + ". Come posso aiutarti?");
    }

    // A quale attività appartiene questo cliente?
    let slug;
    const mapped = await sb("GET", "contact_business?contact_id=eq." + encodeURIComponent(contactId) + "&select=businesses(slug)");
    if (mapped.ok && Array.isArray(mapped.data) && mapped.data.length && mapped.data[0].businesses) {
      slug = mapped.data[0].businesses.slug;
    }

    const out = await handleMessage({ channel: "telegram", contactId: contactId, phone: null, slug: slug, text: text });
    return reply(out.reply || "Scusa, ho avuto un problema. Riprova tra un attimo.");
  } catch (e) {
    console.error(e);
    return reply("Scusa, ho avuto un problema. Riprova tra un attimo.");
  }
};
