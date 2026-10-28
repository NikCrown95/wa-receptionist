// Email al titolare (da Prenolia): stesso guscio per abbonamento e account. style "a" chiaro, "b" con testata scura.
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// o: {style, base, headline, lead, body, facts:[[label,value]], cta, link, note, tone:'info'|'warn', footer}
function ownerMail(o) {
  const base = o.base || "https://prenolia.it";
  const dark = o.style === "b";
  const logo = base + (dark ? "/brand/prenolia-dark.png" : "/brand/prenolia-light.png");
  const accent = "#19B8C8", ink = "#0B2530", muted = "#4F636E";
  const warn = o.tone === "warn";
  const chip = o.chip ? "<div style=\"display:inline-block;margin:0 0 14px;padding:5px 11px;border-radius:999px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;background:" + (warn ? "#FFEFD6" : "#DDF3F6") + ";color:" + (warn ? "#8A5200" : "#0B6B77") + "\">" + esc(o.chip) + "</div>" : "";
  const facts = (o.facts && o.facts.length)
    ? "<tr><td style=\"padding:22px 32px 0\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#F2F7F9;border-radius:14px\">" +
      o.facts.map((f, i) => "<tr><td style=\"padding:" + (i === 0 ? "14px" : "0") + " 18px " + (i === o.facts.length - 1 ? "14px" : "0") + ";font-family:" + FONT + "\"><div style=\"font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6A7D88;padding-top:" + (i ? "12px" : "0") + "\">" + esc(f[0]) + "</div><div style=\"font-size:17px;font-weight:700;color:" + ink + ";margin-top:2px\">" + esc(f[1]) + "</div></td></tr>").join("") +
      "</table></td></tr>"
    : "";
  const head = dark
    ? "<tr><td style=\"background:#0B2530;padding:26px 32px 30px;border-radius:22px 22px 0 0\"><img src=\"" + logo + "\" width=\"150\" alt=\"Prenolia\" style=\"display:block;border:0;height:auto;width:150px\"><div style=\"height:3px;width:44px;background:" + accent + ";border-radius:3px;margin:22px 0 16px\"></div><h1 style=\"margin:0;font-family:" + FONT + ";font-size:27px;line-height:1.2;letter-spacing:-.02em;color:#FFFFFF\">" + esc(o.headline) + "</h1></td></tr>" +
      "<tr><td style=\"padding:26px 32px 0\">" + chip + "<p style=\"margin:0;font-family:" + FONT + ";font-size:16px;line-height:1.6;color:" + muted + "\">" + o.body + "</p></td></tr>"
    : "<tr><td style=\"padding:30px 32px 0\"><img src=\"" + logo + "\" width=\"150\" alt=\"Prenolia\" style=\"display:block;border:0;height:auto;width:150px\"></td></tr>" +
      "<tr><td style=\"padding:26px 32px 0\">" + chip + "<h1 style=\"margin:0 0 12px;font-family:" + FONT + ";font-size:28px;line-height:1.18;letter-spacing:-.02em;color:" + ink + "\">" + esc(o.headline) + "</h1><p style=\"margin:0;font-family:" + FONT + ";font-size:16px;line-height:1.6;color:" + muted + "\">" + o.body + "</p></td></tr>";
  const cta = o.cta ? "<tr><td style=\"padding:26px 32px 0\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\"><tr><td align=\"center\" style=\"border-radius:14px;background:" + (warn ? "#0B2530" : accent) + "\"><a href=\"" + esc(o.link) + "\" style=\"display:block;padding:16px 22px;font-family:" + FONT + ";font-size:16px;font-weight:700;color:" + (warn ? "#FFFFFF" : "#031A20") + ";text-decoration:none\">" + esc(o.cta) + "</a></td></tr></table></td></tr>" : "";
  const note = o.note ? "<tr><td style=\"padding:18px 32px 0\"><p style=\"margin:0;font-family:" + FONT + ";font-size:14px;line-height:1.55;color:#5B6E7A\">" + o.note + "</p></td></tr>" : "";
  const foot = "<tr><td style=\"padding:28px 32px 30px\"><div style=\"border-top:1px solid #E3ECF0;padding-top:16px;font-family:" + FONT + ";font-size:12.5px;line-height:1.6;color:#7A8B96\">" + (o.footer || "Email di servizio inviata da Prenolia. Non rispondere a questo messaggio: per aiutarti scrivi dall’assistenza nelle Impostazioni.") + "</div></td></tr>";
  const pre = "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;color:transparent\">" + esc(o.preheader || o.headline) + "</div>";
  return "<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"color-scheme\" content=\"light\"><meta name=\"supported-color-schemes\" content=\"light\"><title>" + esc(o.headline) + "</title></head>" +
    "<body style=\"margin:0;padding:0;background:#EAF0F3\">" + pre +
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#EAF0F3\"><tr><td align=\"center\" style=\"padding:24px 12px\">" +
    "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:560px;background:#FFFFFF;border-radius:22px;border:1px solid #D9E4EA\">" +
    head + facts + cta + note + foot +
    "</table></td></tr></table></body></html>";
}
module.exports = { ownerMail, esc };
