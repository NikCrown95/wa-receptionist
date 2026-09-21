// api/whatsapp.js  (Lia v5: canale WhatsApp)
// Riceve il messaggio da Twilio, lo passa al cervello di Lia (lib/lia.js) e risponde.

const { handleMessage } = require("../lib/lia.js");

function escapeXml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function rispondi(res, testo) {
  res.setHeader("Content-Type", "text/xml");
  res.status(200).send(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Message>' + escapeXml(testo) + "</Message></Response>"
  );
}

module.exports = async (req, res) => {
  const ERRORE = "Scusa, ho avuto un problema. Riprova tra un attimo.";
  try {
    const body = req.body || {};
    if (!body.Body) return rispondi(res, "Non ho ricevuto nessun testo.");
    const phone = String(body.From || "").replace("whatsapp:", "");
    const out = await handleMessage({ channel: "whatsapp", contactId: phone, phone: phone, text: body.Body });
    return rispondi(res, out.reply || ERRORE);
  } catch (e) {
    console.error(e);
    return rispondi(res, ERRORE);
  }
};
