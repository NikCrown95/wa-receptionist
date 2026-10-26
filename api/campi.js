// api/campi.js  (Prenolia: pagina pubblica di prenotazione dei campi, per circoli e centri sportivi)
// Link: prenolia.it/circolo/nome-circolo  (vercel.json lo manda qui con ?b=nome-circolo)
// Un solo file: serve la pagina (HTML) e i dati (JSON): ?info=1, ?date=AAAA-MM-GG, POST per prenotare.

const courtsLib = require("../lib/courts.js");
const { getAccess, BOOKING_BLOCKED_MESSAGE } = require("../lib/access.js");

function sbHeaders(extra) {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const h = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key;
  return Object.assign(h, extra || {});
}
async function sb(method, path, body, prefer) {
  const res = await fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, { method, headers: sbHeaders(prefer ? { Prefer: prefer } : {}), body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { ok: res.ok, status: res.status, data };
}

const PAGE = require("../lib/campi-page.js");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const q = req.query || {};
    const slug = String(q.b || "");
    const wantsData = req.method === "POST" || q.info === "1" || !!q.date || !!q.month;
    if (req.method === "GET" && !wantsData) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(PAGE);
    }
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) return res.status(404).json({ error: "Attività non trovata" });
    const r = await sb("GET", "businesses?slug=eq." + encodeURIComponent(slug) + "&active=eq.true&select=*&limit=1");
    const biz = r.ok && Array.isArray(r.data) && r.data[0];
    if (!biz || require("../lib/verticals.js").areaOf(biz.business_type) !== "campi") return res.status(404).json({ error: "Attività non trovata" });
    const acc = await getAccess(biz.id);
    if (!acc.allowed) return res.status(503).json({ error: BOOKING_BLOCKED_MESSAGE });

    if (req.method === "GET" && q.info === "1") { const o = await courtsLib.info(sb, biz); if (o.status === 200) o.body.lia = acc.lia_allowed !== false; return res.status(o.status).json(o.body); }
    if (req.method === "GET" && q.month) { const o = await courtsLib.freeMonth(sb, biz, String(q.court || ""), String(q.month)); return res.status(o.status).json(o.body); }
    if (req.method === "GET" && q.date) { const o = await courtsLib.freeDay(sb, biz, String(q.date)); return res.status(o.status).json(o.body); }
    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const o = await courtsLib.book(sb, biz, body);
      if (o.status !== 200) return res.status(o.status).json(o.body);
      const emailSent = await courtsLib.afterBook(biz, o, sb);
      return res.status(200).json({ ok: true, email_sent: !!emailSent, booking: o.body.booking });
    }
    return res.status(405).json({ error: "Metodo non consentito" });
  } catch (e) {
    console.error("campi:", e && e.message);
    return res.status(500).json({ error: "Errore del server" });
  }
};
