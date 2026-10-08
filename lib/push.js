// lib/push.js  (Lia: notifiche push sul telefono del titolare)
// Variabili su Vercel: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY.
// Opzionale: VAPID_SUBJECT (un indirizzo mailto: o https:; se manca uso PUBLIC_URL).
// Dipende dal pacchetto "web-push" (vedi package.json). Se manca, le notifiche restano spente
// e il resto dell'app funziona come prima.

const { sb } = require("./owner.js");

const PUBLIC_URL = process.env.PUBLIC_URL || "https://wa-receptionist-sigma.vercel.app";

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
  for (const s of r.data) {
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
  }
  return out;
}

module.exports = { isConfigured, publicKey, sendToBusiness };
