/* Statistiche del centro sportivo: pensate per i campi, con lo stesso stile delle statistiche delle altre attivita' (radice .gcs).
   I dati sono le prenotazioni dei campi (?history=1) e gli orari dei campi (?courts=1&view=settings). */
(function () {
  var pSt = document.getElementById('panelStats'); if (!pSt || !window.__liaCampi) return;
  var token = (new URLSearchParams(location.search).get('t') || '').trim(); if (!token) return;
  var root = document.createElement('div'); root.className = 'gcs'; pSt.appendChild(root);
  var tip = document.createElement('div'); tip.className = 'gcsTip'; document.body.appendChild(tip);
  var P = 'month', active = false, DATA = null, COURTS = null, CLOSED = [], busy = false, failed = false;
  var PL = { week: 'ultimi 7 giorni', month: 'ultimi 30 giorni', year: 'ultimi 12 mesi' };
  var DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'], DAYL = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  var MS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  var SVGNS = 'http://www.w3.org/2000/svg';

  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function grp(i) { return String(i).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function num(n) { return (Number(n) || 0).toLocaleString('it-IT'); }
  function eur(n) { n = Math.round((Number(n) || 0) * 100) / 100; var w = Math.floor(n), c = Math.round((n - w) * 100); return grp(w) + (c ? ',' + (c < 10 ? '0' : '') + c : '') + ' €'; }
  function hrs(m) { var h = m / 60; return (Math.round(h * 10) / 10).toString().replace('.', ',') + ' h'; }
  function key(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function addD(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; }
  function css(v, fb) { var x = getComputedStyle(root).getPropertyValue(v).trim(); return x || fb; }
  function niceMax(v) { if (v <= 0) return 10; var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), n = v / p, m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10; return m * p; }
  function svg(tag, attrs) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function courtColor(c) {
    var t = (String(c.surface || '') + ' ' + String(c.name || '')).toLowerCase();
    if (/parquet|legno|wood/.test(t)) return '#C58B4E';
    if (/sabbia|sand|beach/.test(t)) return '#D9B877';
    if (/erba|grass|prato/.test(t)) return '#5DB07A';
    if (/terra|rossa|clay|battuta/.test(t)) return '#D9784A';
    if (/cement|hard|resina|sintetic|moquette|pvc|acrilic/.test(t)) return '#5B8DB8';
    return '#4BB3D6';
  }
  function delta(cur, prev, unit) {
    if (unit === 'pt') { var d = cur - prev; return { text: (d > 0 ? '+' : '') + d + ' punti vs periodo prima', cls: d > 0 ? 'up' : d < 0 ? 'down' : 'flat' }; }
    if (!prev) return cur ? { text: 'Nuovo rispetto al periodo prima', cls: 'up' } : { text: 'Nessuna variazione', cls: 'flat' };
    var p = Math.round((cur - prev) / prev * 100); return { text: (p > 0 ? '+' : '') + p + '% vs periodo prima', cls: p > 0 ? 'up' : p < 0 ? 'down' : 'flat' };
  }

  // ---------- tooltip ----------
  function tipShow(html, x, y) {
    tip.innerHTML = html; tip.classList.add('on');
    var w = tip.offsetWidth, h = tip.offsetHeight, l = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)), t = y - h - 12; if (t < 8) t = y + 22;
    tip.style.left = l + 'px'; tip.style.top = t + 'px';
  }
  function tipHide() { tip.classList.remove('on'); }
  function clearOn() { [].forEach.call(root.querySelectorAll('.on'), function (e) { if (e.className && String(e.className).indexOf('pseg') < 0) e.classList.remove('on'); }); }
  document.addEventListener('pointerdown', function (e) { if (!e.target.closest || !e.target.closest('.gcs [data-tip],.gcs svg.gch')) { tipHide(); clearOn(); } }, true);
  window.addEventListener('scroll', function () { if (tip.classList.contains('on')) { tipHide(); clearOn(); } }, true);

  // ---------- grafici ----------
  function scrub(s, n, padL, padR, W, onIdx, onOut) {
    var cur = -1;
    function idx(e) { var r = s.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W; var i = Math.floor((x - padL) / ((W - padL - padR) / n)); return Math.max(0, Math.min(n - 1, i)); }
    function move(e) { var i = idx(e); if (i !== cur) { cur = i; onIdx(i, e); } }
    s.addEventListener('pointerdown', move);
    s.addEventListener('pointermove', function (e) { if (e.pointerType === 'mouse' || e.buttons || e.pointerType === 'touch') move(e); });
    s.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { cur = -1; onOut(); } });
  }
  function frame(host, H) { var W = Math.max(260, Math.round(host.clientWidth || 600)); var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'gch', role: 'img' }); s.style.height = 'auto'; host.appendChild(s); return { s: s, W: W, H: H }; }
  function xLabel(x, i, n) { if (P === 'year') return MS[x.d0.getMonth()]; if (P === 'week') return DAYS[(x.d0.getDay() + 6) % 7] + ' ' + x.d0.getDate(); var step = n > 14 ? 5 : 1; return (i === n - 1 || (i % step === 0 && n - 1 - i >= step)) ? x.d0.getDate() + ' ' + MS[x.d0.getMonth()] : ''; }
  function titleOf(x) { return P === 'year' ? MS[x.d0.getMonth()].charAt(0).toUpperCase() + MS[x.d0.getMonth()].slice(1) + ' ' + x.d0.getFullYear() : DAYL[(x.d0.getDay() + 6) % 7] + ' ' + x.d0.getDate() + ' ' + MS[x.d0.getMonth()]; }

  function bars(host, series, valOf, tipOf) {
    var f = frame(host, 230), s = f.s, W = f.W, H = f.H, pL = 46, pR = 6, pT = 10, pB = 26, iW = W - pL - pR, iH = H - pT - pB;
    var max = niceMax(Math.max.apply(null, series.map(valOf).concat([1])));
    [0, .25, .5, .75, 1].forEach(function (t) { var y = pT + iH * t; s.appendChild(svg('line', { class: 'gl', x1: pL, x2: W - pR, y1: y, y2: y })); var l = svg('text', { x: pL - 6, y: y + 3, 'text-anchor': 'end' }); l.textContent = grp(Math.round(max * (1 - t))); s.appendChild(l); });
    var n = series.length, bw = iW / n, w = Math.max(3, Math.min(34, bw * .62));
    var hl = svg('rect', { class: 'hl', y: pT, height: iH, width: bw, x: -100, rx: 6 }); s.appendChild(hl);
    series.forEach(function (x, i) {
      var cx = pL + bw * i + bw / 2, h = valOf(x) / max * iH;
      if (valOf(x)) s.appendChild(svg('rect', { class: 'b1', x: cx - w / 2, y: pT + iH - h, width: w, height: h, rx: Math.min(4, w / 3) }));
      var lb = xLabel(x, i, n); if (lb) { var t = svg('text', { x: cx, y: H - 8, 'text-anchor': 'middle' }); t.textContent = lb; s.appendChild(t); }
    });
    scrub(s, n, pL, pR, W, function (i) {
      hl.setAttribute('x', pL + bw * i); var r = s.getBoundingClientRect();
      tipShow(tipOf(series[i]), r.left + (pL + bw * i + bw / 2) / W * r.width, r.top + (pT + iH - valOf(series[i]) / max * iH) / H * r.height);
    }, function () { hl.setAttribute('x', -100); tipHide(); });
  }
  function smooth(pts) { if (pts.length < 2) return 'M' + pts[0].x + ',' + pts[0].y; var d = 'M' + pts[0].x.toFixed(1) + ',' + pts[0].y.toFixed(1); for (var i = 0; i < pts.length - 1; i++) { var a = pts[i], b = pts[i + 1], mx = (a.x + b.x) / 2; d += ' C' + mx.toFixed(1) + ',' + a.y.toFixed(1) + ' ' + mx.toFixed(1) + ',' + b.y.toFixed(1) + ' ' + b.x.toFixed(1) + ',' + b.y.toFixed(1); } return d; }
  function line(host, series, valOf, tipOf) {
    var f = frame(host, 220), s = f.s, W = f.W, H = f.H, pL = 46, pR = 12, pT = 12, pB = 26, iW = W - pL - pR, iH = H - pT - pB;
    var max = niceMax(Math.max.apply(null, series.map(valOf).concat([1]))), n = series.length;
    var gid = 'cgs' + Math.floor(Math.random() * 1e6), defs = svg('defs', {}), g = svg('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    g.appendChild(svg('stop', { offset: '0%', 'stop-color': 'var(--accent)', 'stop-opacity': .32 })); g.appendChild(svg('stop', { offset: '100%', 'stop-color': 'var(--accent)', 'stop-opacity': 0 })); defs.appendChild(g); s.appendChild(defs);
    [0, .5, 1].forEach(function (t) { var y = pT + iH * t; s.appendChild(svg('line', { class: 'gl', x1: pL, x2: W - pR, y1: y, y2: y })); var l = svg('text', { x: pL - 6, y: y + 3, 'text-anchor': 'end' }); l.textContent = grp(Math.round(max * (1 - t))); s.appendChild(l); });
    var X = function (i) { return pL + (n > 1 ? i / (n - 1) : .5) * iW; }, Y = function (v) { return pT + iH - v / max * iH; };
    var pts = series.map(function (x, i) { return { x: X(i), y: Y(valOf(x)) }; }), d = smooth(pts);
    s.appendChild(svg('path', { d: d + ' L' + X(n - 1).toFixed(1) + ',' + (pT + iH) + ' L' + X(0).toFixed(1) + ',' + (pT + iH) + ' Z', fill: 'url(#' + gid + ')' }));
    s.appendChild(svg('path', { class: 'ln', d: d }));
    var cur = svg('line', { class: 'cur', y1: pT, y2: pT + iH, x1: 0, x2: 0 }); s.appendChild(cur);
    var dots = pts.map(function (p, i) { var c = svg('circle', { class: 'dt', cx: p.x, cy: p.y, r: n <= 20 ? 3.5 : 0 }); s.appendChild(c); return c; });
    series.forEach(function (x, i) { var lb = xLabel(x, i, n); if (lb) { var t = svg('text', { x: X(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle' }); t.textContent = lb; s.appendChild(t); } });
    var hi = null, base = n <= 20 ? 3.5 : 0;
    scrub(s, n, pL - iW / n / 2 + (n > 1 ? iW / (n - 1) / 2 : 0), pR - iW / n / 2 + (n > 1 ? iW / (n - 1) / 2 : 0), W, function (i) {
      if (hi != null) { dots[hi].classList.remove('on'); dots[hi].setAttribute('r', base); }
      hi = i; dots[i].classList.add('on'); dots[i].setAttribute('r', 5); cur.setAttribute('x1', pts[i].x); cur.setAttribute('x2', pts[i].x); cur.classList.add('on');
      var r = s.getBoundingClientRect(); tipShow(tipOf(series[i]), r.left + pts[i].x / W * r.width, r.top + pts[i].y / H * r.height);
    }, function () { if (hi != null) { dots[hi].classList.remove('on'); dots[hi].setAttribute('r', base); } hi = null; cur.classList.remove('on'); tipHide(); });
  }
  function hbars(host, rows, empty) { // rows: [{name,color,pct,amt,tip}]
    host.innerHTML = rows.length ? rows.map(function (x, i) { return '<div class="hbar-row" data-i="' + i + '" data-tip="1"><div class="lab"><i style="background:' + x.color + '"></i><span>' + esc(x.name) + '</span></div><div class="track"><div class="fill" style="width:' + Math.max(x.pct, x.pct ? 2 : 0) + '%;background:' + x.color + '"></div></div><div class="amt">' + esc(x.amt) + '</div></div>'; }).join('') : '<p class="hint">' + esc(empty || 'Ancora nessun dato.') + '</p>';
    [].forEach.call(host.querySelectorAll('.hbar-row'), function (r) { r.addEventListener('pointerdown', function () { var x = rows[+r.dataset.i]; clearOn(); r.classList.add('on'); var b = r.getBoundingClientRect(); tipShow(x.tip, b.left + b.width / 2, b.top); }); });
  }

  function pie(host, title, total, segs, unit) {
    var box = document.createElement('div'); box.className = 'cgs-pie';
    var tot = segs.reduce(function (t, x) { return t + x.v; }, 0), acc = 0, stops = [];
    segs.forEach(function (x) { var a = tot ? acc / tot * 100 : 0, b = tot ? (acc + x.v) / tot * 100 : 0; if (x.v > 0) stops.push(x.color + ' ' + a.toFixed(2) + '% ' + b.toFixed(2) + '%'); acc += x.v; });
    var ring = document.createElement('div'); ring.className = 'cgs-ring'; ring.style.background = stops.length ? 'conic-gradient(' + stops.join(',') + ')' : 'var(--card2)';
    var hole = document.createElement('div'); hole.className = 'cgs-hole'; hole.innerHTML = '<strong>' + num(total) + '</strong><span>' + esc(unit) + '</span>'; ring.appendChild(hole);
    var lg = document.createElement('div'); lg.className = 'cgs-pl'; lg.innerHTML = '<h3>' + esc(title) + '</h3>' + segs.map(function (x, i) { var pc = tot ? Math.round(x.v / tot * 100) : 0; return '<div class="cgs-pr" data-i="' + i + '" data-tip="1"><i style="background:' + x.color + '"></i><span>' + esc(x.name) + '</span><b>' + pc + '%</b><small>' + num(x.v) + '</small></div>'; }).join('');
    function sel(i, x, y) {
      [].forEach.call(lg.querySelectorAll('.cgs-pr'), function (r, j) { r.classList.toggle('on', j === i); r.classList.toggle('dim', i != null && j !== i); });
      if (i == null) { hole.innerHTML = '<strong>' + num(total) + '</strong><span>' + esc(unit) + '</span>'; tipHide(); return; }
      var sg = segs[i], pc = tot ? Math.round(sg.v / tot * 100) : 0; hole.innerHTML = '<strong>' + pc + '%</strong><span>' + esc(sg.name) + '</span>';
      tipShow('<b>' + esc(sg.name) + '</b>' + num(sg.v) + ' ' + esc(unit) + ' su ' + num(tot), x, y);
    }
    ring.addEventListener('pointerdown', function (e) {
      var r = ring.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), rad = Math.sqrt(dx * dx + dy * dy);
      if (rad > r.width / 2 + 4 || rad < r.width * .3 || !tot) { sel(null); return; }
      var deg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, p = deg / 360 * tot, a = 0, hit = null;
      for (var i = 0; i < segs.length; i++) { a += segs[i].v; if (p < a && segs[i].v > 0) { hit = i; break; } }
      sel(hit, e.clientX, e.clientY - 4);
    });
    [].forEach.call(lg.querySelectorAll('.cgs-pr'), function (r, i) { r.addEventListener('pointerdown', function () { var b = r.getBoundingClientRect(); sel(i, b.left + b.width / 2, b.top); }); });
    box.appendChild(ring); box.appendChild(lg); host.appendChild(box);
    if (!tot) lg.appendChild(Object.assign(document.createElement('p'), { className: 'hint', textContent: 'Ancora nessuna prenotazione nel periodo.' }));
  }

  // ---------- calcoli ----------
  function openMinutes(c, wd) { var t = 0; ((c.hours && c.hours[String(wd)]) || []).forEach(function (h) { var a = h[0].split(':'), b = h[1].split(':'); t += (+b[0] * 60 + +b[1]) - (+a[0] * 60 + +a[1]); }); return t; }
  // un giorno e' chiuso se lo sono tutti i campi: nessun orario in quel giorno della settimana oppure chiusura di giornata intera
  function dayClosed(d) {
    var cs = COURTS || []; if (!cs.length) return false;
    var k = key(d), wd = d.getDay() === 0 ? 7 : d.getDay();
    return cs.every(function (c) {
      if (!openMinutes(c, wd)) return true;
      return CLOSED.some(function (x) { return (!x.court_id || x.court_id === c.id) && k >= x.starts_on && k <= x.ends_on; });
    });
  }
  function capacity(from, to) { // minuti di campo disponibili tra due date (incluse)
    var t = 0, d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    while (d <= to) { var wd = d.getDay() === 0 ? 7 : d.getDay(); (COURTS || []).forEach(function (c) { t += openMinutes(c, wd); }); d = addD(d, 1); }
    return t;
  }
  function agg(rows) {
    var o = { n: 0, rev: 0, min: 0, pl: 0, mem: 0 };
    rows.forEach(function (r) { o.n++; o.rev += r.price; o.min += r.min; o.pl += r.pl; o.mem += r.mem; });
    return o;
  }
  function compute() {
    var tdy = new Date(); tdy = new Date(tdy.getFullYear(), tdy.getMonth(), tdy.getDate());
    var days = P === 'week' ? 7 : P === 'month' ? 30 : 365;
    var from = addD(tdy, -(days - 1)), pFrom = addD(from, -days), pTo = addD(from, -1);
    var all = (DATA.appointments || []).filter(function (a) { return a.status === 'confirmed'; }).map(function (a) {
      var s = new Date(a.starts_at), e = new Date(a.ends_at);
      return { d: new Date(s.getFullYear(), s.getMonth(), s.getDate()), h: s.getHours(), price: Number(a.price_eur) || 0, min: Math.max(0, (e - s) / 60000), pl: +a.players || 0, mem: Math.min(+a.members || 0, +a.players || 0), name: a.customer_name || '', phone: a.customer_phone || '', court: a.court_id, cname: a.service };
    });
    all = all.filter(function (r) { return !dayClosed(r.d); }); // nei giorni di chiusura non si conta nulla
    var cur = all.filter(function (r) { return r.d >= from && r.d <= tdy; }), prev = all.filter(function (r) { return r.d >= pFrom && r.d <= pTo; });
    var c = agg(cur), p = agg(prev);
    c.cap = capacity(from, tdy); p.cap = capacity(pFrom, pTo);
    c.fill = c.cap ? Math.min(100, Math.round(c.min / c.cap * 100)) : 0; p.fill = p.cap ? Math.min(100, Math.round(p.min / p.cap * 100)) : 0;
    // serie nel tempo
    var series = [], i;
    if (P === 'year') { for (i = 11; i >= 0; i--) { var m0 = new Date(tdy.getFullYear(), tdy.getMonth() - i, 1), m1 = new Date(m0.getFullYear(), m0.getMonth() + 1, 0); series.push({ d0: m0, d1: m1 }); } }
    else {
      for (i = 0; i < days; i++) { var dd = addD(from, i); if (!dayClosed(dd)) series.push({ d0: dd, d1: dd }); } // i giorni di chiusura non compaiono nei grafici
      if (!series.length) series.push({ d0: tdy, d1: tdy });
    }
    series.forEach(function (x) { var a = agg(cur.filter(function (r) { return r.d >= x.d0 && r.d <= x.d1; })); x.n = a.n; x.rev = a.rev; x.min = a.min; x.pl = a.pl; });
    // per campo
    var byC = (COURTS || []).map(function (ct) {
      var rr = cur.filter(function (r) { return r.court === ct.id; }), a = agg(rr), cap = 0, d = new Date(from);
      while (d <= tdy) { cap += openMinutes(ct, d.getDay() === 0 ? 7 : d.getDay()); d = addD(d, 1); }
      return { c: ct, n: a.n, min: a.min, rev: a.rev, cap: cap, pct: cap ? Math.min(100, Math.round(a.min / cap * 100)) : 0 };
    });
    var wdc = [0, 0, 0, 0, 0, 0, 0]; cur.forEach(function (r) { wdc[(r.d.getDay() + 6) % 7]++; });
    var hc = {}; cur.forEach(function (r) { hc[r.h] = (hc[r.h] || 0) + 1; });
    var topM = {}; cur.forEach(function (r) { var k = (r.phone || r.name).replace(/\s+/g, ''); if (!k) return; var t = topM[k] || (topM[k] = { name: r.name || 'Cliente', n: 0, min: 0 }); t.n++; t.min += r.min; });
    var top = Object.keys(topM).map(function (k) { return topM[k]; }).sort(function (a, b) { return b.n - a.n || b.min - a.min; }).slice(0, 8);
    var dbl = cur.filter(function (r) { return r.pl >= 3; }).length, sgl = cur.filter(function (r) { return r.pl > 0 && r.pl < 3; }).length;
    return { c: c, p: p, series: series, byC: byC, wdc: wdc, hc: hc, top: top, dbl: dbl, sgl: sgl };
  }

  // ---------- pagina ----------
  function shell() {
    root.innerHTML = '<header class="top"><div class="top-row"><div class="spacer"></div><div class="pseg" role="group" aria-label="Periodo">' + [['week', 'Settimana'], ['month', 'Mese'], ['year', 'Anno']].map(function (p) { return '<button type="button" data-p="' + p[0] + '" aria-pressed="' + (P === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div></div></header><div class="wrap" id="gcsWrap"></div>';
    [].forEach.call(root.querySelectorAll('[data-p]'), function (b) { b.onclick = function () { P = b.dataset.p; draw(); [].forEach.call(root.querySelectorAll('[data-p]'), function (x) { x.setAttribute('aria-pressed', String(x.dataset.p === P)); }); }; });
  }
  function kpi(l, v, d, extra, range) { return '<div class="kpi"><div class="lbl">' + l + '</div><div class="val">' + v + '</div>' + (range ? '<div class="range">' + range + '</div>' : '') + (extra ? '<div class="sub2">' + extra + '</div>' : '') + '<div class="delta ' + d.cls + '">' + esc(d.text) + '</div></div>'; }
  function load(force) {
    if (busy) return; if (DATA && COURTS && !force) { draw(); return; }
    busy = true; failed = false;
    var wrap = root.querySelector('#gcsWrap'); if (wrap && !DATA) wrap.innerHTML = '<div class="gcSk gcSkL"><i></i><i></i><i></i><i></i></div>';
    var h = window.liaGetHistory ? window.liaGetHistory() : fetch('/api/agenda?t=' + encodeURIComponent(token) + '&history=1', { cache: 'no-store' }).then(function (r) { return r.json(); });
    var cs = fetch('/api/agenda?t=' + encodeURIComponent(token) + '&courts=1&view=settings', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); });
    Promise.all([h, cs]).then(function (a) { DATA = a[0]; SPORT = (a[1].club && a[1].club.sport) || 'tennis'; COURTS = (a[1].courts || []).filter(function (c) { return c.active !== false; }); CLOSED = (a[1].past_closures || []).concat((a[1].closures || []).filter(function (c) { return !c.from; })).map(function (c) { return { court_id: c.court_id || null, starts_on: c.starts_on, ends_on: c.ends_on }; }); })
      .catch(function () { failed = true; })
      .then(function () { busy = false; if (active) draw(); });
  }
  var SPORT = 'tennis'; // tennis e padel: giocatori e soci; calcio, pallavolo e altri: solo prenotazioni e ore
  function isSimple() { return SPORT !== 'tennis' && SPORT !== 'padel'; }
  function draw() {
    tipHide(); if (!root.querySelector('#gcsWrap')) shell();
    var wrap = root.querySelector('#gcsWrap');
    if (failed || !DATA) { wrap.innerHTML = failed ? '<div class="heat-msg">Non riesco a caricare le statistiche. <button type="button" id="cgsRetry">Riprova</button></div>' : ''; var rb = wrap.querySelector('#cgsRetry'); if (rb) rb.onclick = function () { load(true); }; return; }
    var d = compute(), c = d.c, p = d.p;
    var nM = c.mem, nG = Math.max(0, c.pl - c.mem);
    wrap.innerHTML = '<div class="kpis">' +
      kpi('Incasso', eur(c.rev), delta(c.rev, p.rev), '', PL[P]) +
      kpi('Prenotazioni', num(c.n), delta(c.n, p.n), hrs(c.min) + ' di campo giocate') +
      kpi('Occupazione dei campi', c.fill + '%', delta(c.fill, p.fill, 'pt'), hrs(c.min) + ' su ' + hrs(c.cap) + ' disponibili') +
      (isSimple() ? kpi('Ore giocate', hrs(c.min), delta(c.min, p.min), 'sui campi, nel periodo') : kpi('Giocatori', num(c.pl), delta(c.pl, p.pl), num(nM) + ' soci · ' + num(nG) + ' non soci')) +
      '</div><div class="panels">' +
      '<div class="row2"><div class="panel"><h2>Incassi nel tempo</h2><p class="sub">Quanto hanno pagato i giocatori. Tocca una barra per il dettaglio.</p><div id="cgsRev"></div></div>' +
      '<div class="panel"><h2>Prenotazioni nel tempo</h2><p class="sub">Campi prenotati ogni ' + (P === 'year' ? 'mese' : 'giorno') + '.</p><div id="cgsBk"></div></div></div>' +
      '<div class="row2"><div class="panel"><h2>Occupazione per campo</h2><p class="sub">Ore giocate sulle ore di apertura, nel periodo.</p><div class="hbars" id="byservice"></div></div>' +
      '<div class="panel"><h2>Giorni più richiesti</h2><p class="sub">Prenotazioni per giorno della settimana.</p><div class="hbars" id="cgsWd"></div></div></div>' +
      (isSimple() ? '' : '<div class="row2"><div class="panel"><h2>Soci e non soci</h2><p class="sub">Chi gioca sui campi. Tocca una fetta per il dettaglio.</p><div id="cgsWho" class="cgs-pies"></div></div>' +
      '<div class="panel"><h2>Singolo o doppio</h2><p class="sub">Come si gioca. Tocca una fetta per il dettaglio.</p><div id="cgsTyp" class="cgs-pies"></div></div></div>') +
      '</div><details class="stats-method"><summary>Come vengono calcolate le statistiche?</summary><div class="stats-method-body"><p><strong>Incasso</strong> Somma dei prezzi delle prenotazioni confermate nel periodo.</p><p><strong>Occupazione</strong> Ore di campo prenotate diviso le ore in cui i campi sono aperti (gli orari che imposti in «Campi e orari»). Le chiusure straordinarie non sono tolte dal totale.</p>' + (isSimple() ? '<p><strong>Ore giocate</strong> Ore di campo delle prenotazioni confermate nel periodo.</p>' : '<p><strong>Giocatori</strong> Somma dei giocatori indicati su ogni prenotazione; i soci sono quelli segnati come tali.</p>') + '<p>I giorni di chiusura (campi senza orari in quel giorno o chiusi tutto il giorno) non compaiono nei grafici e non contano negli incassi.</p><p>Le prenotazioni annullate non vengono contate. Il confronto è con il periodo precedente della stessa durata.</p></div></details>';
    bars(wrap.querySelector('#cgsRev'), d.series, function (x) { return x.rev; }, function (x) { return '<b>' + esc(titleOf(x)) + '</b>' + eur(x.rev) + '<br>' + x.n + (x.n === 1 ? ' prenotazione' : ' prenotazioni'); });
    line(wrap.querySelector('#cgsBk'), d.series, function (x) { return x.n; }, function (x) { return '<b>' + esc(titleOf(x)) + '</b>' + x.n + (x.n === 1 ? ' prenotazione' : ' prenotazioni') + '<br>' + hrs(x.min) + ' di campo · ' + x.pl + ' giocatori'; });
    hbars(wrap.querySelector('#byservice'), d.byC.map(function (x) { return { name: x.c.name, color: courtColor(x.c), pct: x.pct, amt: x.pct + '%', tip: '<b>' + esc(x.c.name) + ' · ' + x.pct + '%</b>' + hrs(x.min) + ' su ' + hrs(x.cap) + '<br>' + x.n + (x.n === 1 ? ' prenotazione' : ' prenotazioni') + ' · ' + eur(x.rev) }; }), 'Aggiungi i campi da Impostazioni › Campi e orari.');
    var mx = Math.max.apply(null, d.wdc.concat([1]));
    hbars(wrap.querySelector('#cgsWd'), c.n ? d.wdc.map(function (n, i) { return { name: DAYL[i], color: 'var(--accent)', pct: Math.round(n / mx * 100), amt: String(n), tip: '<b>' + DAYL[i] + '</b>' + n + (n === 1 ? ' prenotazione' : ' prenotazioni') }; }) : [], 'Ancora nessuna prenotazione nel periodo.');
    var tp = nM + nG, tg = d.dbl + d.sgl;
    if (isSimple()) return;
    pie(wrap.querySelector('#cgsWho'), 'Giocatori', tp, [{ name: 'Soci', v: nM, color: css('--accent', '#2B8A94') }, { name: 'Non soci', v: nG, color: '#3B9CFF' }], 'giocatori');
    pie(wrap.querySelector('#cgsTyp'), 'Tipo di partita', tg, [{ name: 'Doppio (3-4)', v: d.dbl, color: '#7FDCDC' }, { name: 'Singolo (1-2)', v: d.sgl, color: '#E0A23A' }], 'partite');
  }

  document.addEventListener('lia:section', function (e) { active = e.detail === 'stats'; if (active) { shell(); load(); } else tipHide(); });
  document.addEventListener('lia:campichanged', function () { DATA = null; window.liaHistoryPromise = null; if (active) load(true); });
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (active && DATA) draw(); }, 220); });
  try { new MutationObserver(function () { if (active && DATA) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { }
  try { var ap = document.querySelector('.tabPanel.on'); if (ap && ap.id === 'panelStats') { active = true; shell(); load(); } } catch (e) { }
})();
