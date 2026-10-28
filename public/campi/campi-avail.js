/* Disponibilità del circolo (campi sportivi): stessa pagina e stesso stile di quella dei parrucchieri
   (public/dash/avail.js + avail.css): lista a sinistra, dettaglio a destra, ore con − e +, date in italiano.
   Dati e salvataggi: /api/agenda?t=CODICE&courts=1 (view=settings, save_court, add_closure, delete_closure). */
(function () {
  "use strict";
  var token = "";
  try { token = (new URLSearchParams(location.search).get("t") || "").trim(); } catch (e) {}
  if (!token) return;
  var URL0 = "/api/agenda?t=" + encodeURIComponent(token) + "&courts=1";
  var DN = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
  var DS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
  var MO = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  var SV = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  var IC = {
    back: '<svg width="20" height="20" viewBox="0 0 24 24" ' + SV + ' stroke-width="2.2"><path d="M15 6l-6 6 6 6"/></svg>',
    cal: '<svg width="19" height="19" viewBox="0 0 24 24" ' + SV + ' stroke-width="2"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 10h18M8 2v4M16 2v4M10 14l4 4M14 14l-4 4"/></svg>',
    club: '<svg width="24" height="24" viewBox="0 0 24 24" ' + SV + ' stroke-width="2.1"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M12 6v12M3 12h18"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" ' + SV + ' stroke-width="2.6"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  var layer = null, D = null, busy = false, toastT = null, pending = null, justSaved = null, avPrevLbl = "", prevCur = [];
  var sel = "club";                       /* "club", id di un campo oppure "chi" (lavori e indisponibilità) */
  var HS = {}, CU = {}, BASE = {};        /* orari per chiave ("" = circolo, poi id campo), orari propri, stato salvato */
  var C = { who: "", from: "", to: "", part: false, tf: "18:00", tt: "20:00" };

  function $(id) { return document.getElementById(id); }
  function mk(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function m(s) { var a = String(s).split(":"); return Number(a[0]) * 60 + Number(a[1]); }
  function pad(n) { return ("0" + n).slice(-2); }
  function ymd(x) { return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); }
  function today() { return (D && D.today) || ymd(new Date()); }
  function addDays(s, n) { var x = new Date(s + "T12:00:00"); x.setDate(x.getDate() + n); return ymd(x); }
  function dow(s) { return (new Date(s + "T12:00:00").getDay() + 6) % 7; }
  function dlab(s) { var x = new Date(s + "T12:00:00"); return DS[dow(s)] + " " + x.getDate() + " " + MO[x.getMonth()].slice(0, 3); }
  function dfull(s) { var x = new Date(s + "T12:00:00"); return DN[dow(s)] + " " + x.getDate() + " " + MO[x.getMonth()]; }
  function plabel(a, b) { return a === b ? dfull(a) : dlab(a) + " – " + dlab(b); }
  function hword(h) { var r = Math.round(h * 10) / 10; return String(r).replace(".", ",") + (r === 1 ? " ora" : " ore"); }
  function ndays(a, b) { return Math.round((Date.parse(b + "T12:00:00") - Date.parse(a + "T12:00:00")) / 864e5) + 1; }

  function toast(msg, bad) {
    var t = $("avToast"); if (!t) { t = mk("div", "avToast"); t.id = "avToast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.className = "avToast show" + (bad ? " bad" : "");
    clearTimeout(toastT); toastT = setTimeout(function () { t.className = "avToast"; }, 3200);
  }

  /* ---------- rete ---------- */
  function call(body, view) {
    var o = body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {};
    return fetch(URL0 + (view ? "&view=" + view : ""), o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || "Errore, riprova."); return j; });
    });
  }
  function changed() { if (window.__cpReload) { try { window.__cpReload(); } catch (e) {} } }

  /* ---------- modello orari: un giorno = chiuso, una fascia, oppure più fasce ---------- */
  function toModel(rs) {
    rs = (rs || []).map(function (r) { return { open: String(r[0]).slice(0, 5), close: String(r[1]).slice(0, 5) }; }).sort(function (a, b) { return a.open < b.open ? -1 : 1; });
    if (!rs.length) return { open: false };
    if (rs.length === 1) return { open: true, from: rs[0].open, to: rs[0].close };
    return { open: true, custom: rs };
  }
  function toRanges(d) {
    if (!d.open) return [];
    if (d.custom) return d.custom.map(function (x) { return [x.open, x.close]; });
    return [[d.from, d.to]];
  }
  function modelOf(hours) { var out = []; for (var d = 1; d <= 7; d++) out.push(toModel((hours || {})[String(d)] || (hours || {})[d])); return out; }
  function payload(days) { var o = {}; days.forEach(function (d, i) { o[String(i + 1)] = toRanges(d); }); return o; }
  function dayHours(d) { var t = 0; toRanges(d).forEach(function (x) { t += m(x[1]) - m(x[0]); }); return t / 60; }
  function weekHours(days) { var t = 0, n = 0; days.forEach(function (d) { var h = dayHours(d); if (h > 0) { t += h; n++; } }); return { h: t, n: n }; }
  function problem(days) {
    for (var i = 0; i < days.length; i++) {
      var d = days[i]; if (!d.open || d.custom) continue;
      if (m(d.from) >= m(d.to)) return DN[i] + ": l'apertura deve essere prima della chiusura.";
    }
    return "";
  }

  /* ---------- dati ---------- */
  function circleCourt() {
    var fol = D.courts.filter(function (c) { return !c.custom_hours; });
    return fol.filter(function (c) { return c.active; })[0] || fol[0] || D.courts[0] || null;
  }
  function stateOf(k) { return JSON.stringify(k === "" ? HS[""] : { c: !!CU[k], d: HS[k] }); }
  function dirty(k) { return BASE[k] != null && stateOf(k) !== BASE[k]; }
  function keys() { return [""].concat(D.courts.map(function (c) { return c.id; })); }
  function apply(d) {
    var keep = {}, hadD = !!D;
    if (hadD) keys().forEach(function (k) { if (k !== justSaved && dirty(k)) keep[k] = { d: copy(HS[k]), c: !!CU[k] }; });
    justSaved = null; D = d; D.courts = D.courts || []; D.closures = D.closures || [];
    HS = {}; CU = {}; BASE = {};
    var bc = circleCourt();
    HS[""] = modelOf(bc ? bc.hours : {}); BASE[""] = stateOf("");
    D.courts.forEach(function (c) { CU[c.id] = !!c.custom_hours; HS[c.id] = modelOf(c.hours); BASE[c.id] = stateOf(c.id); });
    Object.keys(keep).forEach(function (k) { if (HS[k] != null) { HS[k] = keep[k].d; if (k !== "") CU[k] = keep[k].c; } });
    if (sel !== "club" && sel !== "chi" && !D.courts.some(function (c) { return c.id === sel; })) sel = "club";
    if (D.courts.length < 2 && sel !== "chi") sel = "club";
  }
  function reload() { return call(null, "settings").then(function (d) { apply(d); render(); }); }
  function courtOf(id) { for (var i = 0; i < D.courts.length; i++) if (D.courts[i].id === id) return D.courts[i]; return null; }
  function keyOf(s) { return s === "club" ? "" : s; }

  /* ---------- pezzi di interfaccia ---------- */
  var TIMES = [];
  (function () { for (var q = 0; q <= 23 * 60 + 30; q += 30) TIMES.push(pad(Math.floor(q / 60)) + ":" + pad(q % 60)); })();
  function dateField(val, min) {
    if (window.liaDateField) return window.liaDateField(val, min);
    var i = mk("input", "set-input"); i.type = "date"; if (min) i.min = min; i.value = val || min || ""; return i;
  }
  function selT(val, label, fn) {
    var s = document.createElement("select"); s.setAttribute("aria-label", label);
    var list = TIMES.slice(); if (list.indexOf(val) < 0) { list.push(val); list.sort(); }
    list.forEach(function (t) { var o = mk("option", null, t); o.value = t; if (t === val) o.selected = true; s.appendChild(o); });
    s.addEventListener("change", function () { fn(s.value); });
    return s;
  }
  function step(val, n) { var i = TIMES.indexOf(val); return TIMES[Math.max(0, Math.min(TIMES.length - 1, (i < 0 ? 0 : i) + n))]; }
  function nudge(val, dm) { var top = Math.max(23 * 60 + 30, m(val)), x = Math.max(0, Math.min(top, m(val) + dm)); return pad(Math.floor(x / 60)) + ":" + pad(x % 60); }

  /* − 09:00 + */
  function tmr(val, label, fn) {
    var r = mk("div", "avTmr"), a = mk("button", null, "−"), p = mk("button", null, "+"), o = mk("output", null, val);
    a.type = p.type = "button";
    a.setAttribute("aria-label", label + ", mezz'ora prima"); p.setAttribute("aria-label", label + ", mezz'ora dopo");
    a.addEventListener("click", function () { var v = nudge(val, -30); if (v !== val) fn(v); });
    p.addEventListener("click", function () { var v = nudge(val, 30); if (v !== val) fn(v); });
    r.appendChild(a); r.appendChild(o); r.appendChild(p); return r;
  }

  var PAL = { club: "#2B8A94" };
  function courtColor(c) { var s = ((c && c.surface) || "").toLowerCase(); return /terra/.test(s) ? "#D9784A" : /cement/.test(s) ? "#5B8DB8" : /erba|prato/.test(s) ? "#5DB07A" : "#4BB3D6"; }
  function colorOf(id) { if (id === "club") return PAL.club; if (id === "chi") return "#E5826A"; var c = courtOf(id); return c ? courtColor(c) : PAL.club; }
  function tag(c) { var n = (c.name || "").match(/\d+/); return n ? n[0] : String(c.name || "?").charAt(0).toUpperCase(); }
  function avatar(id) {
    var a = mk("span", "avAv"); a.style.setProperty("--c", colorOf(id));
    if (id === "club") { a.classList.add("shop"); a.innerHTML = IC.club; }
    else { var c = courtOf(id); a.textContent = c ? tag(c) : "?"; }
    return a;
  }

  /* una riga per giorno: pulsante Aperto / + Apri, ore con − e +, niente pausa (un circolo non ha pausa pranzo) */
  function dayRows(list, days, ref) {
    list.textContent = "";
    days.forEach(function (d, i) {
      var er = mk("div", "avEr" + (d.open ? " on" : " off")), ln = mk("div", "avEl");
      ln.appendChild(mk("span", "avEd", DN[i]));
      var sw = mk("button", "avPill" + (d.open ? " on" : "")); sw.type = "button";
      sw.setAttribute("aria-pressed", d.open ? "true" : "false"); sw.setAttribute("aria-label", DN[i] + (d.open ? ": aperto, tocca per chiudere" : ": chiuso, tocca per aprire"));
      sw.textContent = d.open ? "Aperto" : "+ Apri";
      sw.addEventListener("click", function () {
        if (d.open) days[i] = { open: false };
        else { var r = ref && ref[i] && ref[i].open ? ref[i] : null; days[i] = r ? copy(r) : { open: true, from: "08:00", to: "22:00" }; }
        render();
      });
      ln.appendChild(sw);
      var tc = mk("div", "avEt");
      if (!d.open) tc.appendChild(mk("span", "avClosed", "Chiuso"));
      else if (d.custom) {
        tc.appendChild(mk("span", "avInfo", "Fasce: " + d.custom.map(function (x) { return x.open + "–" + x.close; }).join(" · ")));
        var sp = mk("button", "avMini", "Semplifica"); sp.type = "button";
        sp.addEventListener("click", function () { var f = d.custom[0], l = d.custom[d.custom.length - 1]; days[i] = { open: true, from: f.open, to: l.close }; render(); });
        tc.appendChild(sp);
      } else {
        var tl = function (lab, node) { var r = mk("div", "avTl"); r.appendChild(mk("span", null, lab)); r.appendChild(node); return r; };
        tc.appendChild(tl("Apre", tmr(d.from, DN[i] + ", apertura", function (v) { if (m(v) >= m(d.to)) return; d.from = v; render(); })));
        tc.appendChild(tl("Chiude", tmr(d.to, DN[i] + ", chiusura", function (v) { if (m(v) <= m(d.from)) return; d.to = v; render(); })));
      }
      ln.appendChild(tc); er.appendChild(ln); list.appendChild(er);
    });
  }

  /* ---------- editor: orari del circolo / di un campo ---------- */
  function noCourts(box) {
    var pane = mk("div", "avPane"); pane.style.setProperty("--c", colorOf("club"));
    pane.appendChild(mk("p", "avHint", "Prima di impostare gli orari aggiungi almeno un campo."));
    var go = mk("button", "avBtn pri", "Apri Campi"); go.type = "button";
    go.addEventListener("click", function () { close(false); var o = $("menuTabOther"); if (o) o.click(); setTimeout(function () { if (window.liaCampiOpen) window.liaCampiOpen("courts"); }, 120); });
    pane.appendChild(go); box.appendChild(pane);
  }
  function editor(box, id) {
    var k = keyOf(id), isClub = id === "club", c = isClub ? null : courtOf(id);
    if (!D.courts.length) { noCourts(box); return; }
    var own = isClub ? true : !!CU[k], days = HS[k];
    var pane = mk("div", "avPane"); pane.style.setProperty("--c", colorOf(id));
    var w = weekHours(days);
    var head = mk("div", "avHd");
    head.appendChild(avatar(id));
    var tt = mk("div", "avHt");
    tt.appendChild(mk("h2", null, isClub ? "Circolo · orari di apertura" : c.name));
    tt.appendChild(mk("p", null, !own ? "Segue gli orari del circolo" : hword(w.h) + " a settimana · " + w.n + (w.n === 1 ? " giorno" : " giorni") + " di apertura"));
    head.appendChild(tt); pane.appendChild(head);
    pane.appendChild(mk("p", "avHint", isClub
      ? "Sono gli orari di tutti i campi, tranne quelli a cui dai orari propri. Fuori da questi orari non si può prenotare, né dalla pagina né da Lia. Per tornei e lavori usa Lavori e indisponibilità."
      : (own ? c.name + " ha orari propri, diversi da quelli del circolo. Gli altri campi non cambiano." : c.name + " segue gli orari del circolo. Attiva gli orari propri per dargli giorni e ore diversi, ad esempio per tenere chiusi d'inverno i campi esterni.")));

    if (!isClub) {
      var line = mk("div", "avRow");
      var tg = mk("button", "avPill" + (own ? " on" : "")); tg.type = "button";
      tg.setAttribute("aria-pressed", own ? "true" : "false");
      tg.textContent = own ? "Orari propri" : "+ Orari propri";
      tg.addEventListener("click", function () {
        CU[k] = !CU[k];
        if (CU[k]) HS[k] = copy(HS[""]);
        render();
      });
      line.appendChild(tg); pane.appendChild(line);
    }

    if (own) {
      var list = mk("div", "avDays"); pane.appendChild(list);
      dayRows(list, days, isClub ? null : HS[""]);
      var cp = mk("button", "avMini lnk", "Copia gli orari del lunedì su tutti i giorni"); cp.type = "button";
      cp.addEventListener("click", function () { var f = days[0]; for (var d = 1; d < 7; d++) days[d] = copy(f); render(); });
      pane.appendChild(cp);
    }

    var pr = own ? problem(days) : "", dr = dirty(k);
    var note = mk("div", "avErr"); note.hidden = !pr; note.textContent = pr; pane.appendChild(note);
    var ft = mk("div", "avFt");
    var stt = mk("span", "avState" + (dr ? " dirty" : " ok"));
    stt.innerHTML = dr ? "Modifiche non salvate" : IC.check + " Tutto salvato";
    ft.appendChild(stt);
    var save = mk("button", "avBtn pri", isClub ? "Salva orari" : "Salva orari di " + c.name); save.type = "button"; save.disabled = !dr || busy;
    save.addEventListener("click", function () {
      var p2 = own ? problem(days) : ""; if (p2) { toast(p2, true); return; }
      busy = true; render();
      var list2 = isClub ? D.courts.filter(function (x) { return !CU[x.id]; }) : [c], i = 0;
      new Promise(function (ok, ko) {
        (function next() {
          if (i >= list2.length) return ok();
          var x = list2[i++];
          var hrs = isClub ? payload(HS[""]) : CU[x.id] ? payload(HS[x.id]) : payload(HS[""]), cust = isClub ? false : !!CU[x.id];
          call({ action: "save_court", id: x.id, name: x.name, surface: x.surface, indoor: x.indoor, slot_min: x.slot_min, price_member_eur: x.price_member_eur, price_guest_eur: x.price_guest_eur, active: x.active, hours: hrs, custom_hours: cust }).then(next).catch(ko);
        })();
      }).then(function () { busy = false; justSaved = k; toast(isClub ? "Orari salvati." : "Orari di " + c.name + " salvati."); changed(); return reload(); })
        .catch(function (e) { busy = false; render(); toast(e.message, true); });
    });
    ft.appendChild(save); pane.appendChild(ft);
    box.appendChild(pane);
  }

  /* ---------- scheda Lavori e indisponibilità ---------- */
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
  function closureItems() {
    return D.closures.slice().sort(function (a, b) { return a.starts_on < b.starts_on ? -1 : a.starts_on > b.starts_on ? 1 : 0; });
  }
  function renderChi(box) {
    var form = mk("div", "avCard");
    form.appendChild(mk("h3", "avH", "Nuova chiusura"));
    var who = mk("div", "avRow"), quick = mk("div", "avRow");
    var d1 = dateField(C.from, today()); d1.id = "avD1";
    var d2 = dateField(C.to, today()); d2.id = "avD2";
    var dur = mk("div", "avSeg");
    var hrsBox = mk("div", "avField"); hrsBox.hidden = true;
    var add = mk("button", "avBtn pri", "Aggiungi chiusura"); add.type = "button";
    var persons = [["", "Tutto il circolo"]].concat(D.courts.map(function (x) { return [x.id, x.name]; }));

    function redrawWho() { chips(who, persons, function (v) { return C.who === v; }, function (v) { C.who = v; redrawWho(); }); }
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
      [[false, "Tutto il giorno"], [true, "Solo alcune ore"]].forEach(function (o) {
        var b = mk("button", null, o[1]); b.type = "button"; b.setAttribute("aria-pressed", C.part === o[0] ? "true" : "false");
        b.addEventListener("click", function () { C.part = o[0]; redrawDur(); }); dur.appendChild(b);
      });
      hrsBox.textContent = ""; hrsBox.hidden = !C.part;
      if (C.part) {
        hrsBox.appendChild(mk("label", null, "Quali ore"));
        var r = mk("div", "avRow");
        [["Mattina", "08:00", "13:00"], ["Pomeriggio", "13:00", "18:00"], ["Sera", "18:00", "23:00"]].forEach(function (q) {
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
    }
    function redrawAll() { redrawWho(); redrawQuick(); redrawDur(); }

    form.appendChild(field("Cosa non si può prenotare", who));
    form.appendChild(field("Quando", quick));
    var dr = mk("div", "avRow"); dr.appendChild(field("Dal", d1, "avD1")); dr.appendChild(field("Al", d2, "avD2")); form.appendChild(dr);
    d1.addEventListener("change", function () { C.from = d1.value; if (!d2.value || d2.value < d1.value) { C.to = d1.value; d2.value = d1.value; } else C.to = d2.value; redrawQuick(); });
    d2.addEventListener("change", function () { C.to = d2.value; redrawQuick(); });
    form.appendChild(field("Per quanto tempo", dur));
    form.appendChild(hrsBox);
    form.appendChild(mk("p", "avHint", "Nei giorni e negli orari indicati non si può prenotare e il calendario mostra il campo chiuso."));
    form.appendChild(add);
    redrawAll();

    add.addEventListener("click", function () {
      var a = d1.value, b = d2.value || a;
      if (!a) { toast("Scegli un giorno o una scelta rapida.", true); return; }
      if (b < a) { toast("L'ultimo giorno è prima del primo.", true); return; }
      if (C.part && m(C.tf) >= m(C.tt)) { toast("L'ora di fine deve essere dopo quella di inizio.", true); return; }
      busy = true; add.disabled = true;
      call({ action: "add_closure", court_id: C.who || null, starts_on: a, ends_on: b, from: C.part ? C.tf : "", to: C.part ? C.tt : "", reason: "" })
        .then(function () { busy = false; C.from = ""; C.to = ""; toast("Chiusura aggiunta."); changed(); return reload(); })
        .catch(function (e) { busy = false; add.disabled = false; toast(e.message, true); reload().catch(function () {}); });
    });
    box.appendChild(form);

    var lc = mk("div", "avCard"); lc.appendChild(mk("h3", "avH", "In programma"));
    var items = closureItems();
    if (!items.length) lc.appendChild(mk("div", "avNone", "Nessuna chiusura in programma: tutti i campi sono prenotabili negli orari di apertura."));
    items.forEach(function (it) {
      var r = mk("div", "avCl"), t = mk("div", "avClt");
      t.appendChild(mk("b", null, plabel(it.starts_on, it.ends_on)));
      var s = mk("small"), cn = it.court_id ? (courtOf(it.court_id) || { name: "Campo" }).name : null, nd = ndays(it.starts_on, it.ends_on);
      s.appendChild(mk("span", it.court_id ? "avTag p" : "avTag", cn || "Circolo"));
      s.appendChild(document.createTextNode(it.from ? "dalle " + it.from + " alle " + it.to : "tutto il giorno" + (nd > 1 ? " · " + nd + " giorni" : "")));
      t.appendChild(s);
      if (it.bookings) t.appendChild(mk("small", "avWarnTx", it.bookings + (it.bookings === 1 ? " prenotazione già fissata: avvisa il cliente" : " prenotazioni già fissate: avvisa i clienti")));
      r.appendChild(t);
      var x = mk("button", "avX", "Togli"); x.type = "button";
      x.addEventListener("click", function () {
        if (x.getAttribute("data-ask") !== "1") { x.setAttribute("data-ask", "1"); x.textContent = "Sicuro?"; x.classList.add("ask"); setTimeout(function () { if (x.isConnected) { x.removeAttribute("data-ask"); x.textContent = "Togli"; x.classList.remove("ask"); } }, 3000); return; }
        x.disabled = true;
        call({ action: "delete_closure", id: it.id }).then(function () { toast("Chiusura tolta."); changed(); return reload(); }).catch(function (e) { x.disabled = false; toast(e.message, true); });
      });
      r.appendChild(x); lc.appendChild(r);
    });
    box.appendChild(lc);
  }

  /* ---------- struttura ---------- */
  function paintSide() {
    var nav = $("avSide"); if (!nav) return; nav.textContent = "";
    function item(id, title, sub) {
      var b = mk("button", "avSi" + (sel === id ? " on" : "")); b.type = "button";
      b.setAttribute("aria-pressed", sel === id ? "true" : "false");
      b.style.setProperty("--c", colorOf(id));
      if (id === "chi") { var a = mk("span", "avAv chi"); a.style.setProperty("--c", colorOf(id)); a.innerHTML = IC.cal; b.appendChild(a); } else b.appendChild(avatar(id));
      var t = mk("span", "avSt"); t.appendChild(mk("b", null, title)); t.appendChild(mk("small", null, sub)); b.appendChild(t);
      if (id !== "chi" && dirty(keyOf(id))) { var dt = mk("span", "avDot"); dt.setAttribute("title", "Modifiche non salvate"); b.appendChild(dt); }
      b.addEventListener("click", function () { sel = id; render(); var sc = layer.querySelector(".avScroll"); if (sc) sc.scrollTop = 0; });
      nav.appendChild(b);
    }
    var wn = weekHours(HS[""] || []);
    nav.appendChild(mk("div", "avSl", "Circolo"));
    item("club", "Orari del circolo", D.courts.length ? "Apertura · " + hword(wn.h) : "Aggiungi prima un campo");
    if (D.courts.length > 1) {
      nav.appendChild(mk("div", "avSl", "Campi"));
      D.courts.forEach(function (c) {
        var own = !!CU[c.id], w = weekHours(HS[c.id] || []);
        item(c.id, c.name, own ? "Orari propri · " + hword(w.h) : "Come il circolo");
      });
    }
    nav.appendChild(mk("div", "avSep"));
    var n = closureItems().length;
    item("chi", "Lavori e indisponibilità", n ? n + " in programma" : "Nessuna in programma");
  }
  function render() {
    if (!layer || !D) return;
    if (sel !== "club" && sel !== "chi" && !courtOf(sel)) sel = "club";
    paintSide();
    var box = $("avBody"), sc = layer.querySelector(".avScroll"), y = sc ? sc.scrollTop : 0;
    box.textContent = "";
    if (sel === "chi") {
      var hd = mk("div", "avHd flat"), tt = mk("div", "avHt"); hd.style.setProperty("--c", colorOf("chi"));
      tt.appendChild(mk("h2", null, "Lavori e indisponibilità"));
      tt.appendChild(mk("p", null, "Tornei, lavori, maltempo: un campo o tutto il circolo chiuso per uno o più giorni, o solo alcune ore."));
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
      '<div class="avTop"><button type="button" class="mnBack" id="avBack" aria-label="Indietro">' + IC.back + '</button><div><h2 id="avT">Disponibilità</h2><p class="avSubT">Quando i campi si possono prenotare e quando sono chiusi.</p></div></div>' +
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
  function markMenu(on) {
    var av = $("menuTabAvail"), menu = $("burgerMenu");
    document.body.classList.toggle("mnAOn", !!on);
    var sl = $("sectionLabel");
    if (sl) { if (on) { if (sl.textContent !== "Disponibilità") avPrevLbl = sl.textContent; sl.textContent = "Disponibilità"; } else if (sl.textContent === "Disponibilità" && avPrevLbl) sl.textContent = avPrevLbl; }
    if (on) {
      prevCur = [];
      if (menu) menu.querySelectorAll('[aria-current="true"]').forEach(function (b) { if (b !== av) { prevCur.push(b); b.setAttribute("aria-current", "false"); } });
      if (av) av.setAttribute("aria-current", "true");
    } else if (av) av.setAttribute("aria-current", "false");
  }
  function close(keepMenu) {
    if (layer && !layer.hidden) layer.hidden = true;
    markMenu(false);
    if (keepMenu !== false) { prevCur.forEach(function (b) { b.setAttribute("aria-current", "true"); }); }
    prevCur = [];
  }
  /* t: "neg"/"club" = orari del circolo, "chi" = lavori e indisponibilità (predefinito, come per le altre attività) */
  function open(t) {
    if (!layer) build();
    pending = t === "neg" || t === "club" ? "club" : "chi";
    layer.hidden = false; markMenu(true); place();
    var body = $("avBody");
    if (!D) { body.textContent = ""; body.appendChild(mk("p", "avLoad", "Carico gli orari…")); }
    if (D) { sel = pending; render(); }
    var touched = false, mark = function () { touched = true; };
    layer.addEventListener("pointerdown", mark, { once: true });
    layer.addEventListener("keydown", mark, { once: true });
    call(null, "settings").then(function (d) {
      var had = !!D; apply(d);
      if (!had) sel = pending;
      if (!had || !touched) render();
    }).catch(function (e) { if (D) return; body.textContent = ""; body.appendChild(mk("p", "avErr", e.message || "Non riesco a leggere gli orari. Riprova.")); });
  }
  window.liaAvailOpen = open;
  window.liaAvailClose = close;
})();
