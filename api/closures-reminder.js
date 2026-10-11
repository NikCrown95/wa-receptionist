// api/closures-reminder.js  (Prenolia: promemoria del lunedi' mattina per chiusure, ferie e assenze)
//
// Ogni lunedi' alle 8:00 (ora dell'attivita') aggiunge nella campanella una notifica
// "closures_reminder": ricorda di inserire giorni di chiusura, ferie e collaboratori assenti.
// Toccandola, la dashboard apre direttamente Impostazioni > Chiusure e ferie.
//
// Vercel lavora in UTC: il cron parte alle 06:00 e alle 07:00 UTC di ogni lunedi' (vedi vercel.json)
// e questo file agisce solo quando, nel fuso dell'attivita', sono davvero le 8 di lunedi'.
// Cosi' il promemoria arriva alle 8:00 sia con l'ora legale sia con quella solare.
// Se per la settimana esiste gia' (indice unico business_id + settimana) non la ripete.
//
// Prova a mano:   https://TUO-SITO.vercel.app/api/closures-reminder?key=IL_TUO_CRON_SECRET&force=1
// Solo calcolo (non scrive niente):   ...&dry=1
// Variabili su Vercel: CRON_SECRET, SUPABASE_URL, SUPABASE_SECRET_KEY.

const { sb } = require("../lib/owner.js");
const { getAccess } = require("../lib/access.js");

const SEND_HOUR = 8;

function parts(date, tz) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hourCycle: "h23",
  }).formatToParts(date);
  const o = {};
  f.forEach(function (p) { o[p.type] = p.value; });
  return { ymd: o.year + "-" + o.month + "-" + o.day, hour: Number(o.hour), weekday: o.weekday };
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.authorization || "";
  const q = req.query || {};
  if (!secret || (auth !== "Bearer " + secret && q.key !== secret)) {
    return res.status(401).send("no");
  }
  const dry = String(q.dry || "") === "1";
  const force = String(q.force || "") === "1"; // solo per le prove a mano: ignora giorno e ora

  try {
    const r = await sb("GET", "businesses?active=eq.true&select=id,name,timezone");
    if (!r.ok || !Array.isArray(r.data)) return res.status(500).json({ error: "Errore lettura attivita" });

    const now = new Date();
    const out = { businesses: r.data.length, created: 0, skipped_time: 0, skipped_access: 0, skipped_dupe: 0, failed: 0 };
    if (dry) out.preview = [];

    for (const biz of r.data) {
      try {
        const tz = biz.timezone || "Europe/Rome";
        const p = parts(now, tz);
        if (!force && !(p.weekday === "Mon" && p.hour === SEND_HOUR)) { out.skipped_time++; continue; }

        // Solo per chi ha il servizio attivo. Se il controllo non riesce, non scrivo nulla.
        const acc = await getAccess(biz.id);
        if (!acc.checked || !acc.allowed) { out.skipped_access++; continue; }

        // Chiave della settimana: la data locale del lunedi'
        const week = p.ymd;
        if (dry) { out.preview.push({ business: biz.name, week: week }); continue; }

        const ins = await sb("POST", "notification_events", {
          business_id: biz.id,
          event_type: "closures_reminder",
          meta: { week: week },
        }, "return=minimal");
        if (ins.ok) out.created++;
        else if (ins.status === 409) out.skipped_dupe++; // gia' scritta per questa settimana
        else { out.failed++; console.error("closures-reminder insert fallito per", biz.name, ins.status, ins.data); }
      } catch (e) {
        console.error("closures-reminder fallito per", biz.name, e);
        out.failed++;
      }
    }
    return res.status(200).json(out);
  } catch (e) {
    console.error("closures-reminder error", e);
    return res.status(500).json({ error: "Errore" });
  }
};
