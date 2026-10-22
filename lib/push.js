// lib/push.js  (Lia: notifiche push sul telefono del titolare)
// Variabili su Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
// Opzionale: VAPID_SUBJECT (un indirizzo mailto: o https:; se manca uso PUBLIC_URL).
// Dipende dal pacchetto "web-push" (vedi package.json). Se manca, le notifiche restano spente
// e il resto dell'app funziona come prima.

const { sb } = require("./owner.js");

const PUBLIC_URL = require("./site.js").baseUrl();

let webpush = null;
try {
  webpush = require("web-push");
} catch (e) {
  webpush = null;
}

function publicKey() {
  return String(process.env.VAPID_PUBLIC_KEY || "").trim();
}

function isConfigured() {
  return !!(webpush && publicKey() && String(process.env.VAPID_PRIVATE_KEY || "").trim());
}

let ready = false;
function init() {
  if (ready) return true;
  if (!isConfigured()) return false;
  const subject = String(process.env.VAPID_SUBJECT || PUBLIC_URL).trim();
  webpush.setVapidDetails(subject, publicKey(), String(process.env.VAPID_PRIVATE_KEY).trim());
  ready = true;
  return true;
}

// Manda lo stesso avviso a tutti i dispositivi registrati dell'attivita'.
// I dispositivi che non esistono piu' (app disinstallata, permesso tolto) vengono cancellati.
async function sendToBusiness(businessId, payload) {
  const out = { sent: 0, removed: 0, failed: 0, devices: 0 };
  if (!init()) {
    out.error = "not_configured";
    return out;
  }
  const r = await sb("GET", "push_subscriptions?business_id=eq." + businessId + "&select=id,endpoint,p256dh,auth");
  if (!r.ok || !Array.isArray(r.data)) {
    out.error = r.status === 404 ? "no_table" : "read_failed";
    return out;
  }
  out.devices = r.data.length;
  const body = JSON.stringify(payload);
  // Tutti i dispositivi insieme (non uno dopo l'altro): cosi' nessuno resta indietro se uno e' lento.
  await Promise.all(r.data.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 4 * 3600, urgency: "high", timeout: 8000 }
      );
      out.sent++;
    } catch (e) {
      const code = e && e.statusCode;
      if (code === 404 || code === 410) {
        await sb("DELETE", "push_subscriptions?id=eq." + s.id);
        out.removed++;
      } else {
        out.failed++;
        console.error("push non inviata", code, e && e.body ? String(e.body).slice(0, 200) : e && e.message);
      }
    }
  }));
  return out;
}

// Avviso "nuova prenotazione" al titolare. Non solleva mai errori e non aspetta piu' di 6 secondi:
// la prenotazione del cliente non deve mai dipendere dalle notifiche.
async function notifyNewBooking(businessId, info) {
  try {
    if (!isConfigured()) return;
    const job = (async () => {
      const r = await sb("GET", "businesses?id=eq." + encodeURIComponent(businessId) + "&select=agenda_token&limit=1");
      const t = r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0].agenda_token : "";
      const when = info.startsAt
        ? new Intl.DateTimeFormat("it-IT", { timeZone: info.timezone || "Europe/Rome", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(info.startsAt))
        : "";
      await sendToBusiness(businessId, {
        title: "Nuova prenotazione",
        body: [info.name, info.service, when].filter(Boolean).join(" · "),
        url: t ? "/api/agenda?t=" + encodeURIComponent(t) : "/",
        tag: "lia-booking-" + Date.now(),
        kind: "booking",
      });
    })();
    await Promise.race([job, new Promise((ok) => setTimeout(ok, 6000))]);
  } catch (e) {
    console.error("Avviso push non inviato (ignoro):", e && e.message);
  }
}

module.exports = { isConfigured, publicKey, sendToBusiness, notifyNewBooking };
