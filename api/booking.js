// api/booking.js  (Lia: calendario di prenotazione pubblico, senza AI)
// Un solo file: serve sia la pagina (HTML) sia i dati (JSON).
// Link di accesso: https://TUO-SITO.vercel.app/api/booking?b=SLUG_DELL_ATTIVITA
// Variabili su Vercel: SUPABASE_URL, SUPABASE_SECRET_KEY (le stesse gia' in uso).

const { getAccess, BOOKING_BLOCKED_MESSAGE } = require("../lib/access.js");
const { attachStaff, resourceOk } = require("../lib/staff.js");
const PAGE = "<!doctype html>\n<html lang=\"it\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<meta name=\"color-scheme\" content=\"dark\">\n<title>Prenota</title>\n<link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">\n<style>\n:root{\n  --bg:#050608; --bg2:#0A0D12; --card:#0E131B; --card2:#161D29; --line:#1C2532; --line2:#2A3648;\n  --ink:#F9F6F0; --muted:#9BA6B5;\n  --accent:#4BB3D6; --accent2:#3593B8; --on-accent:#04141A; --accent-soft:#0E2A33; --accent-ink:#B5E4F2;\n  --green:#3FE08A; --err:#FF8A8A;\n  color-scheme:dark;\n  box-sizing:border-box;\n}\nhtml,body{height:100%;overflow:hidden;overscroll-behavior:none;}\nhtml{background:var(--bg);}\n*{box-sizing:border-box;}\nbody{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,\"SF Pro Display\",\"SF Pro Text\",\"Inter\",\"Helvetica Neue\",Helvetica,Arial,sans-serif;font-size:16px;line-height:1.45;-webkit-font-smoothing:antialiased;}\nh1,h2,h3,p,ul{margin:0;}\nul{padding:0;list-style:none;}\n:focus-visible{outline:3px solid var(--accent);outline-offset:2px;border-radius:10px;}\n.avatar{flex:none;width:56px;height:56px;border-radius:18px;background:var(--accent-soft);border:1px solid color-mix(in srgb,var(--accent) 35%,var(--line));color:var(--accent-ink);display:grid;place-items:center;}\n\n.app{max-width:640px;margin:0 auto;height:100vh;height:100dvh;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);display:flex;flex-direction:column;overflow:hidden;overflow:clip;}\n.top{padding:16px 20px 0;}\n.top-row{display:flex;align-items:center;gap:14px;}\n.top h1{font-size:1.2rem;font-weight:700;letter-spacing:-0.02em;}\n.tagline{margin-top:2px;color:var(--muted);font-size:.92rem;overflow-wrap:anywhere;}\n\n.seg{margin:16px 0 0;display:flex;padding:4px;border-radius:16px;background:var(--card);border:1px solid var(--line);}\n.seg button{flex:1;min-height:44px;border:0;border-radius:12px;background:transparent;color:var(--muted);font-family:inherit;font-size:.96rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;}\n.seg button[aria-pressed=\"true\"]{background:var(--accent);color:var(--on-accent);}\n.seg button svg{flex:none;}\n\n.panel{flex:1;display:flex;flex-direction:column;min-height:0;}\n.panel[hidden]{display:none;}\n\n/* ---------- chat ---------- */\n#chatMsgs{flex:1;padding:18px 20px 8px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;}\n.row{display:flex;}\n.row.me{justify-content:flex-end;}\n.row.lia{justify-content:flex-start;}\n.b{max-width:82%;padding:11px 16px;border-radius:20px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:1rem;opacity:0;transform:translateY(10px) scale(.98);animation:pop .38s cubic-bezier(.2,.9,.3,1.2) forwards;}\n.row.me .b{background:linear-gradient(160deg,var(--accent) 0%,var(--accent2) 100%);color:var(--on-accent);font-weight:500;border-bottom-right-radius:6px;}\n.row.lia .b{background:var(--card);border:1px solid var(--line);border-bottom-left-radius:6px;}\n@keyframes pop{to{opacity:1;transform:none;}}\n@media (prefers-reduced-motion: reduce){.b{opacity:1;transform:none;animation:none;}}\n.typing{display:inline-flex;align-items:center;gap:4px;padding:14px 18px;border-radius:20px;border-bottom-left-radius:6px;background:var(--card);border:1px solid var(--line);}\n.typing i{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:bounce 1.1s ease-in-out infinite;}\n.typing i:nth-child(2){animation-delay:.15s;} .typing i:nth-child(3){animation-delay:.3s;}\n@keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.5;}30%{transform:translateY(-5px);opacity:1;}}\n@media (prefers-reduced-motion: reduce){.typing i{animation:none;opacity:.85;}}\n.quick{display:flex;flex-wrap:wrap;gap:8px;padding:2px 0 6px;}\n.qbtn{min-height:38px;padding:0 16px;border-radius:999px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);font-family:inherit;font-size:.92rem;font-weight:500;cursor:pointer;}\n.qbtn:hover{border-color:var(--accent);}\n.chatbar{position:sticky;bottom:0;display:flex;gap:8px;align-items:flex-end;padding:12px 16px calc(12px + env(safe-area-inset-bottom,0px));background:linear-gradient(to top, var(--bg) 60%, transparent);}\n.chatbar input{flex:1;min-height:48px;padding:0 18px;border-radius:24px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-family:inherit;font-size:1rem;}\n.chatbar input:focus{outline:none;border-color:var(--accent);}\n.sendbtn{flex:none;width:48px;height:48px;border-radius:50%;border:none;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;cursor:pointer;}\n.sendbtn[disabled]{opacity:.4;}\n\n/* ---------- prenota da solo ---------- */\n.col{padding:20px 20px 110px;overflow-y:auto;flex:1;}\n.col h2{font-size:1.5rem;font-weight:700;letter-spacing:-0.03em;line-height:1.15;outline:none;}\n.col .lead{margin-top:8px;color:var(--muted);font-size:1rem;}\n\n.svc-list{margin-top:22px;display:grid;gap:10px;}\n.svc-opt{display:flex;align-items:center;gap:16px;width:100%;text-align:left;padding:16px 18px;border-radius:18px;border:1.5px solid var(--line2);background:var(--card);color:var(--ink);font-family:inherit;cursor:pointer;}\n.svc-opt[aria-pressed=\"true\"]{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft);}\n.svc-opt .mid{flex:1;min-width:0;}\n.svc-opt b{display:block;font-size:1.04rem;font-weight:600;}\n.svc-opt span{display:block;color:var(--muted);font-size:.9rem;margin-top:2px;}\n.svc-opt .price{flex:none;font-size:1.05rem;font-weight:700;}\n\n.cal{margin-top:22px;padding:18px;border-radius:20px;background:var(--card);border:1px solid var(--line2);}\n.cal-head{display:flex;align-items:center;justify-content:space-between;}\n.cal-head b{font-size:1.05rem;font-weight:700;letter-spacing:-0.01em;text-transform:capitalize;}\n.cal-nav{display:flex;gap:6px;}\n.cal-nav button{width:36px;height:36px;border-radius:10px;border:1px solid var(--line2);background:var(--card2);color:var(--ink);display:grid;place-items:center;cursor:pointer;}\n.cal-nav button[disabled]{opacity:.3;cursor:default;}\n.cal-dow{margin-top:14px;display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}\n.cal-dow span{text-align:center;font-size:.72rem;color:var(--muted);font-weight:600;text-transform:uppercase;}\n.cal-grid{margin-top:4px;display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}\n.cal-day{position:relative;aspect-ratio:1;border-radius:12px;border:0;background:transparent;color:var(--ink);font-family:inherit;font-size:.95rem;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;}\n.cal-day.pad{visibility:hidden;}\n.cal-day.off{color:#3E4A5C;cursor:default;}\n.cal-day.today{box-shadow:inset 0 0 0 1.5px var(--line2);}\n.cal-day.ok::after{content:\"\";position:absolute;bottom:6px;width:4px;height:4px;border-radius:50%;background:var(--accent);}\n.cal-day.full{color:#6B7789;text-decoration:line-through;cursor:default;}\n.cal-day[aria-pressed=\"true\"]{background:var(--accent);color:var(--on-accent);}\n.cal-day[aria-pressed=\"true\"]::after{background:var(--on-accent);}\n.cal-day:disabled{color:#2A3242;cursor:default;}\n\n.time-group{margin-top:22px;}\n.time-group h3{font-size:.86rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;}\n.time-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:9px;}\n.time-opt{min-height:46px;border-radius:13px;border:1.5px solid var(--line2);background:var(--card);color:var(--ink);font-family:inherit;font-size:.96rem;font-weight:600;cursor:pointer;}\n.time-opt[aria-pressed=\"true\"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent);}\n.time-empty{margin-top:18px;padding:26px 18px;text-align:center;color:var(--muted);border:1px dashed var(--line2);border-radius:16px;font-size:.94rem;}\n\n/* passaggio calendario -> orari, sovrapposto con uno scorrimento */\n.cal-stage{position:relative;overflow:hidden;transition:height .32s cubic-bezier(.2,.8,.2,1);}\n.cal-page,.time-page{position:absolute;left:0;right:0;top:0;transition:transform .32s cubic-bezier(.2,.8,.2,1), opacity .28s ease;}\n.cal-page{transform:translateX(0);opacity:1;}\n.time-page{transform:translateX(100%);opacity:0;pointer-events:none;}\n.cal-stage.show-time .cal-page{transform:translateX(-100%);opacity:0;pointer-events:none;}\n.cal-stage.show-time .time-page{transform:translateX(0);opacity:1;pointer-events:auto;}\n@media (prefers-reduced-motion: reduce){\n  .cal-stage,.cal-page,.time-page{transition:none;}\n}\n.time-back{display:inline-flex;align-items:center;gap:6px;background:transparent;border:0;color:var(--accent-ink);font-family:inherit;font-size:.92rem;font-weight:600;padding:2px 2px 4px;cursor:pointer;}\n.time-page .picked-date{margin-top:10px;font-size:1.02rem;font-weight:700;letter-spacing:-0.01em;text-transform:capitalize;}\n.time-page .time-inner{padding-top:2px;}\n\n.picked{margin-top:22px;padding:14px 16px;border-radius:16px;background:var(--card2);display:flex;align-items:center;gap:12px;}\n.picked .ic{flex:none;width:36px;height:36px;border-radius:10px;background:var(--accent-soft);color:var(--accent-ink);display:grid;place-items:center;}\n.picked b{display:block;font-size:.96rem;font-weight:600;}\n.picked span{display:block;color:var(--muted);font-size:.84rem;}\n\n.field{margin-top:16px;display:grid;gap:7px;}\n.field label{font-size:.88rem;font-weight:500;color:var(--muted);}\n.inp{width:100%;min-height:50px;padding:0 16px;border-radius:14px;border:1px solid var(--line2);background:var(--card);color:var(--ink);font-family:inherit;font-size:1rem;}\n.err-banner{margin-top:16px;padding:12px 14px;border-radius:14px;background:rgba(255,138,138,.08);border:1px solid var(--err);color:var(--err);font-size:.92rem;}\n.load{padding:60px 20px;text-align:center;color:var(--muted);}\n.err-page{margin:40px 20px;padding:20px;border-radius:16px;border:1px solid var(--err);color:var(--err);text-align:center;}\n.inp:focus{outline:none;border-color:var(--accent);}\n\n.actions{margin-top:26px;display:grid;gap:6px;}\n.btn{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 26px;border-radius:999px;font-family:inherit;font-size:1.02rem;font-weight:600;border:0;background:var(--accent);color:var(--on-accent);cursor:pointer;}\n.btn[disabled]{opacity:.4;cursor:default;}\n.btn.text{background:transparent;color:var(--muted);min-height:46px;font-weight:500;}\n\n.summary{margin-top:24px;padding:20px;border-radius:20px;background:var(--card);border:1px solid var(--line);display:grid;gap:12px;}\n.summary .r{display:flex;justify-content:space-between;font-size:.98rem;}\n.summary .r span:first-child{color:var(--muted);}\n.summary hr{border:none;border-top:1px solid var(--line);margin:0;}\n.done{display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:10px;}\n.done .check{width:64px;height:64px;border-radius:50%;background:var(--accent);color:var(--on-accent);display:grid;place-items:center;margin-bottom:18px;}\n\n.info{margin-top:14px;display:flex;flex-wrap:wrap;gap:8px;}\n.info:empty{display:none;}\n.chip{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 13px;border-radius:999px;border:1px solid var(--line2);background:var(--card);color:var(--ink);font-size:.86rem;font-weight:500;text-decoration:none;max-width:100%;}\n.chip svg{flex:none;color:var(--accent-ink);}\n.chip span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n.legend{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);display:flex;flex-wrap:wrap;gap:6px 16px;color:var(--muted);font-size:.8rem;}\n.legend i{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-right:6px;vertical-align:middle;}\n.legend s{color:#6B7789;}\n.saved{margin-top:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:.88rem;color:var(--muted);}\n.linkbtn{background:none;border:0;padding:6px 2px;color:var(--accent-ink);font-family:inherit;font-size:.88rem;font-weight:600;cursor:pointer;}\n.privacy{margin-top:14px;color:var(--muted);font-size:.8rem;line-height:1.4;}\n.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;}\na.btn{text-decoration:none;}\n.btn.ghost{background:transparent;color:var(--ink);box-shadow:inset 0 0 0 1.5px var(--line2);}\n.btn.danger{background:transparent;color:var(--err);box-shadow:inset 0 0 0 1.5px #5A2A2A;}\n.confirm{margin-top:14px;padding:16px;border-radius:16px;border:1px solid var(--line2);background:var(--card2);width:100%;text-align:left;display:grid;gap:10px;}\n.confirm p{font-weight:600;}\n.confirm .err-inline{color:var(--err);font-weight:500;font-size:.9rem;}\n.confirm .row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}\n.confirm .btn{min-height:46px;padding:0 12px;font-size:.96rem;}\n.done .summary,.done .actions{width:100%;text-align:left;}\n.lead.move{color:var(--accent-ink);}\n\n.remind{margin-top:2px;max-width:84%;padding:14px;border-radius:20px;border-bottom-left-radius:6px;background:var(--card);border:1px solid var(--line);}\n.remind.full{max-width:none;border-radius:20px;margin-top:18px;width:100%;text-align:left;}\n.remind h3{margin:0 0 12px;font-size:.88rem;font-weight:600;color:var(--muted);}\n.tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;}\n.tile{cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;min-height:96px;padding:14px 8px;border-radius:16px;border:1.5px solid var(--line2);background:var(--card2);color:var(--ink);font-family:inherit;text-align:center;text-decoration:none;transition:border-color .15s,transform .1s;}\n.tile:hover{border-color:var(--accent);}\n.tile:active{transform:scale(.98);}\n.tile.main{border-color:color-mix(in srgb,var(--accent) 55%,var(--line2));background:var(--accent-soft);}\n.tile .ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent-ink);}\n.tile.main .ic{background:var(--accent);color:var(--on-accent);}\n.tile b{display:block;font-size:.92rem;font-weight:600;line-height:1.2;}\n.tile .s{display:block;margin-top:2px;font-size:.76rem;color:var(--muted);line-height:1.2;font-weight:400;}\n\n.optrow{display:flex;gap:8px;flex-wrap:wrap;}\n.opt{min-width:56px;min-height:46px;padding:0 18px;border-radius:14px;border:1.5px solid var(--line2);background:var(--card);color:var(--ink);font-family:inherit;font-size:1rem;font-weight:600;cursor:pointer;}\n.opt:hover{border-color:var(--accent);}\n.opt[aria-pressed=\"true\"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent);}\n.party{margin-top:6px;}\n.party-info{margin-top:12px;font-size:.92rem;color:var(--accent-ink);min-height:1.3em;}\n.party-err{margin-top:8px;color:var(--err);font-size:.9rem;}\n.price small.per{display:block;font-size:.72rem;color:var(--muted);font-weight:400;text-align:right;}\n.staff-pick{margin:0 0 16px}\n.staff-lab{margin:0 0 8px;color:var(--muted);font-size:.9rem;font-weight:600}\n.staff-chips{display:flex;flex-wrap:wrap;gap:8px}\n.staff-chip{min-height:42px;padding:0 16px;border-radius:999px;border:1.5px solid var(--line2);background:var(--card);color:var(--ink);font-family:inherit;font-size:.95rem;font-weight:600;cursor:pointer}\n.staff-chip[aria-pressed=\"true\"]{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-ink)}\n.staff-chip:focus-visible{outline:3px solid var(--accent);outline-offset:2px}\n</style>\n</head>\n<body>\n<div class=\"app\">\n  <header class=\"top\">\n    <div class=\"top-row\">\n      <div class=\"avatar\" id=\"avatar\" role=\"img\" aria-label=\"Categoria dell'attività\"></div>\n      <div><h1>&nbsp;</h1><p class=\"tagline\" id=\"tagline\"></p></div>\n    </div>\n    <div class=\"info\" id=\"info\"></div>\n    <div class=\"seg\" role=\"tablist\" aria-label=\"Come vuoi prenotare\">\n      <button type=\"button\" id=\"tabBook\" role=\"tab\" aria-pressed=\"true\">\n        <svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"3\"></rect><line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"></line><line x1=\"8\" y1=\"3\" x2=\"8\" y2=\"7\"></line><line x1=\"16\" y1=\"3\" x2=\"16\" y2=\"7\"></line></svg>\n        Prenota da solo\n      </button>\n      <button type=\"button\" id=\"tabChat\" role=\"tab\" aria-pressed=\"false\">\n        <svg width=\"17\" height=\"17\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M21 11.5a8.38 8.38 0 0 1-4.5 7.5 8.5 8.5 0 0 1-8.9-.4L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 8-8.5h.5a8.48 8.48 0 0 1 8 8v.5z\"></path></svg>\n        Chat con Lia\n      </button>\n    </div>\n  </header>\n\n  <section class=\"panel\" id=\"chatPanel\" hidden>\n    <main id=\"chatMsgs\" aria-live=\"polite\"></main>\n    <form class=\"chatbar\" id=\"chatForm\" autocomplete=\"off\">\n      <input id=\"chatInput\" type=\"text\" maxlength=\"300\" placeholder=\"Scrivi un messaggio…\" enterkeyhint=\"send\">\n      <button class=\"sendbtn\" id=\"chatSend\" type=\"submit\" aria-label=\"Invia\">\n        <svg width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><line x1=\"12\" y1=\"19\" x2=\"12\" y2=\"5\"></line><polyline points=\"6 11 12 5 18 11\"></polyline></svg>\n      </button>\n    </form>\n  </section>\n\n  <section class=\"panel\" id=\"bookPanel\">\n    <div class=\"col\" id=\"bookView\"></div>\n  </section>\n</div>\n\n<script>\n(function(){\n  var DAY_SHORT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];\n  var MONTHS = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];\n  var MONTHS3 = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];\n  var DAY_LONG = {0:'lunedì',1:'martedì',2:'mercoledì',3:'giovedì',4:'venerdì',5:'sabato',6:'domenica'};\n  var TODAY = new Date();\n  var SLUG = (new URLSearchParams(location.search).get('b') || '').toLowerCase();\n\n  var BUSINESS = { services: [], name: '', address: '', maxDays: 90, rules: null };\n  var slotsCache = {};\n\n  /* ============== interruttore chat / prenota ============== */\n  var tabChat = document.getElementById('tabChat'), tabBook = document.getElementById('tabBook');\n  var chatPanel = document.getElementById('chatPanel'), bookPanel = document.getElementById('bookPanel');\n  function showTab(which){\n    var chat = which === 'chat';\n    tabChat.setAttribute('aria-pressed', chat ? 'true':'false');\n    tabBook.setAttribute('aria-pressed', chat ? 'false':'true');\n    chatPanel.hidden = !chat; bookPanel.hidden = chat;\n  }\n  tabChat.addEventListener('click', function(){ showTab('chat'); });\n  tabBook.addEventListener('click', function(){ showTab('book'); });\n\n  /* ============== CHAT (vera, collegata a /api/chat) ============== */\n  var CHAT = { sid: null, msgs: [] };\n  /* ---- altezza = area visibile (barre del browser e tastiera su iPad/iPhone) ---- */\n  (function fitViewport(){\n    var app = document.querySelector('.app'); if (!app || !window.visualViewport) return;\n    function fit(){ app.style.height = Math.round(window.visualViewport.height) + 'px'; if (window.scrollY || window.scrollX) window.scrollTo(0, 0); }\n    window.visualViewport.addEventListener('resize', fit);\n    window.visualViewport.addEventListener('scroll', function(){ if (window.scrollY || window.scrollX) window.scrollTo(0, 0); });\n    fit();\n  })();\n\n  /* ---- promemoria calendario (usato da chat e da prenotazione) ---- */\n  function icsHref(c){\n    if (!c || !c.start || !c.end) return '';\n    return '/api/booking?ics=1&t=' + encodeURIComponent(c.title||'Appuntamento') + '&s=' + encodeURIComponent(c.start) + '&e=' + encodeURIComponent(c.end) + '&l=' + encodeURIComponent(c.location||'') + '&d=' + encodeURIComponent(c.description||'');\n  }\n  function gDt(x){ return new Date(x).toISOString().replace(/[-:]/g,'').replace(/\\.\\d{3}/,''); }\n  function googleCalendarUrl(c){\n    if (!c || !c.start || !c.end) return '';\n    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(c.title||'Appuntamento')+'&dates='+encodeURIComponent(gDt(c.start)+'/'+gDt(c.end))+'&details='+encodeURIComponent(c.description||'')+'&location='+encodeURIComponent(c.location||'');\n  }\n  var IS_APPLE = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);\n  var CAL_ICON = '<svg width=\"22\" height=\"22\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8 2v4\"></path><path d=\"M16 2v4\"></path><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"></rect><path d=\"M3 10h18\"></path><path d=\"M12 14v4\"></path><path d=\"M10 16h4\"></path></svg>';\n  function reminderBox(cal, full){\n    var box = document.createElement('div'); box.className = 'remind' + (full ? ' full' : '');\n    var t = document.createElement('h3'); t.textContent = 'Aggiungi un promemoria'; box.appendChild(t);\n    var grid = document.createElement('div'); grid.className = 'tiles';\n    function tile(kind, main){\n      var a = document.createElement('a'); a.className = 'tile' + (main ? ' main' : '');\n      if (kind === 'ios'){ a.href = icsHref(cal); a.setAttribute('aria-label', 'Aggiungi al Calendario di iPhone e iPad'); }\n      else { a.href = googleCalendarUrl(cal); a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', 'Aggiungi a Google Calendar'); }\n      var ic = document.createElement('span'); ic.className = 'ic'; ic.innerHTML = CAL_ICON;\n      var tx = document.createElement('span');\n      var b = document.createElement('b'); b.textContent = kind === 'ios' ? 'Calendario iPhone' : 'Google Calendar';\n      var sm = document.createElement('span'); sm.className = 's'; sm.textContent = kind === 'ios' ? 'iPhone e iPad' : 'Android e computer';\n      tx.appendChild(b); tx.appendChild(sm); a.appendChild(ic); a.appendChild(tx); return a;\n    }\n    var ti = tile('ios', IS_APPLE), tg = tile('google', !IS_APPLE);\n    if (IS_APPLE){ grid.appendChild(ti); grid.appendChild(tg); } else { grid.appendChild(tg); grid.appendChild(ti); }\n    box.appendChild(grid); return box;\n  }\n\n  (function(){\n    var msgsEl = document.getElementById('chatMsgs');\n    var form = document.getElementById('chatForm');\n    var input = document.getElementById('chatInput');\n    var sendBtn = document.getElementById('chatSend');\n    var busy = false;\n    var KEY = 'lia_chat_' + SLUG;\n\n    function uuid(){\n      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();\n      var hx='0123456789abcdef', s2='';\n      for (var i=0;i<36;i++){ if (i===8||i===13||i===18||i===23) s2+='-'; else s2+=hx.charAt(Math.floor(Math.random()*16)); }\n      return s2;\n    }\n    function loadChat(){\n      try { var raw = localStorage.getItem(KEY); if (raw){ var o=JSON.parse(raw); if (o && o.sid) CHAT = o; } } catch(e){}\n      if (!CHAT.sid) CHAT.sid = uuid();\n    }\n    function saveChat(){ try { CHAT.msgs = CHAT.msgs.slice(-40); localStorage.setItem(KEY, JSON.stringify(CHAT)); } catch(e){} }\n\n    function el(tag, cls){ var e = document.createElement(tag); if (cls) e.className = cls; return e; }\n    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;\n    function scrollEnd(){ requestAnimationFrame(function(){ requestAnimationFrame(function(){ msgsEl.scrollTo({top:msgsEl.scrollHeight, behavior: reduceMotion?'auto':'smooth'}); }); }); }\n    function bubble(role, text, isErr){ var row=el('div','row '+role); var b=el('div','b'+(isErr?' err':'')); b.textContent=text; row.appendChild(b); msgsEl.appendChild(row); scrollEnd(); }\n    function calBubble(cal){ var row=el('div','row lia'); row.appendChild(reminderBox(cal,false)); msgsEl.appendChild(row); scrollEnd(); }\n    function addAndSave(role, text){ CHAT.msgs.push({r:role,t:text}); saveChat(); bubble(role, text); }\n    function showTyping(){ var row=el('div','row lia'); row.id='typingRow'; var t=el('div','typing'); t.innerHTML='<i></i><i></i><i></i>'; row.appendChild(t); msgsEl.appendChild(row); scrollEnd(); }\n    function hideTyping(){ var r=document.getElementById('typingRow'); if (r) r.remove(); }\n\n    function greeting(n){ var hr = new Date().getHours(); var g = hr < 13 ? 'Buongiorno' : (hr < 18 ? 'Buon pomeriggio' : 'Buonasera'); return g + '! Sono Lia, l\\'assistente di ' + n + ' 😊 Dimmi pure cosa ti serve.'; }\n    function startChat(bizName){\n      loadChat();\n      if (!CHAT.msgs.length){\n        showTyping();\n        setTimeout(function(){ hideTyping(); addAndSave('lia', greeting(bizName)); }, 500);\n      } else {\n        CHAT.msgs.forEach(function(m){ if (m.r === 'cal') calBubble(m.c); else bubble(m.r, m.t); });\n      }\n      input.disabled = false;\n    }\n\n    function send(text){\n      text = (text||'').trim();\n      if (!text || busy) return;\n      busy = true; sendBtn.disabled = true;\n      input.value = '';\n      addAndSave('me', text);\n      showTyping();\n      fetch('/api/chat', {\n        method:'POST', headers:{'Content-Type':'application/json'},\n        body: JSON.stringify({ b: SLUG, s: CHAT.sid, text: text })\n      }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })\n        .then(function(res){\n          hideTyping();\n          if (!res.ok || !res.data.reply){ bubble('lia', 'Scusa, ho avuto un problema. Riprova tra un attimo.', true); }\n          else { addAndSave('lia', res.data.reply); if (res.data.calendar && res.data.calendar.start){ CHAT.msgs.push({r:'cal', c:res.data.calendar}); saveChat(); calBubble(res.data.calendar); } }\n        }).catch(function(){ hideTyping(); bubble('lia', 'Non riesco a collegarmi. Riprova tra poco.', true); })\n        .then(function(){ busy=false; sendBtn.disabled=false; input.focus({preventScroll:true}); });\n    }\n    form.addEventListener('submit', function(ev){ ev.preventDefault(); send(input.value); });\n    window.LiaChat = { start: startChat };\n  })();\n\n  /* ============== PRENOTA DA SOLO ============== */\n  var state = { step:0, staff:null, staffName:'', service:null, viewMonth: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), date:null, time:null, players:null, members:null, due:null, name:'', phone:'', address:'', hp:'', saved:false, apptId:null, apptPhone:'', moveFrom:null, cancelAsk:false, cancelled:false, cancelError:'', errors:{}, submitting:false, submitError:'' };\n  (function(){ try { var raw = localStorage.getItem('lia_cust'); if (raw){ var o = JSON.parse(raw); if (o && o.name && o.phone){ state.name = String(o.name).slice(0,80); state.phone = String(o.phone).slice(0,30); state.saved = true; } } } catch(e){} })();\n  var AVAIL = {};\n\n  function h(tag, attrs){\n    var e = document.createElement(tag); attrs = attrs || {};\n    for (var k in attrs){ var v=attrs[k];\n      if (k==='class') e.className=v; else if (k==='text') e.textContent=v;\n      else if (k.indexOf('on')===0) e.addEventListener(k.slice(2), v);\n      else if (v===true) e.setAttribute(k,''); else if (v!==false && v!=null) e.setAttribute(k,v);\n    }\n    for (var i=2;i<arguments.length;i++){ var c=arguments[i]; if (c==null||c===false) continue;\n      if (Array.isArray(c)) c.forEach(function(x){ if (x) e.appendChild(x.nodeType?x:document.createTextNode(String(x))); });\n      else e.appendChild(c.nodeType?c:document.createTextNode(String(c)));\n    }\n    return e;\n  }\n  function pad(n){ return String(n).padStart(2,'0'); }\n  function dateKey(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }\n  function sameDay(a,b){ return a && b && dateKey(a)===dateKey(b); }\n  function isPast(d){ var t=new Date(TODAY.getFullYear(),TODAY.getMonth(),TODAY.getDate()); return d < t; }\n  function hmToMin(hm){ var p=hm.split(':'); return +p[0]*60+ +p[1]; }\n  function minToHm(m){ return pad(Math.floor(m/60))+':'+pad(m%60); }\n\n  function staffQ(){ return state.staff ? '&staff=' + encodeURIComponent(state.staff) : ''; }\n  function eligibleStaffFor(service){ var t = BUSINESS.team; if (!t || !t.staff) return []; return t.staff.filter(function(p){ return !p.service_ids.length || p.service_ids.indexOf(service.id) !== -1; }); }\n  function staffPicker(){\n    var list = eligibleStaffFor(state.service);\n    if (list.length < 2) return null;\n    var opts = [{id:null, name:'Nessuna preferenza'}].concat(list);\n    return h('div',{class:'staff-pick'},\n      h('p',{class:'staff-lab', text:'Con chi vuoi prenotare?'}),\n      h('div',{class:'staff-chips'}, opts.map(function(p){\n        return h('button',{class:'staff-chip', type:'button', 'aria-pressed': (state.staff||null)===(p.id||null) ? 'true':'false', onclick:function(){\n          if ((state.staff||null)===(p.id||null)) return;\n          state.staff = p.id; state.staffName = p.id ? p.name : ''; AVAIL = {}; slotsCache = {}; state.date = null; state.time = null; goStep(1);\n        }}, p.name);\n      })));\n  }\n  function fetchSlots(date, service, onDone){\n    var key = service.id + '|' + dateKey(date);\n    if (slotsCache[key]){ onDone(slotsCache[key]); return; }\n    fetch('/api/booking?b=' + encodeURIComponent(SLUG) + '&service=' + encodeURIComponent(service.id) + '&date=' + dateKey(date) + staffQ())\n      .then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })\n      .then(function(res){ var times = (res.ok && res.data.times) ? res.data.times : []; slotsCache[key] = times; onDone(times); })\n      .catch(function(){ onDone([]); });\n  }\n\n  function nav(label, onNext, canBack, disabled){\n    return h('div',{class:'actions'},\n      h('button',{class:'btn', type:'button', text:label, onclick:onNext, disabled: !!disabled}),\n      canBack ? h('button',{class:'btn text', type:'button', text:'Indietro', onclick:function(){ state.errors={}; goStep(state.step-1); }}) : null\n    );\n  }\n  function field(id,label,input){ return h('div',{class:'field'}, h('label',{for:id,text:label}), input); }\n  function textInput(id,type,val,ph,onInput,extra){\n    var a={id:id,class:'inp',type:type,value:val,placeholder:ph||'',oninput:onInput}; for (var k in (extra||{})) a[k]=extra[k]; return h('input',a);\n  }\n  function iconCal(){ var s=document.createElement('span'); s.innerHTML='<svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"3\"></rect><line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"></line><line x1=\"8\" y1=\"3\" x2=\"8\" y2=\"7\"></line><line x1=\"16\" y1=\"3\" x2=\"16\" y2=\"7\"></line></svg>'; return s.firstChild; }\n  function iconCheck(){ var s=document.createElement('span'); s.innerHTML='<svg width=\"30\" height=\"30\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.6\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><polyline points=\"4 12 10 18 20 6\"></polyline></svg>'; return s.firstChild; }\n\n  function stepService(){\n    var list = BUSINESS.services.map(function(s){\n      return h('button',{class:'svc-opt', type:'button', 'aria-pressed': state.service&&state.service.id===s.id?'true':'false', onclick:function(){ state.service=s; state.staff=null; state.staffName=''; state.date=null; state.time=null; goStep(1); }},\n        h('span',{class:'mid'}, h('b',{text:s.name}), h('span',{text:s.dur+' min' + (s.atCustomerPlace ? ' \\u00b7 a domicilio' : '')})),\n        h('span',{class:'price'}, (s.price===0||s.price) ? s.price+' €' : '', (BUSINESS.rules && BUSINESS.rules.members) ? h('small',{class:'per',text:'a non socio'}) : null)\n      );\n    });\n    return h('div', null, h('h2',{id:'h', tabindex:'-1', text:'Cosa vuoi prenotare?'}), h('p',{class:'lead',text:'Scegli il servizio che ti serve.'}), h('div',{class:'svc-list'}, list));\n  }\n\n  function stepDateTime(){\n    state.dtView = state.date ? 'time' : 'cal';\n\n    var monthLabel = h('b', {text: ''});\n    var prevBtn = h('button', {type:'button', 'aria-label':'Mese precedente', onclick:function(){ changeMonth(-1); }}, '\\u2039');\n    var nextBtn = h('button', {type:'button', 'aria-label':'Mese successivo', onclick:function(){ changeMonth(1); }}, '\\u203a');\n    var dowRow = h('div', {class:'cal-dow'}, DAY_SHORT.map(function(d){ return h('span',{text:d}); }));\n    var gridEl = h('div', {class:'cal-grid'});\n    var legend = h('div', {class:'legend'}, h('span',null,h('i'),'Posti liberi'), h('span',null,h('s',{text:'12'}),' Completo'), h('span',{text:'Grigio: chiuso'}));\n    var calPage = h('div', {class:'cal-page'},\n      h('div', {class:'cal-head'}, monthLabel, h('div',{class:'cal-nav'}, prevBtn, nextBtn)),\n      dowRow, gridEl, legend\n    );\n\n    var backBtn = h('button', {class:'time-back', type:'button', onclick: goToCal},\n      h('span', {'aria-hidden':'true'}, '\\u2039'), 'Torna al calendario');\n    var pickedDateEl = h('div', {class:'picked-date'});\n    var timeInner = h('div', {class:'time-inner'});\n    var timePage = h('div', {class:'time-page'}, backBtn, pickedDateEl, timeInner);\n\n    var stage = h('div', {class:'cal-stage'}, calPage, timePage);\n    var calBox = h('div', {class:'cal'}, stage);\n\n    var continueBtn = h('button', {class:'btn', type:'button', text:'Continua', disabled: !(state.date && state.time), onclick:function(){\n      if (state.date && state.time) goStep(2);\n    }});\n    var actions = h('div', {class:'actions'}, continueBtn,\n      h('button',{class:'btn text', type:'button', text:'Indietro', onclick:function(){ state.errors={}; goStep(0); }}));\n\n    function toSet(a){ var o = {}; a.forEach(function(x){ o[x] = true; }); return o; }\n    function ensureAvail(){\n      var y = state.viewMonth.getFullYear(), m = state.viewMonth.getMonth();\n      var ym = y + '-' + pad(m+1), k = state.service.id + '|' + ym;\n      if (AVAIL[k] !== undefined) return;\n      AVAIL[k] = null;\n      fetch('/api/booking?b=' + encodeURIComponent(SLUG) + '&service=' + encodeURIComponent(state.service.id) + '&month=' + ym + staffQ())\n        .then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })\n        .then(function(res){\n          if (!(res.ok && res.data && res.data.free)){ delete AVAIL[k]; return; }\n          AVAIL[k] = { free: toSet(res.data.free), open: toSet(res.data.open || []) };\n          if (state.dtView === 'cal' && state.viewMonth.getFullYear() === y && state.viewMonth.getMonth() === m){ renderMonthGrid(); setStageHeight(); }\n        })\n        .catch(function(){ delete AVAIL[k]; });\n    }\n\n    function renderMonthGrid(){\n      var mView = state.viewMonth, year = mView.getFullYear(), month = mView.getMonth();\n      var firstDow = (new Date(year, month, 1).getDay() + 6) % 7;\n      var daysInMonth = new Date(year, month+1, 0).getDate();\n      var isCurrentMonth = (year === TODAY.getFullYear() && month === TODAY.getMonth());\n      var maxD = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + (BUSINESS.maxDays || 90));\n      monthLabel.textContent = MONTHS[month] + ' ' + year;\n      prevBtn.disabled = isCurrentMonth;\n      nextBtn.disabled = new Date(year, month+1, 1) > maxD;\n      ensureAvail();\n      var av = AVAIL[state.service.id + '|' + year + '-' + pad(month+1)] || null;\n      gridEl.innerHTML = '';\n      for (var i=0;i<firstDow;i++) gridEl.appendChild(h('span',{class:'cal-day pad'}));\n      for (var day=1; day<=daysInMonth; day++){\n        (function(day){\n          var d = new Date(year, month, day), dk = dateKey(d), st;\n          if (isPast(d) || d > maxD) st = 'past';\n          else if (!av) st = 'pend';\n          else st = av.free[dk] ? 'ok' : (av.open[dk] ? 'full' : 'closed');\n          var off = (st === 'past' || st === 'closed');\n          gridEl.appendChild(h('button', {\n            class: 'cal-day' + (off?' off':'') + (st==='full'?' full':'') + (st==='ok'?' ok':'') + (sameDay(d, TODAY)?' today':''),\n            type:'button', disabled: off || st === 'full',\n            'aria-label': day + ' ' + MONTHS[month] + (st==='full' ? ', completo' : (st==='closed' ? ', chiuso' : '')),\n            'aria-pressed': sameDay(d, state.date) ? 'true':'false',\n            text: String(day),\n            onclick: function(){ state.date = d; state.time = null; goToTime(); }\n          }));\n        })(day);\n      }\n    }\n\n    function renderTimeContent(){\n      var d = state.date;\n      var myDate = dateKey(d);\n      pickedDateEl.textContent = DAY_LONG[(d.getDay()+6)%7] + ' ' + d.getDate() + ' ' + MONTHS3[d.getMonth()];\n      timeInner.innerHTML = '';\n      timeInner.appendChild(h('div',{class:'time-empty', text:'Cerco gli orari liberi\\u2026'}));\n      setStageHeight();\n      fetchSlots(d, state.service, function(slots){\n        if (dateKey(state.date) !== myDate || state.dtView !== 'time') return; // l'utente ha gia' cambiato giorno\n        timeInner.innerHTML = '';\n        if (!slots.length){ timeInner.appendChild(h('div',{class:'time-empty', text:'Nessun orario libero in questo giorno. Prova un altro giorno.'})); setStageHeight(); return; }\n        var morning = slots.filter(function(t){return t<'13:00';}), afternoon = slots.filter(function(t){return t>='13:00';});\n        function tgrid(list){ return h('div',{class:'time-grid'}, list.map(function(t){\n          return h('button',{class:'time-opt', type:'button', 'aria-pressed': state.time===t?'true':'false', onclick:function(){ pickTime(t); }}, t);\n        })); }\n        if (morning.length) timeInner.appendChild(h('div',{class:'time-group'}, h('h3',{text:'Mattina'}), tgrid(morning)));\n        if (afternoon.length) timeInner.appendChild(h('div',{class:'time-group'}, h('h3',{text:'Pomeriggio'}), tgrid(afternoon)));\n        setStageHeight();\n      });\n    }\n\n    function pickTime(t){\n      state.time = t;\n      timeInner.querySelectorAll('.time-opt').forEach(function(btn){\n        btn.setAttribute('aria-pressed', btn.textContent === t ? 'true' : 'false');\n      });\n      continueBtn.disabled = false;\n      setStageHeight();\n    }\n\n    function setStageHeight(){\n      requestAnimationFrame(function(){\n        var active = state.dtView === 'time' ? timePage : calPage;\n        stage.style.height = active.offsetHeight + 'px';\n      });\n    }\n\n    function goToTime(){\n      state.dtView = 'time';\n      renderTimeContent();\n      stage.classList.add('show-time');\n      setStageHeight();\n    }\n    function goToCal(){\n      state.dtView = 'cal';\n      renderMonthGrid();\n      stage.classList.remove('show-time');\n      setStageHeight();\n    }\n    function changeMonth(delta){\n      state.viewMonth = new Date(state.viewMonth.getFullYear(), state.viewMonth.getMonth()+delta, 1);\n      renderMonthGrid();\n      setStageHeight();\n    }\n\n    renderMonthGrid();\n    if (state.dtView === 'time') renderTimeContent();\n    stage.classList.toggle('show-time', state.dtView === 'time');\n\n    var errMsg = state.submitError; state.submitError = '';\n    var wrap = h('div', null,\n      h('h2',{id:'h', tabindex:'-1', text:'Quando ti va bene?'}),\n      h('p',{class:'lead'}, state.service.name + ' \\u00b7 ' + state.service.dur + ' min \\u00b7 ' + state.service.price + ' \\u20ac' + ((BUSINESS.rules && BUSINESS.rules.members) ? ' a non socio' : '')),\n      errMsg ? h('div',{class:'err-banner', role:'alert', text:errMsg}) : null,\n      state.moveFrom ? h('p',{class:'lead move', text:'Scegli il nuovo orario: quello attuale verr\\u00e0 annullato solo quando confermi.'}) : null,\n      staffPicker(), calBox, actions\n    );\n    setTimeout(setStageHeight, 0);\n    return wrap;\n  }\n\n  function stepDetails(){\n    var d = state.date;\n    var needsAddress = !!state.service.atCustomerPlace;\n    var nameIn = textInput('name','text',state.name,'Es. Marco Bianchi', function(e){ state.name=e.target.value; }, {autocomplete:'name'});\n    var telIn = textInput('phone','tel',state.phone,'Es. 345 123 4567', function(e){ state.phone=e.target.value; }, {autocomplete:'tel', inputmode:'tel'});\n    var addrIn = needsAddress ? textInput('address','text',state.address,'Via, numero civico, citt\\u00e0', function(e){ state.address=e.target.value; }, {autocomplete:'street-address'}) : null;\n    var R = BUSINESS.rules, party = null, partyMsg = null;\n    if (R && R.players && R.players.length){\n      partyMsg = h('p',{class:'party-err', role:'alert'});\n      var info = h('p',{class:'party-info', role:'status'});\n      var playersRow = h('div',{class:'optrow', role:'group', 'aria-label':'Numero di giocatori'});\n      var membersRow = h('div',{class:'optrow', role:'group', 'aria-label':'Quanti sono soci'});\n      var membersField = h('div',{class:'field'}, h('label',{text:'Di cui soci del circolo'}), membersRow);\n      var refreshInfo = function(){\n        if (!R.members || state.players == null || state.members == null){ info.textContent = ''; return; }\n        var nm = state.players - state.members, due = nm * (Number(state.service.price) || 0);\n        info.textContent = nm === 0 ? 'Tutti soci: nulla da pagare.' : 'Da pagare: ' + due + ' \\u20ac (' + nm + (nm === 1 ? ' non socio' : ' non soci') + ' \\u00d7 ' + state.service.price + ' \\u20ac)';\n      };\n      var drawMembers = function(){\n        membersRow.innerHTML = '';\n        membersField.hidden = !R.members || state.players == null;\n        if (membersField.hidden) return;\n        for (var m = 0; m <= state.players; m++){ (function(m){\n          membersRow.appendChild(h('button',{type:'button', class:'opt', 'aria-pressed': state.members === m ? 'true' : 'false', text:String(m), onclick:function(){ state.members = m; partyMsg.textContent = ''; drawMembers(); refreshInfo(); }}));\n        })(m); }\n      };\n      var drawPlayers = function(){\n        playersRow.innerHTML = '';\n        R.players.forEach(function(p){\n          playersRow.appendChild(h('button',{type:'button', class:'opt', 'aria-pressed': state.players === p ? 'true' : 'false', text:String(p), onclick:function(){ state.players = p; if (state.members != null && state.members > p) state.members = null; partyMsg.textContent = ''; drawPlayers(); drawMembers(); refreshInfo(); }}));\n        });\n      };\n      drawPlayers(); drawMembers(); refreshInfo();\n      party = h('div',{class:'party'}, h('div',{class:'field'}, h('label',{text:'Quanti giocatori?'}), playersRow), R.members ? membersField : null, info, partyMsg);\n    }\n    var hp = h('input',{type:'text', name:'website', tabindex:'-1', autocomplete:'off', 'aria-hidden':'true', class:'hp', oninput:function(e){ state.hp=e.target.value; }});\n    return h('div', null,\n      h('h2',{id:'h', tabindex:'-1', text: state.moveFrom ? 'Conferma il nuovo orario.' : 'Ultimo passo.'}),\n      h('p',{class:'lead', text: needsAddress ? 'Ci servono nome, telefono e indirizzo.' : ((BUSINESS.rules && BUSINESS.rules.players) ? 'Ci servono giocatori, nome e telefono.' : 'Ci servono solo nome e telefono.')}),\n      h('div',{class:'picked'}, h('span',{class:'ic'}, iconCal()),\n        h('div', null, h('b',{text: DAY_LONG[(d.getDay()+6)%7] + ' ' + d.getDate() + ' ' + MONTHS3[d.getMonth()] + ', ' + state.time}), h('span',{text: state.service.name}))),\n      state.saved ? h('div',{class:'saved'}, h('span',{text:'Bentornato. Abbiamo ricordato i tuoi dati.'}),\n        h('button',{class:'linkbtn', type:'button', text:'Cancella', onclick:function(){ try { localStorage.removeItem('lia_cust'); } catch(e){} state.name=''; state.phone=''; state.saved=false; goStep(2); }})) : null,\n      party,\n      field('name','Nome e cognome', nameIn),\n      field('phone','Numero di telefono', telIn),\n      needsAddress ? field('address','Indirizzo', addrIn) : null,\n      hp,\n      state.submitError ? h('div',{class:'err-banner', role:'alert', text: state.submitError}) : null,\n      nav(state.submitting ? 'Un attimo\\u2026' : 'Conferma la prenotazione', function(){\n        if (R && R.players && (state.players == null || (R.members && state.members == null))){ partyMsg.textContent = R.members ? 'Scegli quanti giocatori siete e quanti sono soci.' : 'Scegli quanti giocatori siete.'; partyMsg.scrollIntoView({block:'center'}); return; }\n        if (state.name.trim().length<2){ nameIn.focus(); return; }\n        if (state.phone.replace(/\\D/g,'').length<8){ telIn.focus(); return; }\n        if (needsAddress && state.address.trim().length<4){ addrIn.focus(); return; }\n        submitBooking();\n      }, true, state.submitting),\n      h('p',{class:'privacy', text:'Confermando, accetti che ' + (BUSINESS.name || 'l\\'attivit\\u00e0') + ' conservi nome e telefono per gestire il tuo appuntamento.'})\n    );\n  }\n\n  function submitBooking(){\n    state.submitting = true; state.submitError = ''; goStep(2);\n    fetch('/api/booking?b=' + encodeURIComponent(SLUG), {\n      method:'POST', headers:{'Content-Type':'application/json'},\n      body: JSON.stringify({ service: state.service.id, date: dateKey(state.date), time: state.time, name: state.name.trim(), phone: state.phone.trim(), address: state.address.trim(), website: state.hp || '', players: state.players, members: state.members, staff: state.staff || undefined })\n    }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, status:r.status, data:d}; }); })\n      .then(function(res){\n        state.submitting = false;\n        if (!res.ok){\n          state.submitError = (res.data && res.data.error) ? res.data.error : 'Qualcosa non ha funzionato. Riprova.';\n          if (res.status === 409){ AVAIL = {}; delete slotsCache[state.service.id + '|' + dateKey(state.date)]; state.time = null; goStep(1); return; }\n          goStep(2);\n          return;\n        }\n        AVAIL = {};\n        state.calendar = res.data && res.data.calendar ? res.data.calendar : null;\n        state.apptId = res.data && res.data.id ? res.data.id : null;\n        state.staffName = (res.data && res.data.staff_name) || '';\n        state.due = (res.data && res.data.due_eur != null) ? Number(res.data.due_eur) : null;\n        state.apptPhone = state.phone.trim();\n        try { localStorage.setItem('lia_cust', JSON.stringify({ name: state.name.trim(), phone: state.phone.trim() })); state.saved = true; } catch(e){}\n        if (state.moveFrom){ cancelAppointment(state.moveFrom.id, state.moveFrom.phone, function(){}); state.moveFrom = null; }\n        state.cancelAsk = false; state.cancelled = false; state.cancelError = '';\n        goStep(3);\n      })\n      .catch(function(){ state.submitting = false; state.submitError = 'Non riesco a collegarmi. Controlla la connessione e riprova.'; goStep(2); });\n  }\n\n  function cancelAppointment(id, phone, done){\n    fetch('/api/booking?b=' + encodeURIComponent(SLUG) + '&action=cancel', {\n      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ id: id, phone: phone })\n    }).then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })\n      .then(function(res){ done(res.ok, res.data && res.data.error); })\n      .catch(function(){ done(false, 'Non riesco a collegarmi. Riprova.'); });\n  }\n\n  function localCal(){\n    var d = state.date, t = state.time.split(':');\n    var st = new Date(d.getFullYear(), d.getMonth(), d.getDate(), parseInt(t[0],10), parseInt(t[1],10));\n    var en = new Date(st.getTime() + (Number(state.service.dur)||30)*60000);\n    return { title: state.service.name+' - '+(BUSINESS.name||'Appuntamento'), start: st.toISOString(), end: en.toISOString(), location: state.service.atCustomerPlace ? state.address : (BUSINESS.address||''), description: 'Appuntamento confermato con '+(BUSINESS.name||'') };\n  }\n  function row(a,b){ return h('div',{class:'r'}, h('span',{text:a}), h('b',{text:b})); }\n  function resetBooking(){ state.players=null; state.members=null; state.due=null; state.staff=null; state.staffName=''; state.service=null; state.date=null; state.time=null; state.apptId=null; state.moveFrom=null; state.cancelAsk=false; state.cancelled=false; state.cancelError=''; goStep(0); }\n  function startMove(){ state.moveFrom = { id: state.apptId, phone: state.apptPhone }; state.date=null; state.time=null; state.cancelAsk=false; state.cancelError=''; goStep(1); }\n  function doCancel(){\n    state.cancelError = '';\n    cancelAppointment(state.apptId, state.apptPhone, function(ok, err){\n      if (ok){ AVAIL = {}; state.cancelled = true; } else { state.cancelError = err || 'Non \\u00e8 stato possibile annullare. Riprova.'; }\n      goStep(3);\n    });\n  }\n\n  function stepDone(){\n    var d = state.date;\n    if (state.cancelled){\n      return h('div',{class:'done'},\n        h('h2',{id:'h', tabindex:'-1', text:'Appuntamento annullato.'}),\n        h('p',{class:'lead', text:'Il posto \\u00e8 tornato libero per altri clienti.'}),\n        h('div',{class:'actions'}, h('button',{class:'btn', type:'button', text:'Prenota di nuovo', onclick:resetBooking})));\n    }\n    var cal = state.calendar || localCal();\n    var extra;\n    if (state.cancelAsk){\n      extra = h('div',{class:'confirm', role:'group', 'aria-label':'Annulla o sposta'},\n        h('p',{text:'Cosa vuoi fare con questo appuntamento?'}),\n        state.cancelError ? h('p',{class:'err-inline', role:'alert', text:state.cancelError}) : null,\n        h('div',{class:'row2'},\n          h('button',{class:'btn ghost', type:'button', text:'Sposta', onclick:startMove}),\n          h('button',{class:'btn danger', type:'button', text:'Annulla', onclick:doCancel})),\n        h('button',{class:'btn text', type:'button', text:'Lo tengo', onclick:function(){ state.cancelAsk=false; state.cancelError=''; goStep(3); }}));\n    } else {\n      extra = h('div',{class:'actions'},\n        state.apptId ? h('button',{class:'btn text', type:'button', text:'Annulla o sposta l\\'appuntamento', onclick:function(){ state.cancelAsk=true; goStep(3); }}) : null,\n        h('button',{class:'btn text', type:'button', text:'Prenota un altro appuntamento', onclick:resetBooking}));\n    }\n    return h('div',{class:'done'},\n      h('span',{class:'check'}, iconCheck()),\n      h('h2',{id:'h', tabindex:'-1', text:'Prenotazione confermata.'}),\n      h('p',{class:'lead', text: (BUSINESS.name || 'L\\'attivit\\u00e0') + ' ti aspetta.'}),\n      h('div',{class:'summary'},\n        row('Servizio', state.service.name),\n        row('Quando', DAY_LONG[(d.getDay()+6)%7] + ' ' + d.getDate() + ' ' + MONTHS3[d.getMonth()] + ' \\u00b7 ' + state.time),\n        state.staffName ? row('Con', state.staffName) : null,\n        (BUSINESS.address && !state.service.atCustomerPlace) ? row('Dove', BUSINESS.address) : null,\n        (BUSINESS.rules && state.players != null)\n          ? [ row('Giocatori', state.players + (state.members != null ? ' \\u00b7 ' + state.members + (state.members === 1 ? ' socio' : ' soci') : '')), h('hr'),\n              row('Da pagare', (function(){ var d = state.due != null ? state.due : ((state.players - (state.members || 0)) * (Number(state.service.price) || 0)); return d > 0 ? d + ' \\u20ac' : 'Nulla'; })()), h('hr'), row('A nome di', state.name) ]\n          : [ h('hr'), row('Prezzo', state.service.price+' \\u20ac'), h('hr'), row('A nome di', state.name) ]),\n      reminderBox(cal, true),\n      extra\n    );\n  }\n\n  function goStep(n){ state.step=n; render(); document.getElementById('bookView').scrollTop=0; var hh=document.getElementById('h'); if (hh) hh.focus({preventScroll:true}); }\n  function render(){\n    var view = document.getElementById('bookView'); view.innerHTML='';\n    var fns=[stepService, stepDateTime, stepDetails, stepDone];\n    view.appendChild(fns[state.step]());\n  }\n  window.LiaBooking = {\n    setServices: function(list){ BUSINESS.services = list; render(); },\n    setBusiness: function(data){ BUSINESS.name = data.name || ''; BUSINESS.address = data.address || ''; BUSINESS.maxDays = Number(data.max_days) || 90; BUSINESS.rules = data.rules || null; BUSINESS.team = data.team || null; }\n  };\n})();\n</script>\n<script>\n(function(){\n  var params = new URLSearchParams(location.search);\n  var slug = (params.get('b') || '').toLowerCase();\n\n  var SVG_OPEN = '<svg width=\"%S%\" height=\"%S%\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"%W%\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">';\n  function svgOf(path, size, w){ return SVG_OPEN.replace(/%S%/g, size).replace('%W%', w) + path + '</svg>'; }\n  var P_SCISSORS = '<circle cx=\"6\" cy=\"6\" r=\"3\"></circle><circle cx=\"6\" cy=\"18\" r=\"3\"></circle><line x1=\"20\" y1=\"4\" x2=\"8.12\" y2=\"15.88\"></line><line x1=\"14.47\" y1=\"14.48\" x2=\"20\" y2=\"20\"></line><line x1=\"8.12\" y1=\"8.12\" x2=\"12\" y2=\"12\"></line>';\n  var P_SPARKLE = '<path d=\"M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z\"></path><path d=\"M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z\"></path>';\n  var P_CAL = '<rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"3\"></rect><line x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"></line><line x1=\"8\" y1=\"3\" x2=\"8\" y2=\"7\"></line><line x1=\"16\" y1=\"3\" x2=\"16\" y2=\"7\"></line>';\n  var P_PIN = '<path d=\"M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z\"></path><circle cx=\"12\" cy=\"10\" r=\"2.5\"></circle>';\n  var P_PHONE = '<path d=\"M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z\"></path>';\n  var P_IG = '<rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"5\"></rect><circle cx=\"12\" cy=\"12\" r=\"4\"></circle><circle cx=\"17.5\" cy=\"6.5\" r=\"1\" fill=\"currentColor\"></circle>';\n\n  function prettyType(t){ t = String(t || '').replace(/[_-]+/g, ' ').trim(); return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''; }\n  function categoryIcon(type){\n    var t = String(type || '').toLowerCase();\n    if (/parrucch|barbier|hair|coiffeur|acconciat/.test(t)) return svgOf(P_SCISSORS, 28, 1.8);\n    if (/estetist|beauty|nail|unghie|massagg|spa/.test(t)) return svgOf(P_SPARKLE, 28, 1.8);\n    return svgOf(P_CAL, 26, 1.8);\n  }\n  function chip(href, path, text, ext){\n    var a = document.createElement('a'); a.className = 'chip'; a.href = href;\n    if (ext){ a.target = '_blank'; a.rel = 'noopener'; }\n    var ic = document.createElement('span'); ic.innerHTML = svgOf(path, 16, 2); a.appendChild(ic.firstChild);\n    var t = document.createElement('span'); t.textContent = text; a.appendChild(t);\n    return a;\n  }\n  function buildInfo(d){\n    var box = document.getElementById('info'); box.innerHTML = '';\n    if (d.address) box.appendChild(chip('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(d.address + (d.name ? ' ' + d.name : '')), P_PIN, d.address, true));\n    var tel = String(d.phone || '').replace(/[^\\d+]/g, '');\n    if (tel) box.appendChild(chip('tel:' + tel, P_PHONE, d.phone, false));\n    var ig = String(d.instagram || '').replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '');\n    if (ig) box.appendChild(chip('https://instagram.com/' + ig, P_IG, '@' + ig, true));\n  }\n\n  function fail(msg){\n    document.querySelector('.top').insertAdjacentHTML('afterend', '');\n    document.body.innerHTML = '';\n    var box = document.createElement('div');\n    box.className = 'err-page';\n    box.textContent = msg;\n    box.style.margin = '60px 20px';\n    document.body.appendChild(box);\n  }\n\n  if (!/^[a-z0-9-]{1,60}$/.test(slug)){ fail('Manca il codice dell\\'attività nel link.'); return; }\n\n  fetch('/api/booking?b=' + encodeURIComponent(slug) + '&info=1')\n    .then(function(r){ return r.json().then(function(d){ return {ok:r.ok, data:d}; }); })\n    .then(function(res){\n      if (!res.ok && res.data && res.data.error && res.data.error.indexOf('prenotazioni online') > -1){ fail(res.data.error); return; } if (!res.ok || !res.data.services){ fail('Questo link non è valido, oppure l\\'attività non ha ancora servizi impostati.'); return; }\n      document.querySelector('.top h1').textContent = res.data.name;\n      document.getElementById('tagline').textContent = res.data.tagline || prettyType(res.data.type);\n      document.getElementById('avatar').innerHTML = categoryIcon(res.data.type);\n      buildInfo(res.data);\n      document.title = 'Prenota – ' + res.data.name;\n\n      var services = res.data.services.map(function(s){\n        return { id: s.id, name: s.name, dur: s.duration_min, price: s.price_eur, atCustomerPlace: s.at_customer_place };\n      });\n      window.LiaBooking.setBusiness(res.data);\n      if (res.data.lia_allowed === false) { var sg = document.querySelector('.seg'); if (sg) sg.style.display = 'none'; document.getElementById('chatPanel').hidden = true; document.getElementById('bookPanel').hidden = false; }\n      window.LiaBooking.setServices(services);\n      if (res.data.lia_allowed !== false) window.LiaChat.start(res.data.name);\n    })\n    .catch(function(){ fail('Non riesco a collegarmi. Riprova tra poco.'); });\n})();\n</script>\n</body>\n</html>\n";

const STEP_MIN = 30;
const MIN_LEAD_MIN = 15;
const MAX_DAYS_AHEAD = 90; // anticipo massimo di prenotazione, uguale per tutte le attività (circa 3 mesi)

// Regole di prenotazione particolari di un'attività (colonna booking_rules, impostata solo per il circolo di tennis).
// Senza regola tutto funziona come sempre.
function partyRules(biz) {
  const r = biz && biz.booking_rules;
  if (!r || typeof r !== "object" || !Array.isArray(r.players)) return null;
  const players = r.players.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 20).sort((a, b) => a - b);
  if (!players.length) return null;
  return { players, members: r.members === true, certificate: r.medical_certificate === true };
}
function validateParty(rules, input) {
  const p = Number(input && input.players);
  if (!rules.players.includes(p)) return { error: "I giocatori devono essere " + rules.players.join(" oppure ") + "." };
  let m = null;
  if (rules.members) {
    m = Number(input && input.members);
    if (!Number.isInteger(m) || m < 0 || m > p) return { error: "Indica quanti dei " + p + " giocatori sono soci." };
  }
  return { players: p, members: m, nonMembers: m === null ? p : p - m };
}
const MAX_ACTIVE_PER_PHONE = 3; // appuntamenti futuri per numero
const MAX_SELF_PER_HOUR = 40; // prenotazioni online per attivita' all'ora (anti-abuso)

function sbHeaders(extra) {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const h = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key;
  return Object.assign(h, extra || {});
}

async function sb(method, path, body, prefer) {
  const res = await fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, {
    method: method,
    headers: sbHeaders(prefer ? { Prefer: prefer } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  return { ok: res.ok, status: res.status, data: data };
}

function tzOffsetMs(utcMs, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - utcMs;
}
function zonedTimeToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(guess, tz);
  let utc = guess - off1;
  const off2 = tzOffsetMs(utc, tz);
  if (off2 !== off1) utc = guess - off2;
  return new Date(utc);
}
function todayStr(tz) { return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); }
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow === 0 ? 7 : dow;
}
function hmToMin(hm) { const [h, m] = hm.split(":").map(Number); return h * 60 + m; }
function minToHm(min) { return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0"); }

async function getBusiness(slug) {
  const r = await sb(
    "GET",
    "businesses?slug=eq." + encodeURIComponent(slug) +
      "&active=eq.true&select=*,services(*),resources(*,opening_hours(*))"
  );
  if (!r.ok || !Array.isArray(r.data) || !r.data.length) return null;
  const b = r.data[0];
  b.services = (b.services || []).filter((s) => s.active);
  b.resources = (b.resources || []).filter((x) => x.active);
  await attachStaff(b, sb);
  return b;
}

// Se il titolare ha attivato la scelta e il cliente ha scelto una persona, si calcola solo su di lei.
function bizFor(biz, staffId) {
  if (!staffId || !biz.__teamMode || biz.staff_choice !== true) return biz;
  const only = (biz.resources || []).filter((r) => r.id === String(staffId));
  if (!only.length) return null;
  return Object.assign({}, biz, { resources: only });
}

async function getBusinessBlocks(businessId, dateStr) {
  const r = await sb(
    "GET",
    "business_blocks?business_id=eq." + businessId +
      "&date=eq." + dateStr +
      "&select=starts_at,ends_at"
  );
  if (r.status === 404) return [];
  if (!r.ok || !Array.isArray(r.data)) throw new Error("Errore lettura indisponibilità");
  return r.data;
}

// Calcola gli orari liberi di un giorno, dati gli appuntamenti e le chiusure gia' caricati.
function computeSlots(biz, service, dateStr, apptRows, blockRows) {
  const tz = biz.timezone;
  const wd = weekdayOf(dateStr);
  const blockedRanges = blockRows
    .map((b) => [Date.parse(b.starts_at), Date.parse(b.ends_at)])
    .filter((b) => Number.isFinite(b[0]) && Number.isFinite(b[1]));

  const nowMs = Date.now() + MIN_LEAD_MIN * 60000;
  const out = [];
  for (const res of biz.resources) {
    if (!resourceOk(biz, res, service, dateStr)) continue;
    const intervals = (res.opening_hours || []).filter((h) => h.weekday === wd).sort((a, b) => (a.opens < b.opens ? -1 : 1));
    const busy = apptRows.filter((b) => b.resource_id === res.id).map((b) => [Date.parse(b.starts_at), Date.parse(b.blocked_until)]);
    for (const h of intervals) {
      let t = hmToMin(h.opens.slice(0, 5));
      const tEnd = hmToMin(h.closes.slice(0, 5));
      while (t + service.duration_min <= tEnd) {
        const label = minToHm(t);
        const startMs = zonedTimeToUtc(dateStr, label, tz).getTime();
        const endMs = startMs + service.duration_min * 60000;
        const blockedMs = endMs + (service.buffer_min || 0) * 60000;
        const free = startMs >= nowMs && !busy.some((b) => startMs < b[1] && blockedMs > b[0]) && !blockedRanges.some((b) => startMs < b[1] && blockedMs > b[0]);
        if (free) out.push({ time: label, resource_id: res.id });
        t += STEP_MIN;
      }
    }
  }
  const seen = {};
  return out.filter((s) => (seen[s.time] ? false : (seen[s.time] = true)));
}

async function freeSlots(biz, service, dateStr) {
  const tz = biz.timezone;
  const dayStart = zonedTimeToUtc(dateStr, "00:00", tz);
  const dayEnd = zonedTimeToUtc(addDays(dateStr, 1), "00:00", tz);
  const ids = biz.resources.map((r) => r.id);
  if (!ids.length) return [];

  const q =
    "appointments?resource_id=in.(" + ids.join(",") + ")" +
    "&status=eq.confirmed" +
    "&starts_at=lt." + encodeURIComponent(dayEnd.toISOString()) +
    "&blocked_until=gt." + encodeURIComponent(dayStart.toISOString()) +
    "&select=resource_id,starts_at,blocked_until";
  const r = await sb("GET", q);
  if (!r.ok || !Array.isArray(r.data)) throw new Error("Errore lettura appuntamenti");

  const blocks = await getBusinessBlocks(biz.id, dateStr);
  return computeSlots(biz, service, dateStr, r.data, blocks);
}

// Giorni del mese con almeno un orario libero (free) e giorni in cui l'attivita' lavora (open):
// serve al calendario per mostrare chiusi e completi senza una richiesta per ogni giorno.
async function monthAvailability(biz, service, ym) {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  const tz = biz.timezone;
  const today = todayStr(tz);
  const maxExcl = addDays(today, MAX_DAYS_AHEAD + 1);
  const first = ym + "-01";
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const from = first < today ? today : first;
  const to = next > maxExcl ? maxExcl : next;
  const out = { free: [], open: [] };
  const ids = biz.resources.map((r) => r.id);
  if (!ids.length || from >= to) return out;

  const q =
    "appointments?resource_id=in.(" + ids.join(",") + ")" +
    "&status=eq.confirmed" +
    "&starts_at=lt." + encodeURIComponent(zonedTimeToUtc(to, "00:00", tz).toISOString()) +
    "&blocked_until=gt." + encodeURIComponent(zonedTimeToUtc(from, "00:00", tz).toISOString()) +
    "&select=resource_id,starts_at,blocked_until";
  const r = await sb("GET", q);
  if (!r.ok || !Array.isArray(r.data)) throw new Error("Errore lettura appuntamenti");

  const br = await sb("GET", "business_blocks?business_id=eq." + biz.id + "&date=gte." + from + "&date=lt." + to + "&select=starts_at,ends_at");
  let blocks = [];
  if (br.status !== 404) {
    if (!br.ok || !Array.isArray(br.data)) throw new Error("Errore lettura indisponibilita'");
    blocks = br.data;
  }

  for (let d = from; d < to; d = addDays(d, 1)) {
    const wd = weekdayOf(d);
    if (biz.resources.some((res) => (res.opening_hours || []).some((h) => h.weekday === wd))) out.open.push(d);
    if (computeSlots(biz, service, d, r.data, blocks).length) out.free.push(d);
  }
  return out;
}

function checkDate(biz, dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return "Data non valida.";
  const today = todayStr(biz.timezone);
  if (dateStr < today) return "Quella data è già passata.";
  if (dateStr > addDays(today, MAX_DAYS_AHEAD)) return "Data troppo lontana.";
  return null;
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    const q = req.query || {};
    const slug = String(q.b || "");

    // Promemoria per Calendario di iPhone/iPad: file .ics con avviso 1 ora prima.
    if (req.method === "GET" && q.ics === "1") {
      const s0 = Date.parse(String(q.s || "")), e0 = Date.parse(String(q.e || ""));
      const okDate = (n) => Number.isFinite(n) && n > Date.UTC(2020, 0, 1) && n < Date.UTC(2100, 0, 1);
      if (!okDate(s0) || !okDate(e0) || e0 <= s0 || e0 - s0 > 12 * 3600 * 1000) return res.status(400).json({ error: "Richiesta non valida" });
      const esc = (x, n) => String(x || "").slice(0, n).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
      const fmt = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      const ics = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LIA//Appuntamento//IT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        "UID:" + s0 + "-" + Math.abs(esc(q.t, 120).length * 7919 + e0) + "@lia",
        "DTSTAMP:" + fmt(Date.now()), "DTSTART:" + fmt(s0), "DTEND:" + fmt(e0),
        "SUMMARY:" + esc(q.t || "Appuntamento", 120),
        "DESCRIPTION:" + esc(q.d, 300),
        "LOCATION:" + esc(q.l, 200),
        "BEGIN:VALARM", "TRIGGER:-PT60M", "ACTION:DISPLAY", "DESCRIPTION:Promemoria appuntamento", "END:VALARM",
        "END:VEVENT", "END:VCALENDAR",
      ].join("\r\n") + "\r\n";
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", 'inline; filename="appuntamento.ics"');
      return res.status(200).send(ics);
    }

    const wantsData = req.method === "POST" || q.info === "1" || !!q.date || !!q.month;
    if (req.method === "GET" && !wantsData) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(PAGE);
    }

    if (!/^[a-z0-9-]{1,60}$/.test(slug)) return res.status(404).json({ error: "Attività non trovata" });
    const biz = await getBusiness(slug);
    if (!biz) return res.status(404).json({ error: "Attività non trovata" });

    // Annullamento dalla pagina di conferma (serve l'id dell'appuntamento e il telefono usato).
    if (req.method === "POST" && q.action === "cancel") {
      const cb = req.body || {};
      const cid = String(cb.id || "");
      const cphone = String(cb.phone || "").trim();
      if (!/^[0-9a-zA-Z-]{1,64}$/.test(cid) || !cphone) return res.status(400).json({ error: "Richiesta non valida" });
      const cr = await sb(
        "PATCH",
        "appointments?id=eq." + encodeURIComponent(cid) + "&business_id=eq." + biz.id +
          "&contact_id=eq." + encodeURIComponent(cphone) + "&status=eq.confirmed",
        { status: "cancelled" },
        "return=representation"
      );
      if (!cr.ok || !Array.isArray(cr.data) || !cr.data.length) return res.status(404).json({ error: "Appuntamento non trovato o gia' annullato." });
      return res.status(200).json({ ok: true });
    }

    // Abbonamento non rinnovato: niente nuove prenotazioni online.
    const acc = await getAccess(biz.id);
    if (!acc.allowed) return res.status(503).json({ error: BOOKING_BLOCKED_MESSAGE });

    if (req.method === "GET" && q.info === "1") {
      return res.status(200).json({
        lia_allowed: acc.lia_allowed !== false,
        max_days: MAX_DAYS_AHEAD,
        team: (biz.__teamMode && biz.staff_choice === true)
          ? { staff: biz.resources.map((r) => ({ id: r.id, name: r.name, service_ids: (biz.__svc && biz.__svc[r.id]) || [] })) }
          : null,
        rules: (() => { const pr = partyRules(biz); return pr ? { players: pr.players, members: pr.members, certificate: pr.certificate } : null; })(),
        name: biz.name,
        type: biz.business_type,
        timezone: biz.timezone,
        address: biz.address || "",
        tagline: biz.public_tagline || "",
        phone: biz.public_phone || "",
        instagram: biz.public_instagram || "",
        services: biz.services.map((s) => ({
          id: s.id, name: s.name, duration_min: s.duration_min, price_eur: s.price_eur, at_customer_place: s.at_customer_place,
        })),
      });
    }

    if (req.method === "GET" && q.month) {
      const service = biz.services.find((s) => s.id === q.service);
      if (!service) return res.status(400).json({ error: "Servizio non valido" });
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(q.month))) return res.status(400).json({ error: "Mese non valido" });
      const bzm = bizFor(biz, q.staff);
      if (!bzm) return res.status(400).json({ error: "Persona non valida" });
      return res.status(200).json(await monthAvailability(bzm, service, String(q.month)));
    }

    if (req.method === "GET" && q.date) {
      const service = biz.services.find((s) => s.id === q.service);
      if (!service) return res.status(400).json({ error: "Servizio non valido" });
      const bad = checkDate(biz, q.date);
      if (bad) return res.status(400).json({ error: bad });
      const bzd = bizFor(biz, q.staff);
      if (!bzd) return res.status(400).json({ error: "Persona non valida" });
      const slots = await freeSlots(bzd, service, q.date);
      const times = Array.from(new Set(slots.map((s) => s.time))).sort();
      return res.status(200).json({ times: times });
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const service = biz.services.find((s) => s.id === body.service);
      if (!service) return res.status(400).json({ error: "Servizio non valido" });
      const bad = checkDate(biz, body.date);
      if (bad) return res.status(400).json({ error: bad });
      if (!/^\d{2}:\d{2}$/.test(String(body.time || ""))) return res.status(400).json({ error: "Orario non valido" });
      const name = String(body.name || "").trim();
      const phone = String(body.phone || "").trim();
      if (name.length < 2) return res.status(400).json({ error: "Nome mancante" });
      if (phone.replace(/\D/g, "").length < 8) return res.status(400).json({ error: "Numero di telefono non valido" });
      if (service.at_customer_place && !String(body.address || "").trim()) {
        return res.status(400).json({ error: "Indirizzo mancante" });
      }

      const rules = partyRules(biz);
      let party = null;
      if (rules) {
        party = validateParty(rules, body);
        if (party.error) return res.status(400).json({ error: party.error });
      }

      // Anti-abuso: campo nascosto compilato solo dai robot, tetto agli appuntamenti futuri per numero
      // e alle prenotazioni online all'ora. Se un controllo non riesce, si lascia passare.
      if (String(body.website || "").trim()) return res.status(400).json({ error: "Richiesta non valida" });
      try {
        const nowIso = encodeURIComponent(new Date().toISOString());
        const mine = await sb("GET", "appointments?business_id=eq." + biz.id + "&contact_id=eq." + encodeURIComponent(phone) + "&status=eq.confirmed&starts_at=gt." + nowIso + "&select=id&limit=" + (MAX_ACTIVE_PER_PHONE + 1));
        if (mine.ok && Array.isArray(mine.data) && mine.data.length >= MAX_ACTIVE_PER_PHONE) {
          return res.status(429).json({ error: "Hai gia' " + MAX_ACTIVE_PER_PHONE + " appuntamenti in programma. Annullane uno prima di prenotarne un altro." });
        }
        const hourAgo = encodeURIComponent(new Date(Date.now() - 3600000).toISOString());
        const flood = await sb("GET", "appointments?business_id=eq." + biz.id + "&channel=eq.selfservice&created_at=gt." + hourAgo + "&select=id&limit=" + (MAX_SELF_PER_HOUR + 1));
        if (flood.ok && Array.isArray(flood.data) && flood.data.length > MAX_SELF_PER_HOUR) {
          return res.status(429).json({ error: "Troppe prenotazioni in poco tempo. Riprova tra qualche minuto." });
        }
      } catch (e) { console.error("Controllo limiti non riuscito (ignoro):", e && e.message); }

      const bzp = bizFor(biz, body.staff);
      if (!bzp) return res.status(400).json({ error: "Persona non valida" });
      const slots = await freeSlots(bzp, service, body.date);
      const candidates = slots.filter((s) => s.time === body.time);
      if (!candidates.length) return res.status(409).json({ error: "Questo orario non è più disponibile. Aggiorna la pagina e scegline un altro." });

      const start = zonedTimeToUtc(body.date, body.time, biz.timezone);
      const end = new Date(start.getTime() + service.duration_min * 60000);
      const blocked = new Date(end.getTime() + (service.buffer_min || 0) * 60000);

      for (const c of candidates) {
        const r = await sb("POST", "appointments", {
          business_id: biz.id,
          resource_id: c.resource_id,
          service_id: service.id,
          customer_name: name,
          customer_phone: phone,
          customer_address: body.address || null,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          blocked_until: blocked.toISOString(),
          channel: "selfservice",
          contact_id: phone,
          ...(party ? { players: party.players, members: party.members } : {}),
        }, "return=representation");
        if (r.ok) return res.status(200).json({ ok: true, staff_name: (biz.__teamMode && biz.staff_choice === true) ? ((biz.resources.find((x) => x.id === c.resource_id) || {}).name || null) : null, ...(party ? { players: party.players, members: party.members, due_eur: party.nonMembers * Number(service.price_eur || 0) } : {}), id: (Array.isArray(r.data) && r.data[0] ? r.data[0].id : null), calendar: { title: service.name + " - " + biz.name, start: start.toISOString(), end: end.toISOString(), location: service.at_customer_place ? String(body.address || "") : String(biz.address || ""), description: "Appuntamento confermato con " + biz.name } });
        if (r.status !== 409) { console.error("Errore prenotazione:", r.status, r.data); return res.status(500).json({ error: "Errore nel salvataggio" }); }
      }
      return res.status(409).json({ error: "Questo orario è appena stato preso. Aggiorna la pagina e scegline un altro." });
    }

    return res.status(405).json({ error: "Metodo non permesso" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Errore" });
  }
};
