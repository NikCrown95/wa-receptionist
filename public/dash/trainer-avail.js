/* Personal trainer: Disponibilità e assenze, giorno per giorno.
   Calendario + ore da trascinare + riepilogo. Rosso = assenze, verde = disponibilità.
   Dove non scrivi nulla valgono gli orari di apertura. Usa le chiusure orarie (block_set_day). */
(function () {
  "use strict";
  if (!window.__LIA_PT) return;
  var DS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  var DL = ["lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato", "domenica"];
  var MO = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  var P = { mode: "ab", open: false, sel: [], H: {}, per: false, anchor: null, month: null, work: {}, sig: "" };
  var ctx = null, host = null, drag = null, saving = false;

  function pad(n) { return ("0" + n).slice(-2); }
  function ymd(x) { return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); }
  function dt(s) { return new Date(s + "T12:00:00"); }
  function dow(s) { return (dt(s).getDay() + 6) % 7; }
  function addD(s, n) { var x = dt(s); x.setDate(x.getDate() + n); return ymd(x); }
  function mm(s) { var a = String(s).split(":"); return Number(a[0]) * 60 + Number(a[1]); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function today() { return ymd(new Date()); }
  function keys(o) { return Object.keys(o).map(Number).sort(function (a, b) { return a - b; }); }

  /* ---- orari di apertura (base) ---- */
  function baseOf(date) {
    var wd = dow(date) + 1, out = [];
    (ctx.hours || []).forEach(function (h) {
      var w = Number(h.weekday); if (w === 0) w = 7;
      if (w === wd) out.push([mm(String(h.opens).slice(0, 5)), mm(String(h.closes).slice(0, 5))]);
    });
    return out;
  }
  function openHour(date, h) { // l'ora h e' dentro l'apertura (anche solo in parte)
    return baseOf(date).some(function (r) { return r[0] < (h + 1) * 60 && r[1] > h * 60; });
  }
  function range() {
    var lo = 24, hi = 0;
    (ctx.hours || []).forEach(function (h) { lo = Math.min(lo, Math.floor(mm(String(h.opens).slice(0, 5)) / 60)); hi = Math.max(hi, Math.ceil(mm(String(h.closes).slice(0, 5)) / 60)); });
    if (lo >= hi) { lo = 8; hi = 20; }
    return [lo, hi];
  }
  function openHours(date) { var r = range(), o = []; for (var h = r[0]; h < r[1]; h++) if (openHour(date, h)) o.push(h); return o; }

  /* ---- stato: per giorno l'insieme delle ore chiuse (B) ---- */
  function fromServer() {
    var by = {};
    (ctx.blocks || []).forEach(function (b) {
      var d = String(b.date).slice(0, 10); if (d < today()) return;
      var set = by[d] || (by[d] = {});
      if (b.full_day || !b.to) { openHours(d).forEach(function (h) { set[h] = 1; }); return; }
      var a = mm(b.from), z = mm(b.to) || 1440;
      openHours(d).forEach(function (h) { if (Math.min(z, (h + 1) * 60) - Math.max(a, h * 60) >= 30) set[h] = 1; });
    });
    return by;
  }
  var srv = {};
  function cur(d) { return P.work[d] !== undefined ? P.work[d] : (srv[d] || {}); }
  function copyOf(o) { var r = {}; Object.keys(o).forEach(function (k) { r[k] = 1; }); return r; }
  function same(a, b) { var ka = keys(a), kb = keys(b); return ka.length === kb.length && ka.every(function (x, i) { return x === kb[i]; }); }
  function dirtyDays() { return Object.keys(P.work).filter(function (d) { return !same(P.work[d], srv[d] || {}); }).sort(); }
  function setDay(d, set) { P.work[d] = set; }
  /* disponibilita': ore aperte scelte = apertura - chiuse; giorno senza chiusure = orari di apertura (non impostato) */
  function openSet(d) { var b = cur(d), o = {}; if (!keys(b).length) return o; openHours(d).forEach(function (h) { if (!b[h]) o[h] = 1; }); return o; }
  function fromOpen(d, o) { var b = {}; if (!keys(o).length) return b; openHours(d).forEach(function (h) { if (!o[h]) b[h] = 1; }); return b; }
  function isFull(d) { var oh = openHours(d), b = cur(d); return oh.length > 0 && oh.every(function (h) { return b[h]; }); }

  function rg(set) {
    var o = keys(set), r = [], s = null, p = null;
    o.forEach(function (x) { if (s === null) { s = x; p = x; } else if (x === p + 1) p = x; else { r.push([s, p + 1]); s = x; p = x; } });
    if (s !== null) r.push([s, p + 1]);
    return r;
  }
  function rtxt(set) { return rg(set).map(function (r) { return r[0] + "–" + r[1]; }).join(" e "); }
  /* testo "ore" di un giorno secondo la modalita' */
  function label(d) {
    var b = cur(d); if (!keys(b).length) return "";
    if (P.mode === "ab") return isFull(d) ? "tutto il giorno" : rtxt(b);
    var o = openSet(d); return keys(o).length ? rtxt(o) : "non ci sei";
  }

  /* ---- interfaccia ---- */
  function css() {
    if (document.getElementById("ptAvCss")) return;
    var s = document.createElement("style"); s.id = "ptAvCss";
    s.textContent =
      ".ptAv{--pc:#d9766d;--pb:color-mix(in srgb,#d9766d 18%,transparent);--ps:color-mix(in srgb,#d9766d 70%,transparent);display:flex;flex-direction:column;gap:14px;min-width:0}" +
      ".ptAv.av{--pc:#45b08c;--pb:color-mix(in srgb,#45b08c 18%,transparent);--ps:color-mix(in srgb,#45b08c 70%,transparent)}" +
      ".ptAv .pvSg{display:flex;background:color-mix(in srgb,var(--ink) 6%,transparent);border:1px solid var(--line);border-radius:99px;padding:3px}" +
      ".ptAv .pvSg button{flex:1;border:0;background:transparent;color:var(--muted);border-radius:99px;padding:10px 8px;font:inherit;font-weight:600;font-size:.9rem;cursor:pointer}" +
      ".ptAv .pvSg button[aria-pressed=true]{background:var(--pb);color:var(--pc)}" +
      ".ptAv .pvCard{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}" +
      ".ptAv .pvHd{display:flex;align-items:center;justify-content:space-between;gap:8px}" +
      ".ptAv .pvHd b{font-weight:700;font-size:1.02rem;text-transform:capitalize}" +
      ".ptAv .pvHd span{color:var(--muted);font-size:.8rem;font-weight:500}" +
      ".ptAv .pvArr{display:flex;gap:6px}" +
      ".ptAv .pvArr button,.ptAv .pvNav button{border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:99px;min-width:36px;height:34px;padding:0 12px;font:inherit;font-size:.82rem;font-weight:600;cursor:pointer}" +
      ".ptAv .pvArr button:disabled{opacity:.35}" +
      ".ptAv .pvCal{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}" +
      ".ptAv .pvDw{text-align:center;color:var(--muted);font-size:.72rem;font-weight:600;padding-bottom:2px}" +
      ".ptAv .pvD{min-height:50px;border:1px solid var(--line);border-radius:10px;background:transparent;color:var(--ink);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:2px;font:inherit;font-size:.95rem;font-weight:600;cursor:pointer;line-height:1.1}" +
      ".ptAv .pvD small{font-size:.62rem;font-weight:600;color:var(--muted);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".ptAv .pvD.k{background:linear-gradient(160deg,color-mix(in srgb,var(--pc) 26%,transparent),color-mix(in srgb,var(--pc) 8%,transparent));border-color:var(--ps);color:var(--pc)}.ptAv .pvD.k small{color:var(--pc)}" +
      ".ptAv .pvD.x{opacity:.32;cursor:default}" +
      ".ptAv .pvD.t{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--ink) 40%,transparent)}" +
      ".ptAv .pvD.a{background:linear-gradient(160deg,color-mix(in srgb,var(--pc) 42%,transparent),color-mix(in srgb,var(--pc) 12%,transparent));border-color:var(--pc);color:var(--pc);box-shadow:0 0 0 1px var(--pc)}" +
      ".ptAv .pvD.u:after{content:'';width:5px;height:5px;border-radius:50%;background:var(--pc)}" +
      ".ptAv .pvLab{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}" +
      ".ptAv .pvLab b{font-weight:700;font-size:.98rem}" +
      ".ptAv .pvLab .s{color:var(--muted);font-size:.8rem;font-weight:500;width:100%}" +
      ".ptAv .pvNav{display:flex;gap:6px;flex-wrap:wrap}" +
      ".ptAv .pvNav button[aria-pressed=true]{background:var(--pb);border-color:var(--ps);color:var(--pc)}" +
      ".ptAv .pvQ{display:flex;flex-wrap:wrap;gap:6px}" +
      ".ptAv .pvQ button{border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:99px;padding:8px 13px;font:inherit;font-size:.84rem;font-weight:600;cursor:pointer}" +
      ".ptAv .pvH{display:grid;gap:3px;touch-action:none;user-select:none;-webkit-user-select:none}" +
      ".ptAv .pvH div{height:46px;border-radius:7px;border:1px solid var(--line);color:var(--muted);font-size:.7rem;font-weight:600;text-align:center;padding-top:4px}" +
      ".ptAv .pvH div.o{background:color-mix(in srgb,var(--ink) 5%,transparent)}" +
      ".ptAv .pvH div.n{opacity:.3;background:repeating-linear-gradient(135deg,transparent 0 4px,color-mix(in srgb,var(--ink) 12%,transparent) 4px 5px)}" +
      ".ptAv .pvH div.p{background:var(--ps);border-color:var(--pc);color:#fff}" +
      ".ptAv .pvNext{position:sticky;bottom:12px;box-shadow:0 8px 24px rgba(0,0,0,.35)}.ptAv .pvIn{animation:pvIn .22s ease-out}@keyframes pvIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.ptAv .pvPer{border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:99px;height:34px;padding:0 12px;font:inherit;font-size:.82rem;font-weight:600;cursor:pointer}.ptAv .pvPer[aria-pressed=true]{background:var(--pb);border-color:var(--ps);color:var(--pc)}.ptAv .pvClr{border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:99px;height:32px;padding:0 12px;font:inherit;font-size:.8rem;font-weight:600;cursor:pointer}.ptAv .pvAp{margin-top:2px}.ptAv .pvHint{color:var(--muted);font-size:.8rem;font-weight:500}" +
      ".ptAv .pvRp{border:1px solid var(--ps);border-radius:16px;padding:12px 14px;background:color-mix(in srgb,var(--pc) 7%,var(--card))}" +
      ".ptAv .pvRp .k{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--pc);font-weight:700;margin-bottom:4px}" +
      ".ptAv .pvRp .l{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line);font-size:.9rem}" +
      ".ptAv .pvRp .k+.l{border-top:0}" +
      ".ptAv .pvRp .l{align-items:center}.ptAv .pvRp .l span{flex:1}.ptAv .pvRp .l b{font-weight:700;color:var(--pc);text-align:right}.ptAv .pvRm{width:30px;height:30px;flex:none;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--muted);display:grid;place-items:center;cursor:pointer;padding:0}" +
      ".ptAv .pvRp .em{color:var(--muted);font-size:.86rem}" +
      ".ptAv .pvGo{border:0;border-radius:99px;background:var(--ps);color:#fff;padding:14px;font:inherit;font-weight:700;font-size:.96rem;cursor:pointer}" +
      ".ptAv .pvGo:disabled{opacity:.45}" +
      ".ptAv .pvGo.sec{background:transparent;color:var(--muted);border:1px solid var(--line);font-weight:600}" +
      "@media(max-width:620px){.ptAv .pvD{min-height:46px}}";
    s.textContent += ".ptAvOv{--pc:#d9766d;--pb:color-mix(in srgb,#d9766d 18%,transparent);--ps:color-mix(in srgb,#d9766d 70%,transparent);position:fixed;inset:0;z-index:2147483000;background:rgba(3,10,13,.62);display:flex;align-items:center;justify-content:center;padding:16px;animation:pvFade .18s ease-out}\n.ptAvOv.av{--pc:#45b08c;--pb:color-mix(in srgb,#45b08c 18%,transparent);--ps:color-mix(in srgb,#45b08c 70%,transparent)}\n@keyframes pvFade{from{opacity:0}to{opacity:1}}\n.ptAvBox{width:min(520px,100%);max-height:calc(100dvh - 32px);overflow:auto;background:var(--card,#10232a);border:1px solid var(--ps);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:0 24px 60px rgba(0,0,0,.5);color:var(--ink,#e8f0f2);animation:pvPop .2s ease-out}\n@keyframes pvPop{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}\n.ptAvOv .pvLab{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.ptAvOv .pvLab b{font-weight:700;font-size:1.02rem}.ptAvOv .pvLab .s{color:var(--muted,#8fa9b0);font-size:.82rem;font-weight:500;width:100%}\n.ptAvOv .pvX{width:36px;height:36px;border-radius:50%;border:1px solid var(--line,#1f3a43);background:transparent;color:var(--ink,#e8f0f2);display:grid;place-items:center;cursor:pointer}\n.ptAvOv .pvQ{display:flex;flex-wrap:wrap;gap:6px}.ptAvOv .pvQ button{border:1px solid var(--line,#1f3a43);background:transparent;color:var(--ink,#e8f0f2);border-radius:99px;padding:8px 13px;font:inherit;font-size:.84rem;font-weight:600;cursor:pointer}\n.ptAvOv .pvH{display:grid;gap:3px;touch-action:none;user-select:none;-webkit-user-select:none}\n.ptAvOv .pvH div{height:50px;border-radius:7px;border:1px solid var(--line,#1f3a43);color:var(--muted,#8fa9b0);font-size:.72rem;font-weight:600;text-align:center;padding-top:5px}\n.ptAvOv .pvH div.o{background:rgba(255,255,255,.04)}.ptAvOv .pvH div.n{opacity:.3}.ptAvOv .pvH div.p{background:var(--ps);border-color:var(--pc);color:#fff}\n.ptAvOv .pvGo{border:0;border-radius:99px;background:var(--ps);color:#fff;padding:14px;font:inherit;font-weight:700;font-size:.96rem;cursor:pointer}\n";
    document.head.appendChild(s);
  }

  function tick() { return host && host.isConnected; }
  function isPast(d) { return d < today(); }
  function monthStart() { return P.month || (P.month = today().slice(0, 7) + "-01"); }
  function editable(d) { return !isPast(d) && baseOf(d).length > 0; }

  /* ore "in lavorazione" (H): valgono per tutti i giorni scelti finche' non premi Applica */
  function painted(d) { return P.mode === "ab" ? copyOf(cur(d)) : openSet(d); }
  function syncH() {
    var sel = P.sel; P.H = {};
    if (!sel.length) return;
    var f = JSON.stringify(keys(painted(sel[0])));
    if (sel.every(function (d) { return JSON.stringify(keys(painted(d))) === f; })) P.H = painted(sel[0]);
  }

  function draw() {
    if (!tick()) return;
    css();
    var scroller = host.closest(".avScroll"), y = scroller ? scroller.scrollTop : 0;
    host.textContent = ""; host.className = "ptAv " + P.mode;
    /* modalita' */
    var sg = el("div", "pvSg"); sg.setAttribute("role", "group");
    [["ab", "Assenze, chiusure e ferie"], ["av", "Disponibilità"]].forEach(function (m) {
      var b = el("button", null, m[1]); b.type = "button"; b.setAttribute("aria-pressed", P.mode === m[0] ? "true" : "false");
      b.addEventListener("click", function () { P.mode = m[0]; closeSheet(); syncH(); draw(); });
      sg.appendChild(b);
    });
    host.appendChild(sg);

    /* 1) giorni */
    var card = el("div", "pvCard"), ms = monthStart(), md = dt(ms);
    var hd = el("div", "pvHd"), tt = el("b", null, MO[md.getMonth()] + " " + md.getFullYear());
    var ar = el("div", "pvArr"), pv = el("button", null, "‹"), nx = el("button", null, "›");
    pv.type = nx.type = "button"; pv.setAttribute("aria-label", "Mese precedente"); nx.setAttribute("aria-label", "Mese successivo");
    pv.disabled = ms <= today().slice(0, 7) + "-01";
    var lim = dt(today().slice(0, 7) + "-01"); lim.setMonth(lim.getMonth() + 12);
    nx.disabled = md >= lim;
    pv.addEventListener("click", function () { var x = dt(ms); x.setMonth(x.getMonth() - 1); P.month = ymd(x).slice(0, 7) + "-01"; draw(); });
    nx.addEventListener("click", function () { var x = dt(ms); x.setMonth(x.getMonth() + 1); P.month = ymd(x).slice(0, 7) + "-01"; draw(); });
    var pr = el("button", "pvPer", "Periodo"); pr.type = "button"; pr.setAttribute("aria-pressed", P.per ? "true" : "false");
    pr.addEventListener("click", function () { P.per = !P.per; P.anchor = null; draw(); });
    ar.appendChild(pr); ar.appendChild(pv); ar.appendChild(nx); hd.appendChild(tt); hd.appendChild(ar); card.appendChild(hd);
    var cal = el("div", "pvCal");
    DS.forEach(function (d) { cal.appendChild(el("div", "pvDw", d)); });
    for (var i = 0; i < dow(ms); i++) cal.appendChild(el("div"));
    var n = new Date(md.getFullYear(), md.getMonth() + 1, 0).getDate(), dirty = {};
    dirtyDays().forEach(function (d) { dirty[d] = 1; });
    for (var k = 1; k <= n; k++) (function (d, num) {
      var off = !editable(d), on = P.sel.indexOf(d) > -1;
      var b = el("button", "pvD" + (keys(cur(d)).length ? " k" : "") + (on ? " a" : "") + (d === today() ? " t" : "") + (off ? " x" : "") + (dirty[d] ? " u" : ""));
      b.type = "button"; b.appendChild(document.createTextNode(String(num)));
      var lb = label(d); if (lb) b.appendChild(el("small", null, lb === "tutto il giorno" ? "tutto il g." : lb));
      if (off) b.disabled = true;
      b.addEventListener("click", function () { tapDay(d); });
      cal.appendChild(b);
    })(ms.slice(0, 8) + pad(k), k);
    card.appendChild(cal);
    card.appendChild(el("div", "pvHint", P.per ? (P.anchor ? "Ora tocca l'ultimo giorno del periodo." : "Tocca il primo e l'ultimo giorno del periodo.") : "1. Tocca i giorni (anche più di uno). I giorni senza orari seguono l'apertura."));
    host.appendChild(card);

    /* 2) le ore si scelgono in un riquadro in primo piano */
    if (P.sel.length) {
      var nb = el("button", "pvGo pvNext", "Scegli le ore · " + (P.sel.length === 1 ? "1 giorno" : P.sel.length + " giorni")); nb.type = "button";
      nb.addEventListener("click", function () { P.open = true; sheet(); });
      host.appendChild(nb);
    } else closeSheet();
    if (P.open && P.sel.length) sheet();

    /* riepilogo */
    host.appendChild(summary());
    var go = el("button", "pvGo", saving ? "Salvo…" : (dirtyDays().length ? "Salva" : "Nessuna modifica da salvare")); go.type = "button";
    go.disabled = saving || !dirtyDays().length;
    go.addEventListener("click", save);
    host.appendChild(go);
    if (dirtyDays().length) {
      var un = el("button", "pvGo sec", "Annulla le modifiche"); un.type = "button";
      un.addEventListener("click", function () { P.work = {}; syncH(); draw(); });
      host.appendChild(un);
    }
    if (scroller) scroller.scrollTop = y;
  }

  var ovT = 0;
  function closeSheet() { P.open = false; var o = document.getElementById("ptAvSheet"); if (o) o.remove(); }
  function sheet() {
    var old = document.getElementById("ptAvSheet"), fresh = !old; if (old) old.remove();
    var sel = P.sel.slice().sort();
    var ov = el("div", "ptAvOv " + P.mode); ov.id = "ptAvSheet"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true");
    if (fresh) ovT = Date.now();
    ov.addEventListener("click", function (e) { if (e.target === ov && Date.now() - ovT > 450) closeSheet(); });
    var box = el("div", "ptAvBox"); ov.appendChild(box);
    var hd = el("div", "pvLab"), cx = dt(sel[0]);
    hd.appendChild(el("b", null, sel.length === 1 ? DL[dow(sel[0])] + " " + cx.getDate() + " " + MO[cx.getMonth()] : sel.length + " giorni scelti"));
    var x = el("button", "pvX"); x.type = "button"; x.setAttribute("aria-label", "Chiudi");
    x.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    x.addEventListener("click", closeSheet); hd.appendChild(x);
    var base = baseOf(sel[0]).map(function (r) { return Math.floor(r[0] / 60) + ":" + pad(r[0] % 60) + "–" + Math.floor(r[1] / 60) + ":" + pad(r[1] % 60); }).join(" e ");
    hd.appendChild(el("span", "s", (sel.length === 1 ? "Apertura: " + base + ". " : "") + (P.mode === "ab" ? "Trascina o tocca le ore in cui non ci sei." : "Trascina o tocca le ore in cui ci sei.")));
    box.appendChild(hd);
    var q = el("div", "pvQ");
    var Q = P.mode === "ab"
      ? [["Mattina", 0, 13], ["Pomeriggio", 13, 18], ["Sera", 18, 24], ["Tutto il giorno", 0, 24], ["Libero", -1, -1]]
      : [["Mattina", 0, 13], ["Pomeriggio", 13, 18], ["Sera", 18, 24], ["Orari di apertura", -1, -1]];
    Q.forEach(function (it) { var b = el("button", null, it[0]); b.type = "button"; b.addEventListener("click", function () { quick(it); }); q.appendChild(b); });
    box.appendChild(q);
    var r = range(), gr = el("div", "pvH"); gr.style.gridTemplateColumns = "repeat(" + (r[1] - r[0]) + ",minmax(0,1fr))";
    for (var h = r[0]; h < r[1]; h++) {
      var on2 = sel.some(function (d) { return openHour(d, h); }), pa = !!P.H[h];
      var c = el("div", !on2 ? "n" : pa ? "p" : "o", String(h)); c.dataset.h = String(h); if (!on2) c.dataset.off = "1";
      gr.appendChild(c);
    }
    bindDrag(gr); box.appendChild(gr);
    var ap = el("button", "pvGo", "Applica a " + (sel.length === 1 ? "questo giorno" : sel.length + " giorni")); ap.type = "button";
    ap.addEventListener("click", apply); box.appendChild(ap);
    try {
      var rc = host.getBoundingClientRect(), W = window.innerWidth;
      ov.style.paddingLeft = Math.max(16, Math.round(rc.left)) + "px";
      ov.style.paddingRight = Math.max(16, Math.round(W - rc.right)) + "px";
    } catch (e) { }
    document.body.appendChild(ov);
  }

  function tapDay(d) {
    if (!editable(d)) return;
    var i = P.sel.indexOf(d);
    if (P.per) {
      if (!P.anchor) { P.anchor = d; if (i < 0) P.sel.push(d); }
      else {
        var a = P.anchor < d ? P.anchor : d, z = P.anchor < d ? d : P.anchor;
        for (var x = a; x <= z; x = addD(x, 1)) if (editable(x) && P.sel.indexOf(x) < 0) P.sel.push(x);
        P.anchor = null;
      }
    } else if (i > -1) P.sel.splice(i, 1); else P.sel.push(d);
    syncH(); draw();
  }
  function quick(x) {
    var H = {}, oh = {};
    P.sel.forEach(function (d) { openHours(d).forEach(function (h) { oh[h] = 1; }); });
    if (x[1] !== -1) Object.keys(oh).forEach(function (h) { h = Number(h); if (h >= x[1] && h < x[2]) H[h] = 1; });
    P.H = H; sheet();
  }
  function apply() {
    if (!P.sel.length) return;
    P.sel.forEach(function (d) {
      var H = {}; openHours(d).forEach(function (h) { if (P.H[h]) H[h] = 1; });
      setDay(d, P.mode === "ab" ? H : fromOpen(d, H));
    });
    P.sel = []; P.anchor = null; P.H = {}; closeSheet(); draw();
  }

  /* ---- trascinamento ---- */
  function bindDrag(gr) {
    function hit(e) {
      var t = document.elementFromPoint(e.clientX, e.clientY);
      if (!t || !t.dataset || !t.dataset.h || t.dataset.off) return;
      var h = Number(t.dataset.h); if (drag.last === h) return; drag.last = h;
      if (drag.v === null) drag.v = P.H[h] ? 0 : 1;
      if (drag.v) P.H[h] = 1; else delete P.H[h];
      t.className = drag.v ? "p" : "o";
    }
    gr.addEventListener("pointerdown", function (e) {
      drag = { v: null, last: null };
      try { gr.setPointerCapture(e.pointerId); } catch (x) { }
      hit(e);
    });
    gr.addEventListener("pointermove", function (e) { if (drag) hit(e); });
    function end() { drag = null; }
    gr.addEventListener("pointerup", end); gr.addEventListener("pointercancel", end);
  }

  /* ---- riepilogo ---- */
  function summary() {
    var box = el("div", "pvRp"), ab = P.mode === "ab";
    var all = {}; Object.keys(srv).forEach(function (d) { all[d] = 1; }); Object.keys(P.work).forEach(function (d) { all[d] = 1; });
    var days = Object.keys(all).filter(function (d) { return !isPast(d) && keys(cur(d)).length; }).sort();
    box.appendChild(el("div", "k", "Riepilogo · " + (ab ? "non prenotabile" : "prenotabile")));
    if (!days.length) { box.appendChild(el("div", "em", ab ? "Nessuna assenza in programma. Quando ne aggiungi una, la trovi qui." : "Per ora valgono gli orari di apertura in tutti i giorni.")); return box; }
    var g = [];
    days.forEach(function (d) {
      var s = label(d), l = g[g.length - 1];
      if (l && l.s === s && addD(l.b, 1) === d) { l.b = d; l.d.push(d); } else g.push({ a: d, b: d, s: s, d: [d] });
    });
    function dl(d) { var x = dt(d); return DS[dow(d)] + " " + x.getDate() + " " + MO[x.getMonth()].slice(0, 3); }
    g.slice(0, 40).forEach(function (x) {
      var row = el("div", "l"); row.appendChild(el("span", null, x.a === x.b ? dl(x.a) : dl(x.a) + " – " + dl(x.b))); row.appendChild(el("b", null, x.s));
      var rm = el("button", "pvRm"); rm.type = "button"; rm.setAttribute("aria-label", "Togli " + (x.a === x.b ? dl(x.a) : dl(x.a) + " – " + dl(x.b)));
      rm.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      rm.addEventListener("click", function () { x.d.forEach(function (d) { setDay(d, {}); P.sel = P.sel.filter(function (z) { return z !== d; }); }); syncH(); draw(); });
      row.appendChild(rm);
      box.appendChild(row);
    });
    if (g.length > 40) box.appendChild(el("div", "em", "…e altri " + (g.length - 40) + " periodi."));
    return box;
  }

  /* ---- salvataggio ---- */
  function save() {
    var dd = dirtyDays(); if (!dd.length || saving) return;
    var out = dd.map(function (d) {
      var b = cur(d), full = isFull(d);
      return { date: d, full: full, ranges: full ? [] : rg(b).map(function (r) { return [pad(r[0]) + ":00", r[1] >= 24 ? "24:00" : pad(r[1]) + ":00"]; }) };
    });
    saving = true; draw();
    ctx.post({ action: "block_set_day", days: out }).then(function (r) {
      saving = false; P.work = {};
      var c = r && r.conflicts ? r.conflicts : 0;
      ctx.toast(c ? "Salvato. Attenzione: " + c + (c === 1 ? " appuntamento già preso in quelle ore." : " appuntamenti già presi in quelle ore.") : "Salvato.");
      return ctx.reload();
    }).catch(function (e) { saving = false; ctx.toast(e && e.message ? e.message : "Non sono riuscito a salvare. Riprova.", true); draw(); });
  }

  /* ---- ingresso, chiamato da avail.js ---- */
  window.liaPtAvail = function (box, c) {
    ctx = c; host = box;
    var sig = JSON.stringify([c.hours, c.blocks]);
    if (sig !== P.sig) { P.sig = sig; srv = fromServer(); /* dati nuovi dal server: le modifiche non salvate restano solo se i giorni non sono cambiati */ if (!Object.keys(P.work).length) P.work = {}; }
    if (!P.month) P.month = today().slice(0, 7) + "-01";
    P.sel = P.sel.filter(editable);
    draw();
  };
})();
