// api/telegram.js  (Lia v6: canale Telegram per i clienti e per il titolare)
// Variabili su Vercel: TELEGRAM_WEBHOOK_SECRET (parola segreta) e TELEGRAM_BOT_TOKEN (il token di BotFather).
// Link per i clienti: https://t.me/NOME_DEL_BOT?start=SLUG_DELL_ATTIVITA

const { handleMessage, getBusiness } = require("../lib/lia.js");
const { sb, agendaText } = require("../lib/owner.js");

module.exports = async (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET || "";

  // Collegamento automatico con Telegram: si apre UNA volta questo link
  //   https://TUO-SITO.vercel.app/api/telegram?setup=LA_PAROLA_SEGRETA
  if (req.method === "GET") {
    const q = req.query || {};
    if (!secret || q.setup !== secret) return res.status(401).send("no");
    const token = process.env.TELEGRAM_BOT_TOKEN || "";
    if (!token) return res.status(500).send("Manca TELEGRAM_BOT_TOKEN su Vercel.");
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    try {
      const r = await fetch("https://api.telegram.org/bot" + token + "/setWebhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://" + host + "/api/telegram", secret_token: secret, allowed_updates: ["message"] }),
      });
      const d = await r.json();
      return res.status(200).send(d.ok ? "Fatto: Telegram è collegato." : "Errore di Telegram: " + (d.description || "sconosciuto"));
    } catch (e) {
      return res.status(500).send("Errore di collegamento con Telegram.");
    }
  }

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

    // Il titolare collega la sua chat: "/start owner_CODICE"
    const own = text.match(/^\/start(?:@\w+)?\s+owner_([a-f0-9]{8,32})$/i);
    if (own) {
      const b = await sb("GET", "businesses?owner_code=eq." + own[1].toLowerCase() + "&active=eq.true&select=id,name");
      if (!b.ok || !Array.isArray(b.data) || !b.data.length) return reply("Questo codice non è valido.");
      await sb("PATCH", "businesses?id=eq." + b.data[0].id, { owner_telegram_chat_id: chatId });
      return reply("Fatto! Da ora ricevi qui l'agenda di " + b.data[0].name + " ogni mattina.\n\nComandi:\n/oggi - appuntamenti di oggi\n/domani - appuntamenti di domani\n/scollega - smetti di ricevere qui l'agenda");
    }

    // Questa chat è del titolare di un'attività?
    const ow = await sb("GET", "businesses?owner_telegram_chat_id=eq." + chatId + "&active=eq.true&select=id,name,timezone");
    if (ow.ok && Array.isArray(ow.data) && ow.data.length) {
      const biz = ow.data[0];
      const cmd = text.toLowerCase().split(/[\s@]/)[0];
      if (cmd === "/oggi") return reply(await agendaText(biz, 0));
      if (cmd === "/domani") return reply(await agendaText(biz, 1));
      if (cmd === "/scollega") {
        await sb("PATCH", "businesses?id=eq." + biz.id, { owner_telegram_chat_id: null });
        return reply("Ok, non riceverai più qui l'agenda. Per ricollegarti usa di nuovo il tuo codice.");
      }
      return reply("Sono la tua segretaria virtuale. Ogni mattina ti mando l'agenda di " + biz.name + ".\n\nComandi:\n/oggi - appuntamenti di oggi\n/domani - appuntamenti di domani\n/scollega - smetti di ricevere qui l'agenda");
    }

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
