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
  function pd(x) { return new Date(String(x || '').replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1')); }
  function hm(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  function fdate(ds) { var a = String(ds || '').slice(0, 10).split('-'); return a.length === 3 ? (+a[2]) + ' ' + MS[+a[1] - 1] + ' ' + a[0] : ''; }
  function durName(n) { return n === 1 ? '1 mese' : n === 12 ? '1 anno' : n + ' mesi'; }
  function todayIso() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function stOf(m) { return m.expired ? { s: 'bad', label: 'Scaduto' } : m.left <= 0 ? { s: 'bad', label: 'Da rinnovare' } : m.left <= 2 ? { s: 'warn', label: 'Ultimi coaching' } : { s: 'ok', label: 'In corso' }; }
  function curPack(m) { return m.packs.filter(function (p) { return p.left > 0; })[0] || m.packs[m.packs.length - 1] || null; }
  // Nell'elenco: se l'iscritto ha piu' pacchetti ancora attivi (es. dopo un rinnovo con ingressi residui) si mostra la somma
  function listPack(m) {
    var c = curPack(m), act = m.packs.filter(function (p) { return p.left > 0; });
    if (!c || act.length < 2) return c;
    var t = 0, u = 0, l = 0; act.forEach(function (p) { t += p.total; u += p.used || 0; l += p.left; });
    return Object.assign({}, c, { total: t, used: u, left: l });
  }
  function lessons(m) {
    var k = pn(m.phone), now = new Date(), up = [], past = [];
    HIST.forEach(function (a) {
      if (a.status === 'cancelled' || pn(a.customer_phone) !== k) return;
      var st = pd(a.starts_at); (st > now ? up : past).push({ id: a.id, start: st, service: a.service || '' });
    });
    up.sort(function (a, b) { return a.start - b.start; }); past.sort(function (a, b) { return b.start - a.start; });
    return { up: up, past: past };
  }

  function load() {
    // Prima l'elenco degli iscritti (subito), poi i coaching dallo storico: se lo storico e' lento l'elenco si vede lo stesso
    var rp = fetch(url('&roster=1'), { cache: 'no-store' }).then(function (r) { return r.json().then(function (j) { if (!r.ok || !j || !Array.isArray(j.members)) throw new Error((j && j.error) || 'Elenco non disponibile'); return j; }); });
    var hp = (window.liaGetHistory ? window.liaGetHistory() : Promise.resolve({})).then(function (h) { return (h && h.appointments) || []; }, function () { return []; });
    return rp.then(function (j) {
      D = j; (D.members || []).forEach(function (m) { var n = split(m.name); m.first = n.f; m.last = n.l; m.status = stOf(m); });
      render(); if (window.liaPtPickRefresh) window.liaPtPickRefresh(); try { injectIs(); } catch (e) {}
      return hp.then(function (h) { HIST = h; if (!document.querySelector('.liaSheet')) render(); });
    }).catch(function (e) {
      if (!root) { var w = document.querySelector('.clientsWrap'); if (!w) return; root = el('div'); root.id = 'ptMx'; w.appendChild(root); }
      root.textContent = ''; root.appendChild(el('div', 'mxEmpty', 'Non riesco a caricare gli iscritti: ' + ((e && e.message) || 'riprova.')));
    });
  }
  window.liaPtRefresh = function () { window.liaHistoryCache = null; window.liaHistoryPromise = null; return load(); };

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

  function toTop() {
    function go() { try { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0; for (var n = root; n && n !== document.body; n = n.parentElement) { if (n.scrollTop) n.scrollTop = 0; } var sc = document.querySelectorAll('main,.page,.view,.content,#ptMx'); for (var i = 0; i < sc.length; i++) if (sc[i].scrollTop) sc[i].scrollTop = 0; } catch (e) { } }
    go(); if (window.requestAnimationFrame) requestAnimationFrame(go); setTimeout(go, 60); setTimeout(go, 250);
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
    add.innerHTML = SV('<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>', 20) + '<span>Nuovo iscritto</span>'; add.setAttribute('aria-label', 'Nuovo iscritto'); head.appendChild(add); host.appendChild(head);
    var kp = el('div', 'mzKp');
    [['all', 'users', 'Iscritti', cnt.all, '', ''], ['ok', 'check', 'In corso', valid, ring(pc(valid), 'ok'), 'ok'],
     ['warn', 'clock', 'Ultimi coaching', cnt.warn, ring(pc(cnt.warn), 'warn'), 'warn'], ['bad', 'alert', 'Da rinnovare', cnt.bad, ring(pc(cnt.bad), 'bad'), 'bad']].forEach(function (k) {
      var on = k[0] === 'ok' ? S.flt === 'valid' : S.flt === k[0] && k[0] !== 'all';
      var b = el('button', 'mzK ' + (k[5] || 'all')); b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.innerHTML = '<span class="mzKi">' + SV(IC[k[1]], 24) + '</span><span class="mzKt"><b>' + k[3] + '</b><span><span class="lg">' + k[2] + '</span><span class="sh">' + (k[0] === 'ok' ? 'In corso' : k[2]) + '</span></span></span><span class="mzKr">' + k[4] + '</span>';
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
      var hd = el('div', 'mzTh'); ['Nome', 'Telefono', 'Pacchetto', 'Ingressi', 'Prossimo coaching', 'Stato', 'Azioni'].forEach(function (h, i) { hd.appendChild(el('span', i === 0 ? 'on' : '', h)); });
      tbl.appendChild(hd);
      if (!ms.length) { tbl.appendChild(el('div', 'mxEmpty', mem.length ? 'Nessun risultato. Prova a cambiare i filtri.' : 'Ancora nessun iscritto. Aggiungi il primo con "Nuovo iscritto".')); return; }
      (S.more || qq ? ms : ms.slice(0, 30)).forEach(function (m) {
        var cp = listPack(m), ls = lessons(m), nx = ls.up[0], r = el('div', 'mzRow st-' + m.status.s);
        r.tabIndex = 0; r.setAttribute('role', 'button');
        var sc = nx ? '<span class="mzX ' + m.status.s + '"><span class="mzXn"><b>' + nx.start.getDate() + '</b><small>' + MS[nx.start.getMonth()] + '</small></span><span class="mzXd"><small>alle</small><b>' + hm(nx.start) + '</b></span></span>' : '<span class="mzMute">Nessuna</span>';
        var gen = /a$/i.test(m.first) ? 'gf' : 'gm', ini = (m.first[0] || '') + (m.last[0] || '');
        r.innerHTML = '<span class="mzC mzN ' + gen + '"><span class="mzAv s-' + m.status.s + '">' + mzRing(cp) + '<i>' + esc(ini) + '</i></span><b>' + esc(m.first) + ' <span>' + esc(m.last) + '</span></b></span>' +
          '<span class="mzC mzP" data-l="Telefono">' + esc(m.phone) + '</span>' +
          '<span class="mzC" data-l="Pacchetto">' + (cp ? '<span class="mzPl pl' + (Math.max(0, Object.keys(names).indexOf(cp.name)) % 4) + '">' + esc(cp.name) + '</span>' : '—') + '</span>' +
          '<span class="mzC mzI" data-l="Ingressi">' + pips(cp) + '</span>' +
          '<span class="mzC mzE" data-l="Prossimo coaching">' + sc + '</span>' +
          '<span class="mzC"><span class="mzSt ' + m.status.s + '">' + esc(m.status.label) + '</span></span><span class="mzC mzA"></span>' +
          '<span class="mzC mzSm ' + m.status.s + '"><span><small>Pacchetto</small><b>' + (cp ? esc(String(cp.name).replace(/^pacchetto\s+/i, '').replace(/^./, function (c) { return c.toUpperCase(); })) : '—') + '</b></span><span><small>Prossima</small><b class="mzSd">' + (nx ? dshort(nx.start) : '—') + '</b></span><span><small>Ingressi</small><b>' + (cp ? cp.left + ' / ' + cp.total : '—') + '</b></span></span>';
        var A = r.querySelector('.mzA');
        if (D.services && D.services.length) { var rb = btn('', 'mzRn', function (e) { e.stopPropagation(); assign(m); }); rb.innerHTML = SV('<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>', 16) + '<span>Rinnova</span>'; rb.setAttribute('aria-label', 'Nuovo pacchetto'); A.appendChild(rb); }
        function open() { S.mid = pn(m.phone); S.tab = 'lez'; render(); toTop(); }
        r.addEventListener('click', open); r.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
        tbl.appendChild(r);
      });
      if (!S.more && !qq && ms.length > 30) tbl.appendChild(btn('Mostra altri ' + (ms.length - 30), 'mxMore', function () { S.more = true; rows(); }));
    }
    q.addEventListener('input', function () { S.q = q.value; rows(); });
    rows();
  }

  // Assegna un nuovo pacchetto a un iscritto (scelta del pacchetto in un foglio)
  // Scheda "Nuovo iscritto" / "Nuovo pacchetto": dati dell'iscritto + pacchetto acquistato (schede da scegliere, niente menu a tendina)
  function sheet(m) {
    var svcs = (D && D.services) || [], sel = svcs[0] ? svcs[0].id : null;
    var bg = el('div', 'liaSheetBg'), sh = el('div', 'liaSheet ptNm'); sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    var who = m ? '<div class="nmWho"><span class="nmAv">' + esc((m.first[0] || '') + (m.last[0] || '')) + '</span><div><b>' + esc(m.name) + '</b><small>' + esc(m.phone) + '</small></div></div>' : '';
    var data = m ? '' : '<div class="nmSec">Dati dell’iscritto</div><div class="nmGrid"><div class="nmF"><label for="nmF">Nome</label><input id="nmF" type="text" autocomplete="off" autocapitalize="words" placeholder="Giulia"></div><div class="nmF"><label for="nmL">Cognome</label><input id="nmL" type="text" autocomplete="off" autocapitalize="words" placeholder="Bianchi"></div></div><div class="nmF"><label for="nmP">Telefono</label><input id="nmP" type="tel" inputmode="tel" autocomplete="off" placeholder="333 123 4567"></div>';
    sh.innerHTML = '<div class="grab"></div><div class="nmHd"><span class="nmIc">' + SV(m ? '<rect x="3" y="7" width="18" height="12" rx="3"/><path d="M3 11h18M7 15h3"/>' : '<circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0M19 8v6M16 11h6"/>', 22) + '</span><div><h2>' + (m ? 'Nuovo pacchetto' : 'Nuovo iscritto') + '</h2><p>' + (m ? 'Rinnovo o nuovo acquisto, dopo il pagamento.' : 'Registralo dopo il pagamento.') + '</p></div>' + (m ? '' : '<span class="nmSt"></span>') + '</div>' + who + '<div class="nmS1">' + data + '</div>' +
      '<div class="nmS2"><div class="nmSec">Pacchetto acquistato</div><div class="nmPk" role="radiogroup" aria-label="Pacchetto acquistato"></div><div class="nmSum"></div><div class="nmF nmSd" style="margin-top:12px" hidden><label for="nmD">Il pacchetto parte il</label><input id="nmD" type="date"></div>' + (m ? '' : '<div class="nmCd"><label for="nmC">Codice di accesso</label><div class="nmCr"><input id="nmC" type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="20"><button type="button" id="nmGen">Genera</button></div><small>Generato per te: lo darai all’iscritto per prenotare. Puoi cambiarlo.</small></div>') + '</div><div class="lerr" role="alert" hidden></div>' +
      '<div class="nmBt"><button type="button" class="lb lcancel">Annulla</button><button type="button" class="lb lsave">' + (m ? 'Assegna' : 'Continua') + '</button></div>';
    document.body.appendChild(bg); document.body.appendChild(sh);
    var $ = function (q) { return sh.querySelector(q); }, pk = $('.nmPk'), sum = $('.nmSum'), err = $('.lerr');
    function sumTx() {
      var x = svcs.filter(function (v) { return v.id === sel; })[0], sd = $('.nmSd');
      sum.innerHTML = x ? 'Potrà prenotare fino a <b>' + x.entries + ' coaching</b> da solo, negli orari che hai aperto' + (x.per_week ? ', al massimo <b>' + x.per_week + ' a settimana</b>' : '') + (x.months ? ', entro <b>' + durName(x.months) + '</b> da oggi' : '') + '.' : '';
      if (sd) { sd.hidden = !(x && x.months); var di = $('#nmD'); if (di && !di.value) di.value = todayIso(); }
    }
    function drawPk() {
      pk.textContent = '';
      if (!svcs.length) { pk.appendChild(el('p', 'nmNo', 'Non hai ancora creato nessun pacchetto. Aggiungilo da Impostazioni > Pacchetti.')); sum.textContent = ''; return; }
      svcs.forEach(function (x) {
        var on = x.id === sel, b = el('button', 'nmP' + (on ? ' on' : '')); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', on ? 'true' : 'false');
        var sub = x.entries + (x.entries === 1 ? ' ingresso' : ' ingressi') + (x.months ? ' · ' + durName(x.months) : '') + (x.per_week ? ' · max ' + x.per_week + '/sett.' : '') + (x.duration_min ? ' · ' + x.duration_min + ' min' : '');
        b.innerHTML = '<span class="nmRd"></span><span class="nmPt"><b>' + esc(x.name) + '</b><small>' + esc(sub) + '</small></span>' + (x.price_eur != null && x.price_eur !== '' ? '<span class="nmPr">' + eur(x.price_eur) + '</span>' : '');
        b.addEventListener('click', function () { sel = x.id; drawPk(); });
        pk.appendChild(b);
      });
      sumTx();
    }
    drawPk();
    function close() { bg.classList.remove('on'); sh.classList.remove('on'); setTimeout(function () { bg.remove(); sh.remove(); }, 300); }
    bg.addEventListener('click', close);
    requestAnimationFrame(function () { bg.classList.add('on'); sh.classList.add('on'); });
    var step = m ? 2 : 1, saveB = $('.lsave'), cancelB = $('.lcancel');
    function fail(t) { err.textContent = t; err.hidden = false; }
    function show() {
      sh.querySelector('.nmS1').hidden = step !== 1; sh.querySelector('.nmS2').hidden = step !== 2; err.hidden = true;
      var st = $('.nmSt'); if (st) st.innerHTML = '<i class="' + (step === 1 ? 'on' : '') + '"></i><i class="' + (step === 2 ? 'on' : '') + '"></i><em>' + step + ' di 2</em>';
      cancelB.textContent = step === 2 && !m ? 'Indietro' : 'Annulla'; saveB.textContent = step === 1 ? 'Continua' : (m ? 'Assegna' : 'Salva iscritto');
    }
    show();
    sh.addEventListener('keydown', function (e) { if (e.key === 'Enter' && step === 1 && e.target.tagName === 'INPUT') { e.preventDefault(); saveB.click(); } });
    cancelB.addEventListener('click', function () { if (step === 2 && !m) { step = 1; show(); } else close(); });
    saveB.addEventListener('click', function () {
      var b = this, body = { action: 'assign', service_id: sel };
      var sx = svcs.filter(function (v) { return v.id === sel; })[0], di0 = $('#nmD'); if (step === 2 && sx && sx.months && di0 && di0.value) body.start_on = di0.value;
      if (step === 1) {
        var f1 = $('#nmF').value.trim(), l1 = $('#nmL').value.trim(), p1 = $('#nmP').value.trim();
        if (f1.length < 2 || l1.length < 2) return fail('Scrivi nome e cognome.');
        if (pn(p1).length < 6) return fail('Scrivi il numero di telefono.');
        step = 2; show(); return;
      }
      if (!svcs.length || !sel) return fail('Crea prima un pacchetto da Impostazioni.');
      if (!m && !/^[A-Za-z0-9]{4,20}$/.test($('#nmC').value.replace(/\s+/g, ''))) return fail('Il codice deve avere da 4 a 20 tra lettere e numeri (senza spazi o simboli).');
      if (m) { if (!m.code) return fail('Imposta prima il codice di accesso dell’iscritto (nella sua scheda).'); body.name = m.name; body.phone = m.phone; }
      else { body.first_name = $('#nmF').value.trim(); body.last_name = $('#nmL').value.trim(); body.phone = $('#nmP').value.trim(); body.access_code = $('#nmC').value.replace(/\s+/g, ''); }
      b.disabled = true; err.hidden = true;
      post(body).then(function () { close(); return window.liaPtRefresh(); }).catch(function (e) { b.disabled = false; fail(e.message); });
    });
    function genCode() { var A = 'abcdefghjkmnpqrstuvwxyz23456789', c = '', i, a = new Uint8Array(6); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, k) { a[k] = Math.floor(Math.random() * 256); }); for (i = 0; i < 6; i++) c += A[a[i] % A.length]; $('#nmC').value = c; }
    var gb = $('#nmGen'); if (gb) { gb.addEventListener('click', genCode); genCode(); }
    if (!m) setTimeout(function () { var i = $('#nmF'); if (i) i.focus(); }, 350);
  }
  function assign(m) { sheet(m); }
  window.liaPtOpenNew = function () { sheet(null); };
  window.liaPtOpenMember = function (ph) { if (!ph) return; S.mid = pn(ph); S.tab = 'lez'; render(); toTop(); };
  function post(b) {
    return fetch(url(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Errore'); return j; }); });
  }

  function page(m) {
    var cp = curPack(m), st = m.status, ls = lessons(m), host = el('div', 'mx mxD'); root.appendChild(host);
    var top = el('div', 'mvTop');
    var back = el('button', 'mvBack'); back.type = 'button'; back.innerHTML = SV('<path d="M15 6l-6 6 6 6"/>', 16) + '<span>Iscritti</span>'; back.addEventListener('click', function () { S.mid = null; render(); }); top.appendChild(back);
    var hero = el('div', 'mvHero mvA2 ' + st.s);
    hero.innerHTML = '<div class="mvId"><span class="mvAv">' + esc((m.first[0] || '') + (m.last[0] || '')) + '</span><div class="mvNm"><b>' + esc(m.name) + '</b><span>' + esc(m.phone) + '</span></div><span class="mvChip">' + esc(st.label) + '</span></div>';
    hero.insertBefore(top, hero.firstChild);
    var tot = m.total || 0, lf = m.left || 0, fr = tot ? Math.max(0, Math.min(1, lf / tot)) : 0, CI = 2 * Math.PI * 54;
    var rg = el('div', 'mvRg'); rg.innerHTML = '<svg viewBox="0 0 128 128" role="img" aria-label="' + lf + ' ingressi su ' + tot + '"><circle class="t" cx="64" cy="64" r="54"/><circle class="p" cx="64" cy="64" r="54" stroke-dasharray="' + (CI * fr).toFixed(1) + ' ' + CI.toFixed(1) + '" transform="rotate(-90 64 64)"/></svg><div class="mvRn"><b>' + lf + '</b><span>su ' + tot + '</span></div>';
    hero.appendChild(rg); var rl = el('p', 'mvRl2'); rl.textContent = 'ingressi rimasti'; hero.appendChild(rl); host.appendChild(hero);
    var body = el('div', 'mxBody mvBody'); host.appendChild(body);
    var acts = el('div', 'mvActs');
    function ab(label, icon, cls, fn, href) { var b = el(href ? 'a' : 'button', 'mvR ' + (cls || '')); b.setAttribute('aria-label', label); if (href) { b.href = href; b.target = '_blank'; b.rel = 'noopener'; } else b.type = 'button'; b.innerHTML = '<span class="mvRi">' + (icon.slice(0, 4) === '<svg' ? icon.replace(/width="\d+" height="\d+"/, 'width="22" height="22"') : SV(icon, 22)) + '</span><span class="mvRl">' + (label === 'Nuovo pacchetto' ? 'Rinnova' : label) + '</span>'; if (fn) b.addEventListener('click', fn); acts.appendChild(b); }
    if (D.services && D.services.length) ab('Nuovo pacchetto', '<path d="M12 5v14M5 12h14"/>', 'pri', function () { assign(m); });
    var dg = (function (p) { var s = String(p == null ? '' : p).trim(), d = s.replace(/\D/g, ''); if (!d) return ''; if (s.charAt(0) === '+') return d; if (d.slice(0, 2) === '00') return d.slice(2); if (/^3\d{8,9}$/.test(d) || /^0\d{6,10}$/.test(d)) return '39' + d; return d; })(m.phone);
    if (dg) ab('WhatsApp', '<svg width="17" height="17" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>', '', null, 'https://wa.me/' + dg);
    ab('Chiama', '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/>', '', null, 'tel:' + String(m.phone || '').replace(/[^\d+]/g, ''));
    body.appendChild(acts);
    var cb = el('div', 'mvRw mvCode');
    function codeView() {
      cb.classList.remove('ed');
      cb.innerHTML = '<span>Codice di accesso</span><b class="mvCv">' + (m.code ? esc(m.code) : '<i>non impostato</i>') + '<button type="button" class="mvCodeB">' + (m.code ? 'Cambia' : 'Imposta') + '</button></b>';
      cb.querySelector('.mvCodeB').addEventListener('click', codeEdit);
    }
    function codeEdit() {
      cb.classList.add('ed');
      cb.innerHTML = '<span>Codice di accesso</span><div class="mvCe"><input type="text" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="20" placeholder="Lettere e numeri, da 4 a 20" value="' + esc(m.code || '') + '"><button type="button" class="cSv">Salva</button><button type="button" class="cNo">Annulla</button></div><p class="cEr" hidden></p>';
      var inp = cb.querySelector('input'), er = cb.querySelector('.cEr'); inp.focus();
      cb.querySelector('.cNo').addEventListener('click', codeView);
      cb.querySelector('.cSv').addEventListener('click', function () {
        var v = inp.value.replace(/\s+/g, ''), bt = this;
        if (!/^[A-Za-z0-9]{4,20}$/.test(v)) { er.textContent = 'Da 4 a 20 tra lettere e numeri, senza spazi o simboli.'; er.hidden = false; return; }
        bt.disabled = true;
        post({ action: 'set_code', phone: m.phone, access_code: v }).then(function () { m.code = v; codeView(); }).catch(function (e) { bt.disabled = false; er.textContent = e.message; er.hidden = false; });
      });
    }
    codeView();
    var lsC = el('div', 'mvLs');
    function rw(k, v) { var r = el('div', 'mvRw'); r.innerHTML = '<span>' + k + '</span><b>' + v + '</b>'; lsC.appendChild(r); }
    rw('Pacchetto', cp ? esc(cp.name) + (cp.price_eur != null && cp.price_eur !== '' ? ' · ' + eur(cp.price_eur) : '') : 'Nessun pacchetto');
    if (cp && cp.created_at) rw('Dal', dshort(pd(cp.created_at)));
    rw('Ingressi usati', (m.total - m.left) + ' su ' + m.total);
    if (m.expires_on) rw(m.expired ? 'Scaduto il' : 'Scade il', fdate(m.expires_on));
    if (m.per_week && !m.expired) rw('Questa settimana', Math.min(m.week_used || 0, m.per_week) + ' di ' + m.per_week);
    rw('In agenda', ls.up.length + ' coaching');
    lsC.appendChild(cb); body.appendChild(lsC);
    var tabs = el('div', 'mxTabs'); body.appendChild(tabs);
    var pane = el('div', 'mxPane'); body.appendChild(pane);
    function drawTabs() {
      tabs.textContent = '';
      [['lez', 'Coaching'], ['pac', 'Pacchetti']].forEach(function (t) { var b = el('button', null, t[1]); b.type = 'button'; b.setAttribute('aria-pressed', S.tab === t[0] ? 'true' : 'false'); b.addEventListener('click', function () { S.tab = t[0]; drawTabs(); drawPane(); }); tabs.appendChild(b); });
    }
    function ev(x, past) {
      var r = el('div', 'mxEv');
      r.innerHTML = '<span class="mxDt"><b>' + x.start.getDate() + '</b><span>' + MS[x.start.getMonth()] + '</span></span><span class="mxTx"><b>' + esc(x.service || 'Coaching') + '</b><span>' + hm(x.start) + (past ? ' · svolta' : ' · prenotata') + '</span></span>';
      if (past) r.appendChild(el('span', 'gxChip ok', 'Svolta'));
      return r;
    }
    function drawPane() {
      pane.textContent = '';
      if (S.tab === 'lez') {
        pane.appendChild(el('div', 'mxSec', 'In programma'));
        var l1 = el('div', 'mxLs'); if (!ls.up.length) l1.appendChild(el('div', 'mxEmpty', 'Nessun coaching in programma.')); ls.up.slice(0, 12).forEach(function (x) { l1.appendChild(ev(x, false)); }); pane.appendChild(l1);
        pane.appendChild(el('div', 'mxSec', 'Ultimi coaching'));
        var l2 = el('div', 'mxLs'); if (!ls.past.length) l2.appendChild(el('div', 'mxEmpty', 'Ancora nessun coaching.')); ls.past.slice(0, 10).forEach(function (x) { l2.appendChild(ev(x, true)); }); pane.appendChild(l2);
      } else {
        var paid = m.packs.reduce(function (t, p) { return t + (Number(p.price_eur) || 0); }, 0);
        var tot = el('div', 'mxTot'); tot.innerHTML = '<div><span>Totale versato</span><b>' + eur(paid) + '</b></div><span class="gxChip ok">' + m.packs.length + (m.packs.length === 1 ? ' pacchetto' : ' pacchetti') + '</span>'; pane.appendChild(tot);
        var l = el('div', 'mxLs');
        m.packs.slice().reverse().forEach(function (p) {
          var d = pd(p.created_at), r = el('div', 'mxEv');
          r.innerHTML = '<span class="mxDt"><b>' + d.getDate() + '</b><span>' + MS[d.getMonth()] + '</span></span><span class="mxTx"><b>' + esc(p.name) + '</b><span>' + p.left + ' di ' + p.total + ' ingressi rimasti</span><span style="display:block">' + (p.expires_on ? (p.expired ? 'Scaduto il ' : 'Scade il ') + fdate(p.expires_on) : 'Senza scadenza') + (p.per_week ? ' · max ' + p.per_week + ' a settimana' : '') + '</span></span><b>' + (p.price_eur != null ? eur(p.price_eur) : '') + '</b>';
          var rm = btn('Togli', 'mxRm', function () {
            rm.textContent = 'Sicuro?'; rm.onclick = function () { rm.disabled = true; post({ action: 'remove', id: p.id }).then(function () { return window.liaPtRefresh(); }).catch(function (e) { rm.disabled = false; rm.textContent = e.message; }); };
          });
          if (p.expires_on) {
            var pr = btn('Prolunga', 'mxRm', function () {
              pr.hidden = true;
              var wr = el('div', 'mxExt'); wr.style.cssText = 'display:flex;gap:8px;align-items:center;margin:6px 0 10px';
              var di = el('input'); di.type = 'date'; di.min = todayIso(); di.value = p.expires_on > todayIso() ? p.expires_on : todayIso(); di.setAttribute('aria-label', 'Nuova scadenza'); di.style.cssText = 'flex:1;min-width:0;font:inherit;padding:8px 10px;border-radius:10px;border:1px solid var(--line2,#2a3648);background:transparent;color:inherit';
              var ok = btn('Salva', 'mxRm', function () { if (!di.value) return; ok.disabled = true; post({ action: 'extend', id: p.id, expires_on: di.value }).then(function () { return window.liaPtRefresh(); }).catch(function (e) { ok.disabled = false; ok.textContent = e.message; }); });
              wr.appendChild(di); wr.appendChild(ok); l.insertBefore(wr, r.nextSibling);
            });
            r.appendChild(pr);
          }
          r.appendChild(rm); l.appendChild(r);
        });
        pane.appendChild(l);
        var ac = el('div', 'mxManage'); if (D.services && D.services.length) { var nb = btn('', 'mxNewPk', function () { assign(m); }); nb.innerHTML = SV('<path d="M12 5v14M5 12h14"/>', 16) + '<span>Nuovo pacchetto</span>'; ac.appendChild(nb); } pane.appendChild(ac);
      }
    }
    drawTabs(); drawPane();
  }

  // --- Scheda dell'appuntamento: dati dell'iscritto (ingressi rimasti, pacchetto, lezioni) ---
  document.documentElement.classList.add('ptb');
  var injecting = false, injT = null;
  function injectIs() {
    var view = document.getElementById('ap-view'), card = document.getElementById('ap-card');
    if (!view || !card || !D) return;
    var tel = view.querySelector('#ap-cli a[href^="tel:"]'), ph = tel ? pn(tel.getAttribute('href').slice(4)) : '';
    var old = view.querySelector('.ptC');
    var m = ph ? (D.members || []).filter(function (x) { return pn(x.phone) === ph; })[0] : null;
    if (!m) { injecting = true; if (old) old.remove(); view.classList.remove('hasPtC'); injecting = false; return; }
    var cp = curPack(m), st = m.status || stOf(m), ls = lessons(m), pct = cp && cp.total ? Math.round(cp.left / cp.total * 100) : 0;
    var next = ls.up[0];
    var nmEl = view.querySelector('#ap-cli .nm'), avEl = view.querySelector('#ap-cli .av');
    var nm = nmEl ? nmEl.textContent.trim() : m.name, ini = nm.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
    var avBg = avEl ? (avEl.style.background || avEl.style.backgroundColor || '') : '';
    var tm = view.querySelector('#ap-hero .tm span'), te = view.querySelector('#ap-hero .tm small'), dy = view.querySelectorAll('#ap-hero .dy span');
    var dyEl = view.querySelector('#ap-hero .dy'); var dyTx = dy.length ? dy[0].textContent : (dyEl ? dyEl.textContent.split('\u00b7')[0].trim() : '');
    var when = [dyTx, tm ? tm.textContent + (te ? '–' + te.textContent.replace('→', '').replace(/\s+/g, '') : '') : ((view.querySelector('#ap-hero .tm') || {}).textContent || '').replace('→', '–').replace(/\s+/g, '')].filter(Boolean).join(' · ');
    var wa = (function (p) { var q = String(p == null ? '' : p).trim(), d = q.replace(/\D/g, ''); if (!d) return ''; if (q.charAt(0) === '+') return d; if (d.slice(0, 2) === '00') return d.slice(2); if (/^3\d{8,9}$/.test(d) || /^0\d{6,10}$/.test(d)) return '39' + d; return d; })(m.phone || ph);
    var ico = function (d) { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
    var box = el('div', 'ptC ' + st.s);
    box.innerHTML = '<div class="ptCh"><span class="ptCa"' + (avBg ? ' style="background:' + avBg + '"' : '') + '>' + esc(ini) + '</span><div><b>' + esc(nm) + '</b><small>' + esc(when) + '</small></div></div>' +
      '<div class="ptCg"><span class="ptCt"><b>' + (cp ? cp.left : 0) + '</b><small>' + (cp && cp.left === 1 ? 'rimasta' : 'rimaste') + '</small></span><span class="ptCt"><b>' + (cp ? cp.used || 0 : 0) + '</b><small>fatte</small></span><span class="ptCt"><b>' + ls.up.length + '</b><small>in agenda</small></span></div>' +
      '<div class="ptCp"><div class="ptCn"><span>' + esc(cp ? cp.name : '—') + '</span><span class="ptCs">' + esc(st.label) + '</span></div><span class="ptIsP"><i style="width:' + pct + '%"></i></span></div>' +
      '<div class="ptCc"><a class="ptCb" href="tel:' + esc(String(m.phone || ph).replace(/\s+/g, '')) + '">' + ico('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>') + 'Chiama</a>' + (wa ? '<a class="ptCb w" href="https://wa.me/' + wa + '" target="_blank" rel="noopener">' + ico('<path d="M4 20l1.4-4.2A8 8 0 1 1 8.4 18.8z"/>') + 'WhatsApp</a>' : '') + '</div>';
    var sig = box.innerHTML;
    if (old && old.getAttribute('data-sig') === sig && view.firstChild === old) { view.classList.add('hasPtC'); return; }
    box.setAttribute('data-sig', sig);
    injecting = true;
    if (old) old.remove();
    var prev = view.querySelector('.ptC'); if (prev) prev.remove();
    view.insertBefore(box, view.firstChild);
    view.classList.add('hasPtC');
    injecting = false;
  }
  var X_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var shOpenAt = 0, shWasOn = false, shield = 0;
  function ptClose() {
    var sh = document.getElementById('sheet'); if (!sh) return;
    var ed = document.getElementById('ap-edit'), cn = document.getElementById('ap-cancel-edit');
    if (ed && !ed.hidden && cn) { cn.click(); return; }
    shield = Date.now() + 600;
    var bg = document.getElementById('sheet-bg'), cf = document.getElementById('confirm');
    sh.classList.remove('on'); if (bg) bg.classList.remove('on'); if (cf) cf.classList.remove('on');
    var mn = document.getElementById('ap-menu'); if (mn) mn.hidden = true;
  }
  function xBtn() {
    var b = document.getElementById('sheet-close');
    if (!b || b.getAttribute('data-x')) return;
    b.innerHTML = X_SVG; b.setAttribute('data-x', '1'); b.setAttribute('aria-label', 'Chiudi');
    var fired = 0;
    var go = function (ev) { ev.preventDefault(); ev.stopPropagation(); if (Date.now() - fired < 400) return; fired = Date.now(); ptClose(); };
    b.addEventListener('touchend', go, { passive: false });
    b.addEventListener('pointerup', go);
    b.addEventListener('click', go);
  }
  setInterval(function () {
    var sh = document.getElementById('sheet'), on = !!(sh && sh.classList.contains('on'));
    if (on && !shWasOn) shOpenAt = Date.now();
    shWasOn = on; if (on) xBtn();
  }, 120);
  function outside(ev) {
    var sh = document.getElementById('sheet');
    if (!sh || !sh.classList.contains('on') || Date.now() - shOpenAt < 350) return false;
    var t = ev.target;
    if (t && t.closest && (t.closest('#sheet') || t.closest('.confirm') || t.closest('#ap-menu'))) return false;
    return true;
  }
  ['touchend', 'click'].forEach(function (n) {
    document.addEventListener(n, function (ev) {
      if (Date.now() < shield) { ev.preventDefault(); ev.stopPropagation(); return; }
      if (outside(ev)) { ev.preventDefault(); ev.stopPropagation(); ptClose(); }
    }, true);
  });

  // ---- Nuovo appuntamento (PT): si sceglie solo l'iscritto, il pacchetto è quello in corso ----
  (function ptNew() {
    var ov = document.getElementById('newOv'); if (!ov) return;
    var pk = null, svcStep = null, whoDone = false;
    function steps() { return ov.querySelectorAll('.nx-step'); }
    function stp(k) { return ov.querySelector('.nx-step[data-step="' + k + '"]'); }
    function valid() { return ((D && D.members) || []).filter(function (m) { var cp = curPack(m); return cp && cp.left > 0; }).sort(function (a, b) { return String(m2n(a)).localeCompare(String(m2n(b)), 'it'); }); }
    function m2n(m) { return (m.last || '') + ' ' + (m.first || m.name || ''); }
    function ini(m) { return ((m.first || m.name || '?').charAt(0) + (m.last || '').charAt(0)).toUpperCase(); }
    function build() {
      svcStep = stp('svc'); if (!svcStep || pk) return;
      pk = el('div', 'ptPk'); pk.hidden = true;
      pk.innerHTML = '<h4 class="nx-q">Chi è l’iscritto?</h4><p class="nx-qs">Solo gli iscritti con coaching residui.</p><div class="ptPs"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" placeholder="Cerca per nome o telefono" autocomplete="off" aria-label="Cerca iscritto"></div><div class="ptPl"></div>';
      svcStep.parentNode.insertBefore(pk, svcStep);
      pk.querySelector('input').addEventListener('input', fill);
    }
    function fill() {
      if (!pk) return;
      var l = pk.querySelector('.ptPl'), q = pk.querySelector('input').value.trim().toLowerCase(), qd = q.replace(/\D/g, '');
      l.innerHTML = '';
      if (!D) { l.appendChild(el('p', 'ptPe', 'Carico gli iscritti…')); return; }
      var all = valid(), list = all.filter(function (m) { return !q || (m.name || '').toLowerCase().indexOf(q) !== -1 || (qd && pn(m.phone).indexOf(qd) !== -1); });
      if (!all.length) {
        var e = el('div', 'ptPe'); e.innerHTML = '<b>Nessun iscritto con coaching residui</b><span>Aggiungi un iscritto e assegnagli un pacchetto.</span>';
        var b = el('button', 'ptPn', 'Nuovo iscritto'); b.type = 'button';
        b.addEventListener('click', function () { var sc = document.getElementById('newScrim'); if (sc) sc.click(); setTimeout(function () { if (window.liaPtOpenNew) window.liaPtOpenNew(); }, 60); });
        e.appendChild(b); l.appendChild(e); return;
      }
      if (!list.length) { l.appendChild(el('p', 'ptPe', 'Nessun iscritto trovato.')); return; }
      list.forEach(function (m) {
        var cp = curPack(m), st = m.status || stOf(m), r = el('button', 'ptPr ' + st.s); r.type = 'button';
        r.innerHTML = '<span class="ptPa">' + esc(ini(m)) + '</span><span class="ptPt"><b>' + esc(m.name) + '</b><small>' + esc(cp.name) + '</small></span><span class="ptPc"><b>' + cp.left + '</b><small>' + (cp.left === 1 ? 'rimasta' : 'rimaste') + '</small></span>';
        r.addEventListener('click', function () { choose(m, cp); });
        l.appendChild(r);
      });
    }
    function choose(m, cp) {
      var ci = document.getElementById('nwClient'), ph = document.getElementById('nwPhone');
      if (ci) { ci.value = m.name; ci.dispatchEvent(new Event('input', { bubbles: true })); }
      if (ph) { ph.value = m.phone || ''; ph.dispatchEvent(new Event('input', { bubbles: true })); }
      ov.setAttribute('data-who', m.name + '|' + cp.name + '|' + cp.left + '|' + cp.total);
      var tries = 0;
      (function go() {
        var chips = ov.querySelectorAll('#nwServices .nx-ch'), hit = null;
        Array.prototype.forEach.call(chips, function (c) { var n = c.querySelector('.nm'); if (n && n.textContent.trim() === cp.name) hit = c; });
        if (hit) { hit.click(); return; }
        if (++tries < 25) setTimeout(go, 150);
      })();
    }
    function whoCard() {
      var w = stp('who'); if (!w) return;
      var h = w.querySelector('.nx-q'); if (h) h.textContent = 'Conferma l’appuntamento';
      var c = w.querySelector('.ptWc'); if (!c) { c = el('div', 'ptWc'); w.insertBefore(c, h ? h.nextSibling : w.firstChild); }
      var d = (ov.getAttribute('data-who') || '').split('|');
      var cl = document.getElementById('nwClient');
      c.innerHTML = '<span class="ptPa">' + esc((d[0] || '?').split(/\s+/).map(function (x) { return x.charAt(0); }).join('').slice(0, 2).toUpperCase()) + '</span><span class="ptPt"><b>' + esc(d[0] || (cl ? cl.value : '')) + '</b><small>' + esc(d[1] || '') + (d[2] ? ' · ' + d[2] + (d[2] === '1' ? ' coaching rimasto' : ' coaching rimasti') : '') + '</small></span>';
    }
    function sync() {
      if (ov.hidden) { if (pk && !pk.hidden) pk.hidden = true; if (ov.hasAttribute('data-who')) ov.removeAttribute('data-who'); return; }
      build(); if (!pk) return;
      var sv = stp('svc'), on = sv && !sv.hidden;
      if (pk.hidden === !!on) pk.hidden = !on;
      if (on && !pk._on) { pk._on = true; fill(); if (ov.hasAttribute('data-who')) ov.removeAttribute('data-who'); try { load(); } catch (e) {} } if (!on) pk._on = false;
      var w = stp('who'); if (w && !w.hidden) whoCard();
    }
    ov.classList.add('ptn');
    var obs = new MutationObserver(function () { sync(); });
    obs.observe(ov, { attributes: true, attributeFilter: ['hidden'] });
    var t0 = setInterval(function () { var sv = stp('svc'); if (sv) { clearInterval(t0); obs.observe(ov, { attributes: true, subtree: true, attributeFilter: ['hidden'] }); sync(); } }, 200);
    document.addEventListener('lia:data-changed', function () { if (pk && !pk.hidden) fill(); });
    window.liaPtPickRefresh = function () { if (pk && !pk.hidden) fill(); };
  })();

  (function watch() {
    var v = document.getElementById('ap-view');
    if (!v) { setTimeout(watch, 800); return; }
    /* Il riquadro dell'iscritto si mette nello stesso momento in cui la scheda si costruisce (callback del MutationObserver: prima che il browser disegni),
       cosi' la scheda compare subito completa. Le modifiche fatte dal riquadro stesso vengono ignorate, altrimenti si rigenerava in continuo. */
    var isC = function (n) { return n.nodeType === 1 && n.classList.contains('ptC'); };
    new MutationObserver(function (recs) {
      if (injecting) return;
      var mine = recs.length > 0 && recs.every(function (r) { return [].every.call(r.addedNodes, isC) && [].every.call(r.removedNodes, isC); });
      if (mine) return;
      injectIs();
    }).observe(v, { childList: true, subtree: true });
  })();

  function init() { if (!document.querySelector('.clientsWrap')) return; render(); load(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
