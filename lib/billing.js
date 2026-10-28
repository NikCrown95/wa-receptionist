// lib/billing.js — supporto per abbonamenti: accesso al database, link dell'agenda, email al titolare.

const site = require("./site.js");
const mail = require("./mail.js");
const { ownerMail } = require("./owner-mail.js");

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
      chip: "Prova gratuita", facts: [["Fine della prova", dateIt(o.endsAt)], ["Poi", price]],
      body: "Hai usato Prenolia per due settimane. Per continuare senza interruzioni attiva l’abbonamento: " + price + ", si disdice quando vuoi e non c’è nulla da pagare prima del " + dateIt(o.endsAt) + ".",
      cta: "Attiva l’abbonamento",
      note: "Se non lo attivi, dopo la scadenza hai ancora " + (o.graceDays || 3) + " giorni di tolleranza prima che la tua pagina di prenotazione smetta di funzionare.",
    },
    grace: {
      subject: "Il tuo abbonamento è scaduto: hai ancora " + (o.graceDays || 3) + " giorni",
      headline: "Il tuo abbonamento è scaduto",
      tone: "warn", chip: "Da rinnovare", facts: o.graceEnds ? [["Rinnova entro", dateIt(o.graceEnds)]] : [],
      body: "Per non fermare le prenotazioni dei tuoi clienti rinnova entro il " + dateIt(o.graceEnds) + ". Fino ad allora tutto continua a funzionare.",
      cta: "Rinnova l’abbonamento",
      note: "I tuoi dati restano al sicuro e puoi scaricarli quando vuoi da Impostazioni → I tuoi dati.",
    },
    suspended: {
      subject: "Prenolia è in pausa: riattivala quando vuoi",
      headline: "La tua pagina è in pausa",
      tone: "warn", chip: "In pausa",
      body: "Il periodo di tolleranza è finito, quindi la pagina di prenotazione e Lia sono ferme. Appena rinnovi, riparte tutto com’era, con i tuoi clienti e i tuoi appuntamenti.",
      cta: "Riattiva l’abbonamento",
      note: "I tuoi dati sono conservati e puoi scaricarli da Impostazioni → I tuoi dati.",
    },
    payment_failed: {
      subject: "Pagamento non riuscito",
      headline: "Non siamo riusciti ad addebitare il pagamento",
      tone: "warn", chip: "Pagamento", facts: o.graceEnds ? [["Tutto continua a funzionare fino al", dateIt(o.graceEnds)]] : [],
      body: "Può capitare con una carta scaduta o senza fondi. Controlla il metodo di pagamento: Stripe riprova da solo nei prossimi giorni, e finché non scade il periodo di tolleranza " + (o.graceEnds ? "(" + dateIt(o.graceEnds) + ") " : "") + "tutto continua a funzionare.",
      cta: "Aggiorna il metodo di pagamento",
      note: "",
    },
    welcome: {
      subject: "Abbonamento attivato: grazie!",
      headline: "Grazie, è tutto attivo",
      chip: "Tutto attivo", facts: o.firstChargeAt ? [["Primo addebito", dateIt(o.firstChargeAt)], ["Importo", price]] : [],
      body: o.firstChargeAt
        ? "Il tuo abbonamento è attivo. Il primo addebito di " + price + " sarà il " + dateIt(o.firstChargeAt) + ", al termine della prova gratuita. Puoi disdire quando vuoi."
        : "Il tuo abbonamento è attivo e si rinnova ogni mese. Puoi disdire quando vuoi: resta attivo fino alla fine del periodo già pagato.",
      cta: "Apri la tua agenda",
      note: "La fattura te la invio via email. Se ti servono dati particolari (ragione sociale, codice SDI o PEC) scrivili all’assistenza dalle Impostazioni.",
    },
    cancelled: {
      subject: "Disdetta registrata",
      headline: "Disdetta registrata",
      chip: "Disdetta", facts: o.endsAt ? [["Resta attivo fino al", dateIt(o.endsAt)]] : [],
      body: "Il tuo abbonamento resta attivo fino al " + dateIt(o.endsAt) + ", poi non si rinnova. Se cambi idea puoi riattivarlo quando vuoi dalle Impostazioni.",
      cta: "Apri la tua agenda",
      note: "Prima di quella data puoi scaricare tutti i tuoi dati da Impostazioni → I tuoi dati.",
    },
  }[kind];
  if (!M) throw new Error("tipo di email non valido: " + kind);

  const first = "Ciao! ";
  const html = ownerMail({ style: "a", base: site.baseUrl(), chip: M.chip, tone: M.tone, headline: M.headline, body: esc(M.body), facts: M.facts, cta: M.cta, link, note: M.note ? esc(M.note) : "", preheader: M.subject,
    footer: "Email di servizio inviata da Prenolia" + (name ? " per " + esc(name) : "") + ". Non rispondere a questo messaggio: per aiutarti scrivi dall’assistenza nelle Impostazioni." });
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
