// --- Personal trainer: gestione iscritti con la grafica della palestra (stili in /gym/members.css) ---
(function () {
  if (!window.__LIA_PT) return;
  var D = null, HIST = [], S = { flt: 'all', q: '', srt: 'name', pf: 'all', mid: null, tab: 'lez', more: false }, root = null;
  function tok() { return (new URLSearchParams(location.search).get('t') || '').trim(); }
  function url(x) { return '/api/agenda?t=' + encodeURIComponent(tok()) + '&pt=1' + (x || ''); }
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function btn(label, cls, fn) { var b = el('button', cls, label); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
  function SV(d, w) { return '<svg width="' + (w || 20) + '" height="' + (w || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
  var IC = {
    plus: '<path d="M12 5v14M5 12h14"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6 6 0 0 1 3.5 6"/>',
    check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    alert: '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17.5v.1"/>', chev: '<path d="m6 9 6 6 6-6"/>'
  };
  var MS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  function pn(p) { var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('0039') === 0) d = d.slice(4); else if (d.indexOf('39') === 0 && d.length > 10) d = d.slice(2); return d; }
  function split(name) { var p = String(name || '').trim().split(/\s+/); return { f: p[0] || '', l: p.slice(1).join(' ') }; }
  function eur(v) { var n = Number(v); return isFinite(n) ? n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €' : ''; }
  function dshort(d) { return d.getDate() + ' ' + MS[d.getMonth()]; }
  function hm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function stOf(m) { return m.left <= 0 ? { s: 'bad', label: 'Esaurito' } : m.left <= 2 ? { s: 'warn', label: 'In esaurimento' } : { s: 'ok', label: 'Attivo' }; }
  function curPack(m) { return m.packs.filter(function (p) { return p.left > 0; })[0] || m.packs[m.packs.length - 1] || null; }
  function lessons(m) {
    var k = pn(m.phone), now = new Date(), up = [], past = [];
    HIST.forEach(function (a) {
      if (a.status === 'cancelled' || pn(a.customer_phone) !== k) return;
      var st = new Date(a.starts_at); (st > now ? up : past).push({ id: a.id, start: st, service: a.service || '' });
    });
    up.sort(function (a, b) { return a.start - b.start; }); past.sort(function (a, b) { return b.start - a.start; });
    return { up: up, past: past };
  }

  function load() {
    var tasks = [fetch(url('&roster=1'), { cache: 'no-store' }).then(function (r) { return r.json(); })];
    tasks.push((window.liaGetHistory ? window.liaGetHistory() : Promise.resolve({})).catch(function () { return {}; }));
    return Promise.all(tasks).then(function (r) {
      D = r[0]; HIST = (r[1] && r[1].appointments) || [];
      (D.members || []).forEach(function (m) { var n = split(m.name); m.first = n.f; m.last = n.l; m.status = stOf(m); });
      render();
    });
  }
  window.liaPtRefresh = function () { window.liaHistoryCache = null; window.liaHistoryPromise = null; return load().catch(function () { }); };

  function ring(p, c) { return '<span class="mzRing ' + c + '" style="--p:' + p + '"><b>' + p + '%</b></span>'; }
  function mzRing(cp) {
    var r = 26, c = 2 * Math.PI * r, f = cp && cp.total ? Math.max(0, Math.min(1, cp.left / cp.total)) : 0;
    return '<svg viewBox="0 0 60 60" aria-hidden="true"><circle class="t" cx="30" cy="30" r="' + r + '"/><circle class="p" cx="30" cy="30" r="' + r + '" stroke-dasharray="' + (c * f).toFixed(2) + ' ' + c.toFixed(2) + '"/></svg>';
  }
  function pips(cp) {
    if (!cp) return '<span class="mzMute">—</span>';
    var n = cp.total, k = Math.min(n, cp.used || 0), h = '<span class="mzPips" title="' + k + ' su ' + n + ' ingressi usati">';
    if (n <= 12) { for (var i = 0; i < n; i++) h += '<i' + (i < k ? ' class="on"' : '') + '></i>'; } else h += '<span class="mzPb"><i style="width:' + Math.round(k / n * 100) + '%"></i></span>';
    return h + '</span><em class="mzPn">' + k + '/' + n + '</em>';
  }

  function render() {
    var wrap = document.querySelector('.clientsWrap');
    if (!wrap) return;
    if (!root) { root = el('div'); root.id = 'ptMx'; wrap.appendChild(root); }
    root.textContent = '';
    if (!D) { root.appendChild(el('div', 'mxEmpty', 'Carico...')); return; }
    if (S.mid) { var mm = D.members.filter(function (x) { return pn(x.phone) === S.mid; })[0]; if (mm) { page(mm); return; } S.mid = null; }
    list();
  }

  function list() {
    var mem = D.members, host = el('div', 'mx mxList'); root.appendChild(host);
    var cnt = { all: mem.length, ok: 0, warn: 0, bad: 0 };
    mem.forEach(function (m) { cnt[m.status.s]++; });
    var valid = cnt.ok + cnt.warn;
    function pc(n) { return cnt.all ? Math.round(n / cnt.all * 100) : 0; }
    var head = el('div', 'mzHead');
    head.innerHTML = '<div><div class="mzCrumb">' + esc(D.business || 'Personal trainer') + ' / Gestione</div><h1>Iscritti</h1><p>Gestisci iscritti e pacchetti</p></div>';
    var add = btn('', 'mzAdd', function () { window.liaPtOpenNew && window.liaPtOpenNew(D.services); });
    add.innerHTML = SV(IC.plus, 18) + '<span>Nuovo iscritto</span>'; head.appendChild(add); host.appendChild(head);
    var kp = el('div', 'mzKp');
    [['all', 'users', 'Iscritti', cnt.all, '', ''], ['ok', 'check', 'Con ingressi', valid, ring(pc(valid), 'ok'), 'ok'],
     ['warn', 'clock', 'In esaurimento', cnt.warn, ring(pc(cnt.warn), 'warn'), 'warn'], ['bad', 'alert', 'Esauriti', cnt.bad, ring(pc(cnt.bad), 'bad'), 'bad']].forEach(function (k) {
      var on = k[0] === 'ok' ? S.flt === 'valid' : S.flt === k[0] && k[0] !== 'all';
      var b = el('button', 'mzK ' + (k[5] || 'all')); b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.innerHTML = '<span class="mzKi">' + SV(IC[k[1]], 24) + '</span><span class="mzKt"><b>' + k[3] + '</b><span><span class="lg">' + k[2] + '</span><span class="sh">' + (k[0] === 'ok' ? 'Con ingressi' : k[2]) + '</span></span></span><span class="mzKr">' + k[4] + '</span>';
      b.addEventListener('click', function () { S.flt = k[0] === 'ok' ? (S.flt === 'valid' ? 'all' : 'valid') : k[0] === 'all' ? 'all' : (S.flt === k[0] ? 'all' : k[0]); S.more = false; render(); });
      kp.appendChild(b);
    });
    host.appendChild(kp);
    var bar = el('div', 'mzBar');
    var sr = el('label', 'mzSearch'); sr.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
    var q = el('input'); q.type = 'search'; q.placeholder = 'Cerca per nome o telefono'; q.value = S.q; q.autocomplete = 'off'; sr.appendChild(q); bar.appendChild(sr);
    function sel(opts, val, fn) { var w = el('label', 'mzSel'), x = el('select'); opts.forEach(function (o) { var e = el('option', null, o[1]); e.value = o[0]; if (o[0] === val) e.selected = true; x.appendChild(e); }); x.addEventListener('change', function () { fn(x.value); }); w.appendChild(x); w.insertAdjacentHTML('beforeend', SV(IC.chev, 16)); return w; }
    var names = {}; mem.forEach(function (m) { m.packs.forEach(function (p) { names[p.name] = 1; }); });
    bar.appendChild(sel([['all', 'Pacchetto']].concat(Object.keys(names).map(function (n) { return [n, n]; })), S.pf, function (v) { S.pf = v; S.more = false; render(); }));
    bar.appendChild(sel([['name', 'Nome A-Z'], ['named', 'Nome Z-A'], ['left', 'Ingressi rimasti ↑'], ['leftd', 'Ingressi rimasti ↓']], S.srt, function (v) { S.srt = v; render(); }));
    host.appendChild(bar);
    var tbl = el('div', 'mzTable'); host.appendChild(tbl);
    function rows() {
      tbl.textContent = '';
      var qq = S.q.trim().toLowerCase();
      var ms = mem.filter(function (m) {
        var ok = S.flt === 'all' || (S.flt === 'valid' ? m.status.s !== 'bad' : m.status.s === S.flt);
        return ok && (S.pf === 'all' || m.packs.some(function (p) { return p.name === S.pf; })) && (!qq || (m.name + ' ' + m.phone).toLowerCase().indexOf(qq) >= 0);
      });
      var d = /d$/.test(S.srt) ? -1 : 1;
      ms.sort(function (a, b) {
        var x, y; if (S.srt.indexOf('left') === 0) { x = a.left; y = b.left; } else { x = (a.last + ' ' + a.first).toLowerCase(); y = (b.last + ' ' + b.first).toLowerCase(); }
        return (x < y ? -1 : x > y ? 1 : 0) * d;
      });
      var hd = el('div', 'mzTh'); ['Nome', 'Telefono', 'Pacchetto', 'Ingressi', 'Prossima lezione', 'Stato', 'Azioni'].forEach(function (h, i) { hd.appendChild(el('span', i === 0 ? 'on' : '', h)); });
      tbl.appendChild(hd);
      if (!ms.length) { tbl.appendChild(el('div', 'mxEmpty', mem.length ? 'Nessun risultato. Prova a cambiare i filtri.' : 'Ancora nessun iscritto. Aggiungi il primo con "Nuovo iscritto".')); return; }
      (S.more || qq ? ms : ms.slice(0, 30)).forEach(function (m) {
        var cp = curPack(m), ls = lessons(m), nx = ls.up[0], r = el('div', 'mzRow st-' + m.status.s);
        r.tabIndex = 0; r.setAttribute('role', 'button');
        var sc = nx ? '<span class="mzX ' + m.status.s + '"><span class="mzXn"><b>' + nx.start.getDate() + '</b><small>' + MS[nx.start.getMonth()] + '</small></span><span class="mzXd"><small>alle</small><b>' + hm(nx.start) + '</b></span></span>' : '<span class="mzMute">Nessuna</span>';
        var gen = /a$/i.test(m.first) ? 'gf' : 'gm', ini = (m.first[0] || '') + (m.last[0] || '');
        r.innerHTML = '<span class="mzC mzN ' + gen + '"><span class="mzAv s-' + m.status.s + '">' + mzRing(cp) + '<i>' + esc(ini) + '</i></span><b>' + esc(m.first) + ' <span>' + esc(m.last) + '</span></b></span>' +
          '<span class="mzC mzP" data-l="Telefono">' + esc(m.phone) + '</span>' +
          '<span class="mzC" data-l="Pacchetto">' + (cp ? '<span class="mzPl pl' + (Math.max(0, Object.keys(names).indexOf(cp.name)) % 4) + '">' + esc(cp.name) + '</span>' : '—') + '</span>' +
          '<span class="mzC mzI" data-l="Ingressi">' + pips(cp) + '</span>' +
          '<span class="mzC mzE" data-l="Prossima lezione">' + sc + '</span>' +
          '<span class="mzC"><span class="mzSt ' + m.status.s + '">' + esc(m.status.label) + '</span></span><span class="mzC mzA"></span>' +
          '<span class="mzC mzSm ' + m.status.s + '"><span><small>Pacchetto</small><b>' + (cp ? esc(cp.name) : '—') + '</b></span><span><small>Prossima</small><b class="mzSd">' + (nx ? dshort(nx.start) : '—') + '</b></span><span><small>Ingressi</small><b>' + (cp ? cp.left + ' / ' + cp.total : '—') + '</b></span></span>';
        var A = r.querySelector('.mzA');
        if (D.services && D.services.length) A.appendChild(btn('Nuovo pacchetto', 'mzRn', function (e) { e.stopPropagation(); assign(m); }));
        function open() { S.mid = pn(m.phone); S.tab = 'lez'; render(); try { window.scrollTo(0, 0); } catch (e) { } }
        r.addEventListener('click', open); r.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
        tbl.appendChild(r);
      });
      if (!S.more && !qq && ms.length > 30) tbl.appendChild(btn('Mostra altri ' + (ms.length - 30), 'mxMore', function () { S.more = true; rows(); }));
    }
    q.addEventListener('input', function () { S.q = q.value; rows(); });
    rows();
  }

  // Assegna un nuovo pacchetto a un iscritto (scelta del pacchetto in un foglio)
  function assign(m) {
    var svcs = D.services || [];
    var bg = el('div', 'liaSheetBg'), sh = el('div', 'liaSheet'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    sh.innerHTML = '<div class="grab"></div><h2>Nuovo pacchetto</h2><p class="lsub">' + esc(m.name) + '</p><div class="lf"><label for="apS">Pacchetto sottoscritto</label><select id="apS" style="width:100%;padding:12px;border-radius:12px;border:1px solid var(--line2);background:var(--card2);color:var(--ink);font:inherit">' +
      svcs.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + ' · ' + x.entries + ' ingressi</option>'; }).join('') + '</select></div><div class="lerr" role="alert" hidden></div><button type="button" class="lb lsave">Assegna</button><button type="button" class="lb lcancel">Annulla</button>';
    document.body.appendChild(bg); document.body.appendChild(sh);
    function close() { bg.classList.remove('on'); sh.classList.remove('on'); setTimeout(function () { bg.remove(); sh.remove(); }, 300); }
    bg.addEventListener('click', close); sh.querySelector('.lcancel').addEventListener('click', close);
    requestAnimationFrame(function () { bg.classList.add('on'); sh.classList.add('on'); });
    sh.querySelector('.lsave').addEventListener('click', function () {
      var b = this, err = sh.querySelector('.lerr'); b.disabled = true; err.hidden = true;
      post({ action: 'assign', service_id: sh.querySelector('#apS').value, name: m.name, phone: m.phone }).then(function () { close(); return window.liaPtRefresh(); })
        .catch(function (e) { b.disabled = false; err.textContent = e.message; err.hidden = false; });
    });
  }
  function post(b) {
    return fetch(url(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Errore'); return j; }); });
  }

  function page(m) {
    var cp = curPack(m), st = m.status, ls = lessons(m), host = el('div', 'mx mxD'); root.appendChild(host);
    var top = el('div', 'mvTop');
    var back = el('button', 'mvBack'); back.type = 'button'; back.innerHTML = SV('<path d="M15 6l-6 6 6 6"/>', 16) + '<span>Iscritti</span>'; back.addEventListener('click', function () { S.mid = null; render(); }); top.appendChild(back);
    var pct = cp && cp.total ? Math.round(cp.left / cp.total * 100) : 0;
    var hero = el('div', 'mvHero ' + st.s);
    var plan = cp ? '<div class="mvPl"><div class="mvPt"><b>' + esc(cp.name) + '</b>' + (cp.price_eur != null ? '<span>' + eur(cp.price_eur) + ' · pagato</span>' : '') + '</div><span class="mvPb"><i style="width:' + pct + '%"></i></span><div class="mvPd"><span>dal ' + dshort(new Date(cp.created_at)) + '</span><b>' + cp.left + ' ingressi rimasti</b></div></div>' : '<div class="mvPl"><div class="mvPt"><b>Nessun pacchetto</b></div></div>';
    hero.innerHTML = '<span class="mvRing"></span><div class="mvId"><span class="mvAv">' + esc((m.first[0] || '') + (m.last[0] || '')) + '</span><div class="mvNm"><b>' + esc(m.name) + '</b><span>' + esc(m.phone) + '</span></div></div><div class="mvMeta"><span class="mvChip">' + esc(st.label) + '</span></div><span class="mvSep"></span>' + plan;
    hero.insertBefore(top, hero.firstChild.nextSibling); host.appendChild(hero);
    var body = el('div', 'mxBody mvBody'); host.appendChild(body);
    var acts = el('div', 'mvActs');
    function ab(label, icon, cls, fn, href) { var b = el(href ? 'a' : 'button', 'mvA ' + (cls || '')); if (href) { b.href = href; b.target = '_blank'; b.rel = 'noopener'; } else b.type = 'button'; b.innerHTML = SV(icon) + '<span>' + label + '</span>'; if (fn) b.addEventListener('click', fn); acts.appendChild(b); }
    if (D.services && D.services.length) ab('Nuovo pacchetto', '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>', 'pri', function () { assign(m); });
    var dg = (function (p) { var s = String(p == null ? '' : p).trim(), d = s.replace(/\D/g, ''); if (!d) return ''; if (s.charAt(0) === '+') return d; if (d.slice(0, 2) === '00') return d.slice(2); if (/^3\d{8,9}$/.test(d)) return '39' + d; return d; })(m.phone);
    if (dg) ab('WhatsApp', '<path d="M4 20l1.4-4.2A8 8 0 1 1 8.4 18.8z"/>', '', null, 'https://wa.me/' + dg);
    ab('Chiama', '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>', '', null, 'tel:' + String(m.phone || '').replace(/[^\d+]/g, ''));
    body.appendChild(acts);
    var gs = el('div', 'mvGs');
    function gt(k, n, max, sub) { var t = el('div', 'mvG' + (max && n >= max ? ' full' : '')); t.innerHTML = '<span class="mvK">' + k + '</span><span class="mvV"><b>' + n + '</b>' + (max ? '<small>su ' + max + '</small>' : '<small>' + (sub || '') + '</small>') + '</span>' + (max ? '<span class="mvB"><i style="width:' + Math.min(100, Math.round(n / max * 100)) + '%"></i></span>' : ''); gs.appendChild(t); }
    gt('INGRESSI USATI', m.total - m.left, m.total); gt('LEZIONI IN PROGRAMMA', ls.up.length, 0, ls.up.length === 1 ? 'lezione' : 'lezioni');
    gt('INGRESSI RIMASTI', m.left, m.total);
    body.appendChild(gs);
    var tabs = el('div', 'mxTabs'); body.appendChild(tabs);
    var pane = el('div', 'mxPane'); body.appendChild(pane);
    function drawTabs() {
      tabs.textContent = '';
      [['lez', 'Lezioni'], ['pac', 'Pacchetti']].forEach(function (t) { var b = el('button', null, t[1]); b.type = 'button'; b.setAttribute('aria-pressed', S.tab === t[0] ? 'true' : 'false'); b.addEventListener('click', function () { S.tab = t[0]; drawTabs(); drawPane(); }); tabs.appendChild(b); });
    }
    function ev(x, past) {
      var r = el('div', 'mxEv');
      r.innerHTML = '<span class="mxDt"><b>' + x.start.getDate() + '</b><span>' + MS[x.start.getMonth()] + '</span></span><span class="mxTx"><b>' + esc(x.service || 'Lezione') + '</b><span>' + hm(x.start) + (past ? ' · svolta' : ' · prenotata') + '</span></span>';
      if (past) r.appendChild(el('span', 'gxChip ok', 'Svolta'));
      return r;
    }
    function drawPane() {
      pane.textContent = '';
      if (S.tab === 'lez') {
        pane.appendChild(el('div', 'mxSec', 'In programma'));
        var l1 = el('div', 'mxLs'); if (!ls.up.length) l1.appendChild(el('div', 'mxEmpty', 'Nessuna lezione in programma.')); ls.up.slice(0, 12).forEach(function (x) { l1.appendChild(ev(x, false)); }); pane.appendChild(l1);
        pane.appendChild(el('div', 'mxSec', 'Ultime lezioni'));
        var l2 = el('div', 'mxLs'); if (!ls.past.length) l2.appendChild(el('div', 'mxEmpty', 'Ancora nessuna lezione.')); ls.past.slice(0, 10).forEach(function (x) { l2.appendChild(ev(x, true)); }); pane.appendChild(l2);
      } else {
        var paid = m.packs.reduce(function (t, p) { return t + (Number(p.price_eur) || 0); }, 0);
        var tot = el('div', 'mxTot'); tot.innerHTML = '<div><span>Totale versato</span><b>' + eur(paid) + '</b></div><span class="gxChip ok">' + m.packs.length + (m.packs.length === 1 ? ' pacchetto' : ' pacchetti') + '</span>'; pane.appendChild(tot);
        var l = el('div', 'mxLs');
        m.packs.slice().reverse().forEach(function (p) {
          var d = new Date(p.created_at), r = el('div', 'mxEv');
          r.innerHTML = '<span class="mxDt"><b>' + d.getDate() + '</b><span>' + MS[d.getMonth()] + '</span></span><span class="mxTx"><b>' + esc(p.name) + '</b><span>' + p.left + ' di ' + p.total + ' ingressi rimasti</span></span><b>' + (p.price_eur != null ? eur(p.price_eur) : '') + '</b>';
          var rm = btn('Togli', 'ghost sm', function () {
            rm.textContent = 'Sicuro?'; rm.onclick = function () { rm.disabled = true; post({ action: 'remove', id: p.id }).then(function () { return window.liaPtRefresh(); }).catch(function (e) { rm.disabled = false; rm.textContent = e.message; }); };
          });
          r.appendChild(rm); l.appendChild(r);
        });
        pane.appendChild(l);
        var ac = el('div', 'mxManage'); if (D.services && D.services.length) ac.appendChild(btn('Nuovo pacchetto', 'ghost sm', function () { assign(m); })); pane.appendChild(ac);
      }
    }
    drawTabs(); drawPane();
  }

  function init() { if (!document.querySelector('.clientsWrap')) return; load().catch(function () { }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
