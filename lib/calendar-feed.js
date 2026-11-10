// Calendario delle prenotazioni in formato .ics, da aggiungere a Calendario di iPhone/iPad ("Iscriviti").
// Il calendario del telefono rilegge il link da solo: nuove prenotazioni, spostamenti e annullamenti si aggiornano senza altro.

function esc(s, n) {
  return String(s == null ? "" : s).slice(0, n || 500).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// Le righe di un .ics non devono superare 75 byte: si va a capo con uno spazio all'inizio della riga successiva
function fold(line) {
  const out = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch, "utf8");
    if (bytes + b > 73) { out.push(cur); cur = ch; bytes = b; } else { cur += ch; bytes += b; }
  }
  out.push(cur);
  return out.join("\r\n ");
}

function fmt(ms) { return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }

// events: [{ id, title, description, startsAt, endsAt }] (date ISO)
function buildIcs(events, opts) {
  const o = opts || {};
  const now = Date.now();
  const L = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Prenolia//Prenotazioni//IT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:" + esc(o.name || "Prenolia", 80),
    "X-APPLE-CALENDAR-COLOR:#26C6B0",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M", "X-PUBLISHED-TTL:PT15M",
  ];
  (events || []).forEach((e) => {
    const s = Date.parse(e.startsAt), en = Date.parse(e.endsAt);
    if (!Number.isFinite(s) || !Number.isFinite(en) || en <= s) return;
    L.push(
      "BEGIN:VEVENT",
      "UID:appt-" + String(e.id).replace(/[^A-Za-z0-9-]/g, "") + "@prenolia.it",
      "DTSTAMP:" + fmt(now), "DTSTART:" + fmt(s), "DTEND:" + fmt(en),
      "SUMMARY:" + esc(e.title || "Prenotazione", 120),
      "DESCRIPTION:" + esc(e.description || "", 400),
      "STATUS:CONFIRMED", "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  });
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}

// Il codice del link: 32 caratteri esadecimali, scelti a caso e diversi dal codice della dashboard
function validToken(t) { return /^[a-f0-9]{32}$/.test(String(t || "")); }

module.exports = { buildIcs, validToken, esc, fold };

// ---- Dashboard dei personal trainer: voce "Calendario" in Impostazioni, visibile solo su iPhone e iPad ----
const IOS_HEAD =
  '<script>(function(){var u=navigator.userAgent||"";if(/iPad|iPhone|iPod/.test(u)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1))document.documentElement.classList.add("isIos")})()</script>' +
  '<style>html:not(.isIos) .stRow[data-st="calendar"],html:not(.isIos) .stPage[data-st="calendar"]{display:none!important}</style>';

const ROW =
  '<button type="button" class="stRow" data-st="calendar"><span class="stIc c-teal"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/></svg></span>' +
  '<span class="stTx"><b>Calendario</b><small>Le prenotazioni sul calendario del telefono</small></span><span class="stCh" aria-hidden="true">›</span></button>\n              ';

const SECTION =
  '<section class="stPage" data-st="calendar">\n' +
  '            <header class="stPh"><button type="button" class="stBack"><span aria-hidden="true">‹</span> Impostazioni</button><h2>Calendario</h2><p>Le tue prenotazioni coaching compaiono da sole nel calendario di iPhone e iPad.</p></header>\n' +
  '            <div class="stCard"><h4>Aggiungi al calendario</h4>' +
  '<p class="stHint" style="margin:0 0 14px">Tocca il pulsante e conferma con «Iscriviti»: da quel momento le prenotazioni compaiono nel calendario «Prenolia». Nuove prenotazioni, spostamenti e annullamenti si aggiornano da soli.</p>' +
  '<a class="stBtn" id="calAdd" aria-disabled="true" role="button">Aggiungi a iPhone o iPad</a>' +
  '<div id="calFb" style="display:none;margin-top:14px"><p class="stHint" style="margin:0 0 10px">Se il telefono non ha aperto il calendario, copia il link e incollalo nella barra di Safari: si aprir\u00e0 Calendario e potrai toccare \u00abIscriviti\u00bb.</p><button type="button" class="stBtn outline" id="calCopy">Copia il link</button></div>' +
  '<p class="stMsg" id="calMsg" role="status"></p></div>\n' +
  '            <div class="stCard"><h4>Cosa vedrai</h4><div class="calList">' +
  '<div><span>Titolo</span><span>Coaching · Nome iscritto</span></div>' +
  '<div><span>Orario</span><span>Come in agenda</span></div>' +
  '<div><span>Aggiornamento</span><span>Non è istantaneo: il telefono controlla da solo ogni tanto</span></div></div></div>\n' +
  '            <div class="stCard"><h4>Link personale</h4><p class="stHint" style="margin:0 0 12px">Il calendario usa un link segreto: chi lo conosce può vedere le tue prenotazioni. Se pensi che qualcun altro lo abbia, creane uno nuovo: quello vecchio smette di funzionare e dovrai aggiungere di nuovo il calendario.</p>' +
  '<button type="button" class="stBtn outline-danger" id="calReset">Crea un nuovo link</button></div>\n' +
  '          </section>\n\n          ';

function patchPtPage(html) {
  html = html.replace("<head>", "<head>" + IOS_HEAD);
  html = html.replace('<button type="button" class="stRow" data-st="theme">', ROW + '<button type="button" class="stRow" data-st="theme">');
  html = html.replace('<section class="stPage" data-st="notifications">', SECTION + '<section class="stPage" data-st="notifications">');
  return html;
}

module.exports.patchPtPage = patchPtPage;
