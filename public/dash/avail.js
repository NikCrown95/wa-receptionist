/* Disponibilità: orari del negozio, orari del team, chiusure e assenze, in una sola pagina.
   Usa gli stessi salvataggi delle Impostazioni (hours_replace, staff_save, block_create, staff_off_add). */
(function () {
  "use strict";
  var token = "";
  try { token = (new URLSearchParams(location.search).get("t") || "").trim(); } catch (e) {}
  var DN = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
  var DS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  var MO = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  var SV = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  var IC = {
    back: '<svg width="20" height="20" viewBox="0 0 24 24" ' + SV + ' stroke-width="2.2"><path d="M15 6l-6 6 6 6"/></svg>',
    clock: '<svg width="16" height="16" viewBox="0 0 24 24" ' + SV + ' stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    chev: '<svg width="18" height="18" viewBox="0 0 24 24" ' + SV + ' stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>',
    cal: '<svg width="19" height="19" viewBox="0 0 24 24" ' + SV + ' stroke-width="2"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>',
    shop: '<svg width="24" height="24" viewBox="0 0 24 24" ' + SV + ' stroke-width="2.1"><path d="M4 10l1.5-5h13L20 10M5 10v9h14v-9M9 19v-5h6v5"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" ' + SV + ' stroke-width="2.6"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  var layer = null, S = null, busy = false;
  var C = { who: "neg", from: "", to: "", part: false, tf: "14:00", tt: "16:00", kind: "ferie", conf: null };
  var NEG = { days: [], base: "" };
  var TM = {}; /* per collaboratore: { days, base } */
  var toastT = null;

  function $(id) { return document.getElementById(id); }
  function mk(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function m(s) { var a = String(s).split(":"); return Number(a[0]) * 60 + Number(a[1]); }
  function pad(n) { return ("0" + n).slice(-2); }
  function ymd(x) { return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); }
  function addDays(s, n) { var x = new Date(s + "T12:00:00"); x.setDate(x.getDate() + n); return ymd(x); }
  function dow(s) { return (new Date(s + "T12:00:00").getDay() + 6) % 7; }
  function dlab(s) { var x = new Date(s + "T12:00:00"); return DS[dow(s)] + " " + x.getDate() + " " + MO[x.getMonth()].slice(0, 3); }
  function dfull(s) { var x = new Date(s + "T12:00:00"); return DN[dow(s)] + " " + x.getDate() + " " + MO[x.getMonth()]; }
  function plabel(a, b) { return a === b ? dfull(a) : dlab(a) + " – " + dlab(b); }
  function hword(h) { var r = Math.round(h * 10) / 10; return String(r).replace(".", ",") + (r === 1 ? " ora" : " ore"); }
  function hue(s) { var h = 0; s = String(s || ""); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }

  function toast(msg, bad) {
    var t = $("avToast"); if (!t) { t = mk("div", "avToast"); t.id = "avToast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.className = "avToast show" + (bad ? " bad" : "");
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = "avToast"; }, 3200);
  }

  /* ---------- rete ---------- */
  function url() { return "/api/agenda?t=" + encodeURIComponent(token) + "&settings=1"; }
  function getJson(u, opt) { return fetch(u, opt).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Errore"); return d; }); }); }
  function post(body) {
    window.liaSettingsData = null; window.liaSettingsPromise = null;
    return getJson(url(), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  /* apertura veloce: se i dati sono gia' scaricati (li legge anche Impostazioni all'avvio) li uso subito, senza aspettare la rete */
  function cached() { var d = window.liaSettingsData; return d && d.hours ? d : null; }
  function fresh() {
    var p = window.liaSettingsRefresh ? window.liaSettingsRefresh() : Promise.resolve(null);
    return Promise.resolve(p).then(function (d) { return d && d.hours ? d : getJson(url()); });
  }

  /* ---------- modello orari ---------- */
  function toModel(ivs) {
    ivs = ivs.slice().sort(function (a, b) { return a.open < b.open ? -1 : 1; });
    if (!ivs.length) return { open: false };
    if (ivs.length === 1) return { open: true, from: ivs[0].open, to: ivs[0].close, pause: null };
    if (ivs.length === 2) return { open: true, from: ivs[0].open, to: ivs[1].close, pause: { from: ivs[0].close, to: ivs[1].open } };
    return { open: true, custom: ivs };
  }
  function toIntervals(d) {
    if (!d.open) return [];
    if (d.custom) return d.custom.map(function (x) { return { open: x.open, close: x.close }; });
    if (d.pause) return [{ open: d.from, close: d.pause.from }, { open: d.pause.to, close: d.to }];
    return [{ open: d.from, close: d.to }];
  }
  function dayHours(d) { var t = 0; toIntervals(d).forEach(function (x) { t += m(x.close) - m(x.open); }); return t / 60; }
  function weekHours(days) { var t = 0, n = 0; days.forEach(function (d) { var h = dayHours(d); if (h > 0) { t += h; n++; } }); return { h: t, n: n }; }
  function problem(days) {
    for (var i = 0; i < days.length; i++) {
      var d = days[i]; if (!d.open || d.custom) continue;
      if (m(d.from) >= m(d.to)) return DN[i] + ": l'apertura deve essere prima della chiusura.";
      if (d.pause && !(m(d.from) < m(d.pause.from) && m(d.pause.from) < m(d.pause.to) && m(d.pause.to) < m(d.to))) return DN[i] + ": la pausa deve stare dentro l'orario di apertura.";
    }
    return "";
  }
  function payload(days) {
    var out = [];
    days.forEach(function (d, i) { toIntervals(d).forEach(function (x) { out.push({ weekday: i + 1, opens: x.open, closes: x.close }); }); });
    return out;
  }
  function modelFromList(list) {
    var by = [[], [], [], [], [], [], []];
    (list || []).forEach(function (h) {
      var wd = Number(h.weekday), op = String(h.opens || "").slice(0, 5), cl = String(h.closes || "").slice(0, 5);
      if (wd < 0 || wd > 7 || !op || !cl) return;
      by[wd === 0 ? 6 : wd - 1].push({ open: op, close: cl });
    });
    return by.map(toModel);
  }

  /* ---------- dati ---------- */
  function apply(d) {
    var keep = {};
    if (S) { ["neg"].concat(S.staff.map(function (x) { return x.id; })).forEach(function (k) { if (k !== justSaved && dirty(k)) keep[k] = copy(daysOf(k)); }); }
    justSaved = null;
    S = {
      team: d.team_mode === "team",
      staff: Array.isArray(d.staff) ? d.staff : [],
      blocks: Array.isArray(d.blocks) ? d.blocks : [],
      hours: d.hours || []
    };
    NEG.days = modelFromList(S.hours); NEG.base = JSON.stringify(NEG.days);
    TM = {};
    S.staff.forEach(function (st) { var days = modelFromList(st.hours); TM[st.id] = { days: days, base: JSON.stringify(days) }; });
    Object.keys(keep).forEach(function (k) { if (k === "neg") NEG.days = keep[k]; else if (TM[k]) TM[k].days = keep[k]; });
    if (!S.team && C.who !== "neg") C.who = "neg";
    if (C.who !== "neg" && !S.staff.some(function (x) { return x.id === C.who; })) C.who = "neg";
  }
  function reload() { return fresh().then(function (d) { apply(d); render(); }); }

  /* ---------- pezzi di interfaccia ---------- */
  var TIMES = [];
  (function () { for (var q = 5 * 60; q <= 23 * 60 + 45; q += 15) TIMES.push(pad(Math.floor(q / 60)) + ":" + pad(q % 60)); })();
  // Campo data in italiano (giorno / mese / anno): l'input nativo segue la lingua del browser (mm/gg/aaaa)
  var MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
  function dateField(val, min) {
    var w = document.createElement("div"); w.className = "liaDate";
    var sd = document.createElement("select"), sm = document.createElement("select"), sy = document.createElement("select");
    sd.setAttribute("aria-label", "Giorno"); sm.setAttribute("aria-label", "Mese"); sy.setAttribute("aria-label", "Anno");
    var y0 = new Date().getFullYear();
    var i; for (i = 1; i <= 31; i++) sd.add(new Option(String(i), String(i)));
    for (i = 0; i < 12; i++) sm.add(new Option(MESI[i], String(i + 1)));
    for (i = y0; i <= y0 + 3; i++) sy.add(new Option(String(i), String(i)));
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function get() { return sy.value + "-" + pad(+sm.value) + "-" + pad(+sd.value); }
    function set(v) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); if (!m) return;
      if (min && v < min) { m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(min); }
      if (!sy.querySelector('option[value="' + +m[1] + '"]')) sy.add(new Option(m[1], String(+m[1])));
      sy.value = String(+m[1]); sm.value = String(+m[2]); sd.value = String(+m[3]); fit();
    }
    function fit() {
      var n = new Date(+sy.value, +sm.value, 0).getDate();
      Array.prototype.forEach.call(sd.options, function (o) { o.hidden = o.disabled = +o.value > n; });
      if (+sd.value > n) sd.value = String(n);
    }
    [sd, sm, sy].forEach(function (x) { x.addEventListener("change", function () { fit(); if (min && get() < min) set(min); }); w.appendChild(x); });
    Object.defineProperty(w, "value", { get: get, set: set });
    set(val || min || today());
    return w;
  }
  window.liaDateField = dateField;
  function selT(val, label, fn) {
    var s = document.createElement("select"); s.setAttribute("aria-label", label);
    var list = TIMES.slice(); if (list.indexOf(val) < 0) { list.push(val); list.sort(); }
    list.forEach(function (t) { var o = mk("option", null, t); o.value = t; if (t === val) o.selected = true; s.appendChild(o); });
    s.addEventListener("change", function () { fn(s.value); });
    return s;
  }
  function step(val, n) { var i = TIMES.indexOf(val); return TIMES[Math.max(0, Math.min(TIMES.length - 1, (i < 0 ? 0 : i) + n))]; }

  /* ---------- selezione e modello condiviso ---------- */
  var sel = "neg", pending = null, justSaved = null, pzOpen = {}, curKey = "neg", emb = null;
  function person(id) { for (var i = 0; i < S.staff.length; i++) if (S.staff[i].id === id) return S.staff[i]; return null; }
  function daysOf(id) { return id === "neg" ? NEG.days : (TM[id] ? TM[id].days : null); }
  function dirty(id) {
    if (!S) return false;
    if (id === "neg") return NEG.base !== "" && JSON.stringify(NEG.days) !== NEG.base;
    var T = TM[id]; return !!T && JSON.stringify(T.days) !== T.base;
  }
  function nudge(val, dm) { var x = Math.max(300, Math.min(1425, m(val) + dm)); return pad(Math.floor(x / 60)) + ":" + pad(x % 60); }

  /* − 09:00 + */
  function tmr(val, label, fn) {
    var r = mk("div", "avTmr"), a = mk("button", null, "−"), p = mk("button", null, "+"), o = mk("output", null, val);
    a.type = p.type = "button";
    a.setAttribute("aria-label", label + ", mezz'ora prima"); p.setAttribute("aria-label", label + ", mezz'ora dopo");
    a.addEventListener("click", function () { var v = nudge(val, -30); if (v !== val) fn(v); });
    p.addEventListener("click", function () { var v = nudge(val, 30); if (v !== val) fn(v); });
    r.appendChild(a); r.appendChild(o); r.appendChild(p); return r;
  }
  function bar(d) {
    var t = mk("div", "avTrk");
    toIntervals(d).forEach(function (x) {
      var s = (m(x.open) - 360) / 1080 * 100, w = (m(x.close) - m(x.open)) / 1080 * 100, e = mk("i");
      e.style.left = Math.max(0, s) + "%"; e.style.width = Math.max(1.5, Math.min(100 - Math.max(0, s), w)) + "%"; t.appendChild(e);
    });
    return t;
  }

  /* una riga per giorno: interruttore, orari con − e +, pausa, barra colorata */
  function dayRows(list, days, shopRef) {
    list.textContent = "";
    days.forEach(function (d, i) {
      var er = mk("div", "avEr" + (d.open ? " on" : " off")), ln = mk("div", "avEl");
      ln.appendChild(mk("span", "avEd", DN[i]));
      var sw = mk("button", "avPill" + (d.open ? " on" : "")); sw.type = "button";
      sw.setAttribute("aria-pressed", d.open ? "true" : "false"); sw.setAttribute("aria-label", DN[i] + (d.open ? ": aperto, tocca per chiudere" : ": chiuso, tocca per aprire"));
      sw.textContent = d.open ? "Aperto" : "+ Apri";
      sw.addEventListener("click", function () {
        if (d.open) days[i] = { open: false };
        else { var ref = shopRef && shopRef[i] && shopRef[i].open ? shopRef[i] : null; days[i] = ref ? copy(ref) : { open: true, from: "09:00", to: "19:00", pause: null }; }
        render();
      });
      ln.appendChild(sw);
      var tc = mk("div", "avEt");
      if (!d.open) tc.appendChild(mk("span", "avClosed", "Chiuso"));
      else if (d.custom) {
        tc.appendChild(mk("span", "avInfo", "Fasce: " + d.custom.map(function (x) { return x.open + "–" + x.close; }).join(" · ")));
        var sp = mk("button", "avMini", "Semplifica"); sp.type = "button";
        sp.addEventListener("click", function () { var f = d.custom[0], l = d.custom[d.custom.length - 1]; days[i] = { open: true, from: f.open, to: l.close, pause: null }; render(); });
        tc.appendChild(sp);
      } else {
        function tl(lab, node) { var r = mk("div", "avTl"); r.appendChild(mk("span", null, lab)); r.appendChild(node); return r; }
        tc.appendChild(tl("Apre", tmr(d.from, DN[i] + ", apertura", function (v) {
          if (m(v) >= m(d.to)) return; d.from = v; if (d.pause && m(d.pause.from) <= m(v)) d.pause = null; render();
        })));
        tc.appendChild(tl("Chiude", tmr(d.to, DN[i] + ", chiusura", function (v) {
          if (m(v) <= m(d.from)) return; d.to = v; if (d.pause && m(d.pause.to) >= m(v)) d.pause = null; render();
        })));
        if (d.pause) {
          var pk = curKey + ":" + i, pc = mk("button", "avPzChip" + (pzOpen[pk] ? " on" : ""), "Pausa " + d.pause.from + "–" + d.pause.to); pc.type = "button";
          pc.addEventListener("click", function () { pzOpen[pk] = !pzOpen[pk]; render(); });
          tc.appendChild(pc);
        } else {
          var ap = mk("button", "avAddP", "+ Pausa"); ap.type = "button";
          ap.addEventListener("click", function () {
            var a = m(d.from), b = m(d.to), mid = Math.round((a + b) / 2 / 30) * 30;
            var pf = pad(Math.floor(mid / 60)) + ":" + pad(mid % 60), pt = nudge(pf, 60);
            if (m(pf) <= a || m(pt) >= b) { pf = nudge(d.from, 30); pt = nudge(pf, 30); }
            if (m(pt) >= b) { toast("Orario troppo breve per una pausa.", true); return; }
            d.pause = { from: pf, to: pt }; pzOpen[curKey + ":" + i] = true; render();
          });
          tc.appendChild(ap);
        }
      }
      ln.appendChild(tc);
      er.appendChild(ln);
      if (d.open && !d.custom && d.pause && pzOpen[curKey + ":" + i]) {
        var pl = mk("div", "avPz"); pl.appendChild(mk("b", null, "Pausa"));
        var pa = mk("div", "avTl"); pa.appendChild(mk("span", null, "Dalle")); pa.appendChild(tmr(d.pause.from, DN[i] + ", inizio pausa", function (v) { if (m(v) <= m(d.from) || m(v) >= m(d.pause.to)) return; d.pause.from = v; render(); })); pl.appendChild(pa);
        var pb = mk("div", "avTl"); pb.appendChild(mk("span", null, "Alle")); pb.appendChild(tmr(d.pause.to, DN[i] + ", fine pausa", function (v) { if (m(v) >= m(d.to) || m(v) <= m(d.pause.from)) return; d.pause.to = v; render(); })); pl.appendChild(pb);
        var rm = mk("button", "avRm", "✕"); rm.type = "button"; rm.setAttribute("aria-label", "Togli la pausa");
        rm.addEventListener("click", function () { d.pause = null; pzOpen[curKey + ":" + i] = false; render(); });
        pl.appendChild(rm); er.appendChild(pl);
      }
      list.appendChild(er);
    });
  }

  var PRESETS = [
    ["Lun–Ven 9–18", [1, 1, 1, 1, 1, 0, 0], "09:00", "18:00"],
    ["Lun–Sab 9–19", [1, 1, 1, 1, 1, 1, 0], "09:00", "19:00"],
    ["Tutti i giorni", [1, 1, 1, 1, 1, 1, 1], "09:00", "19:00"]
  ];

  var PAL = ["#8B7BE8", "#E58AA8", "#4FA3E0", "#E8A04B", "#4FBF8F", "#C97BD6"];
  function colorOf(id) {
    if (id === "neg") return "#2B8A94";
    if (id === "chi") return "#E5826A";
    for (var i = 0; i < S.staff.length; i++) if (S.staff[i].id === id) return PAL[i % PAL.length];
    return "#2B8A94";
  }
  function avatar(id) {
    var a = mk("span", "avAv"); a.style.setProperty("--c", colorOf(id));
    if (id === "neg") { a.classList.add("shop"); a.innerHTML = IC.shop; }
    else { var s = person(id); a.textContent = String((s && s.name) || "?").charAt(0).toUpperCase(); a.style.setProperty("--h", hue(s && s.name)); }
    return a;
  }

  /* ---------- editor di Negozio / persona ---------- */
  function editor(box, id) {
    curKey = id;
    var isShop = id === "neg", st = isShop ? null : person(id), days = daysOf(id);
    var pane = mk("div", "avPane"); pane.style.setProperty("--c", colorOf(id));
    var w = weekHours(days);
    var head = mk("div", "avHd");
    head.appendChild(avatar(id));
    var tt = mk("div", "avHt");
    tt.appendChild(mk("h2", null, isShop ? "Negozio · orari di apertura" : st.name + (st.is_owner ? " · tu" : "")));
    tt.appendChild(mk("p", null, hword(w.h) + " a settimana · " + w.n + (w.n === 1 ? " giorno" : " giorni") + (isShop ? "" : " di lavoro")));
    head.appendChild(tt); pane.appendChild(head);
    if (isShop) pane.appendChild(mk("p", "avHint", "Gli orari di ogni settimana. Per ferie e giorni a parte usa Chiusure e assenze."));
    else pane.appendChild(mk("p", "avHint", "I clienti possono prenotare con " + st.name + " solo nei suoi giorni e orari."));

    var list = mk("div", "avDays"); pane.appendChild(list);
    dayRows(list, days, isShop ? null : NEG.days);

    var pr = problem(days), dr = dirty(id);
    var note = mk("div", "avErr"); note.hidden = !pr; note.textContent = pr; pane.appendChild(note);
    var ft = mk("div", "avFt");
    var stt = mk("span", "avState" + (dr ? " dirty" : " ok"));
    stt.innerHTML = dr ? "Modifiche non salvate" : IC.check + " Tutto salvato";
    ft.appendChild(stt);
    var save = mk("button", "avBtn pri", isShop ? "Salva orari" : "Salva orari di " + st.name); save.type = "button"; save.disabled = !dr || busy;
    save.addEventListener("click", function () {
      var p2 = problem(days); if (p2) { toast(p2, true); return; }
      busy = true; render();
      var req = isShop ? post({ action: "hours_replace", hours: payload(days) })
        : post({ action: "staff_save", id: id, name: st.name, service_ids: st.service_ids || [], hours: payload(days) });
      req.then(function () { busy = false; justSaved = id; toast(isShop ? "Orari salvati." : "Orari di " + st.name + " salvati."); return reload(); })
        .catch(function (e) { busy = false; render(); toast(e.message, true); });
    });
    ft.appendChild(save); pane.appendChild(ft);
    box.appendChild(pane);
  }

  /* ---------- scheda Chiusure ---------- */
  function today() { return ymd(new Date()); }
  function groups() {
    var all = S.blocks.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }), out = [], last = null;
    all.forEach(function (b) {
      var full = !!b.full_day;
      if (full && last && last.full && addDays(last.to, 1) === b.date) { last.to = b.date; last.ids.push(b.id); last.days++; return; }
      last = { type: "neg", from: b.date, to: b.date, ids: [b.id], days: 1, full: full, t1: b.from, t2: b.to };
      out.push(last);
    });
    return out;
  }
  function closureItems() {
    var items = groups();
    S.staff.forEach(function (st) {
      (st.off || []).forEach(function (o) { items.push({ type: "staff", who: st.name, id: o.id, kind: o.kind, from: o.date_from, to: o.date_to, days: Math.round((Date.parse(o.date_to) - Date.parse(o.date_from)) / 864e5) + 1 }); });
    });
    items.sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : 0; });
    return items;
  }
  function chips(box, items, isOn, pick) {
    box.textContent = "";
    items.forEach(function (it) {
      var b = mk("button", "avChip", it[1]); b.type = "button"; b.setAttribute("aria-pressed", isOn(it[0]) ? "true" : "false");
      b.addEventListener("click", function () { pick(it[0]); }); box.appendChild(b);
    });
  }
  function field(label, node, id) {
    var f = mk("div", "avField"); var l = mk("label", null, label); if (id) l.setAttribute("for", id); f.appendChild(l); f.appendChild(node); return f;
  }
  function renderChi(box) {
    var form = mk("div", "avCard");
    form.appendChild(mk("h3", "avH", "Nuova chiusura"));
    var staffOk = S.team && S.staff.length > 0;
    var who = mk("div", "avRow");
    var persons = [["neg", "Tutto il negozio"]]; if (staffOk) S.staff.forEach(function (s) { persons.push([s.id, s.name]); });
    if (persons.length > 1) form.appendChild(field("Chi", who));
    var quick = mk("div", "avRow");
    var d1 = dateField(C.from, today()); d1.id = "avD1";
    var d2 = dateField(C.to, today()); d2.id = "avD2";
    var dur = mk("div", "avSeg");
    var hrsBox = mk("div", "avField"); hrsBox.hidden = true;
    var kindBox = mk("div", "avRow");
    var warn = mk("div", "avWarn"); warn.hidden = true;
    var add = mk("button", "avBtn pri", "Aggiungi chiusura"); add.type = "button";

    function redrawWho() { chips(who, persons, function (k) { return C.who === k; }, function (k) { C.who = k; if (k !== "neg") C.part = false; redrawAll(); }); }
    function qd(a, b) { C.from = a; C.to = b; d1.value = a; d2.value = b; }
    function redrawQuick() {
      var t = today(), sun = addDays(t, 6 - dow(t)), nm = addDays(t, 7 - dow(t));
      quick.textContent = "";
      [["Oggi", t, t], ["Domani", addDays(t, 1), addDays(t, 1)], ["Questa settimana", t, sun], ["Prossima settimana", nm, addDays(nm, 6)]].forEach(function (q) {
        var b = mk("button", "avChip", q[0]); b.type = "button"; b.setAttribute("aria-pressed", C.from === q[1] && C.to === q[2] ? "true" : "false");
        b.addEventListener("click", function () { qd(q[1], q[2]); redrawQuick(); }); quick.appendChild(b);
      });
    }
    function redrawDur() {
      dur.textContent = "";
      var isNeg = C.who === "neg";
      [[false, "Tutto il giorno"], [true, "Solo alcune ore"]].forEach(function (o) {
        var b = mk("button", null, o[1]); b.type = "button"; b.setAttribute("aria-pressed", C.part === o[0] ? "true" : "false");
        if (o[0] && !isNeg) b.disabled = true;
        b.addEventListener("click", function () { C.part = o[0]; redrawAll(); }); dur.appendChild(b);
      });
      hrsBox.textContent = ""; hrsBox.hidden = !(C.part && isNeg);
      if (C.part && isNeg) {
        hrsBox.appendChild(mk("label", null, "Quali ore"));
        var r = mk("div", "avRow");
        [["Mattina", "09:00", "13:00"], ["Pausa pranzo", "13:00", "14:30"], ["Pomeriggio", "14:30", "19:00"], ["Fine giornata", "17:00", "19:00"]].forEach(function (q) {
          var b = mk("button", "avChip", q[0]); b.type = "button"; b.setAttribute("aria-pressed", C.tf === q[1] && C.tt === q[2] ? "true" : "false");
          b.addEventListener("click", function () { C.tf = q[1]; C.tt = q[2]; redrawDur(); }); r.appendChild(b);
        });
        hrsBox.appendChild(r);
        var tr = mk("div", "avTimes");
        tr.appendChild(mk("span", "avHint", "Dalle"));
        tr.appendChild(selT(C.tf, "Dalle ore", function (v) { C.tf = v; if (m(C.tt) <= m(v)) C.tt = step(v, 4); redrawDur(); }));
        tr.appendChild(mk("span", "avHint", "alle"));
        tr.appendChild(selT(C.tt, "Alle ore", function (v) { C.tt = v; if (m(C.tf) >= m(v)) C.tf = step(v, -4); redrawDur(); }));
        hrsBox.appendChild(tr);
        hrsBox.appendChild(mk("span", "avHint", "Vale per ogni giorno del periodo scelto."));
      }
      if (!isNeg) { hrsBox.hidden = false; hrsBox.textContent = ""; hrsBox.appendChild(mk("span", "avHint", "Le assenze a ore dei collaboratori arrivano presto. Per ora si segnano i giorni interi.")); }
    }
    function redrawKind() {
      kindBox.textContent = ""; var show = C.who !== "neg";
      kindBox.parentNode.hidden = !show; if (!show) return;
      [["ferie", "Ferie"], ["riposo", "Riposo"]].forEach(function (k) {
        var b = mk("button", "avChip", k[1]); b.type = "button"; b.setAttribute("aria-pressed", C.kind === k[0] ? "true" : "false");
        b.addEventListener("click", function () { C.kind = k[0]; redrawKind(); }); kindBox.appendChild(b);
      });
    }
    function redrawAll() { redrawWho(); redrawQuick(); redrawDur(); redrawKind(); }

    form.appendChild(field("Quando", quick));
    var dr = mk("div", "avRow"); dr.appendChild(field("Dal", d1, "avD1")); dr.appendChild(field("Al", d2, "avD2")); form.appendChild(dr);
    d1.addEventListener("change", function () { C.from = d1.value; if (!d2.value || d2.value < d1.value) { C.to = d1.value; d2.value = d1.value; } else C.to = d2.value; redrawQuick(); });
    d2.addEventListener("change", function () { C.to = d2.value; redrawQuick(); });
    form.appendChild(field("Per quanto tempo", dur));
    form.appendChild(hrsBox);
    var kf = field("Tipo di assenza", kindBox); form.appendChild(kf);
    form.appendChild(warn);
    form.appendChild(add);
    redrawAll();

    add.addEventListener("click", function () {
      var a = d1.value, b = d2.value || a;
      if (!a) { toast("Scegli un giorno o una scelta rapida.", true); return; }
      if (b < a) { toast("L'ultimo giorno è prima del primo.", true); return; }
      if (C.who === "neg" && C.part && m(C.tf) >= m(C.tt)) { toast("L'ora di fine deve essere dopo quella di inizio.", true); return; }
      var days = []; for (var d = a; d <= b && days.length < 93; d = addDays(d, 1)) days.push(d);
      if (C.who === "neg" && C.part && days.length > 31) { toast("Per le chiusure a ore scegli al massimo 31 giorni.", true); return; }
      busy = true; add.disabled = true;
      var run, conflicts = 0;
      if (C.who === "neg" && !C.part) {
        var body = { action: "block_create", date: a }; if (b > a) body.date_to = b;
        run = post(body).then(function (r) { conflicts = r.conflicts || 0; });
      } else if (C.who === "neg") {
        run = days.reduce(function (p, day) { return p.then(function () { return post({ action: "block_create", date: day, from: C.tf, to: C.tt }).then(function (r) { conflicts += r.conflicts || 0; }); }); }, Promise.resolve());
      } else {
        run = post({ action: "staff_off_add", resource_id: C.who, kind: C.kind, date_from: a, date_to: b }).then(function (r) { conflicts = r.conflicts || 0; });
      }
      run.then(function () {
        busy = false; C.from = ""; C.to = "";
        toast(conflicts ? "Chiusura aggiunta. Attenzione: " + conflicts + (conflicts === 1 ? " appuntamento già preso in quel periodo." : " appuntamenti già presi in quel periodo.") : "Chiusura aggiunta.");
        return reload();
      }).catch(function (e) { busy = false; add.disabled = false; toast(e.message, true); reload().catch(function () {}); });
    });
    box.appendChild(form);

    var lc = mk("div", "avCard"); lc.appendChild(mk("h3", "avH", "In programma"));
    var items = closureItems();
    if (!items.length) lc.appendChild(mk("div", "avNone", "Nessuna chiusura in programma."));
    items.forEach(function (it) {
      var r = mk("div", "avCl"), t = mk("div", "avClt");
      t.appendChild(mk("b", null, plabel(it.from, it.to)));
      var s = mk("small");
      if (it.type === "neg") {
        s.appendChild(mk("span", "avTag", "Negozio"));
        s.appendChild(document.createTextNode(it.t1 && it.t2 ? "dalle " + it.t1 + " alle " + it.t2 : "tutto il giorno" + (it.days > 1 ? " · " + it.days + " giorni" : "")));
      } else {
        s.appendChild(mk("span", "avTag p", it.who));
        s.appendChild(document.createTextNode((it.kind === "ferie" ? "Ferie" : "Riposo") + " · " + (it.days > 1 ? it.days + " giorni" : "tutto il giorno")));
      }
      t.appendChild(s); r.appendChild(t);
      var x = mk("button", "avX", "Togli"); x.type = "button";
      x.addEventListener("click", function () {
        if (x.getAttribute("data-ask") !== "1") { x.setAttribute("data-ask", "1"); x.textContent = "Sicuro?"; x.classList.add("ask"); setTimeout(function () { if (x.isConnected) { x.removeAttribute("data-ask"); x.textContent = "Togli"; x.classList.remove("ask"); } }, 3000); return; }
        x.disabled = true;
        var req = it.type === "neg" ? post({ action: "block_delete", ids: it.ids }) : post({ action: "staff_off_delete", id: it.id });
        req.then(function () { toast("Chiusura tolta."); return reload(); }).catch(function (e) { x.disabled = false; toast(e.message, true); });
      });
      r.appendChild(x); lc.appendChild(r);
    });
    box.appendChild(lc);
  }

  /* ---------- struttura ---------- */
  function paintSide() {
    var nav = $("avSide"); if (!nav) return; nav.textContent = "";
    function item(id, title, sub, extra) {
      var b = mk("button", "avSi" + (sel === id ? " on" : "") + (extra ? " " + extra : "")); b.type = "button";
      b.setAttribute("aria-pressed", sel === id ? "true" : "false");
      b.style.setProperty("--c", colorOf(id));
      if (id === "chi") { var a = mk("span", "avAv chi"); a.style.setProperty("--c", colorOf(id)); a.innerHTML = IC.cal; b.appendChild(a); } else b.appendChild(avatar(id));
      var t = mk("span", "avSt"); t.appendChild(mk("b", null, title)); t.appendChild(mk("small", null, sub)); b.appendChild(t);
      if (dirty(id)) { var dt = mk("span", "avDot"); dt.setAttribute("title", "Modifiche non salvate"); b.appendChild(dt); }
      b.addEventListener("click", function () { sel = id; render(); var sc = layer.querySelector(".avScroll"); if (sc) sc.scrollTop = 0; });
      nav.appendChild(b);
    }
    var wn = weekHours(NEG.days);
    nav.appendChild(mk("div", "avSl", "Negozio"));
    item("neg", "Negozio", "Orari di apertura · " + hword(wn.h));
    if (S.team && S.staff.length) {
      nav.appendChild(mk("div", "avSl", "Team"));
      S.staff.forEach(function (s) { var w = weekHours(TM[s.id].days); item(s.id, s.name + (s.is_owner ? " · tu" : ""), hword(w.h) + " · " + w.n + (w.n === 1 ? " giorno" : " giorni")); });
    }
    nav.appendChild(mk("div", "avSep"));
    var n = closureItems().length;
    item("chi", "Chiusure e assenze", n ? n + " in programma" : "Nessuna in programma");
    if (!S.team || !S.staff.length) {
      var h = mk("div", "avSide-hint");
      h.appendChild(mk("span", null, "Hai collaboratori? Aggiungili e imposta gli orari di ognuno."));
      var go = mk("button", "avMini lnk", "Apri Chi lavora da te"); go.type = "button";
      go.addEventListener("click", function () { close(false); var o = $("menuTabOther"); if (o) o.click(); setTimeout(function () { if (window.liaSettingsOpen) window.liaSettingsOpen("staff"); }, 90); });
      h.appendChild(go); nav.appendChild(h);
    }
  }
  function renderEmb() {
    if (!emb || !S || !emb.el.isConnected) return;
    var y = emb.sc ? emb.sc.scrollTop : 0;
    emb.el.textContent = ""; editor(emb.el, emb.id);
  }
  function render() {
    renderEmb();
    if (!layer || !S) return;
    if (sel !== "neg" && sel !== "chi" && (!S.team || !person(sel))) sel = "neg";
    paintSide();
    var box = $("avBody"), sc = layer.querySelector(".avScroll"), y = sc ? sc.scrollTop : 0;
    box.textContent = "";
    if (sel === "chi") {
      var hd = mk("div", "avHd flat"), tt = mk("div", "avHt"); hd.style.setProperty("--c", colorOf("chi"));
      tt.appendChild(mk("h2", null, "Chiusure e assenze"));
      tt.appendChild(mk("p", null, "Ferie, festivi, permessi: un giorno, più giorni o solo alcune ore."));
      hd.appendChild(tt); box.appendChild(hd);
      renderChi(box);
    } else editor(box, sel);
    if (sc) sc.scrollTop = y;
  }
  function build() {
    layer = mk("div", "mnLayer avLayer"); layer.id = "avLayer"; layer.hidden = true;
    layer.setAttribute("role", "dialog"); layer.setAttribute("aria-modal", "true"); layer.setAttribute("aria-labelledby", "avT");
    layer.innerHTML =
      '<div class="avScroll"><div class="avIn">' +
      '<div class="avTop"><button type="button" class="mnBack" id="avBack" aria-label="Indietro">' + IC.back + '</button><div><h2 id="avT">Disponibilità</h2><p class="avSubT">Quando ricevi, chi lavora e quando sei chiuso.</p></div></div>' +
      '<div class="avApp"><nav id="avSide" class="avSide" aria-label="Orari di"></nav><section id="avBody" class="avMain"></section></div>' +
      '</div></div>';
    document.body.appendChild(layer);
    $("avBack").addEventListener("click", function () { close(); });
    var menu = $("burgerMenu");
    if (menu) menu.addEventListener("click", function (ev) { var bt = ev.target.closest && ev.target.closest("button"); if (bt && bt.id !== "menuTabAvail") close(false); });
  }
  function place() {
    if (!layer) return;
    var h = document.querySelector(".mainTop"), t = 0;
    try { window.scrollTo(0, 0); } catch (e) {}
    if (h) { t = Math.round(h.getBoundingClientRect().bottom); if (t <= 0) t = Math.round(h.offsetHeight || 0); t = Math.max(0, t); }
    layer.style.top = t + "px";
  }
  window.addEventListener("resize", function () { if (layer && !layer.hidden) place(); });
  /* voce del menu burger evidenziata mentre la pagina e' aperta */
  var prevCur = [];
  function markMenu(on) {
    var av = $("menuTabAvail"), menu = $("burgerMenu");
    if (on) {
      prevCur = [];
      if (menu) menu.querySelectorAll('[aria-current="true"]').forEach(function (b) { if (b !== av) { prevCur.push(b); b.setAttribute("aria-current", "false"); } });
      if (av) av.setAttribute("aria-current", "true");
    } else {
      if (av) av.setAttribute("aria-current", "false");
    }
  }
  function close(keepMenu) {
    if (layer && !layer.hidden) layer.hidden = true;
    markMenu(false);
    if (keepMenu !== false) { prevCur.forEach(function (b) { b.setAttribute("aria-current", "true"); }); }
    prevCur = [];
  }
  function pick() {
    if (pending === "chi") sel = "chi";
    else if (pending === "neg") sel = "neg";
    else if (pending === "team") sel = S.team && S.staff.length ? S.staff[0].id : "neg";
    pending = null;
  }
  function open(t) {
    if (!layer) build();
    pending = t === "neg" || t === "team" || t === "chi" ? t : "chi";
    layer.hidden = false; place(); markMenu(true);
    var body = $("avBody");
    if (!S) { body.textContent = ""; body.appendChild(mk("p", "avLoad", "Carico gli orari…")); }
    var c = cached();
    var shown = false;
    if (c) { apply(c); pick(); render(); shown = true; }
    else if (S) { pick(); render(); shown = true; }
    var touched = false;
    var mark = function () { touched = true; };
    layer.addEventListener("pointerdown", mark, { once: true });
    layer.addEventListener("keydown", mark, { once: true });
    fresh().then(function (d) { apply(d); if (!shown || !touched) { if (!shown) pick(); render(); } }).catch(function (e) { if (shown) return; body.textContent = ""; body.appendChild(mk("p", "avErr", e.message || "Non riesco a leggere gli orari. Riprova.")); });
  }
  /* editor degli orari dentro una pagina delle Impostazioni (stesse tessere della pagina Disponibilita') */
  window.liaAvailMount = function (el, id) {
    if (!el) return;
    emb = { el: el, id: id || "neg" }; el.classList.add("avEmbed");
    if (!S) { el.textContent = ""; el.appendChild(mk("p", "avLoad", "Carico gli orari…")); }
    var c2 = cached(), shown2 = false;
    if (c2) { apply(c2); renderEmb(); shown2 = true; }
    fresh().then(function (d) { apply(d); if (!shown2) renderEmb(); }).catch(function (e) { el.textContent = ""; el.appendChild(mk("p", "avErr", e.message || "Non riesco a leggere gli orari. Riprova.")); });
  };
  window.liaAvailOpen = open;
  window.liaAvailClose = close;
})();
