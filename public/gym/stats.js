/* Statistiche della palestra, con lo stesso stile della pagina statistiche di Lia.
   Grafici disegnati qui, tutti interattivi: passando il dito o il mouse si legge il dettaglio. */
(function () {
  var G = window.liaGym, pSt = document.getElementById('panelStats');
  if (!G || !pSt) return;
  var el = G.el;
  var root = el('div', 'gcs'); pSt.appendChild(root);
  var tip = el('div', 'gcsTip'); document.body.appendChild(tip);
  var P = 'month', cache = {}, active = false, last = null, token = 0;
  var PL = { week: 'ultimi 7 giorni', month: 'ultimi 30 giorni', year: 'ultimi 12 mesi' };
  var DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'], DAYL = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  var SVGNS = 'http://www.w3.org/2000/svg';

  // ---------- utilità ----------
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function grp(i) { return String(i).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function eur(n) { n = Math.round((Number(n) || 0) * 100) / 100; var neg = n < 0 ? '-' : '', a = Math.abs(n), w = Math.floor(a), c = Math.round((a - w) * 100); return neg + grp(w) + (c ? ',' + (c < 10 ? '0' : '') + c : '') + ' €'; }
  function num(n) { return (Number(n) || 0).toLocaleString('it-IT'); }
  function pd(s) { var a = String(s).split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function dShort(s) { var d = pd(s); return d.getDate() + ' ' + G.MS[d.getMonth()]; }
  function dLong(s) { var d = pd(s); return d.getDate() + ' ' + G.MO[d.getMonth()] + ' ' + d.getFullYear(); }
  function mLong(s) { var d = pd(s); return G.MO[d.getMonth()].charAt(0).toUpperCase() + G.MO[d.getMonth()].slice(1) + ' ' + d.getFullYear(); }
  function css(v, fb) { var x = getComputedStyle(root).getPropertyValue(v).trim(); return x || fb; }
  function niceMax(v) { if (v <= 0) return 10; var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), n = v / p, m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10; return m * p; }
  function svg(tag, attrs) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function delta(cur, prev, unit) {
    if (unit === 'pt') { var d = cur - prev; return { text: (d > 0 ? '+' : '') + d + ' punti vs periodo prima', cls: d > 0 ? 'up' : d < 0 ? 'down' : 'flat' }; }
    if (!prev) return cur ? { text: 'Nuovo rispetto al periodo prima', cls: 'up' } : { text: 'Nessuna variazione', cls: 'flat' };
    var p = Math.round((cur - prev) / prev * 100); return { text: (p > 0 ? '+' : '') + p + '% vs periodo prima', cls: p > 0 ? 'up' : p < 0 ? 'down' : 'flat' };
  }
  function courseColor(c) { var n = (c.name + ' ' + (c.category || '')).toLowerCase(); return /hyrox/.test(n) ? 'var(--c-hyrox)' : /pilates/.test(n) ? 'var(--c-pilates)' : /circuit/.test(n) ? 'var(--c-circuit)' : 'var(--accent)'; }

  // ---------- tooltip ----------
  function tipShow(html, x, y) {
    tip.innerHTML = html; tip.classList.add('on');
    var w = tip.offsetWidth, h = tip.offsetHeight, l = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)), t = y - h - 12; if (t < 8) t = y + 22;
    tip.style.left = l + 'px'; tip.style.top = t + 'px';
  }
  function tipHide() { tip.classList.remove('on'); }
  document.addEventListener('pointerdown', function (e) { if (!e.target.closest || !e.target.closest('.gcs [data-tip],.gcs svg.ch,.gcs .donut-css,.gcs .revenue-donut')) { tipHide(); clearOn(); } }, true);
  window.addEventListener('scroll', function () { if (tip.classList.contains('on')) { tipHide(); clearOn(); } }, true);
  function clearOn() { [].forEach.call(root.querySelectorAll('.on'), function (e) { e.classList.remove('on'); }); [].forEach.call(root.querySelectorAll('.dim'), function (e) { e.classList.remove('dim'); }); }

  // ---------- grafici ----------
  // scrub: collega puntatore/dito a un indice
  function scrub(s, n, padL, padR, W, onIdx, onOut) {
    var cur = -1;
    function idx(e) { var r = s.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W; var i = Math.floor((x - padL) / ((W - padL - padR) / n)); return Math.max(0, Math.min(n - 1, i)); }
    function move(e) { var i = idx(e); if (i !== cur) { cur = i; onIdx(i, e); } }
    s.addEventListener('pointerdown', move);
    s.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' || e.buttons || e.pointerType === 'touch') move(e); });
    s.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { cur = -1; onOut(); } });
  }
  function frame(host, H) { var W = Math.max(260, Math.round(host.clientWidth || 600)); var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'ch', role: 'img' }); s.style.height = 'auto'; host.appendChild(s); return { s: s, W: W, H: H }; }
  function xLabel(sr, i, n) { if (P === 'year') return G.MS[pd(sr.from).getMonth()]; if (P === 'week') return DAYS[(pd(sr.from).getDay() + 6) % 7] + ' ' + pd(sr.from).getDate(); var step = n > 14 ? 5 : 1; return (i % step === 0 || i === n - 1) && !(n > 14 && i > n - 3 && i !== n - 1) ? dShort(sr.from) : ''; }
  function titleOf(sr) { return P === 'year' ? mLong(sr.from) : DAYL[(pd(sr.from).getDay() + 6) % 7] + ' ' + dShort(sr.from); }

  function stackedBars(host, series) {
    var f = frame(host, 230), s = f.s, W = f.W, H = f.H, pL = 46, pR = 6, pT = 10, pB = 26, iW = W - pL - pR, iH = H - pT - pB;
    var max = niceMax(Math.max.apply(null, series.map(function (x) { return x.subs + x.pt; }).concat([1])));
    [0, .25, .5, .75, 1].forEach(function (t) { var y = pT + iH * t; s.appendChild(svg('line', { class: 'gl', x1: pL, x2: W - pR, y1: y, y2: y })); var l = svg('text', { x: pL - 6, y: y + 3, 'text-anchor': 'end' }); l.textContent = grp(Math.round(max * (1 - t))) + (t === 0 ? '' : ''); s.appendChild(l); });
    var n = series.length, bw = iW / n, w = Math.max(3, Math.min(34, bw * .62));
    var hl = svg('rect', { class: 'hl', y: pT, height: iH, width: bw, x: -100, rx: 6 }); s.appendChild(hl);
    series.forEach(function (x, i) {
      var cx = pL + bw * i + bw / 2, hs = x.subs / max * iH, hp = x.pt / max * iH;
      if (x.subs) s.appendChild(svg('rect', { class: 'b1', x: cx - w / 2, y: pT + iH - hs - (x.pt ? hp : 0), width: w, height: hs, rx: Math.min(4, w / 3) }));
      if (x.pt) s.appendChild(svg('rect', { class: 'b2', x: cx - w / 2, y: pT + iH - hp, width: w, height: hp, rx: Math.min(4, w / 3) }));
      var lb = xLabel(x, i, n); if (lb) { var t = svg('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }); t.textContent = lb; s.appendChild(t); }
    });
    scrub(s, n, pL, pR, W, function (i, e) {
      var x = series[i]; hl.setAttribute('x', pL + bw * i);
      var r = s.getBoundingClientRect();
      tipShow('<b>' + esc(titleOf(x)) + '</b><i style="background:var(--accent)"></i>Abbonamenti ' + eur(x.subs) + (x.subsN ? ' (' + x.subsN + ')' : '') + '<br><i style="background:var(--gsec)"></i>Personal 1:1 ' + eur(x.pt) + (x.ptN ? ' (' + x.ptN + ')' : '') + '<br><b style="margin:3px 0 0">Totale ' + eur(x.subs + x.pt) + '</b>', r.left + (pL + bw * i + bw / 2) / W * r.width, r.top + (pT + iH * (1 - (x.subs + x.pt) / max)) / H * r.height);
    }, function () { hl.setAttribute('x', -100); tipHide(); });
  }
  function smooth(pts) { if (pts.length < 2) return 'M' + pts[0].x + ',' + pts[0].y; var d = 'M' + pts[0].x.toFixed(1) + ',' + pts[0].y.toFixed(1); for (var i = 0; i < pts.length - 1; i++) { var a = pts[i], b = pts[i + 1], mx = (a.x + b.x) / 2; d += ' C' + mx.toFixed(1) + ',' + a.y.toFixed(1) + ' ' + mx.toFixed(1) + ',' + b.y.toFixed(1) + ' ' + b.x.toFixed(1) + ',' + b.y.toFixed(1); } return d; }
  function lineChart(host, items, o) {
    // items: [{label, v, tip(html)}], o: {fmt, second}
    var f = frame(host, 220), s = f.s, W = f.W, H = f.H, pL = 46, pR = 12, pT = 12, pB = 26, iW = W - pL - pR, iH = H - pT - pB;
    var max = niceMax(Math.max.apply(null, items.map(function (x) { return x.v; }).concat([1])));
    var gid = 'gcsG' + Math.floor(Math.random() * 1e6);
    var defs = svg('defs', {}), g = svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    g.appendChild(svg('stop', { offset: '0%', 'stop-color': o.color || 'var(--accent)', 'stop-opacity': .32 })); g.appendChild(svg('stop', { offset: '100%', 'stop-color': o.color || 'var(--accent)', 'stop-opacity': 0 })); defs.appendChild(g); s.appendChild(defs);
    [0, .5, 1].forEach(function (t) { var y = pT + iH * t; s.appendChild(svg('line', { class: 'gl', x1: pL, x2: W - pR, y1: y, y2: y })); var l = svg('text', { x: pL - 6, y: y + 3, 'text-anchor': 'end' }); l.textContent = grp(Math.round(max * (1 - t))); s.appendChild(l); });
    var n = items.length, X = function (i) { return pL + (n > 1 ? i / (n - 1) : .5) * iW; }, Y = function (v) { return pT + iH - v / max * iH; };
    var pts = items.map(function (x, i) { return { x: X(i), y: Y(x.v) }; }), d = smooth(pts);
    s.appendChild(svg('path', { d: d + ' L' + X(n - 1).toFixed(1) + ',' + (pT + iH) + ' L' + X(0).toFixed(1) + ',' + (pT + iH) + ' Z', fill: 'url(#' + gid + ')' }));
    s.appendChild(svg('path', { class: 'ln' + (o.color ? ' ln2' : ''), d: d }));
    var cur = svg('line', { class: 'cur', y1: pT, y2: pT + iH, x1: 0, x2: 0 }); s.appendChild(cur);
    var dots = pts.map(function (p, i) { var c = svg('circle', { class: 'dt', cx: p.x, cy: p.y, r: n > 20 ? 0 : 3.5 }); if (o.color) c.style.stroke = o.color; s.appendChild(c); return c; });
    var step = Math.max(1, Math.round(n / 6));
    items.forEach(function (x, i) { if (i % step === 0 || i === n - 1) { if (i !== n - 1 && n - 1 - i < step * .6) return; var t = svg('text', { x: X(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }); t.textContent = x.label; s.appendChild(t); } });
    var hi = null;
    scrub(s, n, pL - iW / n / 2 + (n > 1 ? iW / (n - 1) / 2 : 0), pR - iW / n / 2 + (n > 1 ? iW / (n - 1) / 2 : 0), W, function (i) {
      if (hi != null) { dots[hi].classList.remove('on'); if (n > 20) dots[hi].setAttribute('r', 0); }
      hi = i; dots[i].classList.add('on'); dots[i].setAttribute('r', 5); cur.setAttribute('x1', pts[i].x); cur.setAttribute('x2', pts[i].x); cur.classList.add('on');
      var r = s.getBoundingClientRect(); tipShow(items[i].tip, r.left + pts[i].x / W * r.width, r.top + pts[i].y / H * r.height);
    }, function () { if (hi != null) { dots[hi].classList.remove('on'); if (n > 20) dots[hi].setAttribute('r', 0); } hi = null; cur.classList.remove('on'); tipHide(); });
  }

  // ciambella a settori (conic-gradient) con interazione
  function donut(wrapEl, donutEl, holeStrong, holeSpan, legendEl, segs, totalTxt, totalLbl, centerFmt) {
    var tot = segs.reduce(function (t, x) { return t + x.v; }, 0), acc = 0, stops = [];
    segs.forEach(function (x) { var a = tot ? acc / tot * 100 : 0, b = tot ? (acc + x.v) / tot * 100 : 0; if (x.v > 0) stops.push(x.color + ' ' + a.toFixed(2) + '% ' + b.toFixed(2) + '%'); acc += x.v; });
    donutEl.style.background = stops.length ? 'conic-gradient(' + stops.join(',') + ')' : 'var(--card2)';
    holeStrong.textContent = totalTxt; holeSpan.textContent = totalLbl;
    var rows = [].slice.call(legendEl.children);
    function sel(i, x, y) {
      rows.forEach(function (r, j) { r.classList.toggle('on', j === i); r.classList.toggle('dim', i != null && j !== i); });
      if (i == null) { holeStrong.textContent = totalTxt; holeSpan.textContent = totalLbl; tipHide(); return; }
      var sg = segs[i]; holeStrong.textContent = centerFmt(sg); holeSpan.textContent = sg.name;
      tipShow('<b>' + esc(sg.name) + '</b>' + esc(sg.detail), x, y);
    }
    function at(e) {
      var r = donutEl.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, dx = e.clientX - cx, dy = e.clientY - cy, rad = Math.sqrt(dx * dx + dy * dy);
      if (rad > r.width / 2 + 4 || rad < r.width * .3 || !tot) return null;
      var deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, p = deg / 360 * tot, a = 0;
      for (var i = 0; i < segs.length; i++) { a += segs[i].v; if (p < a && segs[i].v > 0) return i; }
      return null;
    }
    ['pointerdown', 'pointermove'].forEach(function (ev) { donutEl.addEventListener(ev, function (e) { if (ev === 'pointermove' && e.pointerType === 'touch' && !e.buttons) return; var i = at(e); sel(i, e.clientX, e.clientY - 4); }); });
    donutEl.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') sel(null); });
    rows.forEach(function (r, i) { r.setAttribute('data-tip', '1'); r.style.cursor = 'pointer'; var rc = function (e) { var b = r.getBoundingClientRect(); sel(i, b.left + b.width / 2, b.top); }; r.addEventListener('pointerdown', rc); r.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') rc(e); }); r.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') sel(null); }); });
  }

  // ---------- pagina ----------
  function shell() {
    root.innerHTML = '<header class="top"><div class="top-row"><div class="spacer"></div><div class="pseg" role="group" aria-label="Periodo">' + [['week', 'Settimana'], ['month', 'Mese'], ['year', 'Anno']].map(function (p) { return '<button type="button" data-p="' + p[0] + '" aria-pressed="' + (P === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div></div></header><div class="wrap" id="gcsWrap"></div>';
    [].forEach.call(root.querySelectorAll('[data-p]'), function (b) { b.onclick = function () { P = b.dataset.p; show(); }; });
  }
  function show() {
    shell();
    var wrap = root.querySelector('#gcsWrap'), my = ++token;
    if (cache[P]) { draw(cache[P]); } else wrap.innerHTML = '<div class="gcSk gcSkL"><i></i><i></i><i></i><i></i></div>';
    G.api(null, G.API + '&stats=1&period=' + P).then(function (j) { var changed = JSON.stringify(cache[P]) !== JSON.stringify(j); cache[P] = j; if (my === token && active && changed) draw(j); }).catch(function (e) { if (my === token && !cache[P]) { wrap.innerHTML = ''; wrap.appendChild(el('div', 'gxWhy', e.message || 'Errore')); } });
  }
  function kpi(l, v, d, extra, range) { return '<div class="kpi"><div class="lbl">' + l + '</div><div class="val">' + v + '</div>' + (range ? '<div class="range">' + range + '</div>' : '') + (extra ? '<div class="sub2">' + extra + '</div>' : '') + '<div class="delta ' + d.cls + '">' + esc(d.text) + '</div></div>'; }
  function draw(d) {
    last = d; tipHide();
    var wrap = root.querySelector('#gcsWrap'); if (!wrap) return;
    var c = d.cur, p = d.prev, st = d.status, act = st.ok + st.warn;
    var nsd = { text: d.noshow.of ? d.noshow.n + ' su ' + d.noshow.of + ' prenotazioni' : 'Nessun dato', cls: d.noshow.pct > 8 ? 'down' : 'flat' };
    wrap.innerHTML = '<div class="kpis">' +
      kpi('Incasso', eur(c.revenue), delta(c.revenue, p.revenue), '', PL[P]) +
      kpi('Prenotazioni', num(c.bookings), delta(c.bookings, p.bookings), num(c.lessons) + ' lezioni · ' + num(c.ptn) + ' Personal') +
      kpi('Riempimento medio', c.fill + '%', delta(c.fill, p.fill, 'pt'), 'dei posti delle lezioni') +
      kpi('Iscritti attivi', num(act), { text: st.warn + (st.warn === 1 ? ' in scadenza' : ' in scadenza'), cls: st.warn ? 'down' : 'flat' }, num(d.members) + ' iscritti in tutto') +
      '</div><div class="panels">' +
      '<div class="row2"><div class="panel"><h2>Incassi nel tempo</h2><p class="sub">Abbonamenti e Personal 1:1. Tocca una barra per il dettaglio.</p><div id="gcsRev"></div><div class="legend"><span><i style="background:var(--accent)"></i>Abbonamenti</span><span><i style="background:var(--gsec)"></i>Personal 1:1</span></div></div>' +
      '<div class="panel"><h2>Prenotazioni nel tempo</h2><p class="sub">Lezioni e Personal prenotati ogni ' + (P === 'year' ? 'mese' : 'giorno') + '.</p><div id="gcsBk"></div></div></div>' +
      '<div class="row2"><div class="panel"><h2>Riempimento dei corsi</h2><p class="sub">Posti occupati sul totale, nel periodo.</p><div class="hbars" id="byservice"></div><p class="hint" id="gcsCh"></p></div>' +
      '<div class="panel"><h2>Crescita iscritti</h2><p class="sub">Iscritti con abbonamento valido a fine mese, ultimi 12 mesi.</p><div id="gcsGr"></div></div></div>' +
      '<div class="row2 row-full"><div class="panel"><h2>I clienti più assidui</h2><p class="sub" id="gcsTopSub"></p><div id="gcsTop"></div></div></div>' +
      '</div><details class="stats-method"><summary>Come vengono calcolate le statistiche?</summary><div class="stats-method-body"><p><strong>Incasso</strong> Somma dei prezzi pagati per gli abbonamenti iniziati nel periodo, più il prezzo di ogni Personal 1:1 effettuato (' + eur(d.pt_price) + ' a seduta, modificabile).</p><p><strong>Riempimento</strong> Prenotazioni alle lezioni diviso i posti disponibili delle lezioni tenute (quelle annullate non contano).</p><p><strong>Iscritti attivi</strong> Iscritti con un abbonamento valido oggi, compresi quelli in scadenza.</p></div></details>';
    // grafici
    var C = { acc: css('--accent', '#2B8A94'), sec: css('--sec', '#6BD6D8'), bad: css('--danger', '#FF6B6B'), warn: '#E0A23A', mute: css('--line2', '#31404a') };
    stackedBars(wrap.querySelector('#gcsRev'), d.series);
    lineChart(wrap.querySelector('#gcsBk'), d.series.map(function (x) { return { label: xLabel(x, 0, d.series.length) && P !== 'month' ? xLabel(x, 0, 12) : dShort(x.from), v: x.lessons + x.ptN, tip: '<b>' + esc(titleOf(x)) + '</b>' + (x.lessons + x.ptN) + ' prenotazioni<br>' + x.lessons + ' lezioni · ' + x.ptN + ' Personal' }; }), {});
    // corsi
    var bs = wrap.querySelector('#byservice');
    bs.innerHTML = d.courses.length ? d.courses.map(function (x, i) { return '<div class="hbar-row" data-i="' + i + '" data-tip="1"><div class="lab"><i style="background:' + courseColor(x) + '"></i><span>' + esc(x.name) + '</span></div><div class="track"><div class="fill" style="width:' + x.pct + '%;background:' + courseColor(x) + '"></div></div><div class="amt">' + x.pct + '%</div></div>'; }).join('') : '<p class="hint">Ancora nessun dato: compare dopo le prime lezioni.</p>';
    var ch = wrap.querySelector('#gcsCh'); if (d.courses.length) ch.textContent = 'Un corso quasi sempre pieno si può raddoppiare; uno sotto la metà si può spostare di orario.';
    [].forEach.call(bs.querySelectorAll('.hbar-row'), function (r) { r.addEventListener('pointerdown', function () { var x = d.courses[+r.dataset.i]; clearOn(); r.classList.add('on'); var b = r.getBoundingClientRect(); tipShow('<b>' + esc(x.name) + ' · ' + x.pct + '%</b>' + num(x.booked) + ' prenotazioni su ' + num(x.seats) + ' posti<br>' + x.sessions + (x.sessions === 1 ? ' lezione' : ' lezioni') + ' nel periodo', b.left + b.width / 2, b.top); }); });
    // clienti più assidui
    var top = (d.top || []).filter(function (x) { return x.n > 0; }), tb = wrap.querySelector('#gcsTop'), ts = wrap.querySelector('#gcsTopSub');
    ts.textContent = top.length ? 'Chi ha prenotato di più negli ' + PL[P] + '.' : 'Ancora nessuna prenotazione negli ' + PL[P] + '.';
    top.forEach(function (x) {
      var row = el('div', 'crow'), av = el('div', 'av', String(x.name).split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase()), mid = el('div', 'mid');
      row.appendChild(av); mid.appendChild(el('b', null, x.name)); mid.appendChild(el('span', null, num(x.n) + (x.n === 1 ? ' prenotazione' : ' prenotazioni'))); row.appendChild(mid); tb.appendChild(row);
    });
    // crescita
    lineChart(wrap.querySelector('#gcsGr'), d.growth.map(function (x) { return { label: G.MS[pd(x.date).getMonth()], v: x.active, tip: '<b>' + esc(mLong(x.date)) + '</b>' + x.active + (x.active === 1 ? ' iscritto attivo' : ' iscritti attivi') }; }), { color: C.sec });
  }

  // ---------- collegamenti ----------
  document.addEventListener('lia:section', function (e) { active = e.detail === 'stats'; if (active) show(); else tipHide(); });
  document.addEventListener('lia:gymchanged', function () { cache = {}; if (active) show(); });
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (active && last) draw(last); }, 220); });
  try { new MutationObserver(function () { if (active && last) draw(last); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { }
  try { var ap = document.querySelector('.tabPanel.on'); if (ap && ap.id === 'panelStats') { active = true; show(); } } catch (e) { }
})();
