// lib/billing.js — supporto per abbonamenti: accesso al database, link dell'agenda, email al titolare.

const site = require("./site.js");
const mail = require("./mail.js");

function sb(method, path, body, prefer) {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const headers = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = "Bearer " + key;
  if (prefer) headers.Prefer = prefer;
  return fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, { method, headers, body: body ? JSON.stringify(body) : undefined })
    .then(async (r) => {
      const text = await r.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
      return { ok: r.ok, status: r.status, data };
    });
}

const SUB_FIELDS = "id,business_id,status,started_at,trial_ends_at,current_period_end,courtesy_until,grace_days,cancelled_at,cancel_at_period_end,stripe_customer_id,stripe_subscription_id,suspended_manually,plans(name,price_eur)";

async function latestSub(businessId) {
  const r = await sb("GET", "subscriptions?business_id=eq." + encodeURIComponent(businessId) + "&select=" + SUB_FIELDS + "&order=started_at.desc&limit=1");
  return r.ok && Array.isArray(r.data) && r.data.length ? r.data[0] : null;
}

async function ownerEmail(businessId) {
  const r = await sb("GET", "business_users?business_id=eq." + encodeURIComponent(businessId) + "&active=eq.true&select=email&limit=1");
  return r.ok && Array.isArray(r.data) && r.data.length ? r.data[0].email : "";
}

async function agendaUrl(businessId) {
  const r = await sb("GET", "businesses?id=eq." + encodeURIComponent(businessId) + "&select=agenda_token&limit=1");
  const t = r.ok && Array.isArray(r.data) && r.data.length ? r.data[0].agenda_token : "";
  return t ? site.baseUrl() + "/api/agenda?t=" + t : site.baseUrl();
}

function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function dateIt(d) {
  const x = new Date(d);
  return d && !isNaN(x) ? new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", day: "numeric", month: "long", year: "numeric" }).format(x) : "";
}

// Un'email di servizio dal tono semplice e caldo. kind: trial_ending | grace | suspended | payment_failed | welcome | cancelled
function billingEmail(kind, o) {
  const name = String(o.bizName || "").trim();
  const link = o.url || site.baseUrl();
  const price = o.priceLabel || "24,99 € al mese";
  const M = {
    trial_ending: {
      subject: "La tua prova gratuita finisce il " + dateIt(o.endsAt),
      headline: "La prova finisce il " + dateIt(o.endsAt),
      body: "Hai usato Prenolia per due settimane. Per continuare senza interruzioni attiva l’abbonamento: " + price + ", si disdice quando vuoi e non c’è nulla da pagare prima del " + dateIt(o.endsAt) + ".",
      cta: "Attiva l’abbonamento",
      note: "Se non lo attivi, dopo la scadenza hai ancora " + (o.graceDays || 3) + " giorni di tolleranza prima che la tua pagina di prenotazione smetta di funzionare.",
    },
    grace: {
      subject: "Il tuo abbonamento è scaduto: hai ancora " + (o.graceDays || 3) + " giorni",
      headline: "Il tuo abbonamento è scaduto",
      body: "Per non fermare le prenotazioni dei tuoi clienti rinnova entro il " + dateIt(o.graceEnds) + ". Fino ad allora tutto continua a funzionare.",
      cta: "Rinnova l’abbonamento",
      note: "I tuoi dati restano al sicuro e puoi scaricarli quando vuoi da Impostazioni → I tuoi dati.",
    },
    suspended: {
      subject: "Prenolia è in pausa: riattivala quando vuoi",
      headline: "La tua pagina è in pausa",
      body: "Il periodo di tolleranza è finito, quindi la pagina di prenotazione e Lia sono ferme. Appena rinnovi, riparte tutto com’era, con i tuoi clienti e i tuoi appuntamenti.",
      cta: "Riattiva l’abbonamento",
      note: "I tuoi dati sono conservati e puoi scaricarli da Impostazioni → I tuoi dati.",
    },
    payment_failed: {
      subject: "Pagamento non riuscito",
      headline: "Non siamo riusciti ad addebitare il pagamento",
      body: "Può capitare con una carta scaduta o senza fondi. Controlla il metodo di pagamento: Stripe riprova da solo nei prossimi giorni, e finché non scade il periodo di tolleranza " + (o.graceEnds ? "(" + dateIt(o.graceEnds) + ") " : "") + "tutto continua a funzionare.",
      cta: "Aggiorna il metodo di pagamento",
      note: "",
    },
    welcome: {
      subject: "Abbonamento attivato: grazie!",
      headline: "Grazie, è tutto attivo",
      body: o.firstChargeAt
        ? "Il tuo abbonamento è attivo. Il primo addebito di " + price + " sarà il " + dateIt(o.firstChargeAt) + ", al termine della prova gratuita. Puoi disdire quando vuoi."
        : "Il tuo abbonamento è attivo e si rinnova ogni mese. Puoi disdire quando vuoi: resta attivo fino alla fine del periodo già pagato.",
      cta: "Apri la tua agenda",
      note: "La fattura te la invio via email. Se ti servono dati particolari (ragione sociale, codice SDI o PEC) scrivili all’assistenza dalle Impostazioni.",
    },
    cancelled: {
      subject: "Disdetta registrata",
      headline: "Disdetta registrata",
      body: "Il tuo abbonamento resta attivo fino al " + dateIt(o.endsAt) + ", poi non si rinnova. Se cambi idea puoi riattivarlo quando vuoi dalle Impostazioni.",
      cta: "Apri la tua agenda",
      note: "Prima di quella data puoi scaricare tutti i tuoi dati da Impostazioni → I tuoi dati.",
    },
  }[kind];
  if (!M) throw new Error("tipo di email non valido: " + kind);

  const logo = site.baseUrl() + "/brand/prenolia-email.png";
  const first = "Ciao! ";
  const html = "<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"color-scheme\" content=\"light\"><meta name=\"supported-color-schemes\" content=\"light\"><title>" + esc(M.subject) + "</title></head>" +
    "<body style=\"margin:0;padding:0;background:#EEF3F6\">" +
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#EEF3F6\"><tr><td align=\"center\" style=\"padding:24px 12px\">" +
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:560px;background:#FFFFFF;border-radius:22px;border:1px solid #DCE6EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif\">" +
    "<tr><td style=\"padding:28px 32px 0\"><img src=\"" + logo + "\" width=\"160\" alt=\"Prenolia\" style=\"display:block;border:0;height:auto;width:160px\"></td></tr>" +
    "<tr><td style=\"padding:0 32px\"><div style=\"height:3px;width:44px;background:#19B8C8;border-radius:3px;margin-top:16px\"></div></td></tr>" +
    "<tr><td style=\"padding:20px 32px 0\"><h1 style=\"margin:0 0 10px;font-size:26px;line-height:1.2;letter-spacing:-.02em;color:#0B2530\">" + esc(M.headline) + "</h1>" +
    "<p style=\"margin:0;font-size:16px;line-height:1.55;color:#33464F\">" + first + esc(M.body) + "</p></td></tr>" +
    "<tr><td style=\"padding:24px 32px 0\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td style=\"border-radius:14px;background:#19B8C8\"><a href=\"" + esc(link) + "\" style=\"display:inline-block;padding:15px 26px;font-size:16px;font-weight:700;color:#031016;text-decoration:none;border-radius:14px\">" + esc(M.cta) + "</a></td></tr></table>" +
    (M.note ? "<p style=\"margin:14px 0 0;font-size:13.5px;line-height:1.5;color:#5B6E7A\">" + esc(M.note) + "</p>" : "") + "</td></tr>" +
    "<tr><td style=\"padding:26px 32px 28px\"><div style=\"border-top:1px solid #E5EDF1;padding-top:16px;font-size:12.5px;line-height:1.55;color:#7A8B96\">Email di servizio inviata da Prenolia" + (name ? " per " + esc(name) : "") + ". Non rispondere a questo messaggio: per qualsiasi cosa usa l’assistenza dalle Impostazioni.</div></td></tr>" +
    "</table></td></tr></table></body></html>";
  const text = [M.headline, "", first + M.body, "", M.cta + ": " + link, M.note ? "" : null, M.note || null, "", "Email di servizio inviata da Prenolia. Non rispondere a questo messaggio."].filter((x) => x !== null).join("\n");
  return { subject: M.subject, html, text };
}

async function sendBillingMail(businessId, kind, extra) {
  const to = await ownerEmail(businessId);
  if (!to) return false;
  const b = await sb("GET", "businesses?id=eq." + encodeURIComponent(businessId) + "&select=name&limit=1");
  const bizName = b.ok && Array.isArray(b.data) && b.data.length ? b.data[0].name : "";
  const url = await agendaUrl(businessId);
  const m = billingEmail(kind, Object.assign({ bizName, url }, extra || {}));
  // senza il nome dell'attivita' nel mittente: e' un'email di Prenolia, non dell'attivita'
  return mail.sendMail(to, m.subject, m.html, m.text);
}

// Registro anti-doppioni: ogni email di abbonamento parte una sola volta per evento.
async function alreadySent(businessId, key) {
  const r = await sb("GET", "audit_logs?business_id=eq." + encodeURIComponent(businessId) + "&action=eq.billing_mail&details->>key=eq." + encodeURIComponent(key) + "&select=id&limit=1");
  return r.ok && Array.isArray(r.data) && r.data.length > 0;
}
async function markSent(businessId, key, kind) {
  await sb("POST", "audit_logs", { actor: "system", action: "billing_mail", business_id: businessId, details: { key, kind } }).catch(() => {});
}

module.exports = { sb, latestSub, ownerEmail, agendaUrl, billingEmail, sendBillingMail, alreadySent, markSent, SUB_FIELDS };
