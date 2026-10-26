// Pagina "Annulla la prenotazione" del campo, aperta dal link dell'email di conferma.
const mail = require("./mail.js");
const e = (x) => String(x == null ? "" : x).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function page(o) {
  const tz = o.tz || "Europe/Rome";
  const back = "/circolo/" + encodeURIComponent(o.slug);
  const phoneLine = o.phone ? '<p class="mut">Chiama il <a href="tel:' + e(String(o.phone).replace(/[^\d+]/g, "")) + '">' + e(o.phone) + "</a>.</p>" : '<p class="mut">Contatta direttamente il circolo.</p>';
  const det = o.start ? '<div class="box"><div><span>Campo</span><b>' + e(o.court || "") + "</b></div><div><span>Quando</span><b>" + e(mail.fmtLong(o.start, tz) + " alle " + mail.fmtTime(o.start, tz)) + "</b></div></div>" : "";
  let inner;
  if (o.state === "ask") inner = '<h1>Vuoi annullare?</h1><p class="mut">Annullando liberi il campo per qualcun altro.</p>' + det + '<div id="msg" class="err" hidden></div><button id="go" class="btn danger" type="button">Sì, annulla la prenotazione</button><a class="btn ghost" href="' + back + '">No, la tengo</a>';
  else if (o.state === "toolate") inner = "<h1>Non si può più annullare online</h1><p class=\"mut\">Mancano meno di " + e(o.limitText) + " alla prenotazione.</p>" + det + phoneLine;
  else if (o.state === "past") inner = "<h1>Prenotazione già passata</h1>" + det + '<a class="btn" href="' + back + '">Prenota un campo</a>';
  else inner = '<h1>Prenotazione non trovata</h1><p class="mut">Potrebbe essere già stata annullata, oppure il link non è più valido.</p><a class="btn" href="' + back + '">Prenota un campo</a>';
  const script = o.state === "ask" ? "<script>(function(){var b=document.getElementById('go'),m=document.getElementById('msg');b.addEventListener('click',function(){b.disabled=true;b.textContent='Un attimo…';m.hidden=true;fetch('/api/campi?b=" + encodeURIComponent(o.slug) + "',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'cancel',id:" + JSON.stringify(String(o.id)) + ",k:" + JSON.stringify(String(o.k)) + "})}).then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}})}).then(function(x){if(x.ok){document.getElementById('card').innerHTML='<h1>Prenotazione annullata</h1><p class=\"mut\">Grazie per avercelo fatto sapere.</p><a class=\"btn\" href=\"" + back + "\">Prenota un altro orario</a>'}else{m.textContent=(x.d&&x.d.error)||'Non sono riuscito ad annullare. Riprova.';m.hidden=false;b.disabled=false;b.textContent='Sì, annulla la prenotazione'}}).catch(function(){m.textContent='Connessione assente. Riprova.';m.hidden=false;b.disabled=false;b.textContent='Sì, annulla la prenotazione'})})})();</script>" : "";
  return '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/png" sizes="64x64" href="/brand/favicon.png?v=2"><title>Annulla la prenotazione · ' + e(o.bizName) + '</title><style>' +
    ':root{--bg:#EEF3F6;--card:#fff;--ink:#0B2530;--mut:#5B6E7A;--line:#DCE6EC;--acc:#19B8C8;--on:#031016;--danger:#B4413A;color-scheme:light dark}' +
    '@media(prefers-color-scheme:dark){:root{--bg:#07090C;--card:#0E131B;--ink:#F4F1EA;--mut:#93A0B0;--line:#1C2532;--acc:#2DD2DC;--on:#031016;--danger:#F08A82}}' +
    '*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;padding:24px 16px;min-height:100vh;display:grid;place-items:start center}' +
    '.card{width:100%;max-width:480px;background:var(--card);border:1px solid var(--line);border-radius:22px;padding:28px 24px;display:grid;gap:14px}h1{margin:6px 0 0;font-size:1.55rem;letter-spacing:-.02em;line-height:1.2}.mut{margin:0;color:var(--mut);line-height:1.5}.mut a{color:var(--acc)}' +
    '.brand{color:var(--mut);font-size:.9rem}.box{border:1px solid var(--line);border-radius:16px;padding:14px 16px;display:grid;gap:10px}.box div{display:flex;gap:14px;align-items:baseline}.box span{flex:none;width:68px;color:var(--mut);font-size:.82rem}.box b{font-weight:650}' +
    '.btn{display:block;text-align:center;text-decoration:none;font:inherit;font-weight:700;border:0;border-radius:14px;padding:15px 18px;background:var(--acc);color:var(--on);cursor:pointer}.btn.danger{background:var(--danger);color:#fff}.btn.ghost{background:transparent;color:var(--ink);border:1.5px solid var(--line)}.btn:disabled{opacity:.6}.err{color:var(--danger);font-weight:600}' +
    '</style></head><body><main class="card" id="card"><div class="brand">' + e(o.bizName) + "</div>" + inner + "</main>" + script + "</body></html>";
}
module.exports = { page };
