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
  function range() {
    if (S.view === 'day') return { from: S.anchor, to: S.anchor, full: true };
    if (S.view === 'week') { var m = monday(S.anchor); return { from: m, to: addDays(m, 6), full: true }; }
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
  function render() {
    if (S.view === 'month') S.view = 'week';
    token++;
    var my = token;
    root.className = 'gcx ' + (S.view === 'month' ? 'monthMode' : S.view === 'week' ? 'weekMode' : 'dayMode') + (S.view === 'week' && S.wkOpen && !phone() ? ' wkOpen' : '') + (S.view === 'month' && S.sideOpen && phone() ? ' sideOpen' : '');
    if (!G.S.data) G.load().catch(function () {});
    var r = range();
    root.innerHTML = controlsHTML() + '<div class="cal-wrap"><div class="cal-card" id="gcBody">' + skel() + '</div></div>';
    bindControls();
    toggleFab();
    ensure(r.from, r.to, r.full, function () {
      prefetchNear();
      var body = document.getElementById('gcBody'); if (!body) return;
      if (S.view === 'day') { body.innerHTML = '<div class="gcal">' + dayHTML() + '</div>'; bindBody(body); return; }
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
  function skel() {
    if (S.view === 'month') { var c = ''; for (var i = 0; i < 35; i++) c += '<i></i>'; return '<div class="gcSk gcSkM">' + c + '</div>'; }
    return '<div class="gcSk gcSkL"><i></i><i></i><i></i><i></i></div>';
  }
  function rangeTxt() {
    var y = function (t) { return ' <span class="rangeYear">' + t + '</span>'; };
    if (S.view === 'day') { var d = parse(S.anchor); return (phone() ? G.DN[d.getDay()] : G.DL[d.getDay()]) + ' ' + d.getDate() + ' ' + (phone() ? G.MS[d.getMonth()] : G.MO[d.getMonth()]) + y(d.getFullYear()); }
    if (S.view === 'week') {
      var a = monday(S.anchor), b = addDays(a, 6), x = parse(a), z = parse(b);
      return x.getDate() + (x.getMonth() !== z.getMonth() ? ' ' + G.MS[x.getMonth()] : '') + ' – ' + z.getDate() + ' ' + G.MS[z.getMonth()] + y(z.getFullYear());
    }
    var m = parse(S.anchor); return cap1(G.MO[m.getMonth()]) + y(m.getFullYear());
  }
  function isCurrent() {
    if (S.view === 'day') return S.anchor === today();
    if (S.view === 'week') return monday(S.anchor) === monday(today());
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
    else if (S.view === 'week') { S.anchor = addDays(S.anchor, 7 * k); S.sel = addDays(monday(S.anchor), (parse(S.sel).getDay() + 6) % 7); }
    else { var d = parse(S.anchor); S.anchor = ymd(new Date(d.getFullYear(), d.getMonth() + k, 1)); S.sel = S.anchor === monthOf(today()) ? today() : S.anchor; }
    render();
  }
  function monthOf(d) { return d.slice(0, 7) + '-01'; }
  function bindBody(body) {
    var f = body.querySelector('#gcFlt'); if (f) f.onchange = function () { S.flt = f.value; render(); };
    bindActions(body);
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

  // ---------- settimana (stessa struttura e stesso stile del calendario di Lia) ----------
  function weekDraw(body) {
    var a = monday(S.anchor), days = [], i;
    for (i = 0; i < 7; i++) days.push(getDay(addDays(a, i)) || { date: addDays(a, i), sessions: [], pt: [], closed: true });
    if (!(S.sel >= a && S.sel <= addDays(a, 6))) S.sel = a <= today() && today() <= addDays(a, 6) ? today() : a;
    var f = S.flt, heads = '', rows = [], rowIx = {}, tot = [];
    function endOf(t, dur) { var m = mins(t) + (dur || 60); return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); }
    function rowOf(key, name, cat) { if (!(key in rowIx)) { rowIx[key] = rows.length; rows.push({ key: key, name: name, cat: cat, cells: [[], [], [], [], [], [], []], n: 0, tk: 0, cp: 0 }); } return rows[rowIx[key]]; }
    days.forEach(function (dd, k) {
      var d = dd.date, st = dayStats(dd);
      (dd.sessions || []).forEach(function (s) { var c = ck(s.course.category); if (f !== 'all' && c !== f) return; var r = rowOf('c:' + s.course.name, s.course.name, c); r.cells[k].push({ t: s.time, s: s }); if (!s.cancelled) { r.n++; r.tk += s.taken; r.cp += s.capacity; } });
      if (f === 'all' || f === 'pt') (Array.isArray(dd.pt) ? dd.pt : []).forEach(function (p) { if (p.free) return; var r = rowOf('pt', 'Personal 1:1', 'pt'); r.cells[k].push({ t: p.time, p: p }); r.n++; });
      tot[k] = dd.closed ? 'Chiuso' : st.n ? st.b + '/' + st.cap : '–';
      heads += '<button type="button" class="gpDh' + (d === S.sel ? ' sel' : '') + (d === today() ? ' today' : '') + '" data-i="' + k + '"><span class="dn">' + G.DN[dow(d)] + '</span><span class="dd">' + parse(d).getDate() + '</span></button>';
    });
    var ord = { circuit: 0, hyrox: 1, pilates: 2, pt: 9 };
    rows.sort(function (x, y) { var ox = x.cat in ord ? ord[x.cat] : 5, oy = y.cat in ord ? ord[y.cat] : 5; return ox - oy || (x.name < y.name ? -1 : 1); });
    var cols = '<div class="gpHd"><div></div>' + heads + '</div>';
    rows.forEach(function (r) {
      cols += '<div class="gpRow"><div class="gpLb gpl-' + r.cat + '"><b>' + esc(r.name) + '</b><span>' + (r.cat === 'pt' ? r.n + ' prenotati' : r.n + (r.n === 1 ? ' lezione' : ' lezioni') + ' · ' + r.tk + '/' + r.cp) + '</span></div>';
      for (var kk = 0; kk < 7; kk++) {
        var dq = days[kk].date, its = r.cells[kk].sort(function (x, y) { return x.t < y.t ? -1 : x.t > y.t ? 1 : 0; }), h = '';
        its.forEach(function (x) {
          if (x.p) { var nm = x.p.name.split(' '); h += '<button type="button" class="gpC gpc-pt' + (isEnded(dq, x.t, 60) ? ' past' : '') + '" data-ptb="' + x.t + '" data-date="' + dq + '"><span class="gpT">' + x.t + '</span><b>' + esc(nm[0] + ' ' + (nm[1] || '').charAt(0) + '.') + '</b></button>'; return; }
          var s = x.s, full = !s.cancelled && s.taken >= s.capacity, pc = s.capacity ? Math.min(100, Math.round(s.taken / s.capacity * 100)) : 0;
          h += '<button type="button" class="gpC gpc-' + r.cat + (isEnded(dq, s.time, s.duration_min) ? ' past' : '') + (s.cancelled ? ' off' : '') + (full ? ' full' : '') + '" data-sess="' + s.schedule_id + '" data-date="' + dq + '"><span class="gpT">' + s.time + '<em>' + (s.cancelled ? 'annullata' : full ? 'pieno' : '') + '</em></span><span class="gpB"><i style="width:' + (s.cancelled ? 0 : pc) + '%"></i></span><s>' + (s.cancelled ? '–' : s.taken + '/' + s.capacity) + '</s></button>';
        });
        cols += '<div class="gpCell' + (dq === S.sel ? ' sel' : '') + (days[kk].closed ? ' closed' : '') + (h ? '' : ' none') + '" data-i="' + kk + '">' + (h || '<span class="gpNo">–</span>') + '</div>';
      }
      cols += '</div>';
    });
    if (!rows.length) cols += '<p class="gxM" style="text-align:center;padding:28px">Nessuna lezione in questa settimana.</p>';
    cols += '<div class="gpTot"><div>Posti prenotati</div>' + tot.map(function (t) { return '<span>' + t + '</span>'; }).join('') + '</div>';
    var opts = '<option value="all">Tutti i corsi</option>' + [['circuit', 'Circuiti'], ['hyrox', 'Hyrox'], ['pilates', 'Pilates']].map(function (k2) { return '<option value="' + k2[0] + '"' + (S.flt === k2[0] ? ' selected' : '') + '>' + k2[1] + '</option>'; }).join('') + '<option value="pt"' + (S.flt === 'pt' ? ' selected' : '') + '>Solo Personal 1:1</option>';
    body.innerHTML = '<div class="week-wrap"><div class="wkNew"><div class="wkFilter gkChips" style="display:flex">' + [['all', 'Tutti'], ['circuit', 'Circuiti'], ['hyrox', 'Hyrox'], ['pilates', 'Pilates'], ['pt', 'Personal']].map(function (k2) { return '<button type="button" class="gkChip' + (S.flt === k2[0] ? ' on' : '') + '" data-f="' + k2[0] + '">' + k2[1] + '</button>'; }).join('') + '<span class="gkLeg"><u class="c1"></u>Circuit<u class="c2"></u>Hyrox<u class="c3"></u>Pilates<u class="c4"></u>Personal</span></div><div class="wkMain"><div class="wkScroll gwkScroll"><div class="gpw">' + cols + '</div></div><aside class="wkSide" aria-label="Giorno selezionato"></aside></div></div></div>';
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
      var p = ev.target.closest('.gpC');
      var x = ev.target.closest('.gpDh,.gpCell');
      if (p) { if (p.dataset.sess) openSession(p.dataset.date, p.dataset.sess); else if (p.dataset.ptb) openPtInfo(p.dataset.date, p.dataset.ptb); return; }
      if (x) { var dd2 = addDays(a, +x.dataset.i); S.sel = dd2; S.anchor = dd2; S.view = 'day'; S.wkOpen = false; root.classList.remove('wkOpen'); render(); }
    });
    var scw = body.querySelector('.wkScroll'); if (scw) scw.scrollTop = 0;
    [].forEach.call(body.querySelectorAll('.gkChip'), function (c) { c.onclick = function () { S.flt = c.dataset.f; render(); }; });
  }
  function weekPhone() {
    var a = monday(S.anchor), tot = 0, rows = '';
    for (var i = 0; i < 7; i++) {
      var d = addDays(a, i), day = getDay(d) || { sessions: [], pt: [], closed: true }, st = dayStats(day);
      if (i === 6 && day.closed) continue;
      tot += st.b;
      var its = [];
      (day.sessions || []).forEach(function (s) { its.push({ t: s.time, s: s }); });
      (Array.isArray(day.pt) ? day.pt : []).forEach(function (p) { if (!p.free) its.push({ t: p.time, p: p }); });
      its.sort(function (x, y) { return x.t < y.t ? -1 : x.t > y.t ? 1 : 0; });
      var body = its.map(function (x) {
        if (x.p) { var nm = x.p.name.split(' '); return '<button type="button" class="gpmR" style="--cc:#2F6BDB" data-ptb="' + x.t + '" data-date="' + d + '"><b>' + x.t + '</b><span class="gpmN">Personal<small>' + esc(nm[0] + ' ' + (nm[1] || '').charAt(0) + '.') + '</small></span></button>'; }
        var s = x.s, full = !s.cancelled && s.taken >= s.capacity, pc = s.capacity ? Math.min(100, Math.round(s.taken / s.capacity * 100)) : 0;
        return '<button type="button" class="gpmR' + (s.cancelled ? ' off' : '') + (isEnded(d, s.time, s.duration_min) ? ' past' : '') + '" style="--cc:' + col(s) + '" data-sess="' + s.schedule_id + '" data-date="' + d + '"><b>' + s.time + '</b><span class="gpmN">' + esc(s.course.name) + '</span><span class="gpmB"><i style="width:' + (s.cancelled ? 0 : pc) + '%"></i></span><s' + (full ? ' class="full"' : '') + '>' + (s.cancelled ? 'annullata' : s.taken + '/' + s.capacity) + '</s></button>';
      }).join('');
      rows += '<div class="gpmD' + (d === today() ? ' tod' : '') + (day.closed || !its.length ? ' none' : '') + '"><button type="button" class="gpmH" data-go="' + d + '"><span class="gpmDn">' + G.DN[dow(d)] + '</span><span class="gpmDd">' + parse(d).getDate() + '</span><span class="gpmOc">' + (day.closed ? 'Chiuso' : st.n ? st.b + '/' + st.cap + ' posti' : 'Nessuna lezione') + '</span><span class="gpmCh">›</span></button>' + (body ? '<div class="gpmL">' + body + '</div>' : '') + '</div>';
    }
    return '<div class="gcOv"><span class="gcKick">Prenotazioni</span><b class="gcBig">' + tot + '</b></div>' + rows;
  }

  // ---------- scelta dell'iscritto ----------
  function memberChip(m) { return '<span class="gcChip ' + (m.status.s === 'none' ? 'none' : m.status.s) + '">' + esc(m.status.label) + '</span>'; }
  function pickMember(title, reason, onPick, onBack) {
    if (!G.S.data) { G.load().then(function () { pickMember(title, reason, onPick, onBack); }).catch(function (e) { G.toast(e.message, 'bad'); }); return; }
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
  function openNew(pre) {
    var run = function (m) {
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
    };
    if (pre) run(pre); else pickMember('Nuova prenotazione', noSub, run);
  }
  window.liaGymBookFor = function (id) { var m = G.S.data && G.S.data.members.filter(function (x) { return x.id === id; })[0]; if (m) openNew(m); };

  // ---------- pulsante + (telefono, vista mese) ----------
  var fab = el('button', 'gxFab gcFab'); fab.type = 'button'; fab.hidden = true; fab.setAttribute('aria-label', 'Nuova prenotazione'); fab.innerHTML = G.ic('plus', 26); document.body.appendChild(fab);
  fab.addEventListener('click', function () { openNew(); });
  function toggleFab() { fab.hidden = !(sectionOn && phone()); }

  // ---------- collegamenti con il resto del dashboard ----------
  // dalla campanella: "Nuova prenotazione" porta al giorno e alla lezione indicati
  window.liaOpenDate = function (iso) {
    var dt = new Date(iso); if (isNaN(dt.getTime())) return;
    var d = ymd(dt); S.view = 'day'; S.anchor = d; S.sel = d; S.hl = pad(dt.getHours()) + ':' + pad(dt.getMinutes());
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
