// --- Personal trainer: Statistiche su pacchetti, incassi, lezioni e iscritti (niente appuntamenti/clienti) ---
(function () {
  if (!window.__LIA_PT) return;
  var P = 'month', D = null, HIST = [], box = null, started = false;
  var MS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  var COL = ['var(--accent)', '#E0A23A', '#9B7BEA', '#4FB3A0', '#E0635A'];
  function tok() { return (new URLSearchParams(location.search).get('t') || '').trim(); }
  function url(x) { return '/api/agenda?t=' + encodeURIComponent(tok()) + '&pt=1' + (x || ''); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function pn(p) { var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('0039') === 0) d = d.slice(4); else if (d.indexOf('39') === 0 && d.length > 10) d = d.slice(2); return d; }
  function pd(x) { return new Date(String(x || '').replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1')); }
  function eur(v) { return (Number(v) || 0).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €'; }
  function sv(tag, a) { var e = document.createElementNS('http://www.w3.org/2000/svg', tag); for (var k in a) e.setAttribute(k, a[k]); return e; }

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

  // punti per grafico: giorni (settimana/mese) o mesi (anno)
  function series(items, p, val) {
    var b = bounds(p, false), out = [], i;
    if (p === 'year') { for (i = 0; i < 12; i++) out.push({ l: MS[i], v: 0 }); items.forEach(function (x) { if (inB(x.at, b)) out[x.at.getMonth()].v += val(x); }); return out; }
    var days = Math.round((b.e - b.s) / 86400000);
    for (i = 0; i < days; i++) { var d = new Date(b.s); d.setDate(d.getDate() + i); out.push({ l: d.getDate() + ' ' + MS[d.getMonth()], v: 0 }); }
    items.forEach(function (x) { if (inB(x.at, b)) { var k = Math.floor((new Date(x.at.getFullYear(), x.at.getMonth(), x.at.getDate()) - b.s) / 86400000); if (out[k]) out[k].v += val(x); } });
    return out;
  }
  function lineChart(pts, money) {
    var W = 640, H = 220, pl = 44, pr = 12, pt = 14, pb = 28, iw = W - pl - pr, ih = H - pt - pb, max = nice(Math.max.apply(null, pts.map(function (p) { return p.v; })) || 1), svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'linechart', role: 'img' });
    function X(i) { return pl + (pts.length > 1 ? i / (pts.length - 1) : 0) * iw; } function Y(v) { return pt + ih - v / max * ih; }
    [0, .5, 1].forEach(function (f) { var y = pt + ih - f * ih; svg.appendChild(sv('line', { x1: pl, x2: W - pr, y1: y, y2: y, stroke: 'var(--line)', 'stroke-width': 1 })); var t = sv('text', { x: pl - 8, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)' }); t.textContent = money ? Math.round(max * f) + (f ? '€' : '') : Math.round(max * f); svg.appendChild(t); });
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1); }).join(' ');
    svg.appendChild(sv('path', { d: d + ' L' + X(pts.length - 1).toFixed(1) + ' ' + (pt + ih) + ' L' + X(0).toFixed(1) + ' ' + (pt + ih) + ' Z', fill: 'var(--accent)', opacity: .12 }));
    svg.appendChild(sv('path', { d: d, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    [0, Math.floor((pts.length - 1) / 2), pts.length - 1].forEach(function (i, k) { if (!pts[i]) return; var t = sv('text', { x: X(i), y: H - 8, 'text-anchor': k === 0 ? 'start' : k === 2 ? 'end' : 'middle', 'font-size': 11, fill: 'var(--muted)' }); t.textContent = pts[i].l; svg.appendChild(t); });
    pts.forEach(function (p, i) { if (p.v) { var c = sv('circle', { cx: X(i), cy: Y(p.v), r: 3.5, fill: 'var(--accent)' }); var tt = sv('title', {}); tt.textContent = p.l + ': ' + (money ? eur(p.v) : p.v); c.appendChild(tt); svg.appendChild(c); } });
    return svg;
  }
  function barChart(pts) {
    var W = 640, H = 200, pl = 30, pb = 26, pt = 10, iw = W - pl - 8, ih = H - pt - pb, max = Math.max(2, Math.max.apply(null, pts.map(function (p) { return p.v; })) || 1), svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'barchart', role: 'img' }), bw = iw / pts.length;
    [0, 1].forEach(function (f) { var y = pt + ih - f * ih; svg.appendChild(sv('line', { x1: pl, x2: W - 8, y1: y, y2: y, stroke: 'var(--line)', 'stroke-width': 1 })); var t = sv('text', { x: pl - 6, y: y + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)' }); t.textContent = Math.round(max * f); svg.appendChild(t); });
    pts.forEach(function (p, i) { var h = p.v / max * ih, r = sv('rect', { x: pl + i * bw + bw * .18, y: pt + ih - h, width: Math.max(2, bw * .64), height: Math.max(p.v ? 2 : 0, h), rx: Math.min(5, bw * .3), fill: 'var(--accent)' }); var tt = sv('title', {}); tt.textContent = p.l + ': ' + p.v + (p.v === 1 ? ' lezione' : ' lezioni'); r.appendChild(tt); svg.appendChild(r); });
    [0, Math.floor((pts.length - 1) / 2), pts.length - 1].forEach(function (i, k) { var t = sv('text', { x: pl + i * bw + bw / 2, y: H - 8, 'text-anchor': k === 0 ? 'start' : k === 2 ? 'end' : 'middle', 'font-size': 11, fill: 'var(--muted)' }); t.textContent = pts[i].l; svg.appendChild(t); });
    return svg;
  }
  function nice(m) { if (m <= 1) return 1; var e = Math.pow(10, Math.floor(Math.log(m) / Math.LN10)), f = m / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; }
  function panel(title, sub) { var p = el('div', 'panel'); p.appendChild(el('h2', null, title)); if (sub) p.appendChild(el('p', 'sub', sub)); return p; }

  function draw() {
    if (!box) return;
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
      { l: 'Lezioni svolte', v: String(done), d: lp.length > done ? { t: 'Su ' + lp.length + ' in programma nel periodo', c: 'flat' } : delta(done, donePrev) },
      { l: 'Iscritti in corso', v: String(active), d: { t: 'Su ' + mem.length + ' iscritti totali', c: 'flat' } }
    ];
    var kp = el('div', 'kpis');
    cards.forEach(function (c) { var k = el('div', 'kpi'); k.appendChild(el('div', 'lbl', c.l)); k.appendChild(el('div', 'val', c.v)); k.appendChild(el('div', 'delta ' + c.d.c, c.d.t)); kp.appendChild(k); });
    box.appendChild(kp);

    var panels = el('div', 'panels'); box.appendChild(panels);
    var r1 = el('div', 'row2'); panels.appendChild(r1);
    var a = panel('Incassi nel tempo', 'Pacchetti venduti: contano nel giorno in cui li registri.'); a.appendChild(lineChart(series(pk, P, function (x) { return x.price; }), true)); r1.appendChild(a);
    var c2 = panel('Lezioni svolte nel tempo', 'Quanto lavori nel periodo.'); c2.appendChild(barChart(series(ls.filter(function (x) { return x.at <= now; }), P, function () { return 1; }))); r1.appendChild(c2);

    var r2 = el('div', 'row2'); panels.appendChild(r2);
    var by = {}; sold.forEach(function (x) { var k = x.name || 'Pacchetto'; (by[k] = by[k] || { n: 0, v: 0 }); by[k].n++; by[k].v += x.price; });
    var names = Object.keys(by).sort(function (x, y) { return by[y].v - by[x].v || by[y].n - by[x].n; });
    var pp = panel('Pacchetti più venduti', 'Quanto incassi da ciascun pacchetto nel periodo.');
    if (!names.length) pp.appendChild(el('p', 'sub', 'Nessun pacchetto venduto in questo periodo.'));
    else { var hb = el('div', 'hbars'), mx = by[names[0]].v || by[names[0]].n || 1; names.slice(0, 6).forEach(function (n, i) { var row = el('div', 'hbar-row'), lab = el('div', 'lab'), dot = el('i'); dot.style.background = COL[i % COL.length]; lab.appendChild(dot); lab.appendChild(el('span', null, n)); row.appendChild(lab); var tr = el('div', 'track'), f = el('div', 'fill'); f.style.width = Math.round((by[n].v || by[n].n) / mx * 100) + '%'; f.style.background = COL[i % COL.length]; tr.appendChild(f); row.appendChild(tr); row.appendChild(el('div', 'amt', eur(by[n].v) + ' · ' + by[n].n)); hb.appendChild(row); }); pp.appendChild(hb); }
    r2.appendChild(pp);
    var rn = mem.filter(function (m) { return m.left <= 2; }).sort(function (x, y) { return x.left - y.left; });
    var pr = panel('Da rinnovare a breve', 'Iscritti con 2 ingressi o meno: i prossimi pacchetti da vendere.');
    if (!rn.length) pr.appendChild(el('p', 'sub', 'Nessuno per ora: tutti gli iscritti hanno ingressi a sufficienza.'));
    rn.slice(0, 8).forEach(function (m) {
      var row = el('div', 'ptRn'); row.appendChild(el('span', 'ptRnN', m.name));
      var st = el('span', 'ptRnS ' + (m.left <= 0 ? 'bad' : 'warn'), m.left <= 0 ? 'Da rinnovare' : m.left + (m.left === 1 ? ' ingresso' : ' ingressi')); row.appendChild(st); pr.appendChild(row);
    });
    r2.appendChild(pr);

    var r3 = el('div', 'row2 row-full'); panels.appendChild(r3);
    var first = {}; pk.forEach(function (x) { var k = pn(x.m.phone); if (!first[k] || x.at < first[k]) first[k] = x.at; });
    var pts = [], y = now.getFullYear(), mo = now.getMonth(), i;
    for (i = 11; i >= 0; i--) { var dd = new Date(y, mo - i, 1), end = new Date(y, mo - i + 1, 1), c = 0; for (var k in first) if (first[k] < end) c++; pts.push({ l: MS[dd.getMonth()], v: c }); }
    var gp = panel('Crescita iscritti', 'Iscritti totali, ultimi 12 mesi.'); gp.appendChild(lineChart(pts, false)); r3.appendChild(gp);

    var det = el('details', 'stats-method'); det.appendChild(el('summary', null, 'Come vengono calcolate le statistiche?'));
    var bd = el('div', 'stats-method-body');
    [['Incassi', 'Somma dei prezzi dei pacchetti registrati nel periodo, nel giorno in cui li hai assegnati all\'iscritto.'], ['Lezioni svolte', 'Lezioni già trascorse e non annullate nel periodo.'], ['Iscritti in corso', 'Iscritti che hanno ancora almeno un ingresso.'], ['Da rinnovare', 'Iscritti con due ingressi o meno.']].forEach(function (x) { var p = el('p'); p.appendChild(el('strong', null, x[0] + ' ')); p.appendChild(document.createTextNode(x[1])); bd.appendChild(p); });
    det.appendChild(bd); box.appendChild(det);
  }

  function load() {
    var rp = fetch(url('&roster=1'), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) { if (j && Array.isArray(j.members)) D = j; });
    var hp = (window.liaGetHistory ? window.liaGetHistory() : Promise.resolve({})).then(function (h) { HIST = (h && h.appointments) || []; }, function () { HIST = []; });
    return Promise.all([rp, hp]).then(draw, function () { if (box) { box.textContent = ''; box.appendChild(el('p', 'sub', 'Non riesco a caricare le statistiche: riprova.')); } });
  }

  window.liaPtStatsRefresh = load;

  function init() {
    var app = document.getElementById('statsSubApp'), wrap = app && app.querySelector('.wrap');
    if (!wrap) return false;
    if (!document.getElementById('ptStCss')) {
      var st = el('style'); st.id = 'ptStCss';
      st.textContent = '#statsSubApp .wrap>:not(#ptSt){display:none!important}#ptSt .panels{display:grid;gap:16px;margin-top:16px}#ptSt .panel h2{margin:0 0 4px;font-size:1.05rem}#ptSt .panel .sub{margin:0 0 14px;color:var(--muted);font-size:.88rem}#ptSt .stats-method{margin-top:18px}' +
        '#ptSt .ptRn{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 0;border-top:1px solid var(--line)}#ptSt .ptRn:first-of-type{border-top:0}#ptSt .ptRnN{font-weight:600}#ptSt .ptRnS{font-size:.78rem;font-weight:700;padding:4px 10px;border-radius:99px;background:color-mix(in srgb,#E0A23A 18%,transparent);color:#E0A23A}#ptSt .ptRnS.bad{background:color-mix(in srgb,var(--danger,#E0635A) 18%,transparent);color:var(--danger,#E0635A)}' +
        '#ptSt .row2{display:grid;gap:16px;grid-template-columns:1fr}@media(min-width:860px){#ptSt .row2:not(.row-full){grid-template-columns:1fr 1fr}}';
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
    // ricarica quando si apre la pagina Statistiche
    document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-tab="stats"],[data-go="stats"],[data-panel="stats"]'); if (t) setTimeout(load, 50); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  setTimeout(start, 600); setTimeout(start, 1800);
})();
