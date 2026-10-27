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
  return sendTo("push_subscriptions?business_id=eq." + businessId + "&select=id,endpoint,p256dh,auth", "push_subscriptions", payload);
}

// Stesso invio, ma ai telefoni dell'admin (super dashboard).
async function sendToAdmins(payload) {
  return sendTo("admin_push_subscriptions?select=id,endpoint,p256dh,auth", "admin_push_subscriptions", payload);
}

async function sendTo(readPath, table, payload) {
  const out = { sent: 0, removed: 0, failed: 0, devices: 0 };
  if (!init()) {
    out.error = "not_configured";
    return out;
  }
  const r = await sb("GET", readPath);
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
        await sb("DELETE", table + "?id=eq." + s.id);
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
        // studi sanitari: la notifica passa dai server di Google/Apple, quindi niente nome del paziente ne' servizio
        body: (info.medical ? [when] : [info.name, info.service, when]).filter(Boolean).join(" · "),
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

// Avviso all'admin quando un'attivita' scrive all'assistenza. Non solleva mai errori e non aspetta piu' di 6 secondi.
async function notifyAdminSupport(info) {
  try {
    if (!isConfigured()) return;
    const text = String(info.message || "").replace(/\s+/g, " ").trim();
    const body = text ? (text.length > 90 ? text.slice(0, 87) + "…" : text) : (info.topic ? "Argomento: " + info.topic : "Apri la richiesta per leggerla.");
    await Promise.race([
      sendToAdmins({
        title: (info.businessName || "Un’attività") + " ti ha scritto",
        body,
        url: "/admin/richieste.html",
        tag: "lia-support-" + (info.id || Date.now()),
        kind: "support",
      }),
      new Promise((ok) => setTimeout(ok, 6000)),
    ]);
  } catch (e) {
    console.error("Avviso push admin non inviato (ignoro):", e && e.message);
  }
}

// Avviso al titolare quando l'admin risponde a una richiesta di assistenza (solo alla prima risposta).
// Toccando la notifica si apre la pagina Assistenza della dashboard. Non solleva mai errori.
async function notifyBusinessSupportReply(businessId, info) {
  try {
    if (!isConfigured() || !businessId) return;
    const job = (async () => {
      const r = await sb("GET", "businesses?id=eq." + encodeURIComponent(businessId) + "&select=agenda_token,business_type&limit=1");
      const t = r.ok && Array.isArray(r.data) && r.data[0] ? r.data[0].agenda_token : "";
      // studi sanitari: la notifica passa dai server di Google/Apple, quindi niente testo della risposta
      const med = r.ok && Array.isArray(r.data) && r.data[0] ? require("./verticals.js").isMedical(r.data[0].business_type) : false;
      const text = med ? "" : String((info && info.reply) || "").replace(/\s+/g, " ").trim();
      await sendToBusiness(businessId, {
        title: "Prenolia ha risposto",
        body: text ? (text.length > 90 ? text.slice(0, 87) + "…" : text) : "Apri l’assistenza per leggere la risposta.",
        url: t ? "/api/agenda?t=" + encodeURIComponent(t) + "&open=assistenza" : "/",
        tag: "lia-support-reply-" + ((info && info.id) || Date.now()),
        kind: "support_reply",
      });
    })();
    await Promise.race([job, new Promise((ok) => setTimeout(ok, 6000))]);
  } catch (e) {
    console.error("Avviso push risposta assistenza non inviato (ignoro):", e && e.message);
  }
}

module.exports = { isConfigured, publicKey, sendToBusiness, sendToAdmins, notifyNewBooking, notifyAdminSupport, notifyBusinessSupportReply };
