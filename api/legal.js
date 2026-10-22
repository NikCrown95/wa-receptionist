// api/legal.js  (Prenolia: pagine privacy, termini e informativa dei clienti)
//   /privacy         -> ?doc=privacy
//   /termini         -> ?doc=termini
//   /privacy/<slug>  -> ?doc=cliente&b=<slug>   (informativa della singola attività)
const { sb } = require("../lib/owner.js");
const { privacyPage, termsPage, customerPage, medicalDpaPage, notFoundPage } = require("../lib/legal.js");

module.exports = async function handler(req, res) {
  const q = req.query || {};
  const doc = String(q.doc || "privacy");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  res.setHeader("Referrer-Policy", "no-referrer");
  try {
    if (doc === "termini") return res.status(200).send(termsPage());
    if (doc === "sanitari") return res.status(200).send(medicalDpaPage());
    if (doc === "cliente") {
      const slug = String(q.b || "").toLowerCase();
      if (!/^[a-z0-9-]{1,60}$/.test(slug)) return res.status(404).send(notFoundPage());
      const r = await sb("GET", "businesses?slug=eq." + encodeURIComponent(slug) + "&active=eq.true&select=name,address,public_phone,legal_name,vat_number,privacy_email,business_type&limit=1");
      if (!r.ok || !Array.isArray(r.data) || !r.data.length) return res.status(404).send(notFoundPage());
      return res.status(200).send(customerPage(r.data[0]));
    }
    return res.status(200).send(privacyPage());
  } catch (e) {
    console.error("legal:", e && e.message);
    return res.status(500).send(notFoundPage());
  }
};
