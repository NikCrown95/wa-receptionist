/* Calendario della palestra (Giorno / Settimana / Mese) nel dashboard di Lia.
   Sostituisce il calendario degli appuntamenti con lezioni e Personal 1:1; la testata, la campanella e il menu restano quelli di Lia.
   Si appoggia a gym.js (window.liaGym) per comunicazione, finestre e schede degli iscritti. */
(function () {
  var G = window.liaGym;
  var pCal = document.getElementById('panelCal');
  if (!G || !pCal) return;
  var el = G.el, pad = G.pad, parse = G.parse, ymd = G.ymd, addDays = G.addDays, monday = G.monday;
  document.body.classList.add('gcalOn');

  var root = el('div', 'gcx');
  pCal.appendChild(root);

  var S = { view: 'day', anchor: G.S.today, sel: G.S.today, flt: 'all', side: 'lez', wkOpen: false, sideOpen: false, hl: null, err: '' };
  var C = {};      // data -> { light, full }
  var token = 0;   // evita che una risposta lenta ridisegni una vista già cambiata
  var sectionOn = true;

  // ---------- utilità ----------
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function today() { return G.S.today; }
  function phone() { return window.matchMedia('(max-width:699px)').matches; }
  function dow(d) { return parse(d).getDay(); }
  function fmtLong(d) { var x = parse(d); return G.DL[x.getDay()] + ' ' + x.getDate() + ' ' + G.MO[x.getMonth()]; }
  function fmtShort(d) { var x = parse(d); return G.DN[x.getDay()] + ' ' + x.getDate() + ' ' + G.MS[x.getMonth()]; }
  function cap1(x) { return x.charAt(0).toUpperCase() + x.slice(1); }
(function () { if (document.getElementById('gkGrid')) return; var st = document.createElement('style'); st.id = 'gkGrid'; st.textContent = ".gcx.gcx.gcx .gkHd,.gcx.gcx.gcx .gkBody,.gcx.gcx.gcx .gkTot{grid-template-columns:38px repeat(7,minmax(0,1fr));gap:0}.gcx.gcx.gcx .gkTot div{display:block}.gcx.gcx.gcx .gkTg{margin-top:0}.gcx.gcx.gcx .gkHr{position:relative;height:calc(var(--hrs) * var(--hh))}.gcx.gcx.gcx .gkHr span{position:absolute;right:8px;transform:translateY(-7px);font:600 .7rem var(--fb);color:var(--muted)}.gcx.gcx.gcx .gkTg .gkCol{position:relative;display:block;height:calc(var(--hrs) * var(--hh));padding:0;gap:0;border-left:1px solid var(--line);background:repeating-linear-gradient(to bottom,transparent 0,transparent calc(var(--hh) - 1px),var(--line) calc(var(--hh) - 1px),var(--line) var(--hh))!important;border-radius:0}.gcx.gcx.gcx .gkTg .gkCol.tod{background-color:color-mix(in srgb,var(--accent) 5%,transparent)!important}.gcx.gcx.gcx .gkTg .gkCol.closed{background-color:color-mix(in srgb,var(--muted) 8%,transparent)!important}.gcx.gcx.gcx .gkTg .gkK{all:unset;box-sizing:border-box;position:absolute;left:3px;right:3px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;gap:2px;padding:5px 8px 4px 11px;border-radius:8px;background:color-mix(in srgb,var(--cc) 20%,var(--card));color:var(--ink)}.gcx.gcx.gcx .gkTg .gkK::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--cc)}.gcx.gcx.gcx .gkTg .gkK.full{background:color-mix(in srgb,var(--danger) 16%,var(--card))}.gcx.gcx.gcx .gkTg .gkRest{position:absolute;inset:6px 4px auto 4px;border:1px dashed var(--line2);border-radius:8px;padding:10px 0;text-align:center}.gcx.gcx.gcx .gkNow{position:absolute;left:0;right:0;height:2px;background:var(--danger);z-index:2;pointer-events:none}.gcx.gcx.gcx .gkTot{margin-top:8px}.gcx.gcx.gcx.weekMode .wkScroll.gwkScroll{height:calc(100vh - 345px)!important;min-height:300px!important}.gcx.gcx.gcx .gkBar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 4px 10px}.gcx.gcx.gcx .gkBar .wkFilter{margin:0!important;padding:0!important;gap:8px!important;overflow-x:auto!important;order:0}.gcx.gcx.gcx .gkVw{order:0}.gcx.gcx.gcx .gkCmode .gkHd{margin-bottom:0}.gcx.gcx.gcx .gkCc{border-left:0}.gcx.gcx.gcx .gkCb{border-bottom:1px solid var(--line)}.gcx.gcx.gcx .gkTot{padding-bottom:6px}.gcx.gcx.gcx .gkFh{display:flex;align-items:center;justify-content:center;font:700 .66rem var(--fb);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.gcx.gcx.gcx .gkLg{margin-left:auto;display:flex;gap:14px;font:600 .72rem var(--fb);color:var(--muted);white-space:nowrap}.gcx.gcx.gcx .gkLg span{display:flex;align-items:center;gap:6px}.gcx.gcx.gcx .gkLg u{width:9px;height:9px;border-radius:3px;display:block;text-decoration:none}.gcx.gcx.gcx .gkLg .ok{background:var(--accent)}.gcx.gcx.gcx .gkLg .nr{background:#E0A23A}.gcx.gcx.gcx .gkLg .fu{background:var(--danger)}.gcx.gcx.gcx .gkBar{flex-wrap:wrap;row-gap:8px}.gcx.gcx.gcx .gkCc.tod{background:color-mix(in srgb,var(--accent) 5%,transparent)}.gcx.gcx.gcx .gkEm{flex:1;display:flex;align-items:center;justify-content:center;min-height:56px;border:1px dashed var(--line2);border-radius:12px;font:600 .74rem var(--fb);color:var(--muted);opacity:.8}.gcx.gcx.gcx .gkCc:has(.gkK) .gkEm{display:none}.gcx.gcx.gcx .gkCmode .gkK{padding:11px 12px 11px 15px;gap:8px;border:1px solid var(--line);border-radius:12px;background:var(--card2)}.gcx.gcx.gcx .gkCmode .gkK::before{width:4px}.gcx.gcx.gcx .gkCmode .gkR b{font:800 .92rem var(--fd);color:var(--ink)}.gcx.gcx.gcx .gkCmode .gkS{padding:2px 8px;border-radius:7px;border:1px solid color-mix(in srgb,var(--accent) 38%,transparent);background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);font:700 .72rem var(--fb)}.gcx.gcx.gcx .gkCmode .gkK.nearly .gkS{border-color:color-mix(in srgb,#E0A23A 40%,transparent);background:color-mix(in srgb,#E0A23A 14%,transparent);color:#E0A23A}.gcx.gcx.gcx .gkCmode .gkK.full .gkS{border-color:color-mix(in srgb,var(--danger) 40%,transparent);background:color-mix(in srgb,var(--danger) 14%,transparent);color:var(--danger)}.gcx.gcx.gcx .gkCmode .gkK.pt .gkS{border-color:color-mix(in srgb,#C9A24B 40%,transparent);background:color-mix(in srgb,#C9A24B 14%,transparent);color:#C9A24B}.gcx.gcx.gcx .gkCmode .gkN{font:700 1rem/1.2 var(--fd);white-space:normal}.gcx.gcx.gcx .gkCmode .gkK .gtP{height:6px;border-radius:4px}.gcx.gcx.gcx .gkCmode .gkK .gtP u{background:var(--accent);border-radius:4px}.gcx.gcx.gcx .gkCmode .gkK.nearly .gtP u{background:#E0A23A}.gcx.gcx.gcx .gkCmode .gkK.full .gtP u{background:var(--danger)}.gcx.gcx.gcx .gkCl.band b{font:800 .98rem var(--fd)}@media(min-width:700px){.gxShade:has(.gxSes){align-items:stretch!important;justify-content:flex-end!important}.gxShade .gxSes.gxSheet{width:440px!important;max-width:440px!important;height:100%!important;max-height:100%!important;border-radius:0!important;border-width:0 0 0 1px!important;animation:gxSlide .28s cubic-bezier(.3,.7,.2,1)}}@keyframes gxSlide{from{transform:translateX(36px);opacity:0}to{transform:none;opacity:1}}.gcx.gcx.gcx .gkCl.band::before{display:none}.gcx.gcx.gcx .gkCl.band{padding-left:12px}.gcx.gcx.gcx .gkCc .gkK{flex:0 0 auto}.gcx.gcx.gcx .gkCc{gap:6px;padding:8px 6px}.gcx.gcx.gcx .gkK.nearly .gkS{color:#E0A23A}.gcx.gcx.gcx .gkCl::before{opacity:.5}.gcx.gcx.gcx .gkCmode .gkHd,.gcx.gcx.gcx .gkCmode .gkBody,.gcx.gcx.gcx .gkCmode .gkTot{grid-template-columns:150px repeat(7,minmax(0,1fr))}.gcx.gcx.gcx .gkCb{grid-template-rows:none;grid-auto-rows:auto;align-items:stretch}.gcx.gcx.gcx .gkCl{position:relative;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:0 10px 0 16px;border-top:1px solid var(--line)}.gcx.gcx.gcx .gkCl::before{content:'';position:absolute;left:0;top:10px;bottom:10px;width:4px;border-radius:3px;background:var(--cc)}.gcx.gcx.gcx .gkCl b{font:700 .95rem var(--fb);color:var(--ink)}.gcx.gcx.gcx .gkCl span{font:600 .74rem var(--fb);color:var(--muted)}.gcx.gcx.gcx .gkCc{display:flex;flex-direction:column;justify-content:center;gap:5px;padding:6px 4px;border-top:1px solid var(--line);border-left:1px solid var(--line);cursor:pointer;min-width:0}.gcx.gcx.gcx .gkCmode .gkK{padding:6px 8px 7px 12px;gap:3px}.gcx.gcx.gcx .gkVw{order:4;display:flex;gap:2px;padding:3px;border-radius:12px;background:var(--card2);flex:0 0 auto}.gcx.gcx.gcx .gkVw button{all:unset;cursor:pointer;padding:7px 12px;border-radius:9px;font:700 .8rem var(--fb);color:var(--muted);white-space:nowrap}.gcx.gcx.gcx .gkVw button.on{background:var(--card);color:var(--ink)}.gcx.gcx.gcx .gkTg .gkK{flex-direction:row;align-items:center;gap:7px;padding:3px 8px 3px 11px}.gcx.gcx.gcx .gkTg .gkR{display:contents}.gcx.gcx.gcx .gkTg .gkS{order:3;margin-left:auto}.gcx.gcx.gcx .gkTg .gkN{flex:1;min-width:0;font-size:.8rem}.gcx.gcx.gcx .gkTg.tall .gkK{flex-direction:column;align-items:stretch;gap:2px;padding:6px 8px 4px 11px}.gcx.gcx.gcx .gkTg.tall .gkR{display:flex}.gcx.gcx.gcx .gkTg.tall .gkS{margin-left:0}"; document.head.appendChild(st); })();
  (function () { if (document.getElementById('gkRef')) return; var st = document.createElement('style'); st.id = 'gkRef'; st.textContent = "html:not([data-theme='light']) .gcx.gcx.gcx.weekMode .cal-card{background:#10181D;border-color:#203039;border-radius:16px;overflow:hidden}html:not([data-theme='light']) .gcx.gcx.gcx .gpw.gkCmode{background:transparent;border:0;border-radius:0;padding:0;box-shadow:none}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkHd,html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkBody{grid-template-columns:110px repeat(7,minmax(0,1fr));gap:0}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkHd{background:#0D1519;border-bottom:1px solid #203039;margin:0;padding:0}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkHd>*{border-right:1px solid #203039}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkHd>*:last-child{border-right:0}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkFh{padding:14px 8px;font:600 .6875rem var(--fb);letter-spacing:.08em;text-transform:uppercase;color:#64748B;text-align:center}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkHd .gtDh{position:relative;margin:0;padding:12px 4px;border-radius:0;background:none;gap:2px;outline:0!important}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkHd .gtDh .dn{font:600 .6875rem var(--fb);letter-spacing:.08em;color:#94A3B8}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkHd .gtDh .dd{width:auto;height:auto;border-radius:0;background:none;font:700 1.25rem/1.2 var(--fd);color:#E2E8F0}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkHd .gtDh.today{background:rgba(42,179,177,.15)}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkHd .gtDh.today .dn{color:#2AB3B1;font-weight:700}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkHd .gtDh.today .dd{background:none;color:#fff;font-weight:800}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkHd .gtDh.today::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:#2AB3B1}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkBody{margin:0;gap:0}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkTot{display:none}html:not([data-theme='light']) .gcx.gcx.gcx .gkCl{background:#0C1317;align-items:center;text-align:center;gap:4px;padding:12px;border-top:1px solid #203039;border-right:1px solid #203039}html:not([data-theme='light']) .gcx.gcx.gcx .gkCl::before{display:none}html:not([data-theme='light']) .gcx.gcx.gcx .gkCl svg{color:#2AB3B1}html:not([data-theme='light']) .gcx.gcx.gcx .gkCl b{font:700 .75rem var(--fb);color:#E2E8F0}html:not([data-theme='light']) .gcx.gcx.gcx .gkCl span{font:500 .625rem var(--fb);color:#64748B}html:not([data-theme='light']) .gcx.gcx.gcx .gkCc{min-height:0;justify-content:flex-start;gap:8px;padding:8px;border-top:1px solid #203039;border-right:1px solid #203039}html:not([data-theme='light']) .gcx.gcx.gcx .gkCc:nth-child(8n){border-right:0}html:not([data-theme='light']) .gcx.gcx.gcx .gkCb>*:nth-child(-n+8){border-top:0}html:not([data-theme='light']) .gcx.gcx.gcx .gkCc.tod{background:rgba(42,179,177,.04)}html:not([data-theme='light']) .gcx.gcx.gcx .gkCc.cls{background:rgba(15,23,42,.35);justify-content:center}html:not([data-theme='light']) .gcx.gcx.gcx .gkCc.cls .gkEm{border:0;color:#475569}html:not([data-theme='light']) .gcx.gcx.gcx .gkEm{border:1px dashed rgba(30,41,59,.8);border-radius:12px;color:#475569;font:500 .6875rem var(--fb);min-height:0}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK{background:#152026;border:1px solid #203039;border-radius:12px;padding:10px 12px;gap:6px;transition:all .18s cubic-bezier(.22,1,.36,1)}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK::before{display:none}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK:hover{background:#1B2931;transform:translateY(-2px);box-shadow:0 10px 25px -5px rgba(0,0,0,.45),0 0 0 1px rgba(42,179,177,.35)}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkR b{font:800 .75rem var(--fb);color:#fff}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkS{padding:2px 6px;border-radius:6px;border:1px solid rgba(42,179,177,.3);background:rgba(42,179,177,.15);color:#2AB3B1;font:600 .625rem var(--fb)}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK.nearly .gkS,html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK.pt .gkS{border-color:rgba(245,158,11,.3);background:rgba(245,158,11,.15);color:#FCD34D}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK.full .gkS{border-color:rgba(244,63,94,.3);background:rgba(244,63,94,.15);color:#FB7185}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkN{font:700 .875rem/1.35 var(--fd);color:#fff;white-space:normal}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK .gtP{height:6px;border-radius:999px;background:#1E293B;margin-top:2px}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK .gtP u{background:#2AB3B1;border-radius:999px}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK.nearly .gtP u{background:#FBBF24}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK.full .gtP u{background:#F43F5E}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK{background:color-mix(in srgb,var(--cc) 16%,#152026);border-color:color-mix(in srgb,var(--cc) 38%,#203039)}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK::before{display:block;content:'';position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--cc)}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK{padding-left:16px}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK:hover{background:color-mix(in srgb,var(--cc) 26%,#1B2931)}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK .gtP{background:color-mix(in srgb,var(--cc) 22%,#1E293B)}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK .gtP u{background:var(--cc)}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK.nearly .gtP u{background:#FBBF24}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK.full .gtP u{background:#F43F5E}html:not([data-theme='light']) .gcx.gcx.gcx .gkCmode .gkK:not(.nearly):not(.full):not(.pt) .gkS{border-color:color-mix(in srgb,var(--cc) 45%,transparent);background:color-mix(in srgb,var(--cc) 22%,transparent);color:color-mix(in srgb,var(--cc) 55%,#fff)}html:not([data-theme='light']) .gcx.gcx.gcx .gkBar{background:rgba(16,24,29,.7);border:1px solid #203039;border-radius:16px;padding:10px 16px;margin:0 4px 12px;gap:10px 8px}html:not([data-theme='light']) .gcx.gcx.gcx .gkFl{font:500 .75rem var(--fb);color:#94A3B8;margin-right:2px}html:not([data-theme='light']) .gcx.gcx.gcx .gkBar .gkChip{height:auto!important;min-height:0!important;padding:6px 12px!important;border-radius:12px!important;font:500 .75rem var(--fb)!important;background:#152026;border:1px solid #203039;color:#CBD5E1}html:not([data-theme='light']) .gcx.gcx.gcx .gkBar .gkChip.on{background:#fff;color:#020617;font-weight:600}html:not([data-theme='light']) .gcx.gcx.gcx .gkLg{margin-left:auto;font-size:.6875rem;color:#94A3B8}html:not([data-theme='light']) .gcx.gcx.gcx .gkLg .ok{background:#2AB3B1}html:not([data-theme='light']) .gcx.gcx.gcx .gkLg .nr{background:#FBBF24}html:not([data-theme='light']) .gcx.gcx.gcx .gkLg .fu{background:#F43F5E}html:not([data-theme='light']) .gxShade .gxSes.gxSheet{width:448px!important;max-width:448px!important;background:#10181D!important;border-left:1px solid #203039!important}html:not([data-theme='light']) .gxShade .gxSes.gxSheet::before{display:none!important}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsH{background:#0D1519;border-bottom:1px solid #203039;padding:20px!important}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsK{display:inline-flex;padding:2px 10px;border-radius:999px;background:rgba(42,179,177,.15);border:1px solid rgba(42,179,177,.3);color:#2AB3B1;font:600 .6875rem var(--fb);letter-spacing:0;text-transform:none;margin-bottom:8px}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsN{font:700 1.25rem var(--fd);color:#fff}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsS{font:500 .75rem var(--fb);color:#94A3B8}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsX{background:#152026;border:1px solid #203039;border-radius:12px;color:#94A3B8;width:36px;height:36px}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsCap{margin:20px 20px 0;padding:16px;border-radius:16px;background:#152026;border:1px solid #203039}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsCapR{display:flex;justify-content:space-between;align-items:center;gap:8px;font:500 .75rem var(--fb);color:#94A3B8}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsCapR b{font:800 .875rem var(--fb);color:#2AB3B1}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsCap.warn .gsCapR b{color:#FCD34D}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsCap.bad .gsCapR b{color:#FB7185}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsCap.mu .gsCapR b{color:#94A3B8}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsCapB{height:8px;border-radius:999px;background:#1E293B;overflow:hidden;margin:10px 0}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsCapB u{display:block;height:100%;border-radius:999px;background:#2AB3B1;text-decoration:none}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsCap.warn .gsCapB u{background:#FBBF24}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsCap.bad .gsCapB u{background:#F43F5E}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsCapF{font:500 .6875rem var(--fb);color:#94A3B8}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsCapF b{color:#fff}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsL{padding:20px 20px 10px;font:700 .75rem var(--fb);letter-spacing:.05em;text-transform:uppercase;color:#94A3B8}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsList{padding:0 20px;display:flex;flex-direction:column;gap:8px}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsRow{min-height:0;padding:10px;gap:10px;border:1px solid #203039;border-radius:12px;background:#152026}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsAv{width:28px;height:28px;font:700 .75rem var(--fb);background:#1E293B;color:#2AB3B1}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsWho b{font:500 .75rem var(--fb);color:#E2E8F0}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsWho small{font:500 .6875rem var(--fb);color:#64748B}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsRm{width:32px;height:32px;border-radius:10px;border:1px solid #203039}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsFt{background:#0D1519;border-top:1px solid #203039;padding:16px 20px calc(16px + env(safe-area-inset-bottom,0px))}html:not([data-theme='light']) .gxShade .gxSes.gxSheet .gsFt .gsPri{height:44px;border-radius:12px;background:#2AB3B1;color:#020617;font:700 .75rem var(--fb)}"; document.head.appendChild(st); })();
  (function () { if (document.getElementById('gkDr')) return; var st = document.createElement('style'); st.id = 'gkDr'; var P = "html:not([data-theme='light']) .gxShade .gxSes.gxSheet"; st.textContent = [
  ".gxShade{--fd:'Manrope','Plus Jakarta Sans',sans-serif}",
  "@media(min-width:700px){.gxShade:has(.gxSes){padding:22px!important;align-items:center!important;justify-content:flex-end!important}.gxShade .gxSes.gxSheet{height:auto!important;max-height:100%!important;border-radius:24px!important;overflow-x:hidden!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch;box-shadow:0 30px 80px -10px rgba(0,0,0,.7)!important}}",
  P+"{border:1px solid #203039!important}",
  P+" .gsH{padding:24px 22px 20px!important;box-shadow:inset 0 3px 0 var(--sc)}",
  P+" .gsHt{display:flex;flex-direction:column;align-items:flex-start;gap:12px}",
  P+" .gsK{align-self:flex-start;width:auto;gap:7px;align-items:center;padding:4px 12px;background:color-mix(in srgb,var(--sc) 20%,transparent);border:1px solid color-mix(in srgb,var(--sc) 45%,transparent);color:color-mix(in srgb,var(--sc) 55%,#fff);margin:0}",
  P+" .gsK::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--sc)}",
  P+" .gsN{font:800 1.85rem/1.1 var(--fd);letter-spacing:-.02em;color:#fff}",
  P+" .gsS{display:flex;flex-wrap:wrap;gap:8px}",
  P+" .gsM{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:10px;background:#152026;border:1px solid #203039;font:600 .8rem var(--fb);color:#CBD5E1}",
  P+" .gsM svg{color:color-mix(in srgb,var(--sc) 60%,#fff)}",
  P+" .gsCap{margin:20px 20px 0;padding:18px 18px 16px}",
  P+" .gsCapR{align-items:flex-end}",
  P+" .gsCapN{display:flex;align-items:baseline;gap:8px}",
  P+" .gsCapN b{font:800 2.2rem/1 var(--fd);color:#fff}",
  P+" .gsCapN span{font:500 .82rem var(--fb);color:#94A3B8}",
  P+" .gsCapT{font:700 .72rem var(--fb);font-style:normal;padding:4px 11px;border-radius:999px;background:color-mix(in srgb,var(--sc) 20%,transparent);color:color-mix(in srgb,var(--sc) 55%,#fff);border:1px solid color-mix(in srgb,var(--sc) 40%,transparent)}",
  P+" .gsCap.warn .gsCapT{background:rgba(245,158,11,.15);color:#FCD34D;border-color:rgba(245,158,11,.35)}",
  P+" .gsCap.bad .gsCapT{background:rgba(244,63,94,.15);color:#FB7185;border-color:rgba(244,63,94,.35)}",
  P+" .gsCap.mu .gsCapT{background:#1E293B;color:#94A3B8;border-color:#2B3A47}",
  P+" .gsCap.ok .gsCapB u{background:var(--sc)}",
  P+" .gsCapB{height:10px;margin:14px 0 12px}",
  P+" .gsCapF{font:500 .8rem var(--fb);color:#94A3B8}",
  P+" .gsCapF b{color:#fff;font-weight:700}",
  P+" .gsL{padding:24px 22px 12px;font:700 .72rem var(--fb);letter-spacing:.1em;color:#94A3B8}",
  P+" .gsList{padding:0 20px;gap:10px}",
  P+" .gsRow{padding:12px 14px;gap:12px;border-radius:14px}",
  P+" .gsAv{width:38px;height:38px;border-radius:50%;font:700 .8rem var(--fb);background:color-mix(in srgb,var(--sc) 22%,#152026);color:color-mix(in srgb,var(--sc) 55%,#fff)}",
  P+" .gsWho b{font:600 .95rem var(--fb);color:#fff}",
  P+" .gsWho small{font:500 .8rem var(--fb);color:#94A3B8}",
  P+" .gsWho small a{color:inherit!important;text-decoration:none!important}",
  P+" .gsRm{width:34px;height:34px;border-radius:50%;color:#94A3B8;background:transparent}",
  P+" .gsFt{display:flex;flex-direction:column;gap:12px;padding:18px 20px calc(18px + env(safe-area-inset-bottom,0px))}",
  P+" .gsFt .gsPri{height:50px;border-radius:14px;font:700 .95rem var(--fb)}",
  P+" .gsFt2{display:grid;grid-template-columns:1fr 1fr;gap:10px}",
  P+" .gsFt2 button{display:flex;align-items:center;justify-content:center;width:auto;height:44px;margin:0;padding:0 10px;border-radius:12px;font:600 .82rem var(--fb);text-decoration:none}",
  P+" .gsFt2 .gsDng{background:rgba(244,63,94,.08);border:1px solid rgba(244,63,94,.35);color:#FB7185}",
  P+" .gsFt2 .gsLnk{background:#152026;border:1px solid #203039;color:#CBD5E1}",
  P+"{width:400px!important;max-width:400px!important}",
  P+" .gsH::before{display:none!important}",
  P+" .gsH{padding:18px 18px 16px!important;box-shadow:none!important}",
  P+" .gsHt{gap:9px}",
  P+" .gsK{padding:3px 10px;font-size:.68rem}",
  P+" .gsK::before{width:6px;height:6px}",
  P+" .gsN{font-size:1.4rem}",
  P+" .gsM{padding:5px 9px;gap:6px;font-size:.72rem;border-radius:9px}",
  P+" .gsM svg{width:13px;height:13px}",
  P+" .gsX{width:32px;height:32px;border-radius:10px}",
  P+" .gsX svg{width:15px;height:15px}",
  P+" .gsCap{margin:16px 16px 0;padding:14px 14px 12px;border-radius:14px}",
  P+" .gsCapN b{font-size:1.7rem}",
  P+" .gsCapN span{font-size:.74rem}",
  P+" .gsCapT{font-size:.66rem;padding:3px 9px}",
  P+" .gsCapB{height:7px;margin:11px 0 9px}",
  P+" .gsCapF{font-size:.74rem}",
  P+" .gsL{padding:18px 18px 9px;font-size:.66rem}",
  P+" .gsList{padding:0 16px;gap:8px}",
  P+" .gsRow{padding:9px 11px;gap:10px;border-radius:12px}",
  P+" .gsAv{width:32px;height:32px;font-size:.72rem}",
  P+" .gsWho b{font-size:.84rem}",
  P+" .gsWho small{font-size:.72rem}",
  P+" .gsRm{width:30px;height:30px}",
  P+" .gsRm svg{width:15px;height:15px}",
  P+" .gsFt{padding:14px 16px calc(14px + env(safe-area-inset-bottom,0px));gap:0}",
  P+" .gsFt2{grid-template-columns:1.5fr 1fr;gap:10px}",
  P+" .gsFt2 button{height:42px;font-size:.82rem;border-radius:12px}",
  P+" .gsCf:has(.gxWhy){position:fixed;z-index:9100;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(5,9,12,.78);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}",
  "@media(min-width:700px){"+P+" .gsCf:has(.gxWhy){inset:22px 22px 22px auto;width:400px;max-width:calc(100% - 44px);border-radius:24px}}",
  P+" .gsCf .gxWhy{width:100%;margin:0;padding:20px;border-radius:16px;background:#152026;border:1px solid rgba(244,63,94,.4);color:#E2E8F0;font:500 .9rem/1.45 var(--fb);box-shadow:0 20px 50px rgba(0,0,0,.5)}",
  P+" .gsCf .gxActs{display:grid;grid-template-columns:1.4fr 1fr;gap:10px;margin-top:16px}",
  P+" .gsCf .gxActs button{height:42px;margin:0;width:auto;border-radius:12px;font:700 .82rem var(--fb)}",
  P+" .gsCf .gxActs .danger{background:#F43F5E;color:#fff;border:0}",
  P+" .gsCf .gxActs .ghost{background:transparent;border:1px solid #2B3A47;color:#CBD5E1}",
  P+" .gsList{margin:0 16px;padding:0;gap:0;border:1px solid #203039;border-radius:16px;background:#121B20;overflow:hidden}",
  P+" .gsList .gsRow{border:0;border-bottom:1px solid #1C2A32;border-radius:0;background:transparent;padding:11px 14px}",
  P+" .gsList .gsRow:last-child{border-bottom:0}",
  P+" .gsAv{background:linear-gradient(135deg,color-mix(in srgb,var(--sc) 38%,#152026),color-mix(in srgb,var(--sc) 14%,#152026));border:1px solid color-mix(in srgb,var(--sc) 30%,transparent);color:#fff;font-weight:700}",
  P+" .gsWho{gap:2px}",
  P+" .gsWho b{font-weight:600;letter-spacing:-.005em}",
  P+" .gsWho small{color:#7C8B99;font-size:.72rem;letter-spacing:.01em}",
  P+" .gsWho small span{color:inherit;text-decoration:none}",
  P+" .gsRm{width:28px;height:28px;border:1px solid #26343D;color:#7C8B99;background:transparent;transition:all .15s}",
  P+" .gsRm:active{background:rgba(244,63,94,.12);border-color:rgba(244,63,94,.5);color:#FB7185}",
  P+" .gsList{margin:0 20px;padding:0;border:0;border-radius:0;background:transparent;overflow:visible}",
  P+" .gsList .gsRow{position:relative;padding:13px 2px;gap:14px;border:0;border-radius:0;background:transparent}",
  P+" .gsList .gsRow::after{content:'';position:absolute;left:54px;right:0;bottom:0;height:1px;background:#1C2A32}",
  P+" .gsList .gsRow:last-child::after{display:none}",
  P+" .gsList .gsAv{width:40px;height:40px;font-size:.78rem;flex:0 0 40px}",
  P+" .gsList .gsWho{gap:3px}",
  P+" .gsList .gsWho b{font-size:.9rem}",
  P+" .gsList .gsWho small{font-size:.75rem}",
  P+" .gsFt:empty{display:none}",
  P+" .gsL{padding:22px 20px 6px}",
  P+" .gsFt .gsFt2 .gsPri{height:42px;font-size:.82rem;border-radius:12px;background:#2AB3B1;color:#020617;font-weight:700;border:0}"
  ].join('\n'); document.head.appendChild(st); })();
  (function () { if (document.getElementById('gkDay')) return; var st = document.createElement('style'); st.id = 'gkDay'; var D = "html:not([data-theme='light']) .gcx.gcx.gcx"; st.textContent = [
  D+" .gdStrip{gap:8px;margin:4px 0 14px}",
  D+" .gdS{padding:10px 2px;border-radius:12px;background:#10181D;border:1px solid #203039;color:#fff;gap:2px;outline:0}",
  D+" .gdS span{color:#94A3B8;font-weight:600;letter-spacing:.08em}",
  D+" .gdS b{color:#fff;font-weight:700}",
  D+" .gdS.tod{background:rgba(42,179,177,.12);border-color:#2AB3B1}",
  D+" .gdS.tod span{color:#2AB3B1}",
  D+" .gdS.sel{background:#2AB3B1;border-color:#2AB3B1}",
  D+" .gdS.sel span,"+D+" .gdS.sel b{color:#04201F}",
  D+" .gcAg{display:flex;flex-direction:column;gap:0}",
  D+" .gdB{display:grid;grid-template-columns:110px minmax(0,1fr);gap:14px;padding:14px 0;border-top:1px solid #203039}",
  D+" .gdBl b{display:block;font:700 .85rem var(--fb);color:#E2E8F0}",
  D+" .gdBl span{display:block;margin-top:3px;font:500 .72rem var(--fb);color:#64748B}",
  D+" .gdBc{display:flex;flex-direction:column;gap:10px;min-width:0}",
  D+" .gdBc .gcAc{all:unset;box-sizing:border-box;cursor:pointer;position:relative;overflow:hidden;display:grid;grid-template-columns:70px minmax(0,1fr);align-items:center;gap:14px;padding:13px 16px 13px 20px;border-radius:14px;background:color-mix(in srgb,var(--cc) 16%,#152026);border:1px solid color-mix(in srgb,var(--cc) 38%,#203039);color:#fff}",
  D+" .gdBc .gcAc::before{content:'';position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--cc)}",
  D+" .gdBc .gcAc.past{opacity:.55}",
  D+" .gdBc .gcAc.off .gcR>b{text-decoration:line-through}",
  D+" .gdBc .gcAt b{display:block;font:700 1rem var(--fd);color:#fff}",
  D+" .gdBc .gcAt span{font:500 .78rem var(--fb);color:#94A3B8}",
  D+" .gdBc .gcAb{min-width:0;display:flex;flex-direction:column;gap:7px}",
  D+" .gdBc .gcR{display:flex;align-items:center;justify-content:space-between;gap:10px}",
  D+" .gdBc .gcR>b{font:700 1rem var(--fd);color:#fff}",
  D+" .gdBc .gcChip{font:600 .75rem var(--fb);padding:3px 10px;border-radius:8px;border:1px solid color-mix(in srgb,var(--cc) 45%,transparent);background:color-mix(in srgb,var(--cc) 22%,transparent);color:color-mix(in srgb,var(--cc) 55%,#fff)}",
  D+" .gdBc .gcChip.warn{border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.15);color:#FCD34D}",
  D+" .gdBc .gcChip.bad{border-color:rgba(244,63,94,.35);background:rgba(244,63,94,.15);color:#FB7185}",
  D+" .gdBc .gcChip.none{border-color:#2B3A47;background:#1E293B;color:#94A3B8}",
  D+" .gdBc .gcAc:not(.pt):not(.off) .gxM{display:none}",
  D+" .gdBc .gcAc .gxM{font:500 .78rem var(--fb);color:#94A3B8}",
  D+" .gdBc .gcAc .gxBar2,"+D+" .gdBc .gcAc [class*='Bar']{max-width:320px}",
  D+" .gdBc .gcBar{display:block;height:6px;max-width:320px;border-radius:99px;background:color-mix(in srgb,var(--cc) 22%,#1E293B);overflow:hidden}",
  D+" .gdBc .gcBar i{display:block;height:100%;border-radius:99px;background:var(--cc)}",
  D+" .gdBc .gcBar i.f{background:#F43F5E}",
  D+" .gdBc .gcAt{background:none;border:0;border-radius:0;padding:0;margin:0;width:auto;min-width:0;display:flex;flex-direction:column;gap:1px}",
  D+" .gdBc .gcAc{grid-template-columns:62px minmax(0,1fr);gap:12px;padding:10px 14px 10px 18px;border-radius:12px}",
  D+" .gdBc .gcAc::before{width:4px}",
  D+" .gdBc .gcAt b{font-size:.95rem}",
  D+" .gdBc .gcAt span{font-size:.72rem}",
  D+" .gdBc .gcAb{gap:6px}",
  D+" .gdBc .gcR>b{font-size:.95rem}",
  D+" .gdBc .gcAc.pt{background:color-mix(in srgb,#C9A24B 12%,#131C21);border-color:color-mix(in srgb,#C9A24B 32%,#203039)}",
  D+" .gdBc .gcAc.pt .gcDot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#C9A24B;margin-right:8px;vertical-align:1px}",
  D+" .gdBc .gcAc[data-ptf]{background:transparent;border:1px dashed #2A3942;padding-top:8px;padding-bottom:8px}",
  D+" .gdBc .gcAc[data-ptf]::before{display:none}",
  D+" .gdBc .gcAc[data-ptf] .gcR>b{font-weight:600;color:#94A3B8}",
  D+" .gdBc .gcAc[data-ptf] .gcDot{background:#6B5A2E}",
  D+" .gdBc .gcAc[data-ptf] .gxM{display:none}",
  D+" .gdBc .gcAc[data-ptf] .gcChip{background:transparent;border-color:transparent;color:#64748B}",
  D+" .gdBc .gcAc[data-ptf] .gcAt b{color:#94A3B8;font-weight:600}",
  D+" .gdBc{gap:8px}",
  D+" .gdS{padding:7px 2px}",
  D+" .gdS b{font-size:1.05rem}",
  D+" .gkCl{align-items:stretch;justify-content:flex-start;padding-top:0;padding-bottom:0}",
  D+" .gkClI{position:sticky;top:calc(var(--gkhh,70px) + 16px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;text-align:center;padding:14px 4px}",
  D+" .gcAg{padding-bottom:96px}",
  D+" .gcNowbar{display:flex;align-items:center;gap:8px;margin:2px 0 2px 124px;font:600 .75rem var(--fb);color:#F43F5E}",
  D+" .gcNowbar i{flex:1;height:1px;background:#F43F5E}",
  "@media(max-width:700px){"+D+" .gdB{grid-template-columns:1fr;gap:8px}"+D+" .gcNowbar{margin-left:0}}"
  ].join('\n'); document.head.appendChild(st); })();
  (function () { if (document.getElementById('gkTl')) return; var st = document.createElement('style'); st.id = 'gkTl'; var D = "html:not([data-theme='light']) .gcx.gcx.gcx .gdT"; st.textContent = [
  D+"{padding:10px 12px 110px}",
  D+" .gdR{display:grid;grid-template-columns:78px 22px minmax(0,1fr);align-items:stretch;gap:0 10px}",
  D+" .gdTm{padding-top:15px;text-align:right}",
  D+" .gdTm b{display:block;font:800 1.05rem var(--fd);color:#F1F5F9}",
  D+" .gdTm span{display:block;margin-top:2px;font:500 .72rem var(--fb);color:#64748B}",
  D+" .gdRl{position:relative;display:flex;justify-content:center}",
  D+" .gdRl::before{content:'';position:absolute;top:0;bottom:0;width:2px;background:#1B2830}",
  D+" .gdR:first-child .gdRl::before{top:22px}",
  D+" .gdR:last-of-type .gdRl::before{bottom:calc(100% - 22px)}",
  D+" .gdRl i{position:relative;z-index:1;margin-top:17px;width:12px;height:12px;border-radius:50%;background:var(--cc);box-shadow:0 0 0 4px #0A141A}",
  D+" .gdCd{padding:0 0 16px;min-width:0}",D+" .gdPp{display:flex;flex-wrap:wrap;gap:8px;padding-top:12px;border-top:1px solid #1B2830}",D+" .gdP{display:inline-flex;align-items:center;gap:7px;padding:4px 12px 4px 4px;border-radius:999px;background:#152026;border:1px solid #203039;font:500 .8rem var(--fb);color:#E2E8F0}",D+" .gdP u{text-decoration:none;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:color-mix(in srgb,var(--cc) 28%,#1E293B);color:#fff;font:700 .66rem var(--fb)}",D+" .gdP.more,"+D+" .gdP.none{padding:4px 12px;color:#94A3B8}",
  D+" .gdCd .gcAc{all:unset;box-sizing:border-box;display:flex;flex-direction:column;gap:12px;width:100%;cursor:pointer;padding:16px 18px;border-radius:16px;background:#10181D;border:1px solid #203039;transition:border-color .15s,background .15s}",
  D+" .gdCd .gcAc:active,"+D+" .gdCd .gcAc:hover{background:#152026;border-color:color-mix(in srgb,var(--cc) 55%,#203039)}",
  D+" .gdCd .gcAc::before{display:none}",
  D+" .gdCd .gcAc.past{opacity:.5}",
  D+" .gdCd .gcAc .gcAt{display:none}",
  D+" .gdCd .gcAc .gcAb{display:flex;flex-direction:column;gap:10px;min-width:0}",
  D+" .gdCd .gcAc .gcR{display:flex;align-items:center;justify-content:space-between;gap:10px}",
  D+" .gdCd .gcAc .gcR>b{font:700 1.05rem var(--fd);color:#fff}",
  D+" .gdCd .gcAc .gcChip{font:600 .75rem var(--fb);padding:3px 10px;border-radius:999px;background:#152026;border:1px solid #203039;color:#94A3B8}",
  D+" .gdCd .gcAc .gcChip.warn{color:#FCD34D;border-color:rgba(245,158,11,.35);background:rgba(245,158,11,.12)}",
  D+" .gdCd .gcAc .gcChip.bad{color:#FB7185;border-color:rgba(244,63,94,.35);background:rgba(244,63,94,.12)}",
  D+" .gdCd .gcAc .gcBar{display:block;height:5px;max-width:none;border-radius:99px;background:#1B2830;overflow:hidden}",
  D+" .gdCd .gcAc .gcBar i{display:block;height:100%;border-radius:99px;background:var(--cc)}",
  D+" .gdCd .gcAc .gcBar i.f{background:#F43F5E}",
  D+" .gdCd .gcAc .gxM{font:500 .8rem var(--fb);color:#94A3B8}",
  D+" .gcNowbar{margin:0 0 10px 96px}",
  "@media(max-width:700px){"+D+" .gdR{grid-template-columns:48px 16px minmax(0,1fr);gap:0 6px}"+D+" .gcNowbar{margin-left:70px}}"
  ].join('\n'); document.head.appendChild(st); })();
  (function () { if (document.getElementById('gkPk')) return; var st = document.createElement('style'); st.id = 'gkPk'; st.textContent = [
  ".gxSheet.gkPick{max-width:440px}",
  ".gkPick .gkCalH{display:flex;align-items:center;justify-content:space-between;margin:14px 0 10px}",
  ".gkPick .gkCalH b{font:800 1.05rem var(--fd,inherit);color:var(--ink)}",
  ".gkPick .gkCalN{all:unset;box-sizing:border-box;width:38px;height:38px;border-radius:12px;border:1px solid var(--line);display:grid;place-items:center;cursor:pointer;color:var(--ink)}",
  ".gkPick .gkCalN:disabled{opacity:.3;cursor:default}",
  ".gkPick .gkCalG{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}",
  ".gkPick .gkCalW{text-align:center;font:700 .7rem var(--fb,inherit);letter-spacing:.08em;color:var(--muted);padding:2px 0 4px}",
  ".gkPick .gkCalD{all:unset;box-sizing:border-box;height:44px;border-radius:12px;display:grid;place-items:center;font:600 .95rem var(--fb,inherit);color:var(--muted);opacity:.35;cursor:default}",
  ".gkPick .gkCalD.ok{opacity:1;cursor:pointer;color:var(--ink);background:color-mix(in srgb,var(--accent) 14%,transparent);border:1px solid color-mix(in srgb,var(--accent) 38%,transparent)}",
  ".gkPick .gkCalD.tod{outline:1.5px solid var(--accent);outline-offset:1px}",
  ".gkPick .gkCalD.sel{background:var(--accent);color:var(--on-accent,#04201F);border-color:var(--accent)}",
  ".gkPick .gkHrsT{margin:18px 0 10px;font:700 .72rem var(--fb,inherit);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}",
  ".gkPick .gkHint{margin:16px 0 4px;font:500 .85rem var(--fb,inherit);color:var(--muted);text-align:center}",
  ".gkPick .gkHrs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}",
  ".gkPick .gkHr{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;gap:2px;padding:11px 14px;border-radius:14px;border:1px solid var(--line);background:var(--card)}",
  ".gkPick .gkHr b{font:800 1.1rem var(--fd,inherit);color:var(--ink)}",
  ".gkPick .gkHr span{font:600 .85rem var(--fb,inherit);color:var(--ink)}",
  ".gkPick .gkHr small{font:500 .75rem var(--fb,inherit);color:var(--muted)}",
  ".gkPick .gkHr.off{opacity:.5}"
  ].join('\n'); document.head.appendChild(st); })();
  (function () { if (document.getElementById('gtCss')) return; var st = document.createElement('style'); st.id = 'gtCss'; st.textContent = "\n/* Settimana a griglia oraria (iPad / desktop) */\n.gcx.gcx .gtW{display:flex;flex-direction:column;gap:0;background:var(--card);border:1px solid var(--line2);border-radius:20px;padding:10px 12px 8px;min-width:0}\n.gcx.gcx .gtHd,.gcx.gcx .gtTot{display:grid;grid-template-columns:48px repeat(7,minmax(0,1fr));align-items:center}\n.gcx.gcx .gtHd{position:sticky;top:0;z-index:4;background:var(--card);padding-bottom:8px}\n.gcx.gcx .gtDh{all:unset;box-sizing:border-box;cursor:pointer;margin:0 3px;padding:9px 2px;border-radius:12px;background:var(--card2);color:var(--ink);display:flex;justify-content:center;align-items:baseline;gap:6px}\n.gcx.gcx .gtDh .dn{font:700 .68rem var(--fb);letter-spacing:.08em;text-transform:uppercase;opacity:.7}\n.gcx.gcx .gtDh .dd{font:800 1.15rem/1.1 var(--fd)}\n.gcx.gcx .gtDh.sel{outline:2px solid var(--accent);outline-offset:-2px}\n.gcx.gcx .gtDh.today{background:var(--accent);color:var(--on-accent,#fff)}\n.gcx.gcx .gtBody{position:relative;display:grid;grid-template-columns:48px 1fr}\n.gcx.gcx .gtHrs{position:relative}\n.gcx.gcx .gtHrs div{position:absolute;left:0;right:0}\n.gcx.gcx .gtHrs span{position:absolute;top:-7px;left:0;font:700 .72rem var(--fb);color:var(--muted)}\n.gcx.gcx .gtCols{position:relative;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));background-image:repeating-linear-gradient(to bottom,color-mix(in srgb,var(--ink) 14%,var(--line2)) 0 1px,transparent 1px 58px)}\n.gcx.gcx .gtCol{position:relative;border-left:1px solid color-mix(in srgb,var(--ink) 14%,var(--line2));cursor:pointer;min-width:0}\n.gcx.gcx .gtCol.tod{background:color-mix(in srgb,var(--accent) 6%,transparent)}\n.gcx.gcx .gtCol.closed{background:color-mix(in srgb,var(--muted) 8%,transparent)}\n.gcx.gcx .gtNow{position:absolute;left:0;right:0;height:2px;background:var(--danger);z-index:2;pointer-events:none}\n.gcx.gcx .gtB{all:unset;box-sizing:border-box;position:absolute;cursor:pointer;overflow:hidden;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:4px 8px;border-radius:9px;border-left:4px solid var(--cc,var(--accent));background:color-mix(in srgb,var(--cc,var(--accent)) 18%,var(--card));color:var(--ink);z-index:1}\n.gcx.gcx .gtB b{font:800 .82rem/1.15 var(--fd);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}\n.gcx.gcx .gtS{font:700 .7rem var(--fb);color:var(--muted);display:flex;gap:6px;white-space:nowrap}\n.gcx.gcx .gtS em{font-style:normal;color:var(--ink)}\n.gcx.gcx .gtB.full .gtS{color:var(--danger)}\n.gcx.gcx .gtB.past{opacity:.5}.gcx.gcx .gtB.off{opacity:.45}\n.gcx.gcx .gtP{display:block;height:4px;border-radius:9px;background:color-mix(in srgb,var(--ink) 14%,transparent);overflow:hidden;margin-top:2px}\n.gcx.gcx .gtP u{display:block;height:100%;background:var(--cc);text-decoration:none}\n.gcx.gcx .gtB.gpc-pt{border:1.5px solid #C9A24B;border-left-width:4px;background:color-mix(in srgb,#C9A24B 16%,var(--card))}\n.gcx.gcx .gtB.gpc-pt::after{display:none}\n.gcx.gcx .gtTot{border-top:1px solid var(--line);margin-top:6px;padding-top:8px}\n.gcx.gcx .gtTot div{font:800 .66rem var(--fb);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}\n.gcx.gcx .gtTot span{text-align:center;font:800 .86rem var(--fd);color:var(--ink)}\n.gcx.gcx .wkScroll.gwkScroll{height:calc(100vh - 340px)!important;min-height:320px!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}\n.gcx.gcx .gtW{height:auto!important;min-height:0!important;overflow:visible!important}\n.gcx.gcx .gtHd{position:sticky!important;top:0!important;z-index:5}\n.gcx.gcx .gtB b{font-size:.86rem!important;font-weight:800!important}\n.gcx.gcx .gtS,.gcx.gcx .gtS em{font-size:.76rem!important;font-weight:700!important}\n.gcx.gcx .gtBody{margin-top:12px}\n.gcx.gcx .gtHd{padding-bottom:4px}\n\n.gcx.gcx .gkDot{display:inline-block;width:9px;height:9px;border-radius:3px;margin:0 7px 0 0;vertical-align:0}\n.gcx.gcx .gkDot.c1{background:var(--c-circuit,#237F8B)}.gcx.gcx .gkDot.c2{background:var(--c-hyrox,#C98512)}.gcx.gcx .gkDot.c3{background:var(--c-pilates,#7D63C4)}.gcx.gcx .gkDot.c4{background:#C9A24B}\n.gcx.gcx .gtW{padding:6px 10px 6px}\n.gcx.gcx .gtDh{padding:5px 2px;border-radius:9px}\n.gcx.gcx .gtDh .dd{font-size:1rem}\n.gcx.gcx .gtDh .dn{font-size:.64rem}\n.gcx.gcx .gtHd{padding-bottom:2px}\n.gcx.gcx .gtMore{background:color-mix(in srgb,var(--ink) 12%,var(--card));border-left-color:var(--ink);opacity:.95}\n.gcx.gcx .gtMore b{font-size:.84rem!important}\n.gcx.gcx .wkScroll.gwkScroll{height:calc(100vh - 300px)!important}\n@media(min-width:700px){\n.gcx.gcx .controls .wkFilter{order:5;display:flex!important;flex:0 1 auto;min-width:0;gap:6px;margin:0 0 0 10px!important;padding:0 6px!important;align-items:center;overflow-x:auto;overflow-y:hidden;flex-wrap:nowrap!important;scrollbar-width:none;-webkit-overflow-scrolling:touch;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 8px,#000 calc(100% - 18px),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 8px,#000 calc(100% - 18px),transparent 100%)}\n.gcx.gcx .controls .wkFilter::-webkit-scrollbar{display:none}\n.gcx.gcx .controls .wkFilter .gkChip{flex:0 0 auto;white-space:nowrap}\n.gcx.gcx.weekMode .controls .gPrev,.gcx.gcx.weekMode .controls .gNext,.gcx.gcx.weekMode .controls .gToday,.gcx.gcx.weekMode .controls .range{flex:0 0 auto}\n.gcx.gcx .controls .wkFilter .gkChip{padding:0 12px!important;min-height:34px!important;height:34px!important;font-size:.84rem!important}\n.gcx.gcx.weekMode .controls .range{font-size:1.5rem!important;margin-right:8px!important}\n.gcx.gcx.weekMode .controls{padding-top:10px!important;padding-bottom:6px!important}\n.gcx.gcx.weekMode .wkScroll.gwkScroll{height:calc(100vh - 235px)!important}\n}\n\n.gcx.gcx .gkHd,.gcx.gcx .gkBody,.gcx.gcx .gkTot{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}\n.gcx.gcx .gkTot{grid-template-columns:repeat(7,minmax(0,1fr))}\n.gcx.gcx .gkTot div{display:none}\n.gcx.gcx .gkHd{position:sticky;top:0;z-index:5;background:var(--card);padding-bottom:6px}\n.gcx.gcx .gkHd .gtDh{flex-direction:row;flex-wrap:wrap;margin:0;padding:8px 4px 6px;gap:6px 6px;justify-content:center;align-items:baseline}\n.gcx.gcx .gkDots{flex:0 0 100%;display:flex;justify-content:center;gap:3px;min-height:4px;padding:0 6px}\n.gcx.gcx .gkDots u{flex:1 1 0;max-width:34px;height:4px;border-radius:3px;display:block;text-decoration:none}\n.gcx.gcx .gkCol{display:flex;flex-direction:column;gap:6px;min-width:0;padding:6px 0 10px;border-radius:12px;cursor:pointer}\n.gcx.gcx .gkCol.tod{background:color-mix(in srgb,var(--accent) 6%,transparent)}\n.gcx.gcx .gkCol.closed{background:color-mix(in srgb,var(--muted) 8%,transparent)}\n.gcx.gcx .gkK{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;gap:3px;padding:9px 10px;border-radius:11px;border-left:4px solid var(--cc);background:color-mix(in srgb,var(--cc) 18%,var(--card));color:var(--ink);min-width:0}\n.gcx.gcx .gkK b{font:800 .95rem var(--fd);color:var(--ink)}\n.gcx.gcx .gkN{font:700 .82rem var(--fb);color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.gcx.gcx .gkS{font:700 .74rem var(--fb);color:var(--muted)}\n.gcx.gcx .gkK.full .gkS{color:var(--danger)}\n.gcx.gcx .gkK.past{opacity:.5}.gcx.gcx .gkK.off{opacity:.45}\n.gcx.gcx .gkRest{text-align:center;color:var(--muted);opacity:.6;font:600 .8rem var(--fb);padding:18px 0}\n.gcx.gcx .gkK .gtP{margin-top:3px}.gcx.gcx .gkK .gtP u{background:var(--cc)}\n\n.gcx.gcx .gdStrip{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin:0 0 10px}\n.gcx.gcx .gdS{all:unset;box-sizing:border-box;cursor:pointer;text-align:center;border-radius:12px;padding:8px 2px;background:var(--card2);color:var(--ink);display:flex;flex-direction:column;gap:1px}\n.gcx.gcx .gdS span{font:700 .64rem var(--fb);letter-spacing:.08em;text-transform:uppercase;opacity:.7}\n.gcx.gcx .gdS b{font:800 1.15rem/1.1 var(--fd)}\n.gcx.gcx .gdS.tod{outline:1px solid var(--accent);outline-offset:-1px}\n.gcx.gcx .gdS.sel{background:var(--accent);color:var(--on-accent,#fff)}\n.gcx.gcx .gcAc{border-left:6px solid var(--cc,var(--line));background:color-mix(in srgb,var(--cc,transparent) 10%,var(--card))}\n.gcx.gcx .gcAc.pt{border-style:solid;border-left-width:6px;border-top:1px solid var(--line);border-right:1px solid var(--line);border-bottom:1px solid var(--line)}\n\n.gcx.gcx .gkHd .gtDh{flex-direction:column;flex-wrap:nowrap;align-items:center;background:none;gap:3px;padding:2px 0 4px;outline:0!important}\n.gcx.gcx .gkHd .gtDh .dn{font:700 .66rem var(--fb);letter-spacing:.08em;color:var(--muted);opacity:1}\n.gcx.gcx .gkHd .gtDh .dd{font:700 1.05rem/1 var(--fd);width:30px;height:30px;display:flex;align-items:center;justify-content:center;border-radius:50%;color:var(--ink)}\n.gcx.gcx .gkHd .gtDh.today .dd{background:var(--accent);color:var(--on-accent,#fff)}\n.gcx.gcx .gkHd .gtDh.today{background:none;color:var(--ink)}\n.gcx.gcx .gkHd{border-bottom:1px solid var(--line);margin-bottom:8px;padding-bottom:6px}\n.gcx.gcx .gkBody{gap:8px}\n.gcx.gcx .gkCol,.gcx.gcx .gkCol.tod,.gcx.gcx .gkCol.closed{background:none;padding:0 0 6px;gap:6px}\n.gcx.gcx .gkK{position:relative;overflow:hidden;gap:4px;padding:8px 10px 9px 13px;border:0;border-radius:10px;background:color-mix(in srgb,var(--ink) 6%,var(--card))}\n.gcx.gcx .gkK::before{content:\"\";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--cc)}\n.gcx.gcx .gkR{display:flex;justify-content:space-between;align-items:baseline;gap:6px}\n.gcx.gcx .gkK b{font:700 .74rem var(--fb);color:var(--muted)}\n.gcx.gcx .gkS{font:700 .74rem var(--fb);color:var(--ink)}\n.gcx.gcx .gkN{font:700 .88rem var(--fb);color:var(--ink)}\n.gcx.gcx .gkK.full .gkS{color:var(--danger)}\n.gcx.gcx .gkK.full .gtP u{background:var(--danger)}\n.gcx.gcx .gkK.nearly .gtP u{background:#E0A23A}\n.gcx.gcx .gkK.off .gkN{text-decoration:line-through}\n.gcx.gcx .gkK .gtP{height:3px;margin-top:2px}\n.gcx.gcx .gkRest{border:1px dashed var(--line2);border-radius:10px;padding:14px 0;font:600 .78rem var(--fb);opacity:.8}\n.gcx.gcx .gkTot{border-top:1px solid var(--line);margin-top:8px;padding-top:10px}\n.gcx.gcx .gkTot span{font:600 .78rem var(--fb);color:var(--muted)}\n.gcx.gcx .gcAc{border-left:4px solid var(--cc,var(--line));background:var(--card)}\n"; document.head.appendChild(st); })();
  function mins(t) { return +t.slice(0, 2) * 60 + +t.slice(3, 5); }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function endT(t, dur) { return hhmm(mins(t) + (dur || 60)); }
  function nowMin() { var n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
  function isStarted(d, t) { return d < today() || (d === today() && mins(t) <= nowMin()); }
  function isEnded(d, t, dur) { return d < today() || (d === today() && mins(t) + (dur || 60) <= nowMin()); }
  // Filtri della settimana: le categorie dei corsi che la palestra ha davvero (+ Personal se lo offre)
  function flist() {
    var o = G.OF ? G.OF() : { cls: true, pt: true }, seen = {}, out = [];
    if (o.cls) ((G.S.data && G.S.data.courses) || []).forEach(function (c) { if (c.category === 'personal') return; if (!seen.corsi) { seen.corsi = 1; out.push(['corsi', 'Corsi']); } });
    if (o.pt) out.push(['pt', 'Personal']);
    return out;
  }
  // un colore per ogni corso: i piu' comuni hanno il loro, gli altri ne ricevono uno stabile dal nome
  var CPAL = ['#4B86D6', '#E36FA6', '#8FCB4A', '#3FC1A5', '#E8794A', '#6C7BE0', '#D6B13A', '#C06AD0'];
  function courseCol(nm) {
    var n = String(nm || '').toLowerCase();
    if (/circuit/.test(n)) return '#3FB0BC'; if (/hyrox/.test(n)) return '#E5604D'; if (/pilates/.test(n)) return '#A58BE0'; if (/thai|boxe|box\b|muay/.test(n)) return '#5FBF6E';
    var h = 0; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return CPAL[h % CPAL.length];
  }
  function ck(cat) { return cat === 'hyrox' ? 'hyrox' : cat === 'pilates' ? 'pilates' : 'circuit'; }
  function col(s) { return courseCol(s.course.name); }
  function ptStats(day) { var p = day.pt; if (Array.isArray(p)) return { total: p.length, booked: p.filter(function (x) { return !x.free; }).length }; return p || { total: 0, booked: 0 }; }
  function dayStats(day) {
    var n = 0, cap = 0, b = 0;
    (day.sessions || []).forEach(function (s) { if (s.cancelled) return; n++; cap += s.capacity; b += s.taken; });
    return { n: n, cap: cap, b: b, pct: cap ? Math.round(b / cap * 100) : 0 };
  }
  function getDay(d) { var c = C[d]; return c ? (c.full || c.light) : null; }

  // ---------- dati ----------
  var BUST = 0;
  function bust() { C = {}; PEND = {}; BUST++; }
  function have(from, to, needFull) { for (var d = from; d <= to; d = addDays(d, 1)) { var c = C[d]; if (!c || !(needFull ? c.full : (c.full || c.light))) return false; } return true; }
  var PEND = {};
  function fetchRange(from, to, light) {
    var key = from + '|' + to + '|' + (light ? 1 : 0), gen = BUST;
    if (PEND[key]) return PEND[key];
    var p = G.api(null, G.API + '&cal=1&from=' + from + '&to=' + to + (light ? '&light=1' : '')).then(function (j) {
      delete PEND[key];
      if (gen !== BUST) return;
      j.days.forEach(function (d) { var c = C[d.date] = C[d.date] || {}; c[light ? 'light' : 'full'] = d; });
      if (j.today) G.S.today = j.today;
    }, function (e) { delete PEND[key]; throw e; });
    PEND[key] = p;
    return p;
  }
  function ensure(from, to, needFull, cb) {
    if (have(from, to, needFull)) { cb(); return; }
    var my = token;
    fetchRange(from, to, !needFull).then(function () { if (my === token) cb(); }).catch(function (e) { if (my === token) { root.textContent = ''; root.appendChild(el('div', 'gxWhy', e.message || 'Errore')); } });
  }
  // a riposo si scaricano il periodo precedente e il successivo: il cambio di settimana/mese e' immediato
  var pfT;
  function prefetchNear() {
    clearTimeout(pfT);
    pfT = setTimeout(function () {
      if (!sectionOn || S.view === 'day' || document.visibilityState === 'hidden') return;
      var keep = S.anchor, view = S.view, out = [];
      [-1, 1].forEach(function (k) {
        var a = view === 'week' ? addDays(S.anchor, 7 * k) : (function () { var d = parse(S.anchor); return ymd(new Date(d.getFullYear(), d.getMonth() + k, 1)); })();
        var sv = S.anchor; S.anchor = a; var r = range(); S.anchor = sv;
        if (!have(r.from, r.to, r.full)) out.push(r);
      });
      out.forEach(function (r) { fetchRange(r.from, r.to, !r.full).catch(function () {}); });
    }, 600);
  }
  // la settimana va sempre da lunedi a domenica
  function wkStart(a) { var d = parse(a); return addDays(a, -((d.getDay() + 6) % 7)); }
  function range() {
    if (S.view === 'day') return { from: S.anchor, to: S.anchor, full: true };
    if (S.view === 'week') { var m = wkStart(S.anchor); return { from: m, to: addDays(m, 6), full: true }; }
    var an = parse(S.anchor), f = new Date(an.getFullYear(), an.getMonth(), 1), gs = monday(ymd(f));
    var lead = Math.round((f.getTime() - parse(gs).getTime()) / 864e5), dim = new Date(an.getFullYear(), an.getMonth() + 1, 0).getDate(), rows = Math.ceil((lead + dim) / 7);
    return { from: gs, to: addDays(gs, rows * 7 - 1), full: false };
  }

  // ---------- disegno ----------
  var CH = {
    l: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>',
    r: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>',
    r15: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    r16: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plus: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
  };
  // in alto, al posto dei tre pulsanti della vista (che in palestra non servono), il giorno o i giorni della settimana
  function syncTop() {
    var par = document.querySelector('.mainTopRow'); if (!par) return;
    var t = document.getElementById('gymTopRange');
    if (!t) { t = document.createElement('h1'); t.id = 'gymTopRange'; t.className = 'gymTopRange'; t.setAttribute('aria-live', 'polite'); par.insertBefore(t, par.firstChild); }
    t.innerHTML = rangeTxt();
  }
  function render() {
    var of0 = G.OF ? G.OF() : null; if (of0) { if (!of0.cls && S.side === 'lez') S.side = 'pt'; if (!of0.pt && S.side === 'pt') S.side = 'lez'; if (S.flt !== 'all' && flist().every(function (x) { return x[0] !== S.flt; })) S.flt = 'all'; }
    if (S.view === 'month') S.view = 'week';
    token++;
    var my = token;
    root.className = 'gcx ' + (S.view === 'month' ? 'monthMode' : S.view === 'week' ? 'weekMode' : 'dayMode') + (S.view === 'week' && S.wkOpen && !phone() ? ' wkOpen' : '') + (S.view === 'month' && S.sideOpen && phone() ? ' sideOpen' : '');
    if (!G.S.data) G.load().catch(function () {});
    var r = range();
    root.innerHTML = controlsHTML() + '<div class="cal-wrap"><div class="cal-card" id="gcBody">' + skel() + '</div></div>';
    bindControls(); syncTop();
    toggleFab();
    ensure(r.from, r.to, r.full, function () {
      prefetchNear(); toggleFab();
      var body = document.getElementById('gcBody'); if (!body) return;
      if (S.view === 'day') { body.innerHTML = '<div class="gcal">' + dayHTML() + '</div>'; bindBody(body); bindStrip(body); dayFocus(body); return; }
      if (S.view === 'week') {
        if (phone()) { body.innerHTML = '<div class="gcal">' + weekPhone() + '</div>'; bindBody(body); }
        else { weekDraw(body); }
        return;
      }
      monthDraw(body);
      // il dettaglio del giorno scelto arriva dopo: il mese si vede subito
      if (!have(S.sel, S.sel, true)) { var my2 = token, selD = S.sel; fetchRange(selD, selD, false).then(function () { if (my2 === token && selD === S.sel) { var b2 = document.getElementById('gcBody'); if (b2 && S.view === 'month') monthDraw(b2); } }).catch(function () {}); }
    });
  }
  // giorno di oggi: parte dalla lezione in corso o dalla prossima, non dalla mattina
  function dayStrip() {
    var a = wkStart(S.anchor), h = '';
    for (var i = 0; i < 7; i++) { var d = addDays(a, i); h += '<button type="button" class="gdS' + (d === S.anchor ? ' sel' : '') + (d === today() ? ' tod' : '') + '" data-d="' + d + '"><span>' + G.DN[dow(d)] + '</span><b>' + parse(d).getDate() + '</b></button>'; }
    return '<div class="gdStrip">' + h + '</div>';
  }
  function bindStrip(body) {
    [].forEach.call(body.querySelectorAll('.gdS'), function (b) { b.onclick = function () { S.anchor = b.dataset.d; S.sel = b.dataset.d; render(); }; });
  }
  function dayFocus(body) {
    if (S.anchor !== today()) return;
    var t = body.querySelector('.gcAc:not(.past):not(.off)'); if (!t) return;
    var ag = body.querySelector('.gcAg'); if (!ag || t === ag.firstElementChild) return;
    setTimeout(function () {
      var sc = null, n = t.parentNode;
      while (n && n !== document.body) { var o = getComputedStyle(n).overflowY; if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 2) { sc = n; break; } n = n.parentNode; }
      if (sc) sc.scrollTop += t.getBoundingClientRect().top - sc.getBoundingClientRect().top - 8;
      else window.scrollTo(0, window.scrollY + t.getBoundingClientRect().top - 70);
    }, 30);
  }
  function skel() {
    if (S.view === 'month') { var c = ''; for (var i = 0; i < 35; i++) c += '<i></i>'; return '<div class="gcSk gcSkM">' + c + '</div>'; }
    return '<div class="gcSk gcSkL"><i></i><i></i><i></i><i></i></div>';
  }
  function rangeTxt() {
    var y = function (t) { return ' <span class="rangeYear">' + t + '</span>'; };
    if (S.view === 'day') { var d = parse(S.anchor); return (phone() ? G.DN[d.getDay()] : G.DL[d.getDay()]) + ' ' + d.getDate() + ' ' + (phone() ? G.MS[d.getMonth()] : G.MO[d.getMonth()]) + y(d.getFullYear()); }
    if (S.view === 'week') {
      var a = wkStart(S.anchor), b = addDays(a, 6), x = parse(a), z = parse(b);
      return x.getDate() + (x.getMonth() !== z.getMonth() ? ' ' + G.MS[x.getMonth()] : '') + ' – ' + z.getDate() + ' ' + G.MS[z.getMonth()] + y(z.getFullYear());
    }
    var m = parse(S.anchor); return cap1(G.MO[m.getMonth()]) + y(m.getFullYear());
  }
  function isCurrent() {
    if (S.view === 'day') return S.anchor === today();
    if (S.view === 'week') { var w0 = wkStart(S.anchor); return today() >= w0 && today() <= addDays(w0, 6); }
    var a = parse(S.anchor), t = parse(today()); return a.getMonth() === t.getMonth() && a.getFullYear() === t.getFullYear();
  }
  function controlsHTML() {
    var seg = '<div class="seg" role="group" aria-label="Visualizzazione">' + [['day', 'Giorno'], ['week', 'Settimana']].map(function (v) { return '<button type="button" data-v="' + v[0] + '" aria-pressed="' + (S.view === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div>';
    return '<header class="top"><div class="controls">' + seg +
      '<button class="arrow gPrev" type="button" aria-label="Periodo precedente">' + CH.l + '</button>' +
      '<h1 class="range" aria-live="polite">' + rangeTxt() + '</h1>' +
      '<button class="arrow gNext" type="button" aria-label="Periodo successivo">' + CH.r + '</button>' +
      '<button class="jumpToday gToday" type="button">Oggi</button>' +
      '<button class="jumpToday gProg" type="button">Programma</button></div></header>';
  }
  function bindControls() {
    [].forEach.call(root.querySelectorAll('[data-v]'), function (b) { b.onclick = function () { S.view = b.dataset.v; if (S.view === 'day') S.anchor = S.sel; S.wkOpen = false; S.sideOpen = false; render(); }; });
    root.querySelector('.gPrev').onclick = function () { step(-1); };
    root.querySelector('.gNext').onclick = function () { step(1); };
    var n = root.querySelector('.gToday'); if (n) n.onclick = function () { S.anchor = today(); S.sel = today(); render(); };
    root.querySelector('.gProg').onclick = function () { G.openSetting('corsi'); };
  }
  function step(k) {
    if (S.view === 'day') { S.anchor = addDays(S.anchor, k); S.sel = S.anchor; }
    else if (S.view === 'week') { S.anchor = addDays(S.anchor, 7 * k); S.sel = wkStart(S.anchor); }
    else { var d = parse(S.anchor); S.anchor = ymd(new Date(d.getFullYear(), d.getMonth() + k, 1)); S.sel = S.anchor === monthOf(today()) ? today() : S.anchor; }
    render();
  }
  function monthOf(d) { return d.slice(0, 7) + '-01'; }
  // evidenzia la lezione (o il Personal) di una notifica: stessa ora e, se nota, stesso corso
  function hlCls(time, name) {
    var h = S.hl; if (!h || h.time !== time) return '';
    if (h.svc && name && String(h.svc).toLowerCase() !== String(name).toLowerCase()) return '';
    return ' hl' + (h.bad ? ' bad' : '');
  }
  function bindBody(body) {
    var f = body.querySelector('#gcFlt'); if (f) f.onchange = function () { S.flt = f.value; render(); };
    bindActions(body);
    if (S.hl) {
      var hl = S.hl, hc = body.querySelector('.gcAc.hl');
      if (hc) {
        setTimeout(function () { try { hc.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { hc.scrollIntoView(); } }, 60);
      }
      setTimeout(function () { if (S.hl === hl) { S.hl = null; var x = document.querySelector('.gcAc.hl'); if (x) x.classList.remove('hl', 'bad'); } }, 6200);
    }
  }
  // azioni comuni a corpo, pannello laterale e foglio del giorno
  function bindActions(scope, afterClose) {
    [].forEach.call(scope.querySelectorAll('[data-sess]'), function (b) { b.onclick = function () { if (afterClose) afterClose(); openSession(b.dataset.date, b.dataset.sess); }; });
    [].forEach.call(scope.querySelectorAll('[data-ptf]'), function (b) { b.onclick = function () { if (afterClose) afterClose(); openPtBook(b.dataset.date, b.dataset.ptf); }; });
    [].forEach.call(scope.querySelectorAll('[data-ptb]'), function (b) { b.onclick = function () { if (afterClose) afterClose(); openPtInfo(b.dataset.date, b.dataset.ptb); }; });
    [].forEach.call(scope.querySelectorAll('[data-go]'), function (b) { b.onclick = function () { if (afterClose) afterClose(); S.sel = b.dataset.go; S.anchor = S.sel; S.view = 'day'; render(); }; });
    [].forEach.call(scope.querySelectorAll('[data-side]'), function (b) { b.onclick = function () { S.side = b.dataset.side; if (afterClose) { afterClose(); openDaySheet(S.sel); } else render(); }; });
  }

  // ---------- pannello del giorno ----------
  function ringSvg(p) {
    var r = 29, c = 2 * Math.PI * r, o = c * (1 - p / 100);
    return '<svg class="gcRing" viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="' + r + '" fill="none" stroke="var(--line2)" stroke-width="7"/><circle cx="36" cy="36" r="' + r + '" fill="none" stroke="' + (p >= 95 ? 'var(--danger)' : 'var(--accent)') + '" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + o.toFixed(1) + '" transform="rotate(-90 36 36)"/><text x="36" y="41" text-anchor="middle" font-size="15">' + p + '%</text></svg>';
  }
  function barHTML(n, cap) { return '<span class="gcBar"><i class="' + (n >= cap ? 'f' : '') + '" style="width:' + Math.min(100, Math.round(n / (cap || 1) * 100)) + '%"></i></span>'; }
  function sessRow(s, d) {
    return '<button type="button" class="gcSrow' + (s.cancelled ? ' off' : '') + '" data-sess="' + s.schedule_id + '" data-date="' + d + '"><span class="gcDt">' + s.time + '</span><span class="gcSb"><b><span class="gcDot" style="background:' + col(s) + '"></span>' + esc(s.course.name) + '</b>' + barHTML(s.taken, s.capacity) + '</span><span class="gcCnt">' + (s.cancelled ? 'Annullata' : s.taken + '/' + s.capacity) + '</span></button>';
  }
  // Palestra senza corsi: nei calendari compaiono solo i Personal già prenotati (le ore libere si vedono quando si prenota)
  function onlyBooked() { return !!(G.OF && !G.OF().cls); }
  function ptRowsHTML(day) {
    var a = Array.isArray(day.pt) ? day.pt : null;
    if (!a) return '<p class="gxM">Carico...</p>';
    if (onlyBooked()) a = a.filter(function (p) { return !p.free; });
    if (onlyBooked() && !a.length) return '<p class="gxM">Nessun Personal prenotato.</p>';
    return a.map(function (p) {
      if (!p.free) return '<button type="button" class="gcSrow" data-ptb="' + p.time + '" data-date="' + day.date + '"><span class="gcDt">' + p.time + '</span><span class="gcSb"><b>Personal 1:1</b><span class="gxM">' + esc(p.name) + '</span></span></button>';
      return '<button type="button" class="gcSrow free" data-ptf="' + p.time + '" data-date="' + day.date + '"' + (isStarted(day.date, p.time) ? ' disabled' : '') + '><span class="gcDt">' + p.time + '</span><span class="gcSb"><b><span class="gcDot"></span>Personal 1:1</b><span class="gxM">Libero · tocca per prenotare</span></span></button>';
    }).join('') || '<p class="gxM">Nessuna ora disponibile.</p>';
  }
  function sideHTML(d, closable) {
    var day = getDay(d) || { date: d, sessions: [], pt: [], closed: true }, st = dayStats(day), ss = day.sessions || [];
    var body = S.side === 'lez' ? (ss.map(function (s) { return sessRow(s, d); }).join('') || '<p class="gxM">Nessuna lezione: la palestra è chiusa.</p>') : ptRowsHTML(day);
    return '<div class="gcSideHd"><h2>' + fmtLong(d) + '</h2>' + (closable ? '<button type="button" class="gcX" data-close aria-label="Chiudi">×</button>' : '') + '</div>' +
      (onlyBooked() ? '<div class="gcRingBox">' + ringSvg(0) + '<div><b>' + (ptStats(day).booked ? ptStats(day).booked + (ptStats(day).booked === 1 ? ' Personal prenotato' : ' Personal prenotati') : day.closed ? 'Chiuso' : 'Nessun Personal') + '</b></div></div>' : '<div class="gcRingBox">' + ringSvg(st.pct) + '<div><b>' + (st.n ? st.b + ' prenotazioni' : 'Chiuso') + '</b><div class="gxM">' + (st.n ? st.n + (st.n === 1 ? ' lezione' : ' lezioni') + ' · ' + st.cap + ' posti' : '') + '</div></div></div>') +
      '<div class="gcSeg gcMini"><button type="button" data-side="lez" aria-pressed="' + (S.side === 'lez') + '">Lezioni</button><button type="button" data-side="pt" aria-pressed="' + (S.side === 'pt') + '">Personal 1:1</button></div>' +
      '<div class="gcStk">' + body + '</div><button type="button" class="gcGhost block" data-go="' + d + '">Vedi tutta la giornata</button>';
  }
  function openDaySheet(d) {
    var go = function () {
      var close = G.sheet(fmtLong(d), function (w, c) {
        var box = el('div', 'gcStk'); box.innerHTML = sideHTML(d, false).replace(/<div class="gcSideHd">.*?<\/div>/, ''); w.appendChild(box);
        bindActions(box, c);
      });
      return close;
    };
    if (have(d, d, true)) go(); else fetchRange(d, d, false).then(go).catch(function (e) { G.toast(e.message, 'bad'); });
  }

  // ---------- mese (stessa struttura e stesso stile del calendario di Lia) ----------
  function wkc(s) { var c = ck(s.course.category); return c === 'hyrox' ? 't' : c === 'pilates' ? 'u' : 'v'; }
  function ringTx(pct, big) {
    var C = 2 * Math.PI * (big ? 40 : 44), vb = big ? 96 : 104, c = vb / 2, r = big ? 40 : 44;
    return { C: C, html: '<svg viewBox="0 0 ' + vb + ' ' + vb + '" aria-hidden="true"><circle class="t" cx="' + c + '" cy="' + c + '" r="' + r + '"/><circle class="p" cx="' + c + '" cy="' + c + '" r="' + r + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + C.toFixed(2) + '"/></svg><b>' + pct + '%</b>' };
  }
  function animRing(scope, sel, C, pct) { requestAnimationFrame(function () { requestAnimationFrame(function () { var p = scope.querySelector(sel); if (p) p.style.strokeDashoffset = (C * (1 - pct / 100)).toFixed(2); }); }); }
  function sideRows(d) {
    var day = getDay(d) || { date: d, sessions: [], pt: [], closed: true }, ss = day.sessions || [], out = '';
    if (S.side === 'lez') {
      ss.forEach(function (s) {
        var sub = s.cancelled ? (s.cancel_reason || 'Annullata') : s.taken + '/' + s.capacity + ' iscritti' + (s.taken >= s.capacity ? ' · completa' : '');
        out += '<button type="button" class="msRow" data-sess="' + s.schedule_id + '" data-date="' + d + '"><span class="msDot wkd wkc-' + wkc(s) + '"></span><span class="msTm">' + s.time + '</span><span class="msNm"><b>' + esc(s.course.name) + '</b><small>' + esc(sub) + '</small></span>' + CH.r15 + '</button>';
      });
      return out || '<div class="msEmpty">' + (day.closed ? 'Palestra chiusa' : 'Nessuna lezione in questo giorno') + '</div>';
    }
    var a = Array.isArray(day.pt) ? day.pt : null;
    if (!a) return '<div class="msEmpty">Carico...</div>';
    a.forEach(function (p) {
      var started = isStarted(d, p.time);
      if (p.free && onlyBooked()) return;
      if (p.free) out += '<button type="button" class="msRow" data-ptf="' + p.time + '" data-date="' + d + '"' + (started ? ' disabled' : '') + '><span class="msDot wkd wkc-a"></span><span class="msTm">' + p.time + '</span><span class="msNm"><b>Personal 1:1</b><small>Libero · tocca per prenotare</small></span>' + CH.r15 + '</button>';
      else out += '<button type="button" class="msRow" data-ptb="' + p.time + '" data-date="' + d + '"><span class="msDot wkd wkc-a"></span><span class="msTm">' + p.time + '</span><span class="msNm"><b>' + esc(p.name) + '</b><small>Personal 1:1</small></span>' + CH.r15 + '</button>';
    });
    return out || '<div class="msEmpty">Nessuna ora disponibile</div>';
  }
  function sideBody(d, wk) {
    var day = getDay(d) || { date: d, sessions: [], pt: [], closed: true }, st = dayStats(day), x = parse(d), rg = ringTx(st.pct, wk);
    var free = Math.max(0, st.cap - st.b);
    var seg = '<div class="seg gcMiniSeg"><button type="button" data-side="lez" aria-pressed="' + (S.side === 'lez') + '">Lezioni</button><button type="button" data-side="pt" aria-pressed="' + (S.side === 'pt') + '">Personal 1:1</button></div>';
    return { C: rg.C, html: '<div class="msWd">' + cap1(G.DL[x.getDay()]) + '</div><h2 class="msDate">' + x.getDate() + ' ' + cap1(G.MO[x.getMonth()]) + ' ' + x.getFullYear() + '</h2>' +
      (wk ? (function () { var ps = ptStats(day); return '<div class="wkKp"><div><b>' + st.n + '</b><span>' + (st.n === 1 ? 'lezione' : 'lezioni') + '</span></div><div><b>' + st.b + '</b><span>iscritti</span></div><div><b>' + Math.max(0, ps.total - ps.booked) + '</b><span>ore Personal libere</span></div></div>'; })() : '<div class="msRing"><div class="msRingW">' + rg.html + '</div><div class="msTx"><strong>Occupazione</strong><span>' + (st.n ? st.b + ' su ' + st.cap + ' posti' : 'Chiuso') + '</span></div></div>') +
      '<div class="msLh"><div class="msCount"><b>' + (wk ? 'Della giornata' : st.n + (st.n === 1 ? ' lezione' : ' lezioni')) + '</b>' + (wk ? '' : '<small class="msOccTx">' + (st.n ? st.b + ' prenotazioni · ' + free + ' posti liberi' : 'Chiuso') + '</small>') + '</div><button type="button" class="msNew gNewB">' + CH.plus + 'Nuovo</button></div>' + seg +
      '<div class="' + (wk ? 'wkList' : 'msList') + '">' + sideRows(d).replace(/class="msRow"/g, wk ? 'class="wkRow"' : 'class="msRow"') + '</div>', pct: st.pct };
  }
  function monthSideHTML(d) {
    var b = sideBody(d, false);
    return { C: b.C, pct: b.pct, html: '<button type="button" class="msHandle" aria-label="Chiudi"><i></i></button><button type="button" class="msClose" aria-label="Chiudi">' + CH.x + '</button><div class="msBody">' + b.html + '</div><div class="msFoot"><button type="button" class="msCta" data-go="' + d + '"><span>Vedi tutta la giornata</span>' + CH.r16 + '</button></div>' };
  }
  function monthDraw(body) {
    var m = parse(S.anchor), mo = m.getMonth(), r = range(), cells = '';
    var rows = Math.round((parse(r.to).getTime() - parse(r.from).getTime()) / 864e5 / 7 + 1 / 7);
    for (var i = 0; i < rows * 7; i++) {
      var d = addDays(r.from, i), x = parse(d), out = x.getMonth() !== mo, day = getDay(d) || { sessions: [], closed: true }, st = dayStats(day), closed = !!day.closed || !st.n;
      var isT = d === today(), past = !out && !isT && d < today(), fut = !out && !isT && d > today();
      var occ = st.pct >= 70 ? 'occ-hi' : st.pct >= 40 ? 'occ-mid' : 'occ-lo';
      var ls = '', dots = '';
      if (!closed) {
        var ss = (day.sessions || []).filter(function (z) { return !z.cancelled; }), seen = {}, anyFull = false;
        ss.forEach(function (z) { var k = ck(z.course.category); if (z.taken >= z.capacity) anyFull = true; if (!seen[k]) { seen[k] = 1; dots += '<u class="mzc-' + k + '"></u>'; } });
        ls = '<span class="mzN">' + st.n + ' lez.</span><span class="mzDots">' + dots + '</span>' + (anyFull ? '<span class="mzFull">Pieno</span>' : '');
      }
      cells += '<button type="button" class="month-cell mzCell' + (out ? ' outside' : '') + (isT ? ' today' : '') + (past ? ' past' : '') + (fut ? ' future' : '') + (st.n ? ' has-events' : '') + (closed ? ' is-closed' : '') + (d === S.sel ? ' sel' : '') + '" data-mc="' + d + '" aria-label="' + fmtLong(d) + '">' +
        '<span class="month-cell-top"><span class="dnum">' + x.getDate() + '</span></span><span class="mzLs">' + ls + '</span><span class="month-closed">' + (closed ? 'Chiuso' : '') + '</span></button>';
    }
    var dw = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(function (t) { return '<span>' + t + '</span>'; }).join('');
    body.innerHTML = '<div class="month-wrap"><div class="month-hero"></div><div class="month-dow">' + dw + '</div><div class="month-grid" style="--rows:' + rows + '">' + cells + '</div><aside class="monthSide" aria-label="Giorno selezionato"></aside></div>';
    var side = body.querySelector('.monthSide'), sb = monthSideHTML(S.sel);
    side.innerHTML = sb.html; animRing(side, '.msRing .p', sb.C, sb.pct);
    [].forEach.call(body.querySelectorAll('[data-mc]'), function (b) { b.onclick = function () { var d = b.dataset.mc; S.sel = d; if (parse(d).getMonth() !== parse(S.anchor).getMonth()) S.anchor = monthOf(d); render(); if (phone()) openDaySheet(d); }; });
    side.onclick = function (ev) {
      if (ev.target.closest('.msClose') || ev.target.closest('.msHandle')) { S.sideOpen = false; root.classList.remove('sideOpen'); return; }
      if (ev.target.closest('.gNewB')) { openNew(); return; }
    };
    bindActions(side);
    var grid = body.querySelector('.month-grid'); drawRings(grid);
    if (window.ResizeObserver) { try { new ResizeObserver(function () { drawRings(grid); }).observe(grid); } catch (e) { } }
  }
  function drawRings(g) {
    try {
      var cs = g.querySelectorAll('.month-cell');
      for (var i = 0; i < cs.length; i++) {
        var c = cs[i], old = c.querySelector('.month-ring'); if (old) old.parentNode.removeChild(old);
        var v = c.getAttribute('data-ring'); if (!v && v !== '0') continue;
        var w = c.offsetWidth, hh = c.offsetHeight; if (w < 20 || hh < 20) continue;
        var p = Math.max(0, Math.min(100, Number(v) || 0)), s = 1.5, r = Math.min(9, w / 2 - s), x1 = w - s, y1 = hh - s;
        var d = 'M' + (w / 2) + ' ' + s + ' H' + (x1 - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + x1 + ' ' + (s + r) + ' V' + (y1 - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (x1 - r) + ' ' + y1 + ' H' + (s + r) + ' A' + r + ' ' + r + ' 0 0 1 ' + s + ' ' + (y1 - r) + ' V' + (s + r) + ' A' + r + ' ' + r + ' 0 0 1 ' + (s + r) + ' ' + s + ' Z';
        c.insertAdjacentHTML('beforeend', '<svg class="month-ring" viewBox="0 0 ' + w + ' ' + hh + '" aria-hidden="true"><rect x="' + s + '" y="' + s + '" width="' + (w - 2 * s) + '" height="' + (hh - 2 * s) + '" rx="' + r + '"/>' + (p > 0 ? '<path d="' + d + '" pathLength="100" stroke-dasharray="' + p + ' 100"/>' : '') + '</svg>');
      }
    } catch (e) { }
  }

  // ---------- giorno ----------
  function dayHTML() {
    var d = S.anchor, day = getDay(d) || { sessions: [], pt: [], closed: true }, ss = day.sessions || [], isT = d === today();
    var live = ss.filter(function (s) { return !s.cancelled; });
    var items = ss.map(function (s) { return { t: s.time, s: s }; });
    (Array.isArray(day.pt) ? day.pt : []).forEach(function (p) { if (p.free) return; items.push({ t: p.time, pt: p }); });
    items.sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
    var nxt = live.filter(function (s) { return !isStarted(d, s.time); })[0];
    var left = live.filter(function (s) { return !isEnded(d, s.time, s.duration_min); }).length;
    var ob = onlyBooked(), ptB = ob ? (Array.isArray(day.pt) ? day.pt : []).filter(function (p) { return !p.free; }) : [];
    var ptNext = ptB.filter(function (p) { return !isStarted(d, p.time); })[0], ptLeft = ptB.filter(function (p) { return !isEnded(d, p.time, 60); }).length;
    var hero = ob ?
      '<div class="gcHero"><div><span class="gcKick">' + (isT ? 'La tua giornata' : 'Agenda') + '</span><h2>' + ptB.length + (ptB.length === 1 ? ' sessione' : ' sessioni') + '</h2>' + (isT && ptB.length ? '<div class="gxM" style="margin-top:4px">' + ptLeft + ' rimaste</div>' : '') + '</div><div><span class="gcKick">' + (ptNext ? 'Prossima' : 'Stato') + '</span>' +
      (ptNext ? '<strong>' + ptNext.time + ' · ' + esc(ptNext.name) + '</strong>' : '<strong>' + (ptB.length ? 'Sessioni concluse' : day.closed ? 'Giorno di chiusura' : 'Nessuna sessione') + '</strong>') + '</div></div>' :
      '<div class="gcHero"><div><span class="gcKick">' + (isT ? 'La tua giornata' : 'Agenda') + '</span><h2>' + live.length + (live.length === 1 ? ' lezione' : ' lezioni') + '</h2>' + (isT && live.length ? '<div class="gxM" style="margin-top:4px">' + left + ' rimaste</div>' : '') + '</div><div><span class="gcKick">' + (nxt ? 'Prossima' : 'Stato') + '</span>' +
      (nxt ? '<strong>' + nxt.time + ' · ' + esc(nxt.course.name) + '</strong><div class="gxM">' + (isT ? 'tra ' + Math.max(0, mins(nxt.time) - nowMin()) + ' min · ' : '') + nxt.taken + '/' + nxt.capacity + ' iscritti</div>' : '<strong>' + (live.length ? 'Lezioni concluse' : 'Palestra chiusa') + '</strong>') + '</div></div>';
    if (day.closed) return '<p class="gxM" style="text-align:center;padding:24px">' + (ob ? 'In questo giorno non ricevi: è un giorno di chiusura.' : 'In questo giorno non ci sono lezioni in programma: la palestra è chiusa.') + '</p>';
    if (ob && !ptB.length) return '<p class="gxM" style="text-align:center;padding:24px">Nessun Personal prenotato in questo giorno. Per prenotarne uno tocca il pulsante +.</p>';
    if (!items.length) return '<p class="gxM" style="text-align:center;padding:32px 24px">Nessuna lezione in questo giorno. Tocca il pulsante + per prenotare un Personal.</p>';
    var out = '', nowDone = false;
    var card = '';
    items.forEach(function (it) {
      var nowH = '';
      if (isT && !nowDone && mins(it.t) > nowMin()) { nowH = '<div class="gcNowbar">Adesso ' + hhmm(nowMin()) + '<i></i></div>'; nowDone = true; }
      if (it.s) {
        var s = it.s, pc = Math.round(s.taken / s.capacity * 100), past = isEnded(d, s.time, s.duration_min);
        card = '<button type="button" class="gcAc' + (past ? ' past' : '') + (s.cancelled ? ' off' : '') + hlCls(s.time, s.course.name) + '" style="--cc:' + col(s) + '" data-sess="' + s.schedule_id + '" data-date="' + d + '"><span class="gcAt"><b>' + s.time + '</b><span>' + endT(s.time, s.duration_min) + '</span></span><span class="gcAb"><span class="gcR"><b>' + esc(s.course.name) + '</b><span class="gcChip ' + (s.cancelled ? 'none' : s.taken >= s.capacity ? 'bad' : s.taken >= s.capacity - 3 ? 'warn' : 'ok') + '">' + (s.cancelled ? 'Annullata' : s.taken + '/' + s.capacity) + '</span></span>' + barHTML(s.taken, s.capacity) + '<span class="gxM">' + (s.cancelled ? (s.cancel_reason || 'Lezione annullata') : past ? 'Conclusa' : s.taken >= s.capacity ? 'Completa' : (s.capacity - s.taken) + ' posti liberi') + '</span></span></button>';
        var at = s.attendees || [];
        if (!s.cancelled) card = card.replace(/<\/button>$/, '<span class="gdPp">' + (at.length ? at.slice(0, 8).map(function (a) { var nm = String(a.name || '?').split(' '); return '<span class="gdP"><u>' + esc((nm[0] || '?').charAt(0) + (nm[1] || '').charAt(0)) + '</u>' + esc(nm[0] + (nm[1] ? ' ' + nm[1].charAt(0) + '.' : '')) + '</span>'; }).join('') + (at.length > 8 ? '<span class="gdP more">+' + (at.length - 8) + '</span>' : '') : '<span class="gdP none">Nessun iscritto</span>') + '</span></button>');
      } else {
        var p = it.pt, booked = !p.free;
        card = '<button type="button" class="gcAc pt' + (isEnded(d, p.time, 60) ? ' past' : '') + (booked ? hlCls(p.time, 'Personal 1:1') : '') + '" style="--cc:#C9A24B"' + (!booked && isStarted(d, p.time) ? ' disabled' : '') + ' ' + (booked ? 'data-ptb="' : 'data-ptf="') + p.time + '" data-date="' + d + '"><span class="gcAt"><b>' + p.time + '</b><span>' + endT(p.time, 60) + '</span></span><span class="gcAb"><span class="gcR"><b><span class="gcDot"></span>Personal 1:1</b><span class="gcChip ' + (booked ? 'ok' : 'none') + '">' + (booked ? 'Prenotato' : 'Libero') + '</span></span><span class="gxM">' + (booked ? esc(p.name) : 'Tocca per prenotare un iscritto') + '</span></span></button>';
      }
      var cc = it.s ? col(it.s) : '#C9A24B', te = it.s ? endT(it.s.time, it.s.duration_min) : endT(it.pt.time, 60);
      out += nowH + '<div class="gdR" style="--cc:' + cc + '"><div class="gdTm"><b>' + it.t + '</b><span>' + te + '</span></div><div class="gdRl"><i></i></div><div class="gdCd">' + card + '</div></div>';
    });
    if (isT && !nowDone && items.length) out += '<div class="gcNowbar">Adesso ' + hhmm(nowMin()) + '<i></i></div>';
    return '<div class="gcAg gdT">' + out + '</div>';
  }

  // ---------- settimana (stessa struttura e stesso stile del calendario di Lia) ----------
  function courseHTML(days, items, heads, byBand) {
    var rows = {}, order = [], BN = ['Mattina', 'Pomeriggio', 'Sera'], IS = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">', BI = [IS + '<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>', IS + '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>', IS + '<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>'];
    items.forEach(function (L, k) { L.forEach(function (x) {
      var bi = x.st < 720 ? 0 : x.st < 1050 ? 1 : 2;
      var key = byBand ? bi : (x.cat === 'pt' ? 'Personal' : x.name);
      if (!rows[key]) { rows[key] = { col: byBand ? 'var(--muted)' : (x.cat === 'pt' ? '#C9A24B' : x.col), d: [[], [], [], [], [], [], []], pt: !byBand && x.cat === 'pt', lo: 9999, hi: 0 }; order.push(key); }
      rows[key].d[k].push(x); rows[key].lo = Math.min(rows[key].lo, x.st); rows[key].hi = Math.max(rows[key].hi, x.st);
    }); });
    order.sort(function (p, q) { return byBand ? p - q : (rows[p].pt ? 1 : 0) - (rows[q].pt ? 1 : 0) || (p < q ? -1 : 1); });
    var h = '<div class="gkHd"><div class="gkFh">' + (byBand ? 'Fascia oraria' : 'Corso') + '</div>' + heads + '</div><div class="gkBody gkCb" style="--rows:' + order.length + '">';
    order.forEach(function (key) {
      var r = rows[key], n = 0; r.d.forEach(function (q) { n += q.length; });
      h += '<div class="gkCl' + (byBand ? ' band' : '') + '" style="--cc:' + r.col + '"><div class="gkClI">' + (byBand ? BI[key] : '') + '<b>' + (byBand ? BN[key] : esc(key)) + '</b><span>' + (byBand ? hhmm(r.lo) + ' – ' + hhmm(r.hi) : n + (n === 1 ? ' lezione' : ' lezioni')) + '</span></div></div>';
      r.d.forEach(function (q, k) {
        h += '<div class="gkCc' + (days[k].date === S.sel ? ' sel' : '') + (days[k].date === today() ? ' tod' : '') + (days[k].closed ? ' cls' : '') + '" data-i="' + k + '">' + (q.length ? '' : '<span class="gkEm">' + (days[k].closed ? 'Chiuso' : byBand ? 'Nessun corso' : '') + '</span>') + q.sort(function (x, y) { return x.st - y.st; }).map(function (x) {
          var cc = x.cat === 'pt' ? '#C9A24B' : x.col;
          return '<button type="button" class="gkK' + x.cls + (x.cat === 'pt' ? ' pt' : '') + '" ' + x.at + ' style="--cc:' + cc + '"><span class="gkR"><b>' + x.time + '</b><span class="gkS">' + esc(x.sub) + '</span></span>' + (byBand || r.pt ? '<span class="gkN">' + esc(x.name) + '</span>' : '') + (x.bar ? '<i class="gtP"><u style="width:' + x.pc + '%"></u></i>' : '') + '</button>';
        }).join('') + '</div>';
      });
    });
    return h + '</div>';
  }
  function weekDraw(body) {
    var a = wkStart(S.anchor), days = [], i;
    for (i = 0; i < 7; i++) days.push(getDay(addDays(a, i)) || { date: addDays(a, i), sessions: [], pt: [], closed: true });
    if (!(S.sel >= a && S.sel <= addDays(a, 6))) S.sel = a <= today() && today() <= addDays(a, 6) ? today() : a;
    var f = S.flt, heads = '', tot = [], items = [], any = false, lo = 24 * 60, hi = 0;
    days.forEach(function (dd, k) {
      var d = dd.date, st = dayStats(dd), L = [];
      (dd.sessions || []).forEach(function (s) {
        if (f !== 'all' && (s.course.category === 'personal' ? 'pt' : 'corsi') !== f) return;
        var full = !s.cancelled && s.taken >= s.capacity, du = s.duration_min || 60;
        L.push({ st: mins(s.time), du: du, cat: ck(s.course.category), col: courseCol(s.course.name), name: s.course.name, time: s.time,
          sub: s.cancelled ? 'Annullata' : full ? 'Pieno' : s.taken + '/' + s.capacity, bar: !s.cancelled, pc: s.capacity && !s.cancelled ? Math.min(100, Math.round(s.taken / s.capacity * 100)) : 0,
          cls: (isEnded(d, s.time, du) ? ' past' : '') + (s.cancelled ? ' off' : '') + (full ? ' full' : s.capacity && s.taken / s.capacity >= 0.8 ? ' nearly' : ''), at: 'data-sess="' + s.schedule_id + '" data-date="' + d + '"' });
      });
      if (f === 'all' || f === 'pt') (Array.isArray(dd.pt) ? dd.pt : []).forEach(function (p) {
        if (p.free) return; var nm = p.name.split(' ');
        L.push({ st: mins(p.time), du: 60, cat: 'pt', name: nm[0] + ' ' + (nm[1] || '').charAt(0) + '.', time: p.time, sub: '1:1', pc: 0,
          cls: isEnded(d, p.time, 60) ? ' past' : '', at: 'data-ptb="' + p.time + '" data-date="' + d + '"' });
      });
      L.forEach(function (x) { any = true; lo = Math.min(lo, x.st); hi = Math.max(hi, x.st + x.du); });
      items[k] = L;
      var pb = ptStats(dd).booked; tot[k] = dd.closed && !pb ? '—' : onlyBooked() ? (pb ? pb + (pb === 1 ? ' sessione' : ' sessioni') : '–') : st.n ? st.b + (st.b === 1 ? ' iscritto' : ' iscritti') : '–';
      var dots = '', seen = {}; L.forEach(function (x) { var c = x.cat === 'pt' ? '#C9A24B' : x.col; if (!seen[c]) { seen[c] = 1; dots += '<u style="background:' + c + '"></u>'; } });
      heads += '<button type="button" class="gtDh' + (d === S.sel ? ' sel' : '') + (d === today() ? ' today' : '') + '" data-i="' + k + '"><span class="dn">' + G.DN[dow(d)] + (d === today() ? ' · OGGI' : '') + '</span><span class="dd">' + parse(d).getDate() + '</span></button>';
    });
    var cmode = S.wm === 'course';
    var used = {}, ri = {}, rows = [], uh;
    items.forEach(function (L) { L.forEach(function (x) { for (uh = Math.floor(x.st / 60); uh < Math.ceil((x.st + x.du) / 60); uh++) used[uh] = 1; }); });
    Object.keys(used).map(Number).sort(function (m, n) { return m - n; }).forEach(function (h2) { ri[h2] = rows.length; rows.push(h2); });
    if (!rows.length) { for (uh = 8; uh < 14; uh++) { ri[uh] = rows.length; rows.push(uh); } }
    var hrs = rows.length, hl = '';
    rows.forEach(function (h2, q2) { hl += '<span style="top:calc(' + q2 + ' * var(--hh))">' + ('0' + h2).slice(-2) + '</span>'; });
    function yOf(m) { var h2 = Math.floor(m / 60); return (ri[h2] === undefined ? 0 : ri[h2]) + (m % 60) / 60; }
    var cols = '<div class="gkHd"><div></div>' + heads + '</div><div class="gkBody gkTg" style="--hh:56px;--hrs:' + hrs + '"><div class="gkHr">' + hl + '</div>';
    days.forEach(function (dd, k) {
      var L = items[k].sort(function (x, y) { return x.st - y.st || y.du - x.du; }), out = '';
      L.forEach(function (x) {
        var c = x.cat === 'pt' ? '#C9A24B' : x.col;
        out += '<button type="button" class="gkK' + x.cls + '" ' + x.at + ' style="--cc:' + c + ';top:calc(' + yOf(x.st) + ' * var(--hh));height:calc(' + (x.du / 60) + ' * var(--hh) - 3px)"><span class="gkR"><b>' + x.time + '</b><span class="gkS">' + esc(x.sub) + '</span></span><span class="gkN">' + esc(x.name) + '</span></button>';
      });
      if (!L.length) out = '<span class="gkRest">' + (dd.closed ? 'Chiuso' : 'Riposo') + '</span>';
      if (dd.date === today() && ri[Math.floor(nowMin() / 60)] !== undefined) out += '<i class="gkNow" style="top:calc(' + yOf(nowMin()) + ' * var(--hh))"></i>';
      cols += '<div class="gkCol' + (dd.date === S.sel ? ' sel' : '') + (dd.date === today() ? ' tod' : '') + (dd.closed ? ' closed' : '') + '" data-i="' + k + '">' + out + '</div>';
    });
    cols += '</div>';
    cols = courseHTML(days, items, heads, !cmode);
    if (!any) cols += '<p class="gxM" style="text-align:center;padding:28px">Nessuna lezione in questa settimana.</p>';
    cols += '<div class="gtTot gkTot"><div></div>' + tot.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div>';
    var fl = flist(), nof = fl.length < 2;
    var opts = '<option value="all">Tutti</option>' + fl.map(function (k2) { return '<option value="' + k2[0] + '"' + (S.flt === k2[0] ? ' selected' : '') + '>' + k2[1] + '</option>'; }).join('');
    var legend = fl.map(function (k2) { return k2[0] === 'pt' ? '<u class="c4"></u>Personal' : '<u class="' + (ck(k2[0]) === 'hyrox' ? 'c2' : ck(k2[0]) === 'pilates' ? 'c3' : 'c1') + '"></u>' + k2[1]; }).join('');
    body.innerHTML = '<div class="week-wrap"><div class="wkNew">' + (nof ? '' : '<div class="wkFilter gkChips" style="display:flex">' + [['all', 'Tutti']].concat(fl).map(function (k2) { return '<button type="button" class="gkChip' + (S.flt === k2[0] ? ' on' : '') + '" data-f="' + k2[0] + '">' + (k2[0] === 'pt' ? '<u class="gkDot c4"></u>' : '') + k2[1] + '</button>'; }).join('') + '</div>') + '<div class="wkMain"><div class="wkScroll gwkScroll"><div class="gpw gtW gkCmode">' + cols + '</div></div><aside class="wkSide" aria-label="Giorno selezionato"></aside></div></div></div>';
    var grid = body.querySelector('.gpw'), side = body.querySelector('.wkSide');
    function drawSide() {
      var b = sideBody(S.sel, true);
      side.innerHTML = '<button type="button" class="wkHandle" aria-label="Chiudi"><i></i></button><button type="button" class="wkClose" aria-label="Chiudi">' + CH.x + '</button><div class="wkSBody">' + b.html + '</div><div class="wkFoot"><button type="button" class="msCta wkCta" data-go="' + S.sel + '"><span>Vedi tutta la giornata</span>' + CH.r16 + '</button></div>';
      animRing(side, '.wkRing .p', b.C, b.pct);
      bindActions(side);
    }
    drawSide();
    side.addEventListener('click', function (ev) {
      if (ev.target.closest('.wkClose') || ev.target.closest('.wkHandle')) { S.wkOpen = false; root.classList.remove('wkOpen'); return; }
      if (ev.target.closest('.gNewB')) openNew();
    });
    grid.addEventListener('click', function (ev) {
      var p = ev.target.closest('.gkK');
      var x = ev.target.closest('.gtDh,.gkCol,.gkCc');
      if (p) { if (p.dataset.sess) openSession(p.dataset.date, p.dataset.sess); else if (p.dataset.ptb) openPtInfo(p.dataset.date, p.dataset.ptb); return; }
      if (x) { var dd2 = addDays(a, +x.dataset.i); S.sel = dd2; S.wkOpen = true; root.classList.add('wkOpen'); drawSide(); [].forEach.call(grid.querySelectorAll('.gtDh,.gkCol,.gkCc'), function (e) { e.classList.toggle('sel', +e.dataset.i === +x.dataset.i); }); }
    });
    var scw = body.querySelector('.wkScroll'); if (scw) scw.scrollTop = 0;
    [].forEach.call(body.querySelectorAll('.gkChip'), function (c) { c.onclick = function () { S.flt = c.dataset.f; render(); }; });
    var wf = body.querySelector('.wkFilter'), wmain = body.querySelector('.wkMain'), bar = document.createElement('div');
    bar.className = 'gkBar';
    var fl2 = document.createElement('span'); fl2.className = 'gkFl'; fl2.textContent = 'Filtra:'; if (wf) { bar.appendChild(fl2); bar.appendChild(wf); }
    var vwSp = 1;
    var vw = document.createElement('div'); vw.className = 'gkVw'; vw.style.marginLeft = 'auto'; vw.innerHTML = '<button type="button" data-wm="grid" class="' + (cmode ? '' : 'on') + '">Griglia</button><button type="button" data-wm="course" class="' + (cmode ? 'on' : '') + '">Per corso</button>'; bar.appendChild(vw);
    if (wmain && wmain.parentNode) wmain.parentNode.insertBefore(bar, wmain);
    [].forEach.call(bar.querySelectorAll('[data-wm]'), function (bt) { bt.onclick = function () { S.wm = bt.dataset.wm; render(); }; });
    [].forEach.call(bar.querySelectorAll('.gkChip'), function (c) { c.onclick = function () { S.flt = c.dataset.f; render(); }; });
    (function () {
      var tg = body.querySelector('.gkTg'), hd = body.querySelector('.gkHd'), tt = body.querySelector('.gkTot'); if (hd) body.style.setProperty('--gkhh', hd.offsetHeight + 'px');
      if (scw) { var rc = scw.getBoundingClientRect(); scw.style.setProperty('height', Math.max(300, window.innerHeight - rc.top - 20) + 'px', 'important'); }
      var cb = body.querySelector('.gkCb');
      if (cb && scw) { var av2 = scw.clientHeight - (hd ? hd.offsetHeight : 0) - (tt ? tt.offsetHeight : 0) - 28, nr = cb.querySelectorAll('.gkCl').length || 1; cb.style.minHeight = '0px'; return; }
      if (!scw || !tg) return;
      var av = scw.clientHeight - (hd ? hd.offsetHeight : 0) - (tt ? tt.offsetHeight : 0) - 28, h = Math.floor(av / hrs);
      var hh = Math.max(44, Math.min(110, h || 60)); tg.style.setProperty('--hh', hh + 'px'); tg.classList.toggle('tall', hh >= 56);
    })();
  }
  function weekPhone() {
    var a = wkStart(S.anchor), tot = 0, rows = '';
    for (var i = 0; i < 7; i++) {
      var d = addDays(a, i), day = getDay(d) || { sessions: [], pt: [], closed: true }, st = dayStats(day);
      if (i === 6 && day.closed) continue;
      tot += st.b;
      var its = [];
      (day.sessions || []).forEach(function (s) { its.push({ t: s.time, s: s }); });
      (Array.isArray(day.pt) ? day.pt : []).forEach(function (p) { if (!p.free) its.push({ t: p.time, p: p }); });
      its.sort(function (x, y) { return x.t < y.t ? -1 : x.t > y.t ? 1 : 0; });
      var parts = its.map(function (x) {
        if (x.p) { var nm = x.p.name.split(' '); return { pt: 1, h: '<button type="button" class="gpmR gpmPt" data-ptb="' + x.t + '" data-date="' + d + '"><b>' + x.t + '</b><span class="gpmN"><em>' + esc(nm[0] + ' ' + (nm[1] || '').charAt(0) + '.') + '</em><small>Personal 1:1</small></span><span class="gpmIc"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg></span></button>' }; }
        var s = x.s, full = !s.cancelled && s.taken >= s.capacity, pc = s.capacity ? Math.min(100, Math.round(s.taken / s.capacity * 100)) : 0;
        return { h: '<button type="button" class="gpmR' + (s.cancelled ? ' off' : '') + (isEnded(d, s.time, s.duration_min) ? ' past' : '') + '" style="--cc:' + col(s) + '" data-sess="' + s.schedule_id + '" data-date="' + d + '"><b>' + s.time + '</b><span class="gpmN">' + esc(s.course.name) + '</span><span class="gpmB"><i style="width:' + (s.cancelled ? 0 : pc) + '%"></i></span><s' + (full ? ' class="full"' : '') + '>' + (s.cancelled ? 'annullata' : s.taken + '/' + s.capacity) + '</s></button>' };
      });
      var body = '', open = false;
      parts.forEach(function (q) { if (q.pt && !open) { body += '<div class="gpmBand">'; open = true; } else if (!q.pt && open) { body += '</div>'; open = false; } body += q.h; });
      if (open) body += '</div>';
      rows += '<div class="gpmD' + (d === today() ? ' tod' : '') + (day.closed || !its.length ? ' none' : '') + '"><button type="button" class="gpmH" data-go="' + d + '"><span class="gpmDn">' + G.DN[dow(d)] + '</span><span class="gpmDd">' + parse(d).getDate() + '</span><span class="gpmOc">' + (day.closed ? 'Chiuso' : st.n ? st.b + '/' + st.cap + ' posti' : 'Nessuna lezione') + '</span><span class="gpmCh">›</span></button>' + (body ? '<div class="gpmL">' + body + '</div>' : '') + '</div>';
    }
    return '<div class="gcOv"><span class="gcKick">Prenotazioni</span><b class="gcBig">' + tot + '</b></div>' + rows;
  }

  // ---------- scelta dell'iscritto ----------
  function memberChip(m) { return '<span class="gcChip ' + (m.status.s === 'none' ? 'none' : m.status.s) + '">' + esc(m.status.label) + '</span>'; }
  function pickMember(title, reason, onPick, onBack, only, emptyMsg) {
    if (!G.S.data) { G.load().then(function () { pickMember(title, reason, onPick, onBack, only, emptyMsg); }).catch(function (e) { G.toast(e.message, 'bad'); }); return; }
    var q = '';
    G.sheet(title, function (w, close) {
      var inp = G.inp('search', '', 'Cerca per nome o telefono'); inp.className = 'gxSearch'; w.appendChild(inp);
      var box = el('div'); w.appendChild(box);
      function draw() {
        box.textContent = '';
        var L = G.S.data.members.filter(function (m) { return (!only || only(m)) && (!q || (m.first_name + ' ' + m.last_name + ' ' + m.phone).toLowerCase().indexOf(q) >= 0); }).slice(0, 40);
        if (!L.length) box.appendChild(el('p', 'gxM', !q && emptyMsg ? emptyMsg : 'Nessun iscritto trovato.'));
        L.forEach(function (m) {
          var rs = reason(m), b = el('button', 'gxCard gxMc'); b.type = 'button'; if (rs) b.style.opacity = '.6';
          b.innerHTML = '<div class="gxRow"><div><b class="gxT">' + esc(m.first_name + ' ' + m.last_name) + '</b><div class="gxM">' + esc(m.phone) + '</div></div>' + memberChip(m) + '</div>' + (rs ? '<div class="gcErr">' + esc(rs) + '</div>' : '');
          b.onclick = function () { if (rs) { G.toast(rs, 'bad'); return; } close(); onPick(m); };
          box.appendChild(b);
        });
      }
      inp.oninput = function () { q = inp.value.toLowerCase(); draw(); };
      draw();
      if (onBack) { var bb = G.btn('Indietro', 'ghost block', function () { close(); onBack(); }); bb.style.marginTop = '6px'; w.appendChild(bb); }
    });
  }
  function noSub(m) { return m.status.s === 'bad' || m.status.s === 'none' ? (m.status.s === 'none' ? 'Nessun abbonamento.' : 'Abbonamento scaduto.') : ''; }

  // ---------- lezione ----------
  function findSession(d, sid) { var day = getDay(d); return day ? (day.sessions || []).filter(function (s) { return s.schedule_id === sid; })[0] : null; }
  function openSession(d, sid) {
    if (Date.now() < (window.__liaNoOpen || 0)) return;
    var go = function () {
      var s = findSession(d, sid); if (!s || !s.attendees) { G.toast('Lezione non trovata.', 'bad'); return; }
      var over = isEnded(d, s.time, s.duration_min), started = isStarted(d, s.time);
      G.sheet(s.course.name, function (w, close) {
        w.classList.add('gxSes'); w.style.setProperty('--sc', col(s));
        var X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
        var kick = s.cancelled ? 'Annullata' : over ? 'Conclusa' : started ? 'In corso' : 'Corso di gruppo';
        var hd = el('div', 'gsH'); hd.innerHTML = '<div class="gsHt"><span class="gsK">' + kick + '</span><b class="gsN">' + esc(s.course.name) + '</b><span class="gsS"><span class="gsM"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>' + fmtLong(d) + '</span><span class="gsM"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' + s.time + '–' + endT(s.time, s.duration_min) + '</span></span></div>';
        var xb = el('button', 'gsX'); xb.type = 'button'; xb.setAttribute('aria-label', 'Chiudi'); xb.innerHTML = X; xb.onclick = close; hd.appendChild(xb); w.appendChild(hd);
        var free = s.capacity - s.taken, oc = el('div', 'gsOc');
        var pcs = s.capacity ? Math.min(100, Math.round(s.taken / s.capacity * 100)) : 0, tone = s.cancelled || over ? 'mu' : free <= 0 ? 'bad' : pcs >= 80 ? 'warn' : 'ok';
        var lab = s.cancelled ? 'Annullata' : over ? 'Conclusa' : free <= 0 ? 'Completa' : pcs >= 80 ? 'Ultimi posti' : 'Disponibile';
        oc.className = 'gsOc gsCap ' + tone;
        oc.innerHTML = '<div class="gsCapR"><div class="gsCapN"><b>' + s.taken + '</b><span>/ ' + s.capacity + ' posti prenotati</span></div><em class="gsCapT">' + lab + '</em></div><div class="gsCapB"><u style="width:' + pcs + '%"></u></div><div class="gsCapF"><span>Posti liberi: <b>' + Math.max(0, free) + '</b></span></div>';
        w.appendChild(oc);
        if (s.cancelled && s.cancel_reason) { var cr = el('div', 'gsCr', 'Motivo: ' + s.cancel_reason); w.appendChild(cr); }
        w.appendChild(el('div', 'gsL', 'Partecipanti prenotati (' + s.attendees.length + ')'));
        var list = el('div', 'gsList');
        if (!s.attendees.length) list.appendChild(el('p', 'gsEmpty', 'Nessun iscritto per ora.'));
        var cf = el('div', 'gsCf');
        s.attendees.forEach(function (a) {
          var pp = String(a.name || '').trim().split(/\s+/), ini = ((pp[0] || '?').charAt(0) + (pp.length > 1 ? pp[pp.length - 1].charAt(0) : '')).toUpperCase();
          var row = el('div', 'gsRow' + (a.no_show ? ' gcNs' : '')), nm = el('div', 'gsWho');
          row.appendChild(el('span', 'gsAv', ini));
          nm.appendChild(el('b', 'gcNm', a.name)); var ph = el('small'); String(a.phone || '').split(' ').forEach(function (t, ix) { if (ix) ph.appendChild(document.createTextNode(' ')); ph.appendChild(el('span', null, t)); }); nm.appendChild(ph); row.appendChild(nm);
          if (over) { /* lezione conclusa: nessuna azione sul singolo iscritto */ }
          else {
            var rm = el('button', 'gsRm'); rm.type = 'button'; rm.setAttribute('aria-label', 'Togli ' + a.name); rm.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>';
            rm.onclick = function () { cf.innerHTML = ''; G.confirmBar(cf, 'Togliere ' + a.name + ' da questa lezione? Se aveva usato un ingresso, gli torna.', function () { G.act({ action: 'booking_cancel', booking_id: a.booking_id, member_id: a.member_id }, 'Tolto.').then(function () { bust(); close(); render(); setTimeout(function () { openSession(d, sid); }, 30); }); }); };
            row.appendChild(rm);
          }
          list.appendChild(row);
        });
        w.appendChild(list); w.appendChild(cf);
        var ac = el('div', 'gsFt');
        if (s.cancelled) ac.appendChild(G.btn('Riattiva lezione', 'gsPri', function () { G.act({ action: 'session_restore', schedule_id: s.schedule_id, date: d }, 'Lezione riattivata.').then(function () { bust(); close(); render(); }); }));
        else if (!over) {
          var ac2 = el('div', 'gsFt2');
          ac2.appendChild(G.btn('Aggiungi un iscritto', 'gsPri', function () { close(); addToSession(d, s); }));
          ac2.appendChild(G.btn('Annulla lezione', 'gsDng', function () { cancelSession(cf, close, d, s); }));
          ac.appendChild(ac2);
        }
        w.appendChild(ac);
      });
    };
    if (have(d, d, true)) go(); else fetchRange(d, d, false).then(go).catch(function (e) { G.toast(e.message, 'bad'); });
  }
  function cancelSession(w, close, d, s) {
    if (w.querySelector('.gcCnf')) return;
    var box = el('div', 'gxWhy gcCnf'); box.appendChild(el('div', null, 'Annullare questa lezione? Gli iscritti prenotati vengono tolti e gli ingressi tornano disponibili. Non vengono avvisati in automatico.'));
    var r = G.inp('text', '', 'Motivo (facoltativo)'); r.style.marginTop = '8px'; box.appendChild(r);
    var a = el('div', 'gxActs'); a.appendChild(G.btn('Sì, annulla la lezione', 'danger sm', function () { G.act({ action: 'session_cancel', schedule_id: s.schedule_id, date: d, reason: r.value }, 'Lezione annullata.').then(function () { bust(); close(); render(); }); })); a.appendChild(G.btn('No, tieni', 'ghost sm', function () { box.remove(); })); box.appendChild(a); w.appendChild(box);
  }
  function addToSession(d, s) {
    var ids = {}; s.attendees.forEach(function (a) { ids[a.member_id] = 1; });
    pickMember('Aggiungi a ' + s.course.name + ' · ' + s.time, function (m) { return noSub(m) || (ids[m.id] ? 'È già prenotato.' : '') || (s.taken >= s.capacity ? 'La lezione è completa.' : ''); }, function (m) {
      G.api({ action: 'booking_add', member_id: m.id, schedule_id: s.schedule_id, date: d }).then(function () { G.toast(m.first_name + ' ' + m.last_name + ' aggiunto alla lezione.', 'ok'); bust(); refreshMembers(); render(); setTimeout(function () { openSession(d, s.schedule_id); }, 60); }).catch(function (e) { G.toast(e.message, 'bad'); setTimeout(function () { openSession(d, s.schedule_id); }, 60); });
    }, function () { openSession(d, s.schedule_id); });
  }
  function refreshMembers() { G.load().catch(function () {}); }

  // ---------- Personal 1:1 ----------
  function openPtBook(d, t) {
    if (Date.now() < (window.__liaNoOpen || 0)) return;
    var hasPt = function (m) { return (m.plans || []).some(function (p) { return p.valid && (p.covers || []).indexOf('personal') >= 0; }); };
    pickMember('Personal 1:1 · ' + fmtShort(d) + ' ' + t, noSub, function (m) {
      G.api({ action: 'pt_book', member_id: m.id, date: d, time: t }).then(function () { G.toast('Personal 1:1 prenotato per ' + m.first_name + ' ' + m.last_name + '.', 'ok'); bust(); refreshMembers(); render(); }).catch(function (e) { G.toast(e.message, 'bad'); });
    }, null, hasPt, 'Nessun iscritto con un Piano Personal attivo. Assegnalo dalla scheda dell\'iscritto, in Abbonamenti.');
  }
  function openPtInfo(d, t) {
    if (Date.now() < (window.__liaNoOpen || 0)) return;
    var go = function () {
      var day = getDay(d), p = day && Array.isArray(day.pt) ? day.pt.filter(function (x) { return x.time === t; })[0] : null;
      if (!p || p.free) { G.toast('Prenotazione non trovata.', 'bad'); return; }
      var over = isEnded(d, t, 60);
      G.sheet('Personal 1:1', function (w, close) {
        w.classList.add('gxSes'); w.style.setProperty('--sc', '#C9A24B');
        var X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
        var hd = el('div', 'gsH'); hd.innerHTML = '<div class="gsHt"><span class="gsK">' + (over ? 'Conclusa' : 'Personal 1:1') + '</span><b class="gsN">Personal 1:1</b><span class="gsS"><span class="gsM"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>' + fmtLong(d) + '</span><span class="gsM"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' + t + '–' + endT(t, 60) + '</span></span></div>';
        var xb = el('button', 'gsX'); xb.type = 'button'; xb.setAttribute('aria-label', 'Chiudi'); xb.innerHTML = X; xb.onclick = close; hd.appendChild(xb); w.appendChild(hd);
        w.appendChild(el('div', 'gsL', 'Iscritto'));
        var list = el('div', 'gsList'), pp = String(p.name || '').trim().split(/\s+/), ini = ((pp[0] || '?').charAt(0) + (pp.length > 1 ? pp[pp.length - 1].charAt(0) : '')).toUpperCase();
        var row = el('div', 'gsRow' + (p.no_show ? ' gcNs' : '')), nm = el('div', 'gsWho');
        row.appendChild(el('span', 'gsAv', ini));
        nm.appendChild(el('b', 'gcNm', p.name));
        var ph = el('small'); String(p.phone || '').split(' ').forEach(function (tk, ix) { if (ix) ph.appendChild(document.createTextNode(' ')); ph.appendChild(el('span', null, tk)); }); nm.appendChild(ph);
        row.appendChild(nm); list.appendChild(row); w.appendChild(list);
        var cf = el('div', 'gsCf'); w.appendChild(cf);
        var ac = el('div', 'gsFt');
        if (!over) {
          var ac2 = el('div', 'gsFt2'); ac2.style.gridTemplateColumns = '1fr';
          ac2.appendChild(G.btn('Annulla prenotazione', 'gsDng', function () { G.confirmBar(cf, 'Annullare il Personal di ' + p.name + '? Se aveva usato un ingresso, gli torna.', function () { G.act({ action: 'pt_cancel', booking_id: p.booking_id, member_id: p.member_id }, 'Prenotazione annullata.').then(function () { bust(); refreshMembers(); close(); render(); }); }); }));
          ac.appendChild(ac2);
        }
        w.appendChild(ac);
      });
    };
    if (have(d, d, true)) go(); else fetchRange(d, d, false).then(go).catch(function (e) { G.toast(e.message, 'bad'); });
  }

  // ---------- nuova prenotazione (da un iscritto alla prima lezione utile) ----------
  function openNew(pre, kind) {
    var hasPt0 = function (m) { return (m.plans || []).some(function (q) { return q.valid && (q.covers || []).indexOf('personal') >= 0; }); };
    var run = function (m) {
      var from = (S.view === 'day' && S.anchor > today()) ? S.anchor : today(), to = addDays(from, 42);
      var show = function () {
        var byDay = {}, days = [];
        for (var d = from; d <= to; d = addDays(d, 1)) {
          var day = getDay(d); if (!day) continue;
          var mPt = hasPt0(m);
          if (kind !== 'pt') day.sessions.forEach(function (s) { if (!s.cancelled && !isStarted(d, s.time)) (byDay[d] = byDay[d] || []).push({ d: d, s: s }); });
          if (kind !== 'cls' && mPt) (Array.isArray(day.pt) ? day.pt : []).forEach(function (q) { if (q.free && !isStarted(d, q.time)) (byDay[d] = byDay[d] || []).push({ d: d, pt: q }); });
        }
        Object.keys(byDay).forEach(function (k) { byDay[k].sort(function (a, b) { return (a.s ? a.s.time : a.pt.time) < (b.s ? b.s.time : b.pt.time) ? -1 : 1; }); days.push(k); });
        days.sort();
        G.sheet(m.first_name + ' ' + m.last_name, function (w, close) {
          w.classList.add('gkPick');
          var sub = el('div', 'gxM', kind === 'pt' ? 'Scegli il giorno del Personal' : 'Scegli il giorno della lezione'); sub.style.marginTop = '-6px'; w.appendChild(sub);
          if (!days.length) { w.appendChild(el('p', 'gxM', kind === 'pt' ? 'Nessun orario Personal libero nei prossimi giorni.' : 'Nessuna lezione libera nei prossimi giorni.')); return; }
          var pd = function (n) { return (n < 10 ? '0' : '') + n; };
          var f0 = parse(from), cur = { y: f0.getFullYear(), m: f0.getMonth() }, last = parse(days[days.length - 1]), selDay = null;
          var head = el('div', 'gkCalH'), grid = el('div', 'gkCalG'), hrs = el('div', 'gkHrsW');
          w.appendChild(head); w.appendChild(grid); w.appendChild(hrs);
          function drawHours() {
            hrs.textContent = '';
            if (!selDay) { hrs.appendChild(el('p', 'gkHint', 'Tocca un giorno evidenziato per vedere gli orari disponibili.')); return; }
            hrs.appendChild(el('div', 'gkHrsT', cap1(fmtLong(selDay)) + ' · orari disponibili'));
            var box = el('div', 'gkHrs');
            byDay[selDay].forEach(function (x) {
              var label = x.s ? x.s.course.name : 'Personal 1:1', t = x.s ? x.s.time : x.pt.time, full = x.s && x.s.taken >= x.s.capacity, mine = x.s && x.s.attendees && x.s.attendees.some(function (a) { return a.member_id === m.id; });
              var b = el('button', 'gkHr' + (full || mine ? ' off' : '')); b.type = 'button';
              b.innerHTML = '<b>' + t + '</b><span>' + esc(label) + '</span><small>' + (x.s ? (mine ? 'Già prenotato' : full ? 'Completa' : (x.s.capacity - x.s.taken) + ' posti liberi') : 'Libero') + '</small>';
              b.onclick = function () {
                if (full || mine) { G.toast(full ? 'Lezione completa.' : 'È già prenotato.', 'bad'); return; }
                var body = x.s ? { action: 'booking_add', member_id: m.id, schedule_id: x.s.schedule_id, date: x.d } : { action: 'pt_book', member_id: m.id, date: x.d, time: x.pt.time };
                G.api(body).then(function () { G.toast('Prenotato: ' + m.first_name + ' ' + m.last_name + ' · ' + label + '.', 'ok'); bust(); refreshMembers(); close(); render(); }).catch(function (e) { G.toast(e.message, 'bad'); });
              };
              box.appendChild(b);
            });
            hrs.appendChild(box);
          }
          function drawCal() {
            head.textContent = ''; grid.textContent = '';
            var pv = el('button', 'gkCalN'), nx = el('button', 'gkCalN'); pv.type = nx.type = 'button';
            pv.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>'; nx.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
            var atFirst = cur.y === f0.getFullYear() && cur.m === f0.getMonth(), atLast = cur.y === last.getFullYear() && cur.m === last.getMonth();
            if (atFirst) pv.disabled = true; if (atLast) nx.disabled = true;
            pv.onclick = function () { cur.m--; if (cur.m < 0) { cur.m = 11; cur.y--; } drawCal(); };
            nx.onclick = function () { cur.m++; if (cur.m > 11) { cur.m = 0; cur.y++; } drawCal(); };
            head.appendChild(pv); head.appendChild(el('b', null, cap1(G.MO[cur.m]) + ' ' + cur.y)); head.appendChild(nx);
            ['L', 'M', 'M', 'G', 'V', 'S', 'D'].forEach(function (x) { grid.appendChild(el('span', 'gkCalW', x)); });
            var off = (new Date(cur.y, cur.m, 1).getDay() + 6) % 7, nd = new Date(cur.y, cur.m + 1, 0).getDate();
            for (var k = 0; k < off; k++) grid.appendChild(el('span', 'gkCalE'));
            for (var n = 1; n <= nd; n++) {
              var key = cur.y + '-' + pd(cur.m + 1) + '-' + pd(n), ok = !!byDay[key];
              var b = el('button', 'gkCalD' + (ok ? ' ok' : '') + (key === selDay ? ' sel' : '') + (key === today() ? ' tod' : ''), String(n)); b.type = 'button'; b.disabled = !ok;
              (function (kk) { b.onclick = function () { selDay = kk; drawCal(); drawHours(); }; })(key);
              grid.appendChild(b);
            }
          }
          drawCal(); drawHours();
        });
      };
      if (have(from, to, true)) show(); else fetchRange(from, to, false).then(show).catch(function (e) { G.toast(e.message, 'bad'); });
    };
    if (pre) run(pre); else if (kind === 'pt') pickMember('Personal 1:1', noSub, run, null, hasPt0, 'Nessun iscritto con un Piano Personal attivo. Assegnalo dalla scheda dell\'iscritto, in Abbonamenti.'); else pickMember(kind === 'cls' ? 'Iscrivi a un corso' : 'Nuova prenotazione', noSub, run);
  }
  window.liaGymBookFor = function (id) { var m = G.S.data && G.S.data.members.filter(function (x) { return x.id === id; })[0]; if (m) openNew(m); };

  // ---------- pulsante + (telefono, vista mese) ----------
  var fab = el('button', 'gxFab gcFab'); fab.type = 'button'; fab.hidden = true; fab.setAttribute('aria-label', 'Nuova prenotazione'); fab.innerHTML = G.ic('plus', 26); document.body.appendChild(fab);
  function chooseNew() {
    var o = G.OF ? G.OF() : { cls: true, pt: true };
    if (!o.pt) return openNew(null, 'cls'); if (!o.cls) return openNew(null, 'pt');
    G.sheet('Cosa vuoi prenotare?', function (w, close) {
      [['cls', 'Un corso', 'Iscrivi un iscritto a una lezione'], ['pt', 'Un Personal', 'Fissa una seduta 1:1 in un orario libero']].forEach(function (x) {
        var b = el('button', 'gxCard gxMc'); b.type = 'button'; b.innerHTML = '<div class="gxRow"><div><b class="gxT">' + x[1] + '</b><div class="gxM">' + x[2] + '</div></div></div>';
        b.onclick = function () { close(); openNew(null, x[0]); }; w.appendChild(b);
      });
    });
  }
  fab.addEventListener('click', function () { chooseNew(); });
  function toggleFab() { fab.hidden = !(sectionOn && (phone() || onlyBooked() || S.view === 'day')); }

  // ---------- collegamenti con il resto del dashboard ----------
  // dalla campanella: "Nuova prenotazione" porta al giorno e alla lezione indicati
  window.liaOpenDate = function (iso) {
    var dt = new Date(iso); if (isNaN(dt.getTime())) return;
    var fe = window.liaFocusEv || {}, who = String(fe.name || '').trim().split(/\s+/);
    var d = ymd(dt); S.view = 'day'; S.anchor = d; S.sel = d;
    S.hl = { time: pad(dt.getHours()) + ':' + pad(dt.getMinutes()), svc: fe.svc || '', who: who[0] ? who[0] + (who[1] ? ' ' + who[1].charAt(0) + '.' : '') : '', bad: !!fe.bad };
    bust(); render();
  };
  document.addEventListener('lia:section', function (e) {
    sectionOn = e.detail === 'cal'; toggleFab();
    if (sectionOn) { var rr = range(), warm = have(rr.from, rr.to, rr.full); render(); if (warm) revalidate(); }
  });
  document.addEventListener('lia:gymchanged', function () { bust(); if (sectionOn) render(); });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (sectionOn) render(); }, 200); });
  function snap() { var r = range(), o = []; for (var d = r.from; d <= r.to; d = addDays(d, 1)) o.push(C[d]); return JSON.stringify(o); }
  function revalidate() {
    var r = range(), before = snap();
    fetchRange(r.from, r.to, !r.full).then(function () { if (sectionOn && !document.querySelector('.gxShade') && snap() !== before) render(); }).catch(function () {});
  }
  // aggiorna da solo ogni minuto, senza disturbare se c'è una finestra aperta
  setInterval(function () {
    if (!sectionOn || document.visibilityState === 'hidden' || document.querySelector('.gxShade')) return;
    var r = range(), my = token;
    fetchRange(r.from, r.to, !r.full).then(function () { if (my === token && !document.querySelector('.gxShade')) { var keep = window.scrollY; render(); window.scrollTo(0, keep); } }).catch(function () {});
  }, 60000);

  // sezione di partenza: il calendario è la prima schermata
  try { var ap = document.querySelector('.tabPanel.on'); sectionOn = !ap || ap.id === 'panelCal'; } catch (e) { sectionOn = true; }
  toggleFab();
  if (sectionOn) render();
})();
