/* Calendario della palestra (Giorno / Settimana / Mese) nel dashboard di Lia.
   Sostituisce il calendario degli appuntamenti con lezioni e Personal 1:1; la testata, la campanella e il menu restano quelli di Lia.
   Si appoggia a gym.js (window.liaGym) per comunicazione, finestre e schede degli iscritti. */
(function () {
  var G = window.liaGym;
  var pCal = document.getElementById('panelCal');
  if (!G || !pCal) return;
  var el = G.el, pad = G.pad, parse = G.parse, ymd = G.ymd, addDays = G.addDays, monday = G.monday;
  document.body.classList.add('gcalOn');

  var root = el('div', 'gcal');
  pCal.appendChild(root);

  var S = { view: 'day', anchor: G.S.today, sel: G.S.today, flt: 'all', side: 'lez', wkSide: false, hl: null, err: '' };
  var C = {};      // data -> { light, full }
  var token = 0;   // evita che una risposta lenta ridisegni una vista già cambiata
  var sectionOn = true;

  // ---------- utilità ----------
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function today() { return G.S.today; }
  function phone() { return window.matchMedia('(max-width:859px)').matches; }
  function dow(d) { return parse(d).getDay(); }
  function fmtLong(d) { var x = parse(d); return G.DL[x.getDay()] + ' ' + x.getDate() + ' ' + G.MO[x.getMonth()]; }
  function fmtShort(d) { var x = parse(d); return G.DN[x.getDay()] + ' ' + x.getDate() + ' ' + G.MS[x.getMonth()]; }
  function cap1(x) { return x.charAt(0).toUpperCase() + x.slice(1); }
  function mins(t) { return +t.slice(0, 2) * 60 + +t.slice(3, 5); }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function endT(t, dur) { return hhmm(mins(t) + (dur || 60)); }
  function nowMin() { var n = new Date(); return n.getHours() * 60 + n.getMinutes(); }
  function isStarted(d, t) { return d < today() || (d === today() && mins(t) <= nowMin()); }
  function isEnded(d, t, dur) { return d < today() || (d === today() && mins(t) + (dur || 60) <= nowMin()); }
  function ck(cat) { return cat === 'hyrox' ? 'hyrox' : cat === 'pilates' ? 'pilates' : 'circuit'; }
  function col(s) { return 'var(--c-' + ck(s.course.category) + ')'; }
  function ptStats(day) { var p = day.pt; if (Array.isArray(p)) return { total: p.length, booked: p.filter(function (x) { return !x.free; }).length }; return p || { total: 0, booked: 0 }; }
  function dayStats(day) {
    var n = 0, cap = 0, b = 0;
    (day.sessions || []).forEach(function (s) { if (s.cancelled) return; n++; cap += s.capacity; b += s.taken; });
    return { n: n, cap: cap, b: b, pct: cap ? Math.round(b / cap * 100) : 0 };
  }
  function getDay(d) { var c = C[d]; return c ? (c.full || c.light) : null; }

  // ---------- dati ----------
  function bust() { C = {}; }
  function have(from, to, needFull) { for (var d = from; d <= to; d = addDays(d, 1)) { var c = C[d]; if (!c || !(needFull ? c.full : (c.full || c.light))) return false; } return true; }
  function fetchRange(from, to, light) {
    return G.api(null, G.API + '&cal=1&from=' + from + '&to=' + to + (light ? '&light=1' : '')).then(function (j) {
      j.days.forEach(function (d) { var c = C[d.date] = C[d.date] || {}; c[light ? 'light' : 'full'] = d; });
      if (j.today) G.S.today = j.today;
    });
  }
  function ensure(from, to, needFull, cb) {
    if (have(from, to, needFull)) { cb(); return; }
    var my = token;
    fetchRange(from, to, !needFull).then(function () { if (my === token) cb(); }).catch(function (e) { if (my === token) { root.textContent = ''; root.appendChild(el('div', 'gxWhy', e.message || 'Errore')); } });
  }
  function range() {
    if (S.view === 'day') return { from: S.anchor, to: S.anchor, full: true };
    if (S.view === 'week') { var m = monday(S.anchor); return { from: m, to: addDays(m, 6), full: true }; }
    var an = parse(S.anchor), f = new Date(an.getFullYear(), an.getMonth(), 1), gs = monday(ymd(f));
    var lead = Math.round((f.getTime() - parse(gs).getTime()) / 864e5), dim = new Date(an.getFullYear(), an.getMonth() + 1, 0).getDate(), rows = Math.ceil((lead + dim) / 7);
    return { from: gs, to: addDays(gs, rows * 7 - 1), full: false };
  }

  // ---------- disegno ----------
  function render() {
    token++;
    var my = token;
    if (!G.S.data) { root.textContent = ''; root.appendChild(el('div', 'gxEmpty', 'Carico...')); G.load().then(function () { if (my === token) render(); }).catch(function (e) { root.textContent = ''; root.appendChild(el('div', 'gxWhy', e.message)); }); return; }
    var r = range();
    root.innerHTML = controlsHTML() + '<div id="gcBody"><div class="gxEmpty">Carico...</div></div>';
    bindControls();
    toggleFab();
    ensure(r.from, r.to, r.full, function () {
      var body = document.getElementById('gcBody'); if (!body) return;
      if (S.view === 'day') { body.innerHTML = dayHTML(); bindBody(body); return; }
      if (S.view === 'week') { body.innerHTML = phone() ? weekPhone() : weekWide(); bindBody(body); return; }
      // mese: il pannello del giorno scelto ha bisogno anche dei Personal (dettaglio)
      var drawMonth = function () { body.innerHTML = monthHTML(); bindBody(body); };
      if (!phone() && !have(S.sel, S.sel, true)) { var my2 = token; fetchRange(S.sel, S.sel, false).then(function () { if (my2 === token) drawMonth(); }).catch(drawMonth); return; }
      drawMonth();
    });
  }
  function rangeTxt() {
    if (S.view === 'day') return fmtLong(S.anchor);
    if (S.view === 'week') {
      var a = monday(S.anchor), b = addDays(a, 5), x = parse(a), y = parse(b);
      return x.getDate() + (x.getMonth() !== y.getMonth() ? ' ' + G.MS[x.getMonth()] : '') + ' – ' + y.getDate() + ' ' + G.MS[y.getMonth()] + ' ' + y.getFullYear();
    }
    var m = parse(S.anchor); return cap1(G.MO[m.getMonth()]) + ' <i>' + m.getFullYear() + '</i>';
  }
  function isCurrent() {
    if (S.view === 'day') return S.anchor === today();
    if (S.view === 'week') return monday(S.anchor) === monday(today());
    var a = parse(S.anchor), t = parse(today()); return a.getMonth() === t.getMonth() && a.getFullYear() === t.getFullYear();
  }
  function controlsHTML() {
    var seg = '<div class="gcSeg" role="group" aria-label="Visualizzazione">' + [['day', 'Giorno'], ['week', 'Settimana'], ['month', 'Mese']].map(function (v) { return '<button type="button" data-v="' + v[0] + '" aria-pressed="' + (S.view === v[0]) + '">' + v[1] + '</button>'; }).join('') + '</div>';
    var acts = '<div class="gcActs">' + (isCurrent() ? '' : '<button type="button" class="gcNow" id="gcNow">Oggi</button>') + '<button type="button" class="gcGhost" id="gcProg">Programma</button>' + (phone() ? '' : '<button type="button" class="gcPrim" id="gcNew">Nuova prenotazione</button>') + '</div>';
    return '<div class="gxTop gcTop">' + seg + '</div><div class="gcNav"><button type="button" class="gcArr" id="gcPrev" aria-label="Precedente">‹</button><h1 class="gcRange">' + rangeTxt() + '</h1><button type="button" class="gcArr" id="gcNext" aria-label="Successivo">›</button></div>' + acts;
  }
  function bindControls() {
    [].forEach.call(root.querySelectorAll('[data-v]'), function (b) { b.onclick = function () { S.view = b.dataset.v; if (S.view === 'day') S.anchor = S.sel; S.wkSide = false; render(); }; });
    document.getElementById('gcPrev').onclick = function () { step(-1); };
    document.getElementById('gcNext').onclick = function () { step(1); };
    var n = document.getElementById('gcNow'); if (n) n.onclick = function () { S.anchor = today(); S.sel = today(); render(); };
    document.getElementById('gcProg').onclick = function () { G.openSetting('corsi'); };
    var nw = document.getElementById('gcNew'); if (nw) nw.onclick = function () { openNew(); };
  }
  function step(k) {
    if (S.view === 'day') { S.anchor = addDays(S.anchor, k); S.sel = S.anchor; }
    else if (S.view === 'week') { S.anchor = addDays(S.anchor, 7 * k); }
    else { var d = parse(S.anchor); S.anchor = ymd(new Date(d.getFullYear(), d.getMonth() + k, 1)); }
    render();
  }
  function bindBody(body) {
    var f = body.querySelector('#gcFlt'); if (f) f.onchange = function () { S.flt = f.value; render(); };
    bindActions(body);
    [].forEach.call(body.querySelectorAll('[data-mc]'), function (b) { b.onclick = function () { var d = b.dataset.mc; S.sel = d; if (parse(d).getMonth() !== parse(S.anchor).getMonth()) S.anchor = d; if (phone()) { render(); openDaySheet(d); } else render(); }; });
    [].forEach.call(body.querySelectorAll('[data-wh]'), function (b) { b.onclick = function () { S.sel = b.dataset.wh; S.wkSide = true; render(); }; });
    [].forEach.call(body.querySelectorAll('[data-close]'), function (b) { b.onclick = function () { S.wkSide = false; render(); }; });
    if (S.hl) { var hl = S.hl; setTimeout(function () { if (S.hl === hl) S.hl = null; }, 2600); }
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
  function ptRowsHTML(day) {
    var a = Array.isArray(day.pt) ? day.pt : null;
    if (!a) return '<p class="gxM">Carico...</p>';
    return a.map(function (p) {
      if (!p.free) return '<button type="button" class="gcSrow" data-ptb="' + p.time + '" data-date="' + day.date + '"><span class="gcDt">' + p.time + '</span><span class="gcSb"><b><span class="gcDot"></span>Personal 1:1</b><span class="gxM">' + esc(p.name) + '</span></span></button>';
      return '<button type="button" class="gcSrow free" data-ptf="' + p.time + '" data-date="' + day.date + '"' + (isStarted(day.date, p.time) ? ' disabled' : '') + '><span class="gcDt">' + p.time + '</span><span class="gcSb"><b><span class="gcDot"></span>Personal 1:1</b><span class="gxM">Libero · tocca per prenotare</span></span></button>';
    }).join('') || '<p class="gxM">Nessuna ora disponibile.</p>';
  }
  function sideHTML(d, closable) {
    var day = getDay(d) || { date: d, sessions: [], pt: [], closed: true }, st = dayStats(day), ss = day.sessions || [];
    var body = S.side === 'lez' ? (ss.map(function (s) { return sessRow(s, d); }).join('') || '<p class="gxM">Nessuna lezione: la palestra è chiusa.</p>') : ptRowsHTML(day);
    return '<div class="gcSideHd"><h2>' + fmtLong(d) + '</h2>' + (closable ? '<button type="button" class="gcX" data-close aria-label="Chiudi">×</button>' : '') + '</div>' +
      '<div class="gcRingBox">' + ringSvg(st.pct) + '<div><b>' + (st.n ? st.b + ' prenotazioni' : 'Chiuso') + '</b><div class="gxM">' + (st.n ? st.n + (st.n === 1 ? ' lezione' : ' lezioni') + ' · ' + st.cap + ' posti' : '') + '</div></div></div>' +
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

  // ---------- mese ----------
  function monthHTML() {
    var m = parse(S.anchor), y = m.getFullYear(), mo = m.getMonth(), r = range(), h = '';
    var rows = Math.round((parse(r.to).getTime() - parse(r.from).getTime()) / 864e5 / 7 + 1 / 7);
    for (var i = 0; i < rows * 7; i++) {
      var d = addDays(r.from, i), x = parse(d), out = x.getMonth() !== mo, day = getDay(d) || { sessions: [], closed: true }, st = dayStats(day), closed = day.closed;
      var cls = 'gcMc' + (out ? ' out' : '') + (d === today() ? ' today' : '') + (!out && d < today() ? ' past' : '') + (!out && d > today() ? ' future' : '') + (closed ? ' closed' : '') + (d === S.sel ? ' sel' : '') + (st.pct >= 95 ? ' full' : '');
      h += '<button type="button" class="' + cls + '" data-mc="' + d + '" aria-label="' + fmtLong(d) + '"><span class="gcDn">' + x.getDate() + '</span><span class="gcMa">' + (closed ? 'Chiuso' : st.n + (st.n === 1 ? ' lez.' : ' lez.')) + '</span><span class="gcMo"><span class="gcMl"><i style="width:' + st.pct + '%"></i></span><span class="gcMp">' + (st.n ? st.pct + '%' : '') + '</span></span></button>';
    }
    var dw = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(function (t) { return '<span>' + t + '</span>'; }).join('');
    var side = !phone() ? '<aside class="gcSide" aria-label="Giorno selezionato">' + sideHTML(S.sel, false) + '</aside>' : '';
    return '<div class="gcMwrap' + (side ? ' hasSide' : '') + '"><div><div class="gcDow">' + dw + '</div><div class="gcMgrid">' + h + '</div></div>' + side + '</div>';
  }

  // ---------- giorno ----------
  function dayHTML() {
    var d = S.anchor, day = getDay(d) || { sessions: [], pt: [], closed: true }, ss = day.sessions || [], isT = d === today();
    var live = ss.filter(function (s) { return !s.cancelled; });
    var items = ss.map(function (s) { return { t: s.time, s: s }; });
    (Array.isArray(day.pt) ? day.pt : []).forEach(function (p) { items.push({ t: p.time, pt: p }); });
    items.sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
    var nxt = live.filter(function (s) { return !isStarted(d, s.time); })[0];
    var left = live.filter(function (s) { return !isEnded(d, s.time, s.duration_min); }).length;
    var hero = '<div class="gcHero"><div><span class="gcKick">' + (isT ? 'La tua giornata' : 'Agenda') + '</span><h2>' + live.length + (live.length === 1 ? ' lezione' : ' lezioni') + '</h2>' + (isT && live.length ? '<div class="gxM" style="margin-top:4px">' + left + ' rimaste</div>' : '') + '</div><div><span class="gcKick">' + (nxt ? 'Prossima' : 'Stato') + '</span>' +
      (nxt ? '<strong>' + nxt.time + ' · ' + esc(nxt.course.name) + '</strong><div class="gxM">' + (isT ? 'tra ' + Math.max(0, mins(nxt.time) - nowMin()) + ' min · ' : '') + nxt.taken + '/' + nxt.capacity + ' iscritti</div>' : '<strong>' + (live.length ? 'Lezioni concluse' : 'Palestra chiusa') + '</strong>') + '</div></div>';
    if (day.closed) return hero + '<p class="gxM" style="text-align:center;padding:24px">In questo giorno non ci sono lezioni in programma: la palestra è chiusa.</p>';
    var out = '', nowDone = false;
    items.forEach(function (it) {
      if (isT && !nowDone && mins(it.t) > nowMin()) { out += '<div class="gcNowbar">Adesso ' + hhmm(nowMin()) + '<i></i></div>'; nowDone = true; }
      if (it.s) {
        var s = it.s, pc = Math.round(s.taken / s.capacity * 100), past = isEnded(d, s.time, s.duration_min);
        out += '<button type="button" class="gcAc' + (past ? ' past' : '') + (s.cancelled ? ' off' : '') + (S.hl && S.hl === s.time ? ' hl' : '') + '" data-sess="' + s.schedule_id + '" data-date="' + d + '"><span class="gcAt"><b>' + s.time + '</b><span>' + endT(s.time, s.duration_min) + '</span></span><span class="gcAb"><span class="gcR"><b><span class="gcDot" style="background:' + col(s) + '"></span>' + esc(s.course.name) + '</b><span class="gcChip ' + (s.cancelled ? 'none' : s.taken >= s.capacity ? 'bad' : s.taken >= s.capacity - 3 ? 'warn' : 'ok') + '">' + (s.cancelled ? 'Annullata' : s.taken + '/' + s.capacity) + '</span></span>' + barHTML(s.taken, s.capacity) + '<span class="gxM">' + (s.cancelled ? (s.cancel_reason || 'Lezione annullata') : past ? 'Conclusa' : s.taken >= s.capacity ? 'Completa' : (s.capacity - s.taken) + ' posti liberi') + '</span></span></button>';
      } else {
        var p = it.pt, booked = !p.free;
        out += '<button type="button" class="gcAc pt' + (isEnded(d, p.time, 60) ? ' past' : '') + '"' + (!booked && isStarted(d, p.time) ? ' disabled' : '') + ' ' + (booked ? 'data-ptb="' : 'data-ptf="') + p.time + '" data-date="' + d + '"><span class="gcAt"><b>' + p.time + '</b><span>' + endT(p.time, 60) + '</span></span><span class="gcAb"><span class="gcR"><b><span class="gcDot"></span>Personal 1:1</b><span class="gcChip ' + (booked ? 'ok' : 'none') + '">' + (booked ? 'Prenotato' : 'Libero') + '</span></span><span class="gxM">' + (booked ? esc(p.name) : 'Tocca per prenotare un iscritto') + '</span></span></button>';
      }
    });
    if (isT && !nowDone && items.length) out += '<div class="gcNowbar">Adesso ' + hhmm(nowMin()) + '<i></i></div>';
    return hero + '<div class="gcAg">' + out + '</div>';
  }

  // ---------- settimana ----------
  function weekWide() {
    var a = monday(S.anchor), days = [];
    for (var i = 0; i < 7; i++) days.push(getDay(addDays(a, i)) || { date: addDays(a, i), sessions: [], pt: [], closed: true });
    var ncols = (days[6].sessions.length || (Array.isArray(days[6].pt) && days[6].pt.some(function (p) { return !p.free; }))) ? 7 : 6;
    var hmin = 8, hmax = 20;
    days.forEach(function (dd) {
      dd.sessions.forEach(function (s) { hmin = Math.min(hmin, Math.floor(mins(s.time) / 60)); hmax = Math.max(hmax, Math.ceil((mins(s.time) + s.duration_min) / 60)); });
      (Array.isArray(dd.pt) ? dd.pt : []).forEach(function (p) { if (!p.free) { hmin = Math.min(hmin, Math.floor(mins(p.time) / 60)); hmax = Math.max(hmax, Math.ceil(mins(p.time) / 60) + 1); } });
    });
    var H = 52, total = (hmax - hmin) * H, tl = '', head = '', cols = '';
    for (var h = hmin; h < hmax; h++) tl += '<div>' + pad(h) + ':00</div>';
    for (var k = 0; k < ncols; k++) {
      var dd2 = days[k], d = dd2.date, st = dayStats(dd2), b = '';
      head += '<button type="button" data-wh="' + d + '" class="' + (d === today() ? 'tod ' : '') + (S.wkSide && d === S.sel ? 'sel2' : '') + '"><small>' + G.DN[dow(d)] + '</small><b>' + parse(d).getDate() + '</b><span class="gcBar"><i class="' + (st.pct >= 95 ? 'f' : '') + '" style="width:' + st.pct + '%"></i></span><span class="gcPc">' + (st.n ? st.pct + '%' : '–') + '</span></button>';
      for (var h2 = 1; h2 < hmax - hmin; h2++) b += '<div class="gcHl" style="top:' + h2 * H + 'px"></div>';
      var seen = {};
      dd2.sessions.forEach(function (s) { seen[s.time] = (seen[s.time] || 0) + 1; });
      var idx = {};
      dd2.sessions.forEach(function (s) {
        if (S.flt !== 'all' && ck(s.course.category) !== S.flt) return;
        var n = seen[s.time], j = idx[s.time] = (idx[s.time] || 0) + 1;
        var top = (mins(s.time) - hmin * 60) / 60 * H + 2, ht = Math.max(30, s.duration_min / 60 * H - 4);
        b += '<button type="button" class="gcBk' + (isEnded(d, s.time, s.duration_min) ? ' past' : '') + (s.cancelled ? ' off' : '') + '" style="top:' + top + 'px;height:' + ht + 'px;--cc:' + col(s) + ';left:calc(' + ((j - 1) / n * 100) + '% + 4px);right:calc(' + ((n - j) / n * 100) + '% + 4px)" data-sess="' + s.schedule_id + '" data-date="' + d + '"><b>' + s.time + ' ' + esc(s.course.name) + '</b>' + (s.cancelled ? 'Annullata' : s.taken + '/' + s.capacity) + '</button>';
      });
      if (S.flt === 'all' || S.flt === 'pt') (Array.isArray(dd2.pt) ? dd2.pt : []).forEach(function (p) {
        if (p.free) return;
        b += '<button type="button" class="gcBk pt" style="top:' + ((mins(p.time) - hmin * 60) / 60 * H + 2) + 'px;height:' + (H - 4) + 'px" data-ptb="' + p.time + '" data-date="' + d + '"><b>' + p.time + ' Personal 1:1</b>' + esc(p.name.split(' ')[0] + ' ' + (p.name.split(' ')[1] || '').charAt(0) + '.') + '</button>';
      });
      if (d === today()) b += '<div class="gcNowl" style="top:' + ((nowMin() - hmin * 60) / 60 * H) + 'px"></div>';
      cols += '<div class="gcHc' + (d === today() ? ' tod' : '') + '" style="height:' + total + 'px">' + b + '</div>';
    }
    var opts = '<option value="all">Tutti i corsi</option>' + [['circuit', 'Circuiti'], ['hyrox', 'Hyrox'], ['pilates', 'Pilates']].map(function (k2) { return '<option value="' + k2[0] + '"' + (S.flt === k2[0] ? ' selected' : '') + '>' + k2[1] + '</option>'; }).join('') + '<option value="pt"' + (S.flt === 'pt' ? ' selected' : '') + '>Solo Personal 1:1</option>';
    var side = S.wkSide ? '<aside class="gcSide">' + sideHTML(S.sel, true) + '</aside>' : '';
    var gt = '48px repeat(' + ncols + ',minmax(0,1fr))';
    return '<div class="gcFilt"><select class="gcSel" id="gcFlt" aria-label="Corso">' + opts + '</select></div><div class="gcWk' + (side ? ' hasSide' : '') + '"><div class="gcWkc"><div class="gcWkh" style="grid-template-columns:' + gt + '"><div></div>' + head + '</div><div class="gcWkb" style="grid-template-columns:' + gt + '"><div class="gcTl">' + tl + '</div>' + cols + '</div></div>' + side + '</div>';
  }
  function weekPhone() {
    var a = monday(S.anchor), tot = 0, rows = '';
    for (var i = 0; i < 7; i++) {
      var d = addDays(a, i), day = getDay(d) || { sessions: [], closed: true }, st = dayStats(day);
      if (i === 6 && day.closed) continue;
      tot += st.b;
      rows += '<button type="button" class="gcWrow' + (d === today() ? ' tod' : '') + '" data-go="' + d + '"><span class="gcWd"><small>' + G.DN[dow(d)] + '</small><b>' + parse(d).getDate() + '</b></span><span class="gcCh">' + (day.sessions.filter(function (s) { return !s.cancelled; }).map(function (s) { return '<span style="--cc:' + col(s) + '">' + s.time + ' ' + esc(s.course.name.split(' ')[0]) + ' ' + s.taken + '</span>'; }).join('') || '<span class="none">Chiuso</span>') + '</span><span class="gcPc">' + (st.n ? st.pct + '%' : '') + '</span></button>';
    }
    return '<div class="gcOv"><span class="gcKick">Prenotazioni</span><b class="gcBig">' + tot + '</b></div>' + rows;
  }

  // ---------- scelta dell'iscritto ----------
  function memberChip(m) { return '<span class="gcChip ' + (m.status.s === 'none' ? 'none' : m.status.s) + '">' + esc(m.status.label) + '</span>'; }
  function pickMember(title, reason, onPick, onBack) {
    var q = '';
    G.sheet(title, function (w, close) {
      var inp = G.inp('search', '', 'Cerca per nome o telefono'); inp.className = 'gxSearch'; w.appendChild(inp);
      var box = el('div'); w.appendChild(box);
      function draw() {
        box.textContent = '';
        var L = G.S.data.members.filter(function (m) { return !q || (m.first_name + ' ' + m.last_name + ' ' + m.phone).toLowerCase().indexOf(q) >= 0; }).slice(0, 40);
        if (!L.length) box.appendChild(el('p', 'gxM', 'Nessun iscritto trovato.'));
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
    var go = function () {
      var s = findSession(d, sid); if (!s || !s.attendees) { G.toast('Lezione non trovata.', 'bad'); return; }
      var over = isEnded(d, s.time, s.duration_min), started = isStarted(d, s.time);
      G.sheet(s.course.name, function (w, close) {
        var sub = el('div', 'gxM', fmtLong(d) + ' · ' + s.time + '–' + endT(s.time, s.duration_min)); sub.style.marginTop = '-6px'; w.appendChild(sub);
        var rb = el('div', 'gcRingBox'); rb.innerHTML = ringSvg(Math.round(s.taken / s.capacity * 100)) + '<div><b>' + s.taken + ' su ' + s.capacity + ' posti</b><div class="gxM">' + (s.cancelled ? 'Lezione annullata' + (s.cancel_reason ? ': ' + esc(s.cancel_reason) : '') : over ? 'Lezione conclusa' : s.taken >= s.capacity ? 'Completa' : (s.capacity - s.taken) + ' posti liberi') + '</div></div>'; w.appendChild(rb);
        if (!s.attendees.length) w.appendChild(el('p', 'gxM', 'Nessun iscritto per ora.'));
        s.attendees.forEach(function (a) {
          var row = el('div', 'gxAt' + (a.no_show ? ' gcNs' : '')), nm = el('div'); nm.appendChild(el('span', 'gcNm', a.name)); nm.appendChild(el('small', null, ' ' + a.phone)); row.appendChild(nm);
          if (over) row.appendChild(G.btn(a.no_show ? 'Presente' : 'Non si è presentato', 'ghost sm', function () { G.act({ action: 'booking_noshow', booking_id: a.booking_id, kind: 'class', value: !a.no_show }).then(function () { a.no_show = !a.no_show; bust(); close(); render(); setTimeout(function () { openSession(d, sid); }, 30); }); }));
          else row.appendChild(G.btn('Togli', 'ghost sm', function () { G.confirmBar(w, 'Togliere ' + a.name + ' da questa lezione? Se aveva usato un ingresso, gli torna.', function () { G.act({ action: 'booking_cancel', booking_id: a.booking_id, member_id: a.member_id }, 'Tolto.').then(function () { bust(); close(); render(); setTimeout(function () { openSession(d, sid); }, 30); }); }); }));
          w.appendChild(row);
        });
        var ac = el('div', 'gcStk'); ac.style.marginTop = '14px';
        if (s.cancelled) ac.appendChild(G.btn('Riattiva lezione', '', function () { G.act({ action: 'session_restore', schedule_id: s.schedule_id, date: d }, 'Lezione riattivata.').then(function () { bust(); close(); render(); }); }));
        else if (!over) {
          ac.appendChild(G.btn('Aggiungi un iscritto', '', function () { close(); addToSession(d, s); }));
          ac.appendChild(G.btn('Annulla questa lezione', 'danger', function () { cancelSession(w, close, d, s); }));
        }
        var ed = G.btn('Posti, giorno e ora', 'ghost', function () { close(); G.openSetting('corsi'); }); if (!over) ac.appendChild(ed);
        w.appendChild(ac);
        if (started && !over && !s.cancelled) w.appendChild(el('p', 'gxM', 'La lezione è iniziata: le assenze si segnano a lezione conclusa.'));
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
    pickMember('Personal 1:1 · ' + fmtShort(d) + ' ' + t, noSub, function (m) {
      G.api({ action: 'pt_book', member_id: m.id, date: d, time: t }).then(function () { G.toast('Personal 1:1 prenotato per ' + m.first_name + ' ' + m.last_name + '.', 'ok'); bust(); refreshMembers(); render(); }).catch(function (e) { G.toast(e.message, 'bad'); });
    });
  }
  function openPtInfo(d, t) {
    var go = function () {
      var day = getDay(d), p = day && Array.isArray(day.pt) ? day.pt.filter(function (x) { return x.time === t; })[0] : null;
      if (!p || p.free) { G.toast('Prenotazione non trovata.', 'bad'); return; }
      var over = isEnded(d, t, 60);
      G.sheet('Personal 1:1', function (w, close) {
        var sub = el('div', 'gxM', fmtLong(d) + ' · ' + t + '–' + endT(t, 60)); sub.style.marginTop = '-6px'; w.appendChild(sub);
        var c = el('div', 'gxCard' + (p.no_show ? ' gcNs' : '')); c.innerHTML = '<b class="gxT gcNm">' + esc(p.name) + '</b><div class="gxM">' + esc(p.phone) + '</div>'; w.appendChild(c);
        var st = el('div', 'gcStk');
        if (over) st.appendChild(G.btn(p.no_show ? 'Segna presente' : 'Non si è presentato', 'ghost', function () { G.act({ action: 'booking_noshow', booking_id: p.booking_id, kind: 'pt', value: !p.no_show }).then(function () { bust(); close(); render(); }); }));
        else st.appendChild(G.btn('Annulla questa prenotazione', 'danger', function () { G.confirmBar(w, 'Annullare il Personal di ' + p.name + '? Se aveva usato un ingresso, gli torna.', function () { G.act({ action: 'pt_cancel', booking_id: p.booking_id, member_id: p.member_id }, 'Prenotazione annullata.').then(function () { bust(); refreshMembers(); close(); render(); }); }); }));
        w.appendChild(st);
      });
    };
    if (have(d, d, true)) go(); else fetchRange(d, d, false).then(go).catch(function (e) { G.toast(e.message, 'bad'); });
  }

  // ---------- nuova prenotazione (da un iscritto alla prima lezione utile) ----------
  function openNew() {
    pickMember('Nuova prenotazione', noSub, function (m) {
      var from = today(), to = addDays(today(), 7);
      var show = function () {
        var slots = [];
        for (var d = from; d <= to && slots.length < 24; d = addDays(d, 1)) {
          var day = getDay(d); if (!day) continue;
          day.sessions.forEach(function (s) { if (!s.cancelled && !isStarted(d, s.time)) slots.push({ d: d, s: s }); });
          (Array.isArray(day.pt) ? day.pt : []).forEach(function (p) { if (p.free && !isStarted(d, p.time)) slots.push({ d: d, pt: p }); });
        }
        slots.sort(function (a, b) { var ta = a.s ? a.s.time : a.pt.time, tb = b.s ? b.s.time : b.pt.time; return a.d === b.d ? (ta < tb ? -1 : 1) : (a.d < b.d ? -1 : 1); });
        G.sheet(m.first_name + ' ' + m.last_name, function (w, close) {
          var sub = el('div', 'gxM', 'Scegli la lezione'); sub.style.marginTop = '-6px'; w.appendChild(sub);
          if (!slots.length) w.appendChild(el('p', 'gxM', 'Nessuna lezione libera nei prossimi giorni.'));
          slots.forEach(function (x) {
            var label = x.s ? x.s.course.name : 'Personal 1:1', t = x.s ? x.s.time : x.pt.time, full = x.s && x.s.taken >= x.s.capacity, mine = x.s && x.s.attendees && x.s.attendees.some(function (a) { return a.member_id === m.id; });
            var b = el('button', 'gxCard gxMc'); b.type = 'button'; if (full || mine) b.style.opacity = '.55';
            b.innerHTML = '<div class="gxRow"><div><b class="gxT">' + esc(label) + '</b><div class="gxM">' + fmtShort(x.d) + ' · ' + t + '</div></div><span class="gcChip ' + (full ? 'bad' : 'none') + '">' + (x.s ? (mine ? 'Già prenotato' : x.s.taken + '/' + x.s.capacity) : 'Libero') + '</span></div>';
            b.onclick = function () {
              if (full || mine) { G.toast(full ? 'Lezione completa.' : 'È già prenotato.', 'bad'); return; }
              var body = x.s ? { action: 'booking_add', member_id: m.id, schedule_id: x.s.schedule_id, date: x.d } : { action: 'pt_book', member_id: m.id, date: x.d, time: x.pt.time };
              G.api(body).then(function () { G.toast('Prenotato: ' + m.first_name + ' ' + m.last_name + ' · ' + label + '.', 'ok'); bust(); refreshMembers(); close(); render(); }).catch(function (e) { G.toast(e.message, 'bad'); });
            };
            w.appendChild(b);
          });
        });
      };
      if (have(from, to, true)) show(); else fetchRange(from, to, false).then(show).catch(function (e) { G.toast(e.message, 'bad'); });
    });
  }

  // ---------- pulsante + (telefono, vista mese) ----------
  var fab = el('button', 'gxFab gcFab'); fab.type = 'button'; fab.hidden = true; fab.setAttribute('aria-label', 'Nuova prenotazione'); fab.innerHTML = G.ic('plus', 26); document.body.appendChild(fab);
  fab.addEventListener('click', function () { openNew(); });
  function toggleFab() { fab.hidden = !(sectionOn && S.view === 'month' && phone()); }

  // ---------- collegamenti con il resto del dashboard ----------
  // dalla campanella: "Nuova prenotazione" porta al giorno e alla lezione indicati
  window.liaOpenDate = function (iso) {
    var dt = new Date(iso); if (isNaN(dt.getTime())) return;
    var d = ymd(dt); S.view = 'day'; S.anchor = d; S.sel = d; S.hl = pad(dt.getHours()) + ':' + pad(dt.getMinutes());
    bust(); render();
  };
  document.addEventListener('lia:section', function (e) {
    sectionOn = e.detail === 'cal'; toggleFab();
    if (sectionOn) { bust(); render(); }
  });
  document.addEventListener('lia:gymchanged', function () { bust(); if (sectionOn) render(); });
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (sectionOn) render(); }, 200); });
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
