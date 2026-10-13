// api/reminders.js  (Prenolia: promemoria email ai clienti, il giorno prima dell'appuntamento)
//
// Chiamato da Vercel Cron ogni ora (vedi vercel.json), protetto da CRON_SECRET come /api/alerts.
// Manda il promemoria agli appuntamenti confermati che hanno un'email, che iniziano entro circa 26 ore
// e per cui il promemoria non e' ancora partito. Regole:
//   - solo tra le 8:00 e le 20:59 (ora dell'attivita'): niente email di notte;
//   - non se l'appuntamento e' tra meno di 2 ore, e non se la prenotazione e' stata fatta meno di 3 ore fa
//     (la conferma appena ricevuta basta);
//   - al massimo 60 email per chiamata; se manca la colonna reminder_sent_at (SQL non eseguito) non fa nulla.

const { sb } = require("../lib/owner.js");
const { getAccess } = require("../lib/access.js");
const mail = require("../lib/mail.js");

const MAX_PER_RUN = 60;

function localHour(d, tz) {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: tz || "Europe/Rome", hour: "2-digit", hour12: false }).format(d);
  return Number(h) % 24;
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.authorization || "";
  const key = (req.query || {}).key;
  if (!secret || (auth !== "Bearer " + secret && key !== secret)) return res.status(401).json({ error: "unauthorized" });

  const out = { candidates: 0, sent: 0, skipped: 0, failed: 0 };
  try {
    const now = Date.now();
    const iso = (ms) => encodeURIComponent(new Date(ms).toISOString());
    const r = await sb("GET",
      "appointments?status=eq.confirmed&customer_email=not.is.null&reminder_sent_at=is.null" +
      "&starts_at=gte." + iso(now + 2 * 3600000) + "&starts_at=lt." + iso(now + 26 * 3600000) +
      "&created_at=lt." + iso(now - 3 * 3600000) +
      "&order=starts_at.asc&limit=" + MAX_PER_RUN +
      "&select=id,customer_name,customer_email,customer_address,starts_at,ends_at,business_id,services(name),resources(name),businesses(name,slug,timezone,address,public_phone,team_mode,staff_choice,cancel_limit_hours)");
    if (!r.ok) {
      if (r.status === 400 || r.status === 404) return res.status(200).json({ ...out, note: "Colonne email non ancora create: esegui prima lo SQL." });
      return res.status(500).json({ error: "Lettura appuntamenti non riuscita" });
    }
    const rows = Array.isArray(r.data) ? r.data : [];
    out.candidates = rows.length;
    const accessCache = {};
    for (const a of rows) {
      const b = a.businesses;
      if (!b || !a.customer_email) { out.skipped++; continue; }
      const tz = b.timezone || "Europe/Rome";
      const h = localHour(new Date(), tz);
      if (h < 8 || h >= 21) { out.skipped++; continue; }
      if (accessCache[a.business_id] === undefined) {
        try { accessCache[a.business_id] = (await getAccess(a.business_id)).allowed !== false; } catch (e) { accessCache[a.business_id] = true; }
      }
      if (!accessCache[a.business_id]) { out.skipped++; continue; }
      // Prima si segna come inviato (solo se ancora vuoto): se due chiamate si sovrappongono, parte una sola email.
      const claim = await sb("PATCH", "appointments?id=eq." + a.id + "&reminder_sent_at=is.null", { reminder_sent_at: new Date().toISOString() }, "return=representation");
      if (!claim.ok || !Array.isArray(claim.data) || !claim.data.length) { out.skipped++; continue; }
      const lim = b.cancel_limit_hours === null || b.cancel_limit_hours === undefined ? 2 : Number(b.cancel_limit_hours);
      const em = mail.appointmentEmail({
        kind: "reminder", slug: b.slug, apptId: a.id, bizName: b.name, bizPhone: b.public_phone || "", bizAddress: b.address || "",
        customerName: a.customer_name, service: (a.services && a.services.name) || "Appuntamento",
        staffName: (b.team_mode === "team" && b.staff_choice === true && a.resources) ? a.resources.name : "",
        startsAt: a.starts_at, endsAt: a.ends_at, tz, customerAddress: a.customer_address || "",
        cancelLimitH: Number.isFinite(lim) ? lim : 2, privacyUrl: mail.baseUrl() + "/privacy/" + b.slug,
      });
      const ok = await mail.sendMail(a.customer_email, em.subject, em.html, em.text, b.name);
      if (ok) out.sent++;
      else {
        out.failed++;
        await sb("PATCH", "appointments?id=eq." + a.id, { reminder_sent_at: null }).catch(() => {}); // riproverà alla prossima ora
      }
    }
    return res.status(200).json(out);
  } catch (e) {
    console.error("Promemoria:", e);
    return res.status(500).json({ error: "Errore", ...out });
  }
};
