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
    check: '<svg width="16" height="16" viewBox="0 0 24 24" ' + SV + ' stroke-width="2.6"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  var layer = null, S = null, tab = "neg", openStaff = null, busy = false;
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
    var t = $("avToast"); if (!t) return;
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
    S = {
      team: d.team_mode === "team",
      staff: Array.isArray(d.staff) ? d.staff : [],
      blocks: Array.isArray(d.blocks) ? d.blocks : [],
      hours: d.hours || []
    };
    NEG.days = modelFromList(S.hours); NEG.base = JSON.stringify(NEG.days);
    TM = {};
    S.staff.forEach(function (st) { var days = modelFromList(st.hours); TM[st.id] = { days: days, base: JSON.stringify(days) }; });
    if (!S.team && C.who !== "neg") C.who = "neg";
    if (C.who !== "neg" && !S.staff.some(function (x) { return x.id === C.who; })) C.who = "neg";
  }
  function reload() { return fresh().then(function (d) { apply(d); render(); }); }

  /* ---------- pezzi di interfaccia ---------- */
  var TIMES = [];
  (function () { for (var q = 5 * 60; q <= 23 * 60 + 45; q += 15) TIMES.push(pad(Math.floor(q / 60)) + ":" + pad(q % 60)); })();
  function sel(val, label, fn) {
    var s = document.createElement("select"); s.setAttribute("aria-label", label);
    var list = TIMES.slice(); if (list.indexOf(val) < 0) { list.push(val); list.sort(); }
    list.forEach(function (t) { var o = mk("option", null, t); o.value = t; if (t === val) o.selected = true; s.appendChild(o); });
    s.addEventListener("change", function () { fn(s.value); });
    return s;
  }
  function step(val, n) { var i = TIMES.indexOf(val); return TIMES[Math.max(0, Math.min(TIMES.length - 1, (i < 0 ? 0 : i) + n))]; }

  /* elenco giorni: lo stesso per negozio e per ogni collaboratore */
  function dayList(box, days, onChange, shopRef) {
    box.textContent = "";
    days.forEach(function (d, i) {
      var row = mk("div", "avDay" + (d.open ? "" : " off"));
      var head = mk("div", "avDh");
      var bd = mk("span", "avBd", DS[i]);
      var nm = mk("span", "avDn", DN[i]);
      var sw = mk("button", "avSw"); sw.type = "button"; sw.setAttribute("role", "switch"); sw.setAttribute("aria-checked", d.open ? "true" : "false"); sw.setAttribute("aria-label", DN[i] + (d.open ? ": aperto" : ": chiuso"));
      sw.addEventListener("click", function () {
        if (d.open) days[i] = { open: false };
        else { var ref = shopRef && shopRef[i] && shopRef[i].open ? shopRef[i] : null; days[i] = ref ? copy(ref) : { open: true, from: "09:00", to: "19:00", pause: null }; }
        onChange();
      });
      var wrap = mk("span", "avDl"); wrap.appendChild(bd); wrap.appendChild(nm);
      head.appendChild(wrap);
      if (!d.open) head.appendChild(mk("span", "avClosed", "Chiuso"));
      head.appendChild(sw);
      row.appendChild(head);
      if (d.open && d.custom) {
        var cu = mk("div", "avSub");
        cu.appendChild(mk("span", "avInfo", "Fasce: " + d.custom.map(function (x) { return x.open + "–" + x.close; }).join(" · ")));
        var sp = mk("button", "avMini", "Semplifica"); sp.type = "button";
        sp.addEventListener("click", function () { var f = d.custom[0], l = d.custom[d.custom.length - 1]; days[i] = { open: true, from: f.open, to: l.close, pause: null }; onChange(); });
        cu.appendChild(sp); row.appendChild(cu);
      } else if (d.open) {
        var tm = mk("div", "avTimes");
        tm.appendChild(mk("span", "avClk", "")); tm.lastChild.innerHTML = IC.clock;
        tm.appendChild(sel(d.from, DN[i] + ", apertura", function (v) { d.from = v; if (m(d.to) <= m(v)) d.to = step(v, 4); onChange(); }));
        tm.appendChild(mk("i", null, "–"));
        tm.appendChild(sel(d.to, DN[i] + ", chiusura", function (v) { d.to = v; if (m(d.from) >= m(v)) d.from = step(v, -4); onChange(); }));
        row.appendChild(tm);
        var sub = mk("div", "avSub");
        if (d.pause) {
          var pw = mk("div", "avPause");
          pw.appendChild(mk("span", "avPl", "Pausa"));
          pw.appendChild(sel(d.pause.from, DN[i] + ", inizio pausa", function (v) { d.pause.from = v; if (m(d.pause.to) <= m(v)) d.pause.to = step(v, 2); onChange(); }));
          pw.appendChild(mk("i", null, "–"));
          pw.appendChild(sel(d.pause.to, DN[i] + ", fine pausa", function (v) { d.pause.to = v; if (m(d.pause.from) >= m(v)) d.pause.from = step(v, -2); onChange(); }));
          var rm = mk("button", "avX", "✕"); rm.type = "button"; rm.setAttribute("aria-label", "Togli la pausa"); rm.addEventListener("click", function () { d.pause = null; onChange(); });
          pw.appendChild(rm); sub.appendChild(pw);
        } else {
          var ap = mk("button", "avMini", "+ Pausa"); ap.type = "button";
          ap.addEventListener("click", function () {
            var a = m(d.from), b = m(d.to), mid = Math.round((a + b) / 2 / 15) * 15;
            var pf = pad(Math.floor(mid / 60)) + ":" + pad(mid % 60), pt = step(pf, 4);
            if (m(pf) <= a || m(pt) >= b) { pf = step(d.from, 2); pt = step(pf, 2); }
            if (m(pt) >= b) { toast("Orario troppo breve per una pausa.", true); return; }
            d.pause = { from: pf, to: pt }; onChange();
          });
          sub.appendChild(ap);
        }
        var cp = mk("button", "avMini lnk", "Copia su tutti i giorni aperti"); cp.type = "button";
        cp.addEventListener("click", function () {
          days.forEach(function (x, k) { if (x.open && k !== i) days[k] = copy(d); });
          onChange(); toast("Orario copiato su tutti i giorni aperti.");
        });
        sub.appendChild(cp);
        row.appendChild(sub);
      }
      box.appendChild(row);
    });
  }

  function summary(days, caption) {
    var w = weekHours(days);
    var c = mk("div", "avSum");
    var l = mk("div");
    l.appendChild(mk("b", null, hword(w.h)));
    l.appendChild(mk("span", null, caption));
    c.appendChild(l);
    c.appendChild(mk("em", null, w.n + (w.n === 1 ? " giorno aperto" : " giorni aperti")));
    return c;
  }

  var PRESETS = [
    ["Lun–Ven 9–18", [1, 1, 1, 1, 1, 0, 0], "09:00", "18:00"],
    ["Lun–Sab 9–19", [1, 1, 1, 1, 1, 1, 0], "09:00", "19:00"],
    ["Tutti i giorni", [1, 1, 1, 1, 1, 1, 1], "09:00", "19:00"]
  ];
  function presets(days, onChange) {
    var r = mk("div", "avRow");
    r.appendChild(mk("span", "avHint", "Parti da:"));
    PRESETS.forEach(function (p) {
      var b = mk("button", "avChip", p[0]); b.type = "button";
      b.addEventListener("click", function () {
        for (var i = 0; i < 7; i++) days[i] = p[1][i] ? { open: true, from: p[2], to: p[3], pause: null } : { open: false };
        onChange(); toast("Orari impostati: " + p[0]);
      });
      r.appendChild(b);
    });
    return r;
  }

  /* ---------- scheda Negozio ---------- */
  function renderNeg(box) {
    var card = mk("div", "avCard");
    var sumBox = mk("div"); card.appendChild(sumBox);
    card.appendChild(presets(NEG.days, redraw));
    var list = mk("div", "avDays"); card.appendChild(list);
    var save = mk("button", "avBtn pri"); save.type = "button"; card.appendChild(save);
    var note = mk("div", "avErr"); note.hidden = true; card.appendChild(note);
    function redraw() {
      sumBox.textContent = ""; sumBox.appendChild(summary(NEG.days, "aperte a settimana"));
      dayList(list, NEG.days, redraw, null);
      var dirty = JSON.stringify(NEG.days) !== NEG.base;
      save.textContent = dirty ? "Salva orari" : "Orari salvati"; save.disabled = !dirty || busy;
      save.classList.toggle("done", !dirty);
      var pr = problem(NEG.days); note.hidden = !pr; note.textContent = pr;
    }
    save.addEventListener("click", function () {
      var pr = problem(NEG.days); if (pr) { toast(pr, true); return; }
      busy = true; redraw();
      post({ action: "hours_replace", hours: payload(NEG.days) }).then(function () { busy = false; toast("Orari salvati."); return reload(); })
        .catch(function (e) { busy = false; redraw(); toast(e.message, true); });
    });
    redraw();
    box.appendChild(card);
    box.appendChild(mk("p", "avFoot", "Questi sono gli orari in cui ricevi. Per ferie e giorni a parte usa la scheda Chiusure."));
  }

  /* ---------- scheda Team ---------- */
  function weekStrip(days) {
    var w = mk("div", "avWeek");
    days.forEach(function (d, i) {
      var x = mk("span", "avWd" + (d.open ? " on" : ""));
      x.appendChild(mk("b", null, DS[i]));
      var tx = "Libero";
      if (d.open) { var iv = toIntervals(d); tx = iv[0].open.replace(":00", "") + "–" + iv[iv.length - 1].close.replace(":00", ""); }
      x.appendChild(document.createTextNode(tx));
      w.appendChild(x);
    });
    return w;
  }
  function renderTeam(box) {
    if (!S.team || !S.staff.length) {
      var e = mk("div", "avCard avEmpty");
      e.appendChild(mk("b", null, "Al momento ricevi i clienti solo tu"));
      e.appendChild(mk("p", null, "Gli orari sono quelli del negozio. Se hai collaboratori, aggiungili in «Chi lavora da te»: poi imposterai qui gli orari di ognuno."));
      var go = mk("button", "avBtn", "Apri «Chi lavora da te»"); go.type = "button";
      go.addEventListener("click", function () { close(); var o = $("menuTabOther"); if (o) o.click(); setTimeout(function () { if (window.liaSettingsOpen) window.liaSettingsOpen("staff"); }, 90); });
      e.appendChild(go); box.appendChild(e); return;
    }
    S.staff.forEach(function (st) {
      var T = TM[st.id], card = mk("div", "avCard avPers" + (openStaff === st.id ? " open" : ""));
      var head = mk("button", "avPh"); head.type = "button"; head.setAttribute("aria-expanded", openStaff === st.id ? "true" : "false");
      var av = mk("span", "avAv", String(st.name || "?").charAt(0).toUpperCase()); av.style.setProperty("--h", hue(st.name));
      var tx = mk("span", "avPt");
      tx.appendChild(mk("b", null, st.name + (st.is_owner ? " (tu)" : "")));
      var w = weekHours(T.days);
      tx.appendChild(mk("small", null, hword(w.h) + " a settimana · " + w.n + (w.n === 1 ? " giorno" : " giorni")));
      head.appendChild(av); head.appendChild(tx);
      var cv = mk("span", "avCv"); cv.innerHTML = IC.chev; head.appendChild(cv);
      head.addEventListener("click", function () { openStaff = openStaff === st.id ? null : st.id; render(); });
      card.appendChild(head);
      card.appendChild(weekStrip(T.days));
      if (openStaff === st.id) {
        var body = mk("div", "avPb");
        var act = mk("div", "avRow");
        var like = mk("button", "avChip", "Come il negozio"); like.type = "button";
        like.addEventListener("click", function () { T.days = copy(NEG.days); render(); toast(st.name + ": orari copiati dal negozio. Ricorda di salvare."); });
        var ab = mk("button", "avChip", "Segna assenza"); ab.type = "button";
        ab.addEventListener("click", function () { C.who = st.id; C.part = false; setTab("chi"); });
        act.appendChild(like); act.appendChild(ab); body.appendChild(act);
        var list = mk("div", "avDays"); body.appendChild(list);
        var save = mk("button", "avBtn pri"); save.type = "button"; body.appendChild(save);
        var note = mk("div", "avErr"); note.hidden = true; body.appendChild(note);
        (function (st, T, list, save, note) {
          function redraw() {
            dayList(list, T.days, redraw, NEG.days);
            var dirty = JSON.stringify(T.days) !== T.base;
            save.textContent = dirty ? "Salva orari di " + st.name : "Orari salvati"; save.disabled = !dirty || busy;
            save.classList.toggle("done", !dirty);
            var pr = problem(T.days); note.hidden = !pr; note.textContent = pr;
          }
          save.addEventListener("click", function () {
            var pr = problem(T.days); if (pr) { toast(pr, true); return; }
            busy = true; redraw();
            post({ action: "staff_save", id: st.id, name: st.name, service_ids: st.service_ids || [], hours: payload(T.days) })
              .then(function () { busy = false; toast("Orari di " + st.name + " salvati."); return reload(); })
              .catch(function (e) { busy = false; redraw(); toast(e.message, true); });
          });
          redraw();
        })(st, T, list, save, note);
        card.appendChild(body);
      }
      box.appendChild(card);
    });
    box.appendChild(mk("p", "avFoot", "I clienti possono prenotare con una persona solo nei suoi giorni e orari."));
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
    var d1 = document.createElement("input"); d1.type = "date"; d1.id = "avD1"; d1.min = today(); d1.value = C.from;
    var d2 = document.createElement("input"); d2.type = "date"; d2.id = "avD2"; d2.min = today(); d2.value = C.to;
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
        tr.appendChild(sel(C.tf, "Dalle ore", function (v) { C.tf = v; if (m(C.tt) <= m(v)) C.tt = step(v, 4); redrawDur(); }));
        tr.appendChild(mk("span", "avHint", "alle"));
        tr.appendChild(sel(C.tt, "Alle ore", function (v) { C.tt = v; if (m(C.tf) >= m(v)) C.tf = step(v, -4); redrawDur(); }));
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
  function setTab(t) { tab = t; render(); var sc = layer && layer.querySelector(".avScroll"); if (sc) sc.scrollTop = 0; }
  function render() {
    if (!layer || !S) return;
    layer.querySelectorAll(".avTab").forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-t") === tab ? "true" : "false"); });
    var team = layer.querySelector('[data-t="team"]'); if (team) team.hidden = false;
    var box = $("avBody"), sc = layer.querySelector(".avScroll"), y = sc ? sc.scrollTop : 0;
    box.textContent = "";
    if (tab === "neg") renderNeg(box); else if (tab === "team") renderTeam(box); else renderChi(box);
    if (sc) sc.scrollTop = y;
  }
  function build() {
    layer = mk("div", "mnLayer avLayer"); layer.id = "avLayer"; layer.hidden = true;
    layer.setAttribute("role", "dialog"); layer.setAttribute("aria-modal", "true"); layer.setAttribute("aria-labelledby", "avT");
    layer.innerHTML =
      '<div class="avScroll"><div class="avIn">' +
      '<div class="avTop"><button type="button" class="mnBack" id="avBack" aria-label="Indietro">' + IC.back + '</button><div><h2 id="avT">Disponibilità</h2><p class="avSubT">Quando ricevi, chi lavora e quando sei chiuso.</p></div></div>' +
      '<div class="avTabs" role="tablist"><button type="button" class="avTab" role="tab" data-t="neg">Negozio</button><button type="button" class="avTab" role="tab" data-t="team">Team</button><button type="button" class="avTab" role="tab" data-t="chi">Chiusure</button></div>' +
      '<div id="avBody" class="avBody"></div>' +
      '</div></div><div class="avToast" id="avToast" role="status"></div>';
    document.body.appendChild(layer);
    $("avBack").addEventListener("click", close);
    layer.querySelectorAll(".avTab").forEach(function (b) { b.addEventListener("click", function () { setTab(b.getAttribute("data-t")); }); });
    var menu = $("burgerMenu");
    if (menu) menu.addEventListener("click", function (ev) { var bt = ev.target.closest && ev.target.closest("button"); if (bt && bt.id !== "menuTabAvail") close(); });
  }
  function place() {
    if (!layer) return;
    var h = document.querySelector(".mainTop"), t = 0;
    if (h) { t = Math.max(0, Math.round(h.getBoundingClientRect().bottom)); }
    layer.style.top = t + "px";
  }
  window.addEventListener("resize", function () { if (layer && !layer.hidden) place(); });
  function close() { if (layer && !layer.hidden) layer.hidden = true; }
  function open(t) {
    if (!layer) build();
    if (t === "neg" || t === "team" || t === "chi") tab = t;
    layer.hidden = false; place();
    var body = $("avBody");
    if (!S) { body.textContent = ""; body.appendChild(mk("p", "avLoad", "Carico gli orari…")); }
    fresh().then(function (d) { apply(d); render(); }).catch(function (e) { body.textContent = ""; body.appendChild(mk("p", "avErr", e.message || "Non riesco a leggere gli orari. Riprova.")); });
  }
  window.liaAvailOpen = open;
  window.liaAvailClose = close;
})();
