// api/weekly-recap.js  (Lia: riepilogo settimanale nella campanella della dashboard)
//
// Parte da solo ogni domenica sera (vedi vercel.json). Per ogni attivita' con Lia attiva
// conta le prenotazioni prese da Lia negli ultimi 7 giorni e il loro valore, poi aggiunge
// una notifica "weekly_recap" nella campanella (tabella notification_events).
// Se la settimana e' a zero non scrive nulla. Se la notifica della settimana esiste gia'
// (indice unico business_id + settimana) non la ripete.
//
// Prova a mano:   https://TUO-SITO.vercel.app/api/weekly-recap?key=IL_TUO_CRON_SECRET
// Solo calcolo (non scrive niente):   ...&dry=1
// Variabili su Vercel: CRON_SECRET, SUPABASE_URL, SUPABASE_SECRET_KEY.

const { sb } = require("../lib/owner.js");
const { getAccess } = require("../lib/access.js");

// Canali con cui prenota Lia (calendario online "selfservice" e inserimenti "manuale" restano fuori)
const LIA_CHANNELS = ["whatsapp", "telegram", "web", "webchat"];
const DAYS = 7;

function localYmd(date, tz) {
  // en-CA stampa YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// Chiave della settimana: la domenica (data locale dell'attivita') che chiude la settimana
function weekKey(now, tz) {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now);
  const back = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd] || 0;
  return localYmd(new Date(now.getTime() - back * 86400000), tz);
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.authorization || "";
  const key = (req.query || {}).key;
  if (!secret || (auth !== "Bearer " + secret && key !== secret)) {
    return res.status(401).send("no");
  }
  const dry = String((req.query || {}).dry || "") === "1";

  try {
    const r = await sb("GET", "businesses?active=eq.true&select=id,name,timezone");
    if (!r.ok || !Array.isArray(r.data)) return res.status(500).json({ error: "Errore lettura attivita" });

    const now = new Date();
    const sinceIso = new Date(now.getTime() - DAYS * 86400000).toISOString();
    const out = { businesses: r.data.length, created: 0, skipped_no_lia: 0, skipped_zero: 0, skipped_dupe: 0, failed: 0 };
    if (dry) out.preview = [];

    for (const biz of r.data) {
      try {
        // Solo chi ha Lia e il servizio attivo. Se il controllo non riesce, non scrivo nulla.
        const acc = await getAccess(biz.id);
        if (!acc.checked || !acc.allowed || !acc.lia_allowed) { out.skipped_no_lia++; continue; }

        const ap = await sb(
          "GET",
          "appointments?business_id=eq." + biz.id +
            "&status=eq.confirmed&channel=in.(" + LIA_CHANNELS.join(",") + ")" +
            "&created_at=gte." + encodeURIComponent(sinceIso) +
            "&select=id,services(price_eur)&limit=2000"
        );
        if (!ap.ok || !Array.isArray(ap.data)) { out.failed++; continue; }

        const count = ap.data.length;
        if (!count) { out.skipped_zero++; continue; }
        const amount = Math.round(
          ap.data.reduce((sum, a) => sum + (Number(a.services && a.services.price_eur) || 0), 0)
        );
        const tz = biz.timezone || "Europe/Rome";
        const week = weekKey(now, tz);

        if (dry) { out.preview.push({ business: biz.name, week: week, count: count, amount: amount }); continue; }

        const ins = await sb("POST", "notification_events", {
          business_id: biz.id,
          event_type: "weekly_recap",
          meta: { week: week, count: count, amount: amount, from: sinceIso, to: now.toISOString() },
        }, "return=minimal");
        if (ins.ok) out.created++;
        else if (ins.status === 409) out.skipped_dupe++; // gia' scritta per questa settimana
        else { out.failed++; console.error("weekly-recap insert fallito per", biz.name, ins.status, ins.data); }
      } catch (e) {
        console.error("weekly-recap fallito per", biz.name, e);
        out.failed++;
      }
    }
    return res.status(200).json(out);
  } catch (e) {
    console.error("weekly-recap error", e);
    return res.status(500).json({ error: "Errore" });
  }
};
