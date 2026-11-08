// lib/owner-booking-mail.js  (Prenolia: email al titolare per ogni nuova prenotazione e disdetta del cliente)
// Facoltativa: parte solo se businesses.notify_email e' true (Impostazioni > Notifiche).
// Non solleva mai errori: la prenotazione del cliente non deve mai dipendere dall'email.

const mail = require("./mail.js");
const site = require("./site.js");
const { sb } = require("./owner.js");

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const CHANNEL = { selfservice: "Calendario online", web: "Calendario online", whatsapp: "WhatsApp", telegram: "Telegram", webchat: "Webchat" };

function fmt(d, tz, opts) { return new Intl.DateTimeFormat("it-IT", Object.assign({ timeZone: tz }, opts)).format(d); }
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// o: { kind: "booked"|"cancelled", customerName, service, startsAt, tz, at (Date: quando e' successo), channel, url, medical }
function ownerBookingEmail(o) {
  const tz = o.tz || "Europe/Rome";
  const start = new Date(o.startsAt), at = o.at ? new Date(o.at) : new Date();
  const cancelled = o.kind === "cancelled";
  const named = !o.medical && o.customerName;
  const wdShort = fmt(start, tz, { weekday: "short" }).replace(".", "");
  const monShort = fmt(start, tz, { month: "short" }).replace(".", "");
  const dayNum = fmt(start, tz, { day: "numeric" });
  const whenLong = cap(fmt(start, tz, { weekday: "long", day: "numeric", month: "long" }));
  const hm = fmt(start, tz, { hour: "2-digit", minute: "2-digit", hour12: false });
  const atText = fmt(at, tz, { day: "numeric", month: "long" }) + ", " + fmt(at, tz, { hour: "2-digit", minute: "2-digit", hour12: false });
  const where = CHANNEL[o.channel] || "";
  const who = named ? String(o.customerName) : "";
  const svc = o.medical ? "Appuntamento" : (o.service || "Appuntamento");
  const shortWhen = wdShort + " " + dayNum + " " + monShort + " alle " + hm;

  const subject = (cancelled ? "Prenotazione cancellata" : "Nuova prenotazione") + ": " + (who ? who + ", " : "") + shortWhen;
  const chip = cancelled ? "Prenotazione cancellata" : "Nuova prenotazione";
  const headline = cancelled
    ? (who ? who + " ha cancellato" : "Una prenotazione è stata cancellata")
    : (who ? who + " ha prenotato" : "Hai una nuova prenotazione");
  const lead = cancelled
    ? "Il cliente ha annullato l’appuntamento dal suo link. L’orario è tornato libero in agenda."
    : "Un nuovo appuntamento è entrato nella tua agenda" + (where ? " (" + where.toLowerCase() + ")" : "") + ". Non devi fare niente.";
  const sub = cancelled ? "Era fissato per " + whenLong.toLowerCase() + ", alle " : whenLong + ", alle ";

  const logo = site.baseUrl() + "/brand/prenolia-light.png";
  const chipBg = cancelled ? "#FFEFD6" : "#DDF3F6", chipFg = cancelled ? "#7A4800" : "#0B6B77";
  const tileBg = cancelled ? "#E3EAEE" : "#19B8C8", tileFg = cancelled ? "#4F636E" : "#031016";
  const row = (k, v, first) => "<tr><td style=\"padding:" + (first ? "0" : "10px") + " 0 0;font-family:" + FONT + ";font-size:14.5px;color:#5B6E7A\">" + esc(k) + "</td><td align=\"right\" style=\"padding:" + (first ? "0" : "10px") + " 0 0;font-family:" + FONT + ";font-size:14.5px;font-weight:700;color:#0B2530\">" + esc(v) + "</td></tr>";
  const rows = [];
  if (who) rows.push(["Cliente", who]);
  rows.push([cancelled ? "Cancellata il" : "Prenotata il", atText]);
  if (where) rows.push(["Da dove", where]);

  const html = "<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"color-scheme\" content=\"light\"><meta name=\"supported-color-schemes\" content=\"light\"><title>" + esc(headline) + "</title></head>" +
    "<body style=\"margin:0;padding:0;background:#EEF3F6\">" +
    "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent\">" + esc(svc + " · " + shortWhen) + "</div>" +
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#EEF3F6\"><tr><td align=\"center\" style=\"padding:24px 12px\">" +
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:560px;background:#FFFFFF;border-radius:22px;border:1px solid #DCE6EC\">" +
    "<tr><td style=\"padding:28px 32px 0\"><img src=\"" + logo + "\" width=\"160\" alt=\"Prenolia\" style=\"display:block;border:0;height:auto;width:160px\"></td></tr>" +
    "<tr><td style=\"padding:0 32px\"><div style=\"height:3px;width:44px;background:#19B8C8;border-radius:3px;margin-top:16px\"></div></td></tr>" +
    "<tr><td style=\"padding:20px 32px 0\">" +
      "<div style=\"display:inline-block;margin:0 0 12px;padding:5px 11px;border-radius:999px;font-family:" + FONT + ";font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;background:" + chipBg + ";color:" + chipFg + "\">" + esc(chip) + "</div>" +
      "<h1 style=\"margin:0 0 10px;font-family:" + FONT + ";font-size:26px;line-height:1.2;letter-spacing:-.02em;color:#0B2530\">" + esc(headline) + "</h1>" +
      "<p style=\"margin:0;font-family:" + FONT + ";font-size:16px;line-height:1.55;color:#33464F\">" + esc(lead) + "</p>" +
    "</td></tr>" +
    "<tr><td style=\"padding:22px 32px 0\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#F3F8FA;border:1px solid #E1ECF1;border-radius:18px\"><tr><td style=\"padding:18px 20px\">" +
      "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr>" +
        "<td width=\"68\" valign=\"middle\"><table role=\"presentation\" width=\"68\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td align=\"center\" style=\"width:68px;height:72px;border-radius:16px;background:" + tileBg + ";color:" + tileFg + ";font-family:" + FONT + "\">" +
          "<div style=\"font-size:11px;font-weight:800;letter-spacing:.1em;line-height:1\">" + esc(wdShort.toUpperCase()) + "</div>" +
          "<div style=\"font-size:30px;font-weight:800;line-height:1;margin:4px 0 3px\">" + esc(dayNum) + "</div>" +
          "<div style=\"font-size:11px;font-weight:800;letter-spacing:.1em;line-height:1\">" + esc(monShort.toUpperCase()) + "</div></td></tr></table></td>" +
        "<td valign=\"middle\" style=\"padding-left:16px;font-family:" + FONT + "\"><div style=\"font-size:19px;font-weight:800;letter-spacing:-.01em;color:#0B2530\">" + esc(svc) + "</div>" +
          "<div style=\"font-size:15px;color:#33464F;margin-top:4px\">" + esc(sub) + "<b style=\"color:#0B2530\">" + esc(hm) + "</b></div></td>" +
      "</tr></table>" +
      "<div style=\"height:1px;background:#E1ECF1;margin:16px 0 14px\"></div>" +
      "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\">" + rows.map((r, i) => row(r[0], r[1], i === 0)).join("") + "</table>" +
    "</td></tr></table></td></tr>" +
    "<tr><td style=\"padding:24px 32px 0\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td align=\"center\" style=\"border-radius:14px;background:#19B8C8\"><a href=\"" + esc(o.url) + "\" style=\"display:block;padding:15px 26px;font-family:" + FONT + ";font-size:16px;font-weight:700;color:#031016;text-decoration:none\">Apri l’agenda</a></td></tr></table>" +
      (cancelled ? "" : "<p style=\"margin:12px 0 0;text-align:center;font-family:" + FONT + ";font-size:13.5px;line-height:1.5;color:#5B6E7A\">Se il cliente cancella, ti scriviamo di nuovo.</p>") +
    "</td></tr>" +
    "<tr><td style=\"padding:26px 32px 28px\"><div style=\"border-top:1px solid #E5EDF1;padding-top:16px;font-family:" + FONT + ";font-size:12.5px;line-height:1.55;color:#5B6E7A\">Ricevi questa email perché hai attivato “Email per ogni prenotazione”. Puoi spegnerla in Impostazioni › Notifiche. Non rispondere a questo messaggio: per aiutarti scrivi dall’assistenza nelle Impostazioni.</div></td></tr>" +
    "</table></td></tr></table></body></html>";

  const text = [headline, "", lead, "", svc + " · " + whenLong + ", alle " + hm]
    .concat(rows.map((r) => r[0] + ": " + r[1]))
    .concat(["", "Apri l’agenda: " + o.url, "", "Ricevi questa email perché hai attivato “Email per ogni prenotazione”. Puoi spegnerla in Impostazioni › Notifiche."]).join("\n");
  return { subject, html, text };
}

// info: { customerName, service, startsAt, timezone, channel, medical }
async function sendOwnerBookingMail(businessId, kind, info) {
  try {
    const b = await sb("GET", "businesses?id=eq." + encodeURIComponent(businessId) + "&select=notify_email,agenda_token,timezone&limit=1");
    if (!b.ok || !Array.isArray(b.data) || !b.data[0] || b.data[0].notify_email !== true) return false;
    const u = await sb("GET", "business_users?business_id=eq." + encodeURIComponent(businessId) + "&active=eq.true&select=email&limit=1");
    const to = u.ok && Array.isArray(u.data) && u.data[0] ? u.data[0].email : "";
    if (!to || !info || !info.startsAt) return false;
    const t = b.data[0].agenda_token;
    const url = t ? site.baseUrl() + "/api/agenda?t=" + t : site.baseUrl();
    const m = ownerBookingEmail({ kind, customerName: info.customerName, service: info.service, startsAt: info.startsAt, tz: info.timezone || b.data[0].timezone, channel: info.channel, url, medical: !!info.medical });
    // senza il nome dell'attivita' nel mittente: e' un'email di Prenolia, come quelle dell'abbonamento
    return await Promise.race([mail.sendMail(to, m.subject, m.html, m.text), new Promise((ok) => setTimeout(() => ok(false), 6000))]);
  } catch (e) {
    console.error("Email al titolare non inviata (ignoro):", e && e.message);
    return false;
  }
}

module.exports = { ownerBookingEmail, sendOwnerBookingMail };
