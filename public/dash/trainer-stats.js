// --- Personal trainer: Statistiche su pacchetti, incassi, coaching e iscritti (niente appuntamenti/clienti) ---
(function () {
  if (!window.__LIA_PT) return;
  var P = 'month', D = null, HIST = [], box = null, started = false, sig = '', tipEl = null;
  var MS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  var COL = ['var(--accent)', '#E0A23A', '#9B7BEA', '#4FB3A0', '#E0635A', '#5B9BE0'];
  var NF = new Intl.NumberFormat('it-IT', { useGrouping: 'always', maximumFractionDigits: 2 });
  function tok() { return (new URLSearchParams(location.search).get('t') || '').trim(); }
  function url(x) { return '/api/agenda?t=' + encodeURIComponent(tok()) + '&pt=1' + (x || ''); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function pn(p) { var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('0039') === 0) d = d.slice(4); else if (d.indexOf('39') === 0 && d.length > 10) d = d.slice(2); return d; }
  function pd(x) { return new Date(String(x || '').replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1')); }
  function eur(v) { return NF.format(Number(v) || 0) + ' €'; }
  function plural(n, a, b) { return n + ' ' + (n === 1 ? a : b); }
  function sv(tag, a) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); if (a) for (var k in a) e.setAttribute(k, a[k]); return e; }
  function calm() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  // ---- tooltip (stesso aspetto di quello delle altre statistiche) ----
  function tipNode() { if (!tipEl) { tipEl = el('div'); tipEl.id = 'ptTip'; tipEl.setAttribute('role', 'status'); document.body.appendChild(tipEl); } return tipEl; }
  function tipShow(html, x, y, touch) {
    var t = tipNode(); t.innerHTML = html; t.classList.add('on');
    var w = t.offsetWidth, h = t.offsetHeight, vw = document.documentElement.clientWidth, tx = Math.min(Math.max(8, x - w / 2), vw - w - 8), ty = y - h - (touch ? 34 : 14);
    if (ty < 8) ty = y + (touch ? 28 : 18);
    t.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
  }
  var clears = [];
  function tipHide() { if (tipEl) tipEl.classList.remove('on'); clears.forEach(function (f) { f(); }); }
  document.addEventListener('pointerdown', function (e) { if (!e.target.closest || !e.target.closest('[data-pt-tip]')) tipHide(); });
  window.addEventListener('scroll', tipHide, { passive: true });
  function toSvg(svg, e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }
  function toScreen(svg, x, y) { var p = svg.createSVGPoint(); p.x = x; p.y = y; return p.matrixTransform(svg.getScreenCTM()); }
  function hover(svg, n, idxFn, show, hide) {
    svg.setAttribute('data-pt-tip', '1');
    function on(e) { var i = idxFn(toSvg(svg, e).x); if (i < 0 || i >= n) return; show(i, e.pointerType === 'touch'); }
    function off() { hide(); if (tipEl) tipEl.classList.remove('on'); }
    svg.onpointerdown = on;
    svg.onpointermove = function (e) { if (e.pointerType === 'mouse' || e.buttons || e.pressure > 0) on(e); };
    svg.onpointerleave = function (e) { if (e.pointerType === 'mouse') off(); };
    svg.onpointercancel = off;
    clears.push(hide);
  }

  // ---- periodi ----
  function bounds(p, prev) {
    var n = new Date(), s, e;
    if (p === 'week') { s = new Date(n); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); e = new Date(s); e.setDate(e.getDate() + 7); if (prev) { e = new Date(s); s = new Date(s); s.setDate(s.getDate() - 7); } }
    else if (p === 'month') { s = new Date(n.getFullYear(), n.getMonth() + (prev ? -1 : 0), 1); e = new Date(n.getFullYear(), n.getMonth() + (prev ? 0 : 1), 1); }
    else { s = new Date(n.getFullYear() + (prev ? -1 : 0), 0, 1); e = new Date(n.getFullYear() + (prev ? 0 : 1), 0, 1); }
    return { s: s, e: e };
  }
  function inB(d, b) { return d >= b.s && d < b.e; }
  function delta(cur, prev) {
    if (!prev) return cur ? { t: 'Nuovo rispetto al periodo precedente', c: 'up' } : { t: 'Nessun dato per il confronto', c: 'flat' };
    var d = (cur - prev) / prev * 100, c = d > 3 ? 'up' : d < -3 ? 'down' : 'flat';
    return { t: (d > 0 ? '+' : '') + Math.round(d) + '% rispetto al periodo precedente', c: c };
  }
  function packs() { var o = []; ((D && D.members) || []).forEach(function (m) { (m.packs || []).forEach(function (p) { o.push({ id: p.id, name: p.name, price: Number(p.price_eur) || 0, at: pd(p.created_at), m: m }); }); }); return o; }
  function lessons() { return HIST.filter(function (a) { return a.status !== 'cancelled'; }).map(function (a) { return { at: pd(a.starts_at) }; }); }

  // punti: giorni (settimana/mese) o mesi (anno); v = somma, n = quanti elementi
  function series(items, p, val) {
    var b = bounds(p, false), out = [], i;
    if (p === 'year') { for (i = 0; i < 12; i++) out.push({ label: MS[i], full: MS[i] + ' ' + b.s.getFullYear(), v: 0, n: 0 }); items.forEach(function (x) { if (inB(x.at, b)) { var o = out[x.at.getMonth()]; o.v += val(x); o.n++; } }); return out; }
    var days = Math.round((b.e - b.s) / 86400000);
    for (i = 0; i < days; i++) { var d = new Date(b.s); d.setDate(d.getDate() + i); out.push({ label: d.getDate() + ' ' + MS[d.getMonth()], full: d.getDate() + ' ' + MS[d.getMonth()], v: 0, n: 0 }); }
    items.forEach(function (x) { if (inB(x.at, b)) { var k = Math.floor((new Date(x.at.getFullYear(), x.at.getMonth(), x.at.getDate()) - b.s) / 86400000); if (out[k]) { out[k].v += val(x); out[k].n++; } } });
    return out;
  }

  // ---- grafici ----
  function niceMoney(m) { if (m <= 50) return 50; var e = Math.pow(10, Math.floor(Math.log(m) / Math.LN10)), f = m / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
  function niceInt(m) { return m <= 4 ? 4 : Math.ceil(m / 4) * 4; }
  function smooth(pts) {
    var n = pts.length; function f(v) { return v.toFixed(1); }
    if (n < 3) return pts.map(function (p, i) { return (i === 0 ? 'M' : 'L') + f(p.x) + ',' + f(p.y); }).join(' ');
    var dx = [], m = [], t = [], i;
    for (i = 0; i < n - 1; i++) { dx[i] = pts[i + 1].x - pts[i].x || 1; m[i] = (pts[i + 1].y - pts[i].y) / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (i = 1; i < n - 1; i++) t[i] = (m[i - 1] * m[i] <= 0) ? 0 : (m[i - 1] + m[i]) / 2;
    for (i = 0; i < n - 1; i++) { if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; } var a = t[i] / m[i], b = t[i + 1] / m[i], q = a * a + b * b; if (q > 9) { var k = 3 / Math.sqrt(q); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; } }
    var d = 'M' + f(pts[0].x) + ',' + f(pts[0].y);
    for (i = 0; i < n - 1; i++) { var c = dx[i] / 3; d += ' C' + f(pts[i].x + c) + ',' + f(pts[i].y + t[i] * c) + ' ' + f(pts[i + 1].x - c) + ',' + f(pts[i + 1].y - t[i + 1] * c) + ' ' + f(pts[i + 1].x) + ',' + f(pts[i + 1].y); }
    return d;
  }
  var gid = 0;
  function lineChart(host, pts, o) {
    var svg = sv('svg', { class: 'linechart', role: 'img', 'aria-label': o.aria || 'Grafico' }); host.appendChild(svg);
    var W = (window.liaChartW && window.liaChartW(svg)) || 640, H = 220, pl = o.money ? 48 : 34, pr = 12, pt = 14, pb = 26, iw = W - pl - pr, ih = H - pt - pb;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var raw = Math.max.apply(null, pts.map(function (p) { return p.v; })) || 1, max = o.money ? niceMoney(raw) : niceInt(raw), id = 'ptG' + (++gid);
    var defs = sv('defs'), g = sv('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }); g.appendChild(sv('stop', { offset: '0%', 'stop-color': 'var(--accent)', 'stop-opacity': '.35' })); g.appendChild(sv('stop', { offset: '100%', 'stop-color': 'var(--accent)', 'stop-opacity': '0' })); defs.appendChild(g); svg.appendChild(defs);
    [0, .5, 1].forEach(function (t) { var y = pt + ih * t; svg.appendChild(sv('line', { class: 'grid-l', x1: pl, x2: W - pr, y1: y, y2: y })); var lb = sv('text', { class: 'axis', x: pl - 8, y: y + 4, 'text-anchor': 'end' }); lb.textContent = NF.format(Math.round(max * (1 - t))); svg.appendChild(lb); });
    function X(i) { return pl + (pts.length > 1 ? i / (pts.length - 1) : 0) * iw; } function Y(v) { return pt + ih - v / max * ih; }
    var xy = pts.map(function (p, i) { return { x: X(i), y: Y(p.v) }; }), d = smooth(xy);
    svg.appendChild(sv('path', { class: 'area', d: d + ' L' + X(pts.length - 1).toFixed(1) + ',' + (pt + ih) + ' L' + X(0).toFixed(1) + ',' + (pt + ih) + ' Z', style: 'fill:url(#' + id + ')' }));
    var line = sv('path', { class: 'line', d: d }); svg.appendChild(line);
    var step = Math.max(1, Math.round(pts.length / 6)), last = pts.length - 1;
    pts.forEach(function (p, i) {
      if (i % step === 0 || i === last) {
        if (pts.length <= 12) svg.appendChild(sv('circle', { class: 'dot', cx: X(i), cy: Y(p.v), r: 3.5 }));
        if (i === last || (i % step === 0 && last - i >= Math.max(2, step))) { var t = sv('text', { class: 'axis', x: X(i), y: H - 6, 'text-anchor': i === 0 ? 'start' : i === last ? 'end' : 'middle' }); t.textContent = p.label; svg.appendChild(t); }
      }
    });
    var cross = sv('line', { y1: pt, y2: pt + ih, stroke: 'var(--muted)', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: 0, 'pointer-events': 'none' }), dot = sv('circle', { r: 5.5, fill: 'var(--bg)', stroke: 'var(--accent)', 'stroke-width': 2.5, opacity: 0, 'pointer-events': 'none' });
    svg.appendChild(cross); svg.appendChild(dot);
    hover(svg, pts.length, function (x) { return Math.max(0, Math.min(last, Math.round((x - X(0)) / ((X(last) - X(0)) || 1) * last))); },
      function (i, touch) { var px = X(i), py = Y(pts[i].v); cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('opacity', 1); dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('opacity', 1); var sp = toScreen(svg, px, py); tipShow(o.tip(pts[i]), sp.x, sp.y, touch); },
      function () { cross.setAttribute('opacity', 0); dot.setAttribute('opacity', 0); });
    if (!calm()) {
      var len = 0; try { len = line.getTotalLength(); } catch (e) { }
      if (len) { var area = svg.querySelector('.area');
      line.style.strokeDasharray = len; line.style.strokeDashoffset = len; area.style.opacity = '0';
      requestAnimationFrame(function () { line.style.transition = 'stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)'; line.style.strokeDashoffset = '0'; area.style.transition = 'opacity .7s ease .25s'; area.style.opacity = '1'; }); }
    }
  }
  function barChart(host, pts, o) {
    var svg = sv('svg', { class: 'barchart', role: 'img', 'aria-label': o.aria || 'Grafico' }); host.appendChild(svg);
    var W = (window.liaChartW && window.liaChartW(svg)) || 640, H = 200, pl = 30, pr = 8, pt = 10, pb = 26, iw = W - pl - pr, ih = H - pt - pb;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var max = niceInt(Math.max.apply(null, pts.map(function (p) { return p.v; })) || 1);
    [0, .5, 1].forEach(function (t) { var y = pt + ih * t; svg.appendChild(sv('line', { class: 'grid-l', x1: pl, x2: W - pr, y1: y, y2: y })); var lb = sv('text', { class: 'axis', x: pl - 8, y: y + 4, 'text-anchor': 'end' }); lb.textContent = Math.round(max * (1 - t)); svg.appendChild(lb); });
    var gap = pts.length > 20 ? 3 : 8, bw = (iw - gap * (pts.length - 1)) / pts.length, step = Math.max(1, Math.round(pts.length / 6)), last = pts.length - 1, rects = [];
    pts.forEach(function (p, i) {
      var bh = p.v / max * ih, x = pl + i * (bw + gap), r = sv('rect', { class: 'bar', x: x, y: pt + ih - bh, width: Math.max(bw, 1), height: Math.max(p.v ? bh : 0, p.v ? 2 : 0), rx: Math.min(4, bw / 2) });
      rects.push(r); svg.appendChild(r);
      if (i === last || (i % step === 0 && last - i >= Math.max(2, step))) { var t = sv('text', { class: 'axis', x: x + bw / 2, y: H - 6, 'text-anchor': i === 0 ? 'start' : i === last ? 'end' : 'middle' }); t.textContent = p.label; svg.appendChild(t); }
    });
    hover(svg, pts.length, function (x) { return Math.max(0, Math.min(last, Math.floor((x - pl + gap / 2) / (bw + gap)))); },
      function (i, touch) { rects.forEach(function (r, j) { r.style.opacity = j === i ? '1' : '.35'; }); var sp = toScreen(svg, pl + i * (bw + gap) + bw / 2, parseFloat(rects[i].getAttribute('y'))); tipShow(o.tip(pts[i]), sp.x, sp.y, touch); },
      function () { rects.forEach(function (r) { r.style.opacity = ''; }); });
    if (!calm()) {
      rects.forEach(function (r) { r.style.transformBox = 'fill-box'; r.style.transformOrigin = 'bottom'; r.style.transform = 'scaleY(0)'; });
      requestAnimationFrame(function () { rects.forEach(function (r, i) { r.style.transition = 'transform .5s cubic-bezier(.2,.8,.2,1) ' + Math.min(i * 12, 260) + 'ms'; r.style.transform = 'scaleY(1)'; }); });
    }
  }
  function panel(title, sub) { var p = el('div', 'panel'); p.appendChild(el('h2', null, title)); if (sub) p.appendChild(el('p', 'sub', sub)); return p; }

  function draw() {
    if (!box) return;
    tipHide(); clears = [];
    box.textContent = '';
    if (!D) { box.appendChild(el('p', 'sub', 'Carico le statistiche...')); return; }
    var b = bounds(P, false), bp = bounds(P, true), now = new Date(), pk = packs(), ls = lessons(), mem = D.members || [];
    var sold = pk.filter(function (x) { return inB(x.at, b); }), soldPrev = pk.filter(function (x) { return inB(x.at, bp); });
    var income = sold.reduce(function (s, x) { return s + x.price; }, 0), incomePrev = soldPrev.reduce(function (s, x) { return s + x.price; }, 0);
    var lp = ls.filter(function (x) { return inB(x.at, b); }), lpPrev = ls.filter(function (x) { return inB(x.at, bp); });
    var done = lp.filter(function (x) { return x.at <= now; }).length, donePrev = lpPrev.filter(function (x) { return x.at <= now; }).length;
    var active = mem.filter(function (m) { return m.left > 0; }).length;

    var cards = [
      { l: 'Incassi', v: eur(income), d: delta(income, incomePrev) },
      { l: 'Pacchetti venduti', v: String(sold.length), d: delta(sold.length, soldPrev.length) },
      { l: 'Coaching svolti', v: String(done), d: lp.length > done ? { t: 'Su ' + lp.length + ' in programma nel periodo', c: 'flat' } : delta(done, donePrev) },
      { l: 'Iscritti in corso', v: String(active), d: { t: 'Su ' + mem.length + ' iscritti totali', c: 'flat' } }
    ];
    var kp = el('div', 'kpis');
    cards.forEach(function (c) { var k = el('div', 'kpi'); k.appendChild(el('div', 'lbl', c.l)); k.appendChild(el('div', 'val', c.v)); k.appendChild(el('div', 'delta ' + c.d.c, c.d.t)); kp.appendChild(k); });
    box.appendChild(kp);

    var panels = el('div', 'panels'); box.appendChild(panels);
    var r1 = el('div', 'row2'); panels.appendChild(r1);
    var sI = series(pk, P, function (x) { return x.price; }), a = panel('Incassi nel tempo', 'Euro incassati dai pacchetti, nel giorno in cui li registri.'); r1.appendChild(a);
    if (sI.some(function (q) { return q.v; })) lineChart(a, sI, { money: true, aria: 'Incassi nel tempo', tip: function (p) { return '<b>' + eur(p.v) + '</b>' + p.full + (p.n ? ' · ' + plural(p.n, 'pacchetto', 'pacchetti') : ''); } });
    else a.appendChild(el('p', 'ptEmpty', 'Nessun incasso in questo periodo.'));
    var sL = series(ls.filter(function (x) { return x.at <= now; }), P, function () { return 1; }), c2 = panel('Coaching svolti nel tempo', 'Quanti coaching hai tenuto nel periodo.'); r1.appendChild(c2);
    if (sL.some(function (q) { return q.v; })) barChart(c2, sL, { aria: 'Coaching svolti nel tempo', tip: function (p) { return '<b>' + plural(p.v, 'coaching', 'coaching') + '</b>' + p.full; } });
    else c2.appendChild(el('p', 'ptEmpty', 'Nessun coaching svolto in questo periodo.'));

    var r2 = el('div', 'row2'); panels.appendChild(r2);
    var by = {}; sold.forEach(function (x) { var k = x.name || 'Pacchetto'; (by[k] = by[k] || { n: 0, v: 0 }); by[k].n++; by[k].v += x.price; });
    var names = Object.keys(by).sort(function (x, y) { return by[y].v - by[x].v || by[y].n - by[x].n; });
    var pp = panel('Pacchetti più venduti', 'Quanto incassi da ciascun pacchetto nel periodo.'); r2.appendChild(pp);
    if (!names.length) pp.appendChild(el('p', 'ptEmpty', 'Nessun pacchetto venduto in questo periodo.'));
    else {
      var list = el('div', 'ptHb'), top = by[names[0]].v || by[names[0]].n || 1;
      names.slice(0, 6).forEach(function (n, i) {
        var row = el('div', 'ptHbR'), col = COL[i % COL.length], h = el('div', 'ptHbH'), nm = el('div', 'ptHbN'), dt = el('i');
        dt.style.background = col; nm.appendChild(dt); nm.appendChild(el('span', null, n)); h.appendChild(nm); h.appendChild(el('b', null, eur(by[n].v)));
        row.appendChild(h); row.appendChild(el('div', 'ptHbS', plural(by[n].n, 'venduto', 'venduti') + (income ? ' · ' + Math.round(by[n].v / income * 100) + '% degli incassi' : '')));
        var tr = el('div', 'ptTr'), f = el('div', 'ptFl'); f.style.background = col; f.style.width = Math.round((by[n].v || by[n].n) / top * 100) + '%';
        if (!calm()) { f.style.transform = 'scaleX(0)'; setTimeout(function () { f.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1) ' + (i * 70) + 'ms'; f.style.transform = 'scaleX(1)'; }, 30); }
        tr.appendChild(f); row.appendChild(tr);
        row.setAttribute('data-pt-tip', '1');
        row.addEventListener('pointerdown', function (e) { var r = row.getBoundingClientRect(); tipShow('<b>' + eur(by[n].v) + '</b>' + n + ' · ' + plural(by[n].n, 'venduto', 'venduti'), e.clientX, r.top, e.pointerType === 'touch'); });
        list.appendChild(row);
      });
      pp.appendChild(list);
    }
    var first = {}; pk.forEach(function (x) { var k = pn(x.m.phone); if (!first[k] || x.at < first[k]) first[k] = x.at; });
    var gpts = [], y = now.getFullYear(), mo = now.getMonth(), i;
    for (i = 11; i >= 0; i--) { var dd = new Date(y, mo - i, 1), end = new Date(y, mo - i + 1, 1), c = 0; for (var k in first) if (first[k] < end) c++; gpts.push({ label: MS[dd.getMonth()], full: MS[dd.getMonth()] + ' ' + dd.getFullYear(), v: c }); }
    var gp = panel('Crescita iscritti', 'Iscritti totali, ultimi 12 mesi.'); r2.appendChild(gp);
    lineChart(gp, gpts, { aria: 'Crescita iscritti', tip: function (p) { return '<b>' + plural(p.v, 'iscritto', 'iscritti') + '</b>' + p.full; } });

    var det = el('details', 'stats-method'); det.appendChild(el('summary', null, 'Come vengono calcolate le statistiche?'));
    var bd = el('div', 'stats-method-body');
    [['Incassi', 'Somma dei prezzi dei pacchetti registrati nel periodo, nel giorno in cui li hai assegnati all\'iscritto.'], ['Coaching svolti', 'Coaching già trascorsi e non annullate nel periodo.'], ['Iscritti in corso', 'Iscritti che hanno ancora almeno un ingresso.']].forEach(function (x) { var p = el('p'); p.appendChild(el('strong', null, x[0] + ' ')); p.appendChild(document.createTextNode(x[1])); bd.appendChild(p); });
    det.appendChild(bd); box.appendChild(det);
  }

  function load() {
    window.liaHistoryCache = null; window.liaHistoryPromise = null;
    var rp = fetch(url('&roster=1'), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { if (j && Array.isArray(j.members)) D = j; });
    var hp = (window.liaGetHistory ? window.liaGetHistory() : Promise.resolve({})).then(function (h) { HIST = (h && h.appointments) || []; }, function () { HIST = []; });
    return Promise.all([rp, hp]).then(function () {
      var s = JSON.stringify([D && D.members, HIST.length]);
      if (s !== sig) { sig = s; draw(); }
    }, function () { if (box && !D) { box.textContent = ''; box.appendChild(el('p', 'sub', 'Non riesco a caricare le statistiche: riprova.')); } });
  }
  window.liaPtStatsRefresh = load;

  function init() {
    var app = document.getElementById('statsSubApp'), wrap = app && app.querySelector('.wrap');
    if (!wrap) return false;
    if (!document.getElementById('ptStCss')) {
      var st = el('style'); st.id = 'ptStCss';
      st.textContent = '#statsSubApp .wrap>:not(#ptSt){display:none!important}#ptSt .panels{display:grid;gap:16px;margin-top:16px}#ptSt .panel h2{margin:0 0 4px;font-size:1.05rem}#ptSt .panel .sub{margin:0 0 6px;color:var(--muted);font-size:.88rem}#ptSt .stats-method{margin-top:18px}' +
        '#ptSt .ptEmpty{margin:26px 0 18px;text-align:center;color:var(--muted);font-size:.92rem}' +
        '#ptSt .row2{display:grid;gap:16px;grid-template-columns:1fr}@media(min-width:860px){#ptSt .row2{grid-template-columns:1fr 1fr}}' +
        '#ptSt .ptHb{display:grid;gap:18px;margin-top:20px}#ptSt .ptHbR{cursor:pointer;-webkit-user-select:none;user-select:none}#ptSt .ptHbH{display:flex;justify-content:space-between;align-items:baseline;gap:12px}' +
        '#ptSt .ptHbN{display:flex;align-items:center;gap:9px;min-width:0;font-weight:600;font-size:.95rem}#ptSt .ptHbN i{width:9px;height:9px;border-radius:50%;flex:none}#ptSt .ptHbN span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '#ptSt .ptHbH b{font-size:.98rem;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}#ptSt .ptHbS{margin:3px 0 8px 18px;color:var(--muted);font-size:.8rem}' +
        '#ptSt .ptTr{height:8px;border-radius:8px;background:var(--card2);overflow:hidden}#ptSt .ptFl{height:100%;border-radius:8px;transform-origin:left}' +
        '#ptTip{position:fixed;z-index:80;left:0;top:0;pointer-events:none;background:var(--ink);color:var(--bg);border-radius:10px;padding:8px 11px;font-size:.78rem;line-height:1.35;box-shadow:0 8px 24px rgba(0,0,0,.3);opacity:0;transition:opacity .1s;max-width:240px}#ptTip.on{opacity:1}#ptTip b{display:block;font-size:.9rem;font-weight:700}';
      document.head.appendChild(st);
    }
    box = document.getElementById('ptSt');
    if (!box) { box = el('div'); box.id = 'ptSt'; wrap.appendChild(box); }
    app.querySelectorAll('.pseg [data-p]').forEach(function (b) {
      if (b.__pt) return; b.__pt = 1;
      b.addEventListener('click', function () { P = b.getAttribute('data-p'); draw(); });
    });
    return true;
  }

  function start() {
    if (started) return; if (!init()) return; started = true;
    draw(); load();
    // ogni volta che si apre la pagina Statistiche: i grafici si ridisegnano con l'animazione e i dati si aggiornano
    var pnl = document.getElementById('panelStats'), was = false;
    function vis() { return !!(pnl && pnl.offsetParent !== null && !pnl.hidden); }
    function check() { var v = vis(); if (v && !was) { draw(); load(); } was = v; }
    if (pnl) new MutationObserver(check).observe(pnl, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    setInterval(check, 1200);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && vis()) load(); });
    var prev = window.liaPtRefresh; if (prev) window.liaPtRefresh = function () { var r = prev.apply(this, arguments); load(); return r; };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  setTimeout(start, 600); setTimeout(start, 1800);
})();
