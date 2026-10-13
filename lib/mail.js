// lib/mail.js  (Prenolia: email ai clienti finali, conferma e promemoria dell'appuntamento)
// Invio con Resend (stessa chiave e stesso mittente usati per il recupero password).
// Variabili su Vercel: RESEND_API_KEY, RESEND_FROM (opzionale), PUBLIC_URL (opzionale).
// Il link per annullare e' firmato (HMAC): chi non ha l'email non puo' indovinarlo.

const crypto = require("crypto");
const { emailProblem } = require("./validate.js");

const DEFAULT_BASE = "https://wa-receptionist-sigma.vercel.app";
function baseUrl() { return String(process.env.PUBLIC_URL || DEFAULT_BASE).replace(/\/+$/, ""); }

function secret() {
  return process.env.BUSINESS_SESSION_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SECRET_KEY || "";
}
function cancelSig(id) {
  return crypto.createHmac("sha256", secret()).update("cancel:" + String(id)).digest("hex").slice(0, 32);
}
function validCancelSig(id, k) {
  if (!secret() || typeof k !== "string" || k.length !== 32) return false;
  const a = Buffer.from(cancelSig(id)), b = Buffer.from(k);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function cancelUrl(slug, id) {
  return baseUrl() + "/api/booking?b=" + encodeURIComponent(slug) + "&cancel=" + encodeURIComponent(id) + "&k=" + cancelSig(id);
}
function icsUrl(title, startIso, endIso, description, location) {
  return baseUrl() + "/api/booking?ics=1&s=" + encodeURIComponent(startIso) + "&e=" + encodeURIComponent(endIso) +
    "&t=" + encodeURIComponent(title) + "&d=" + encodeURIComponent(description || "") + "&l=" + encodeURIComponent(location || "");
}

function normalizeEmail(v) {
  const s = String(v == null ? "" : v).trim().toLowerCase();
  if (!s) return "";
  return emailProblem(s) ? null : s;
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function fromAddress(bizName) {
  const raw = process.env.RESEND_FROM || "Prenolia <noreply@send.prenolia.it>";
  const m = raw.match(/<([^>]+)>/);
  const addr = m ? m[1] : raw.trim();
  const name = String(bizName || "").replace(/["<>\\\r\n]/g, "").trim().slice(0, 60);
  return name ? '"' + name + ' (via Prenolia)" <' + addr + ">" : raw;
}

async function sendMail(to, subject, html, text, bizName) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.error("RESEND_API_KEY mancante"); return false; }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress(bizName), to: [to], subject, html, text }),
    });
    if (!r.ok) console.error("Resend", r.status, await r.text().catch(() => ""));
    return r.ok;
  } catch (e) { console.error("Resend", e && e.message); return false; }
}

// ---------- formati di data in italiano, nel fuso dell'attivita' ----------
function dayKey(d, tz) { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d); }
function fmtLong(d, tz) {
  const s = new Intl.DateTimeFormat("it-IT", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function fmtTime(d, tz) { return new Intl.DateTimeFormat("it-IT", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(d); }
function fmtShort(d, tz) { return new Intl.DateTimeFormat("it-IT", { timeZone: tz, day: "numeric", month: "short" }).format(d); }
function limitText(h) {
  if (!h) return "";
  if (h === 1) return "1 ora";
  if (h === 24) return "1 giorno";
  if (h === 48) return "2 giorni";
  return h + " ore";
}

// o: { kind: "confirm" | "reminder", slug, apptId, bizName, bizPhone, bizAddress, customerName, service, staffName,
//      startsAt, endsAt, tz, customerAddress, cancelLimitH, privacyUrl }
function appointmentEmail(o) {
  const tz = o.tz || "Europe/Rome";
  const start = new Date(o.startsAt), end = new Date(o.endsAt || o.startsAt);
  const base = baseUrl();
  const logo = base + "/brand/prenolia-light.png";
  const tomorrow = dayKey(start, tz) === dayKey(new Date(Date.now() + 86400000), tz);
  const today = dayKey(start, tz) === dayKey(new Date(), tz);
  const when = fmtLong(start, tz) + " alle " + fmtTime(start, tz);
  const first = String(o.customerName || "").trim().split(/\s+/)[0] || "";
  const cUrl = o.slug && o.apptId ? cancelUrl(o.slug, o.apptId) : "";
  const title = o.bizName + " - " + o.service;
  const cal = icsUrl(title, start.toISOString(), end.toISOString(), "Appuntamento confermato con " + o.bizName, o.customerAddress || o.bizAddress || "");
  const lim = Number(o.cancelLimitH) || 0;

  let headline, intro, subject, pre;
  if (o.kind === "reminder") {
    headline = today ? "Ti aspettiamo oggi" : (tomorrow ? "Ti aspettiamo domani" : "Promemoria del tuo appuntamento");
    intro = "Ti ricordiamo l’appuntamento da <b>" + esc(o.bizName) + "</b>.";
    subject = "Promemoria: " + o.service + (today ? " oggi" : (tomorrow ? " domani" : " " + fmtShort(start, tz))) + " alle " + fmtTime(start, tz);
    pre = o.service + ", " + when;
  } else {
    headline = "Appuntamento confermato";
    intro = "La tua prenotazione da <b>" + esc(o.bizName) + "</b> è confermata.";
    subject = "Prenotazione confermata: " + o.service + ", " + fmtShort(start, tz) + " alle " + fmtTime(start, tz);
    pre = o.service + ", " + when;
  }

  const rows = [["Servizio", esc(o.service)], ["Quando", "<b style=\"font-size:18px;color:#0B2530\">" + esc(when) + "</b>"]];
  if (o.staffName) rows.push(["Con", esc(o.staffName)]);
  if (o.customerAddress) rows.push(["Dove", "A casa tua: " + esc(o.customerAddress)]);
  else if (o.bizAddress) rows.push(["Dove", esc(o.bizAddress)]);
  if (o.bizPhone) rows.push(["Telefono", "<a href=\"tel:" + esc(String(o.bizPhone).replace(/[^\d+]/g, "")) + "\" style=\"color:#14808B;text-decoration:none\">" + esc(o.bizPhone) + "</a>"]);
  const rowsHtml = rows.map((r, i) =>
    "<tr><td style=\"padding:" + (i ? "10px" : "0") + " 0 10px;width:84px;vertical-align:top;color:#6B7C8A;font-size:13px\">" + r[0] + "</td>" +
    "<td style=\"padding:" + (i ? "10px" : "0") + " 0 10px;vertical-align:top;color:#0B2530;font-size:15px;line-height:1.4\">" + r[1] + "</td></tr>"
  ).join("");

  let cancelNote;
  if (!cUrl) cancelNote = "";
  else if (lim > 0) cancelNote = "Puoi annullare online fino a " + limitText(lim) + " prima dell’appuntamento. Dopo " + (o.bizPhone ? "chiama il " + esc(o.bizPhone) : "contatta direttamente l’attività") + ".";
  else cancelNote = "Non puoi più venire? Annullare con un tocco libera l’orario per qualcun altro.";

  const btn = (href, label, primary) =>
    "<table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"margin:0 0 10px\"><tr><td style=\"border-radius:14px;" +
    (primary ? "background:#19B8C8\"><a href=\"" + href + "\" style=\"display:inline-block;padding:15px 26px;font-size:16px;font-weight:700;color:#031016;text-decoration:none;border-radius:14px\">"
             : "border:1.5px solid #C9D6DE\"><a href=\"" + href + "\" style=\"display:inline-block;padding:13px 24px;font-size:15px;font-weight:600;color:#B4413A;text-decoration:none;border-radius:14px\">") +
    label + "</a></td></tr></table>";

  const greet = (first ? "Ciao " + esc(first) + ", " + intro.charAt(0).toLowerCase() + intro.slice(1) : intro);
  const html = "<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"color-scheme\" content=\"light\"><meta name=\"supported-color-schemes\" content=\"light\"><title>" + esc(headline) + "</title></head>" +
    "<body style=\"margin:0;padding:0;background:#EEF3F6\">" +
    "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent\">" + esc(pre) + "</div>" +
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#EEF3F6\"><tr><td align=\"center\" style=\"padding:24px 12px\">" +
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:560px;background:#FFFFFF;border-radius:22px;border:1px solid #DCE6EC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif\">" +
    "<tr><td style=\"padding:28px 32px 0\"><img src=\"" + logo + "\" width=\"132\" alt=\"Prenolia\" style=\"display:block;border:0;height:auto;width:132px\"></td></tr>" +
    "<tr><td style=\"padding:0 32px\"><div style=\"height:3px;width:44px;background:#19B8C8;border-radius:3px;margin-top:16px\"></div></td></tr>" +
    "<tr><td style=\"padding:20px 32px 0\">" +
      "<h1 style=\"margin:0 0 10px;font-size:26px;line-height:1.2;letter-spacing:-.02em;color:#0B2530\">" + esc(headline) + "</h1>" +
      "<p style=\"margin:0;font-size:16px;line-height:1.55;color:#33464F\">" + greet + "</p>" +
    "</td></tr>" +
    "<tr><td style=\"padding:20px 32px 0\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#F3F8FA;border:1px solid #E1ECF1;border-radius:16px\"><tr><td style=\"padding:18px 20px 8px\">" +
      "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">" + rowsHtml + "</table></td></tr></table></td></tr>" +
    "<tr><td style=\"padding:24px 32px 0\">" + btn(cal, "Aggiungi al calendario", true) +
      (cUrl ? btn(cUrl, "Annulla appuntamento", false) : "") +
      (cancelNote ? "<p style=\"margin:4px 0 0;font-size:13.5px;line-height:1.5;color:#5B6E7A\">" + cancelNote + "</p>" : "") +
    "</td></tr>" +
    "<tr><td style=\"padding:26px 32px 28px\"><div style=\"border-top:1px solid #E5EDF1;padding-top:16px;font-size:12.5px;line-height:1.55;color:#7A8B96\">" +
      "Questa email è stata inviata da Prenolia per conto di " + esc(o.bizName) + ", perché hai lasciato questo indirizzo prenotando. Lo usiamo solo per la conferma e il promemoria di questo appuntamento. Non rispondere a questo messaggio." +
      (o.privacyUrl ? " <a href=\"" + esc(o.privacyUrl) + "\" style=\"color:#14808B\">Informativa privacy</a>" : "") +
    "</div></td></tr>" +
    "</table></td></tr></table></body></html>";

  const text = [
    headline + (first ? ", " + first : ""), "",
    (o.kind === "reminder" ? "Ti ricordiamo l'appuntamento da " : "La tua prenotazione da ") + o.bizName + (o.kind === "reminder" ? "." : " è confermata."), "",
    "Servizio: " + o.service, "Quando: " + when,
    o.staffName ? "Con: " + o.staffName : "",
    o.customerAddress ? "Dove: a casa tua, " + o.customerAddress : (o.bizAddress ? "Dove: " + o.bizAddress : ""),
    o.bizPhone ? "Telefono: " + o.bizPhone : "", "",
    "Aggiungi al calendario: " + cal,
    cUrl ? "Annulla l'appuntamento: " + cUrl : "",
    cancelNote ? cancelNote.replace(/<[^>]+>/g, "") : "", "",
    "Email inviata da Prenolia per conto di " + o.bizName + ". Non rispondere a questo messaggio.",
  ].filter((x, i, a) => x !== "" || (a[i - 1] !== "" && i > 0)).join("\n");

  return { subject, html, text };
}

module.exports = { limitText, sendMail, appointmentEmail, normalizeEmail, cancelSig, validCancelSig, cancelUrl, baseUrl, fmtLong, fmtTime };
