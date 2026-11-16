// api/retention.js  (pulizia notturna dei dati personali)
//
// Chiamato da Vercel Cron ogni notte (vedi vercel.json). Esegue la funzione del database retention_cleanup:
//   - rende anonime le prenotazioni vecchie (12 mesi per gli studi sanitari, 24 per le altre attivita')
//   - cancella note, chat con l'IA (90 giorni), codici e iscrizioni scadute
// E' quello che promettono le pagine privacy. Con ?dry=1 simula e basta. Protetto da CRON_SECRET, come /api/reminders.

const { sb } = require("../lib/owner.js");

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.authorization || "";
  const key = (req.query || {}).key;
  if (!secret || (auth !== "Bearer " + secret && key !== secret)) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const dry = String((req.query || {}).dry || "") === "1";
  try {
    const r = await sb("POST", "rpc/retention_cleanup", { p_dry: dry });
    if (!r.ok) {
      console.error("retention_cleanup fallita", r.status, JSON.stringify(r.data));
      return res.status(500).json({ error: "retention_failed", status: r.status });
    }
    return res.status(200).json({ ok: true, result: r.data });
  } catch (e) {
    console.error("retention_cleanup errore", e && e.message);
    return res.status(500).json({ error: "retention_failed" });
  }
};
