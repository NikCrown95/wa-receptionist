/* Calendario del centro sportivo (campi sportivi) per la dashboard di Lia.
   Sostituisce il calendario degli appuntamenti: giorno con i campi in colonna, dettaglio, annulla e prenotazione a mano.
   Dati da /api/agenda?t=CODICE&courts=1 (stesso codice segreto dell'agenda). */
(function () {
  var token = (new URLSearchParams(location.search).get('t') || '').trim();
  var pCal = document.getElementById('panelCal');
  if (!token || !pCal) return;
  document.body.classList.add('campiOn');
  var URL0 = '/api/agenda?t=' + encodeURIComponent(token) + '&courts=1';

  var DN = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
  var DL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  var MO = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var PPM = 52 / 60; // pixel per minuto
  var SVG_L = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>';
  var SVG_R = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>';

  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function parse(s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function fmt(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(s, n) { var d = parse(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); }
  function mins(t) { return +t.slice(0, 2) * 60 + +t.slice(3, 5); }
  function hhmm(m) { return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function monday(s) { return addDays(s, -(wd(s) - 1)); }
  function wd(s) { var g = parse(s).getUTCDay(); return g === 0 ? 7 : g; }
  function longDay(s) { var d = parse(s), m = MO[d.getUTCMonth()]; return DL[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + (window.matchMedia && window.matchMedia('(max-width:699px)').matches ? m.charAt(0).toUpperCase() + m.slice(1) : m); }
  function eur(n) { return n == null ? '' : (Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : Number(n).toFixed(2).replace('.', ',')) + ' €'; }
  function soc(n) { return n === 0 ? 'Nessun socio' : n === 1 ? '1 socio' : n + ' soci'; }

  var S = { court: (function () { try { return localStorage.getItem('cpCourt') || ''; } catch (e) { return ''; } })(), view: (function () { try { return localStorage.getItem('cpView') === 'grid' ? 'grid' : 'day'; } catch (e) { return 'day'; } })(), data: null, strip: null, day: null, sel: null, form: null, err: '', loading: true, busy: false, askCancel: false };
  var root = el('div', 'cpx');
  pCal.appendChild(root);
  var tick = 0;

  function toast(m, bad) {
    var o = document.querySelector('.cp-toast'); if (o) o.remove();
    var t = el('div', 'cp-toast' + (bad ? ' bad' : ''), m); t.setAttribute('role', 'status'); document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4200);
  }
  function call(body) {
    var o = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    var u = body ? URL0 : (isPh() && S.strip ? URL0 + '&from=' + addDays(S.strip, -28) + '&days=63' : URL0 + '&from=' + S.strip + '&days=7');
    return fetch(u, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Errore, riprova.'); return j; }); });
  }
  function load() {
    var my = ++tick; S.loading = !S.data; S.err = ''; draw();
    call().then(function (j) { if (my !== tick) return; if (!S.strip) { var mo = monday(j.today); S.day = S.day || j.today; if (mo !== j.today) { S.strip = mo; S.data = j; load(); return; } S.strip = mo; } S.data = j; S.loading = false; if (!S.day) S.day = j.today; draw(); })
      .catch(function (e) { if (my !== tick) return; S.loading = false; S.err = e.message; draw(); });
  }

  // ---------- disegno del campo ----------
  // tennis e padel: 2 o 4 giocatori, soci, certificato. Calcio, pallavolo e gli altri sport: solo il referente, nessun socio, un prezzo per prenotazione.
  function clubSport() { return (S.data && S.data.club && S.data.club.sport) || 'tennis'; }
  function isSimple() { var sp = clubSport(); return sp !== 'tennis' && sp !== 'padel'; }
  function courtColor(c) {
    var t = (String(c.surface || '') + ' ' + String(c.name || '')).toLowerCase();
    if (/parquet|legno|wood/.test(t)) return '#C58B4E';
    if (/sabbia|sand|beach/.test(t)) return '#D9B877';
    if ((c.sport || window.__liaCampiSport) === 'pallavolo') return '#8E7CC3'; // pallavolo al coperto: viola, per distinguerlo dal tennis in terra
    if (/erba|grass|prato/.test(t)) return '#5DB07A';
    if (/terra|rossa|clay|battuta/.test(t)) return '#D9784A';
    if (/cement|hard|resina|sintetic|moquette|pvc|acrilic/.test(t)) return '#5B8DB8';
    return '#4BB3D6';
  }
  function dotsAt(n, y) { // n giocatori in fila alla stessa altezza
    var out = [], r = n > 6 ? 3 : 4.5;
    for (var i = 0; i < n; i++) out.push([n === 1 ? 32 : 17 + i * (30 / (n - 1)), y, r]);
    return out;
  }
  function courtSvg(c, players, members, cls) { // il campo visto dall'alto, con i giocatori
    var col = courtColor(c), w = el('span', 'cp-cs' + (cls ? ' ' + cls : ''));
    var sp = clubSport(), L = 'stroke="#fff" stroke-opacity=".85" stroke-width="2"', L2 = 'stroke="#fff" stroke-opacity=".6" stroke-width="1.5"', body;
    if (sp === 'calcio') body = '<rect x="10" y="7" width="44" height="50" fill="none" ' + L + '/><line x1="10" y1="32" x2="54" y2="32" ' + L + '/><circle cx="32" cy="32" r="7" fill="none" ' + L + '/><rect x="21" y="7" width="22" height="10" fill="none" ' + L2 + '/><rect x="21" y="47" width="22" height="10" fill="none" ' + L2 + '/>';
    else if (sp === 'pallavolo') body = '<rect x="7" y="15" width="50" height="34" fill="none" ' + L + '/><line x1="32" y1="11" x2="32" y2="53" ' + L + '/><line x1="21" y1="15" x2="21" y2="49" ' + L2 + '/><line x1="43" y1="15" x2="43" y2="49" ' + L2 + '/>';
    else body = '<rect x="9" y="9" width="46" height="46" fill="none" ' + L + '/><line x1="9" y1="32" x2="55" y2="32" ' + L + '/><line x1="20" y1="9" x2="20" y2="55" ' + L2 + '/><line x1="44" y1="9" x2="44" y2="55" ' + L2 + '/>';
    var d = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="' + col + '"/>' + body;
    if (players > 0 && !isSimple()) {
      var top = Math.ceil(players / 2), pts = dotsAt(top, 21).concat(dotsAt(players - top, 43)), m = members == null ? 0 : members;
      pts.forEach(function (q, i) { d += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="' + q[2] + '" ' + (i < m ? 'fill="#fff" stroke="#fff"' : (members == null ? 'fill="#fff" stroke="#fff"' : 'fill="rgba(0,0,0,.35)" stroke="#fff"')) + ' stroke-width="1.6"/>'; });
    }
    w.innerHTML = d + '</svg>'; return w;
  }

  // ---------- calcoli ----------
  function nowIn() { // data e minuti attuali nel fuso del centro sportivo
    var tz = (S.data && S.data.timezone) || 'Europe/Rome';
    var p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date());
    var g = function (t) { return p.filter(function (x) { return x.type === t; })[0].value; };
    return { date: g('year') + '-' + g('month') + '-' + g('day'), min: +g('hour') * 60 + +g('minute') };
  }
  function slotsOf(c, date) { // gli slot del campo in quel giorno: [{start,end}]
    var out = [], hs = (c.hours && c.hours[String(wd(date))]) || [];
    hs.forEach(function (h) { for (var m = mins(h[0]); m + c.slot_min <= mins(h[1]); m += c.slot_min) out.push({ s: m, e: m + c.slot_min }); });
    return out;
  }
  function closuresOf(c, date) { return ((S.data && S.data.closures) || []).filter(function (x) { return (!x.court_id || x.court_id === c.id) && date >= x.starts_on && date <= x.ends_on; }); }
  function closedAt(c, date, a, b) { return closuresOf(c, date).some(function (x) { return (x.from ? mins(x.from) : 0) < b && (x.to ? mins(x.to) : 1440) > a; }); }
  function bookingsOn(date) { return (S.data.bookings || []).filter(function (b) { return b.date === date; }); }
  function stat(date) { // {occ, tot}: slot occupati e slot totali del giorno
    var occ = 0, tot = 0;
    S.data.courts.forEach(function (c) { tot += slotsOf(c, date).filter(function (sl) { return !closedAt(c, date, sl.s, sl.e); }).length; });
    bookingsOn(date).forEach(function (b) { var c = S.data.courts.filter(function (x) { return x.id === b.court_id; })[0]; if (c) occ += Math.max(1, Math.round((mins(b.end) - mins(b.start)) / c.slot_min)); });
    return { occ: Math.min(occ, tot), tot: tot };
  }

  // ---------- disegno ----------
  function draw() {
    var fv0 = root.querySelector('.cp-fv'), ft = fv0 ? fv0.scrollTop : 0, py = window.pageYOffset;
    draw0();
    var fv1 = root.querySelector('.cp-fv'); if (fv1 && fv0) fv1.scrollTop = ft; if (window.pageYOffset !== py) window.scrollTo(0, py);
  }
  function draw0() {
    root.textContent = ''; root.classList.remove('wide');
    var openNow = !!(S.sel || S.form); S.animIn = openNow && !S.wasOpen; S.wasOpen = openNow;
    if (S.err && !S.data) {
      var e = el('div', 'cp-err'); e.appendChild(el('span', null, S.err));
      var rb = el('button', 'cp-btn', 'Riprova'); rb.type = 'button'; rb.onclick = load; e.appendChild(rb); root.appendChild(e); return;
    }
    if (!S.data) { root.appendChild(el('div', 'cp-load', 'Carico il calendario…')); return; }
    var D = S.data;
    if (window.__liaCampiSport !== clubSport()) { window.__liaCampiSport = clubSport(); try { document.dispatchEvent(new Event('liaSport')); } catch (e) {} } // il menu e l'intestazione seguono lo sport del centro
    if (!D.courts.length) { root.appendChild(el('div', 'cp-load', 'Non hai ancora nessun campo attivo. Aggiungili dalle Impostazioni.')); return; }

    // testata
    var PH = isPh(); if (PH) { S.view = 'day'; phHead(D); }
    if (!PH) {
    var top = el('div', 'cp-top');
    var ti = el('div', 'cp-title', S.view === 'grid' ? weekLabel() : longDay(S.day));
    top.appendChild(ti);
    var vw = el('div', 'cp-vw'); vw.setAttribute('role', 'group'); vw.setAttribute('aria-label', 'Vista');
    [['day', 'Giorno'], ['grid', 'Griglia']].forEach(function (v) {
      var b = el('button', S.view === v[0] ? 'on' : '', v[1]); b.type = 'button'; b.setAttribute('aria-pressed', S.view === v[0] ? 'true' : 'false');
      b.onclick = function () { S.view = v[0]; try { localStorage.setItem('cpView', v[0]); } catch (e) {} S.sel = null; S.form = null; S.askCancel = false; draw(); };
      vw.appendChild(b);
    });
    top.appendChild(vw);
    var da = el('div', 'cp-dd');
    [[-1, SVG_L, S.view === 'grid' ? 'Settimana prima' : 'Giorno prima'], [1, SVG_R, S.view === 'grid' ? 'Settimana dopo' : 'Giorno dopo']].forEach(function (v) {
      var b = el('button', 'cp-arr'); b.type = 'button'; b.setAttribute('aria-label', v[2]); b.innerHTML = v[1]; b.onclick = function () { if (S.view === 'grid') goWeek(v[0]); else goDay(v[0]); }; da.appendChild(b);
    });
    top.appendChild(da);
    var nb = el('button', 'cp-now', 'Oggi'); nb.type = 'button';
    nb.onclick = function () { S.day = D.today; S.sel = null; S.form = null; if (S.strip !== monday(D.today)) { S.strip = monday(D.today); S.data = null; load(); } else draw(); };
    var nw = el('button', 'cp-now new', '+ Nuova'); nw.type = 'button'; nw.onclick = function () { openForm(S.day); };
    top.appendChild(nw); top.appendChild(nb); root.appendChild(top);
    }
    if (S.err) { var er = el('div', 'cp-err'); er.appendChild(el('span', null, S.err)); var r2 = el('button', 'cp-btn', 'Riprova'); r2.type = 'button'; r2.onclick = load; er.appendChild(r2); root.appendChild(er); }

    // giorni
    var st = el('div', 'cp-strip thin'); st.setAttribute('role', 'group'); st.setAttribute('aria-label', 'Giorni');
    var pv = el('button', 'cp-arr'); pv.type = 'button'; pv.setAttribute('aria-label', 'Sette giorni prima'); pv.innerHTML = SVG_L;
    pv.onclick = function () { shift(-7); }; st.appendChild(pv);
    for (var i = 0; i < 7; i++) {
      (function (date) {
        var s = stat(date), b = el('button', 'cp-d' + (date === S.day ? ' on' : '') + (date === D.today ? ' tod' : '')); b.type = 'button';
        b.setAttribute('aria-pressed', date === S.day ? 'true' : 'false');
        b.setAttribute('aria-label', longDay(date) + ', ' + s.occ + ' slot occupati su ' + s.tot);
        b.appendChild(el('span', null, DN[parse(date).getUTCDay()])); b.appendChild(el('b', null, String(parse(date).getUTCDate()))); b.appendChild(el('i', null, s.occ + '/' + s.tot));
        b.onclick = function () { S.day = date; S.sel = null; S.form = null; S.askCancel = false; draw(); };
        st.appendChild(b);
      })(addDays(S.strip, i));
    }
    var nx = el('button', 'cp-arr'); nx.type = 'button'; nx.setAttribute('aria-label', 'Sette giorni dopo'); nx.innerHTML = SVG_R;
    nx.onclick = function () { shift(7); }; st.appendChild(nx); 

    // riepilogo
    var bs = bookingsOn(S.day), s0 = stat(S.day), now = nowIn();
    var sum = el('div', 'cp-sum');
    function tile(a, b, c) { var k = el('div', 'cp-k'); k.appendChild(el('span', null, a)); k.appendChild(el('b', null, b)); if (c) k.appendChild(el('small', null, c)); sum.appendChild(k); }
    var pct = s0.tot ? Math.round(s0.occ * 100 / s0.tot) : 0;
    var ppl = bs.reduce(function (a, b) { return a + (+b.players || 0); }, 0), mem = bs.reduce(function (a, b) { return a + (+b.members || 0); }, 0);
    var freeC = D.courts.filter(function (c) {
      return slotsOf(c, S.day).some(function (sl) {
        if (closedAt(c, S.day, sl.s, sl.e)) return false;
        if (S.day < now.date || (S.day === now.date && sl.e <= now.min)) return false;
        return !bs.some(function (b) { return b.court_id === c.id && mins(b.start) < sl.e && mins(b.end) > sl.s; });
      });
    }).length;
    tile('Occupazione', pct + '%', s0.occ + ' slot su ' + s0.tot);
    if (isSimple()) tile('Prenotazioni', String(bs.length), bs.length === 1 ? 'in questo giorno' : 'in questo giorno'); else tile('Persone', String(ppl), mem + ' soci · ' + (ppl - mem) + ' non soci');
    tile('Campi liberi', freeC + ' su ' + D.courts.length, S.day === now.date ? 'con posto libero' : 'con posto libero');
    if (PH && !phWeek()) { // telefono: una sola card compatta, come l'agenda dei parrucchieri
      sum.textContent = ''; sum.className = 'cp-sum cp-sum1';
      var k1 = el('div', 'cp-k'); k1.appendChild(el('span', null, 'Agenda'));
      k1.appendChild(el('b', null, bs.length === 0 ? 'Nessuna prenotazione' : bs.length === 1 ? '1 prenotazione' : bs.length + ' prenotazioni'));
      sum.appendChild(k1);
    }
    if (S.view !== 'grid' && !(PH && phWeek())) root.appendChild(sum);

    var lg = el('div', 'cp-leg');
    lg.innerHTML = '<span><i class="p2"></i>2 giocatori</span><span><i class="p4"></i>4 giocatori</span>';

    if (S.view === 'grid') {
      if (S.court && !courtOf(S.court)) S.court = '';
      var ct = el('div', 'cp-ct'); ct.setAttribute('role', 'group'); ct.setAttribute('aria-label', 'Campo');
      var all = el('button', 'all' + (!S.court ? ' on' : '')); all.type = 'button'; all.setAttribute('aria-pressed', !S.court ? 'true' : 'false');
      all.innerHTML = '<span class="cp-cs tab allic"><svg viewBox="0 0 64 64" aria-hidden="true"><rect width="64" height="64" rx="14" fill="#2B8A94"/><rect x="14" y="14" width="15" height="15" rx="3" fill="#fff"/><rect x="35" y="14" width="15" height="15" rx="3" fill="#fff"/><rect x="14" y="35" width="15" height="15" rx="3" fill="#fff"/><rect x="35" y="35" width="15" height="15" rx="3" fill="#fff"/></svg></span><span><b>Tutti</b><small>tutti i campi</small></span>';
      all.onclick = function () { S.court = ''; try { localStorage.setItem('cpCourt', ''); } catch (e) {} S.sel = null; S.form = null; draw(); };
      ct.appendChild(all);
      D.courts.forEach(function (c) {
        var b = el('button', S.court === c.id ? 'on' : ''); b.type = 'button'; b.setAttribute('aria-pressed', S.court === c.id ? 'true' : 'false');
        b.appendChild(courtSvg(c, 0, null, 'tab')); var t = el('span'); t.appendChild(el('b', null, c.name)); t.appendChild(el('small', null, [c.surface, c.indoor ? 'coperto' : ''].filter(Boolean).join(' · ') || ' ')); b.appendChild(t);
        b.onclick = function () { S.court = S.court === c.id ? '' : c.id; try { localStorage.setItem('cpCourt', S.court); } catch (e) {} S.sel = null; S.form = null; draw(); };
        ct.appendChild(b);
      });
      root.appendChild(ct);
    }
    if (S.view === 'grid') { var gs = el('div', 'cp-gs' + (S.sel || S.form ? ' open' : '')); gs.appendChild(S.court ? board(bs, now) : boardAll(now)); if (S.sel || S.form) gs.appendChild(detail(bs)); root.appendChild(gs); root.classList.add('wide'); }
    else root.appendChild(dayList(bs, now));
    if (PH) phWrap();
  }

  // ---------- smartphone: come per le altre attività (Giorno / Settimana dal selettore in alto, riga dei giorni con swipe) ----------
  var mq = window.matchMedia ? window.matchMedia('(max-width:699px)') : { matches: false };
  function isPh() { return !!mq.matches; }
  function phWeek() { var w = document.getElementById('view-week'); return !!(w && w.getAttribute('aria-pressed') === 'true'); }
  ['view-day', 'view-week'].forEach(function (id) { var b = document.getElementById(id); if (b) b.addEventListener('click', function () { setTimeout(function () { S.sel = null; S.form = null; S.askCancel = false; if (S.data) draw(); }, 0); }); });
  if (mq.addEventListener) mq.addEventListener('change', function () { if (S.data) draw(); });
  function phHead(D) {
    var wk = phWeek(), top = el('div', 'cp-ptop');
    if (wk) {
      var wa = parse(monday(S.day)), wb = parse(addDays(monday(S.day), 6)), sh = function (d) { var m = MO[d.getUTCMonth()].slice(0, 3); return m.charAt(0).toUpperCase() + m.slice(1); };
      var pt = el('div', 'cp-ptitle', wa.getUTCMonth() === wb.getUTCMonth() ? wa.getUTCDate() + ' – ' + wb.getUTCDate() + ' ' + sh(wb) + ' ' : wa.getUTCDate() + ' ' + sh(wa) + ' – ' + wb.getUTCDate() + ' ' + sh(wb) + ' ');
      pt.appendChild(el('span', 'cp-yr', String(wb.getUTCFullYear()))); top.appendChild(pt);
    } else {
      var d = parse(S.day), card = el('div', 'cp-pcard'), nbk = bookingsOn(S.day).length;
      var tile = el('b'); tile.appendChild(el('em', null, DN[d.getUTCDay()].toUpperCase())); tile.appendChild(el('u', null, String(d.getUTCDate()))); card.appendChild(tile);
      var diff = Math.round((parse(S.day) - parse(D.today)) / 864e5), rel = diff === 0 ? 'Oggi' : diff === 1 ? 'Domani' : diff === -1 ? 'Ieri' : MO[d.getUTCMonth()].charAt(0).toUpperCase() + MO[d.getUTCMonth()].slice(1, 3) + ' ' + d.getUTCFullYear();
      var tx = el('span'); tx.appendChild(el('strong', null, longDay(S.day))); tx.appendChild(el('small', null, rel + ' · ' + (nbk === 0 ? 'nessuna prenotazione' : nbk === 1 ? '1 prenotazione' : nbk + ' prenotazioni'))); card.appendChild(tx);
      top.appendChild(card);
    }
    var ar = el('div', 'cp-pact');
    [[-1, SVG_L, 'Giorno prima'], [1, SVG_R, 'Giorno dopo']].forEach(function (v) {
      var b = el('button', 'cp-arr'); b.type = 'button'; b.setAttribute('aria-label', v[2]); b.innerHTML = v[1]; b.onclick = function () { goDay(wk ? v[0] * 7 : v[0]); }; ar.appendChild(b);
    });
    var nb = el('button', 'cp-now', 'Oggi'); nb.type = 'button';
    nb.onclick = function () { S.day = D.today; S.sel = null; S.form = null; if (S.strip !== monday(D.today)) { S.strip = monday(D.today); S.data = null; load(); } else draw(); };
    ar.appendChild(nb); top.appendChild(ar); root.appendChild(top);
    var ptt = top.querySelector('.cp-ptitle');
    if (ptt) { // come i parrucchieri: il titolo parte da 30px e si restringe finche' sta su una riga
      var fitT = function () { var fs = 30; ptt.style.fontSize = fs + 'px'; while (ptt.scrollWidth > ptt.clientWidth + 1 && fs > 15) { fs--; ptt.style.fontSize = fs + 'px'; } };
      fitT(); if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitT);
    }
    if (wk) { // come i parrucchieri: una settimana per pagina, si scorre di settimana in settimana e resta lo stesso giorno della settimana
      var st = el('div', 'cp-pstrip'), NP = 2, wk0 = monday(S.day);
      st.setAttribute('role', 'group'); st.setAttribute('aria-label', 'Giorni');
      for (var pg = -NP; pg <= NP; pg++) {
        var page = el('div', 'cp-pwk');
        for (var i = 0; i < 7; i++) (function (date) {
          var n = bookingsOn(date).length, b = el('button', 'cp-pd' + (date === S.day ? ' on' : '') + (date === D.today ? ' tod' : '') + (date < D.today ? ' past' : '')); b.type = 'button';
          b.setAttribute('aria-pressed', date === S.day ? 'true' : 'false'); b.setAttribute('aria-label', longDay(date) + ', ' + n + (n === 1 ? ' prenotazione' : ' prenotazioni'));
          b.appendChild(el('span', null, DN[parse(date).getUTCDay()])); b.appendChild(el('b', null, String(parse(date).getUTCDate()))); b.appendChild(el('i', null, n ? String(n) : '·'));
          b.onclick = function () { if (date === S.day) return; S.day = date; S.sel = null; S.form = null; S.askCancel = false; draw(); };
          page.appendChild(b);
        })(addDays(wk0, pg * 7 + i));
        st.appendChild(page);
      }
      root.appendChild(st);
      st.scrollLeft = st.clientWidth * NP;
      (function () {
        var t = null;
        st.addEventListener('scroll', function () {
          clearTimeout(t);
          t = setTimeout(function () {
            var w = st.clientWidth; if (!w) return;
            var p = Math.round(st.scrollLeft / w) - NP; if (!p) return;
            S.day = addDays(S.day, p * 7); S.strip = monday(S.day); S.sel = null; S.form = null; S.askCancel = false; load();
          }, 130);
        }, { passive: true });
      })();
    }
    if (!S.sel && !S.form) { var fab = el('button', 'cp-fab'); fab.type = 'button'; fab.setAttribute('aria-label', 'Nuova prenotazione'); fab.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'; fab.onclick = function () { openForm(S.day); }; root.appendChild(fab); }
  }
  function phWrap() {
    var pb = el('div', 'cp-pbody' + (S.swDir ? ' in' + S.swDir : '')); S.swDir = '';
    Array.prototype.slice.call(root.children).forEach(function (c) { if (c.classList.contains('cp-sum') || c.classList.contains('cp-list')) pb.appendChild(c); });
    root.appendChild(pb); swipe(pb);
  }
  function swipe(box) { // il contenuto segue il dito; oltre la soglia cambia giorno
    var x0 = 0, y0 = 0, dx = 0, on = false, lock = '';
    var body = function () { return root.querySelector('.cp-pbody'); };
    box.addEventListener('touchstart', function (e) { if (e.touches.length !== 1 || S.sel || S.form) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; on = true; lock = ''; }, { passive: true });
    box.addEventListener('touchmove', function (e) {
      if (!on) return; var t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
      if (!lock) { if (Math.abs(mx) > 8 || Math.abs(my) > 8) lock = Math.abs(mx) > Math.abs(my) * 1.3 ? 'h' : 'v'; }
      if (lock !== 'h') return; dx = mx; var b = body(); if (b) { b.style.transition = 'none'; b.style.transform = 'translateX(' + Math.max(-140, Math.min(140, dx * .8)) + 'px)'; b.style.opacity = String(1 - Math.min(.5, Math.abs(dx) / 500)); }
    }, { passive: true });
    function end() {
      if (!on) return; on = false; var b = body();
      if (lock === 'h' && Math.abs(dx) > 70) { var dir = dx < 0 ? 1 : -1; S.swDir = dir > 0 ? 'R' : 'L'; if (b) { b.style.transition = 'transform .14s ease-out,opacity .14s'; b.style.transform = 'translateX(' + (dir > 0 ? -60 : 60) + 'px)'; b.style.opacity = '0'; } setTimeout(function () { goDay(dir); }, 120); }
      else if (b) { b.style.transition = 'transform .18s ease-out,opacity .18s'; b.style.transform = ''; b.style.opacity = ''; }
    }
    box.addEventListener('touchend', end, { passive: true }); box.addEventListener('touchcancel', end, { passive: true });
  }
  function goWeek(n) { S.strip = addDays(S.strip, 7 * n); S.day = addDays(S.day, 7 * n); S.sel = null; S.form = null; S.askCancel = false; load(); }
  function goDay(n) {
    var nd = addDays(S.day, n); S.sel = null; S.form = null; S.askCancel = false;
    var lo = isPh() ? addDays(S.strip, -14) : S.strip, hi = addDays(S.strip, isPh() ? 20 : 6);
    S.stripKeep = false;
    if (nd < lo || nd > hi) { S.strip = monday(nd); S.day = nd; load(); } else { S.day = nd; draw(); }
  }
  function shift(n) { S.strip = addDays(S.strip, n); S.day = S.strip; S.sel = null; S.form = null; S.askCancel = false; load(); }

  function weekLabel() {
    var a = parse(S.strip), b = parse(addDays(S.strip, 6));
    return a.getUTCMonth() === b.getUTCMonth() ? a.getUTCDate() + ' – ' + b.getUTCDate() + ' ' + MO[b.getUTCMonth()] : a.getUTCDate() + ' ' + MO[a.getUTCMonth()] + ' – ' + b.getUTCDate() + ' ' + MO[b.getUTCMonth()];
  }
  function boardAll(now) { // tutti i campi: un'ora per riga, le prenotazioni della stessa ora una sotto l'altra
    var D = S.data, days = [], lo = 24, hi = 0;
    for (var i = 0; i < 7; i++) days.push(addDays(S.strip, i));
    D.courts.forEach(function (c) { days.forEach(function (d) { slotsOf(c, d).forEach(function (sl) { lo = Math.min(lo, Math.floor(sl.s / 60)); hi = Math.max(hi, Math.ceil(sl.e / 60)); }); }); });
    days.forEach(function (d) { bookingsOn(d).forEach(function (b) { lo = Math.min(lo, Math.floor(mins(b.start) / 60)); hi = Math.max(hi, Math.ceil(mins(b.end) / 60)); }); });
    var wrap = el('div', 'cp-board wk all');
    if (hi <= lo) { wrap.appendChild(el('div', 'cp-load', 'Il centro sportivo è chiuso in questa settimana.')); return wrap; }
    var g = el('div', 'cp-ga'); g.appendChild(el('div'));
    days.forEach(function (d) {
      var n = bookingsOn(d).length, h = el('button', 'cp-wh' + (d === now.date ? ' tod' : '')); h.type = 'button';
      h.setAttribute('aria-label', longDay(d) + ', ' + n + ' prenotazioni. Apri il giorno');
      h.appendChild(el('span', null, DN[parse(d).getUTCDay()])); h.appendChild(el('b', null, String(parse(d).getUTCDate()))); h.appendChild(el('i', null, n ? String(n) : ' '));
      h.onclick = function () { S.day = d; S.view = 'day'; try { localStorage.setItem('cpView', 'day'); } catch (e) {} S.sel = null; S.form = null; draw(); };
      g.appendChild(h);
    });
    for (var hr = lo; hr < hi; hr++) {
      var cells = days.map(function (d) { return bookingsOn(d).filter(function (b) { return Math.floor(mins(b.start) / 60) === hr; }).sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : (a.court_id < b.court_id ? -1 : 1); }); });
      var mx = 1; cells.forEach(function (x) { mx = Math.max(mx, x.length); });
      var lab = el('div', 'cp-ah', pad(hr) + ':00'); lab.style.minHeight = (mx * 31 + 8) + 'px'; g.appendChild(lab);
      cells.forEach(function (list, di) {
        var cell = el('div', 'cp-ac' + (days[di] === now.date && hr === Math.floor(now.min / 60) ? ' now' : ''));
        list.forEach(function (b) {
          var c = courtOf(b.court_id) || { name: 'Campo' }, ch = el('button', 'cp-chip' + ((b.players || 0) >= 4 ? ' p4' : ' p2') + (S.sel === b.id ? ' on' : '')); ch.type = 'button';
          ch.style.setProperty('--cc', courtColor(c));
          ch.setAttribute('aria-label', c.name + ' ' + b.start + '-' + b.end + ', ' + (b.last_name || '') + ' ' + (b.first_name || ''));
          var m = mins(b.start) % 60;
          ch.appendChild(el('b', null, b.last_name || b.first_name || '—'));
          if (m) ch.appendChild(el('u', null, ':' + pad(m)));
          ch.appendChild(el('em', null, c.name.replace(/^Campo\s*/i, 'C')));
          ch.onclick = function () { S.sel = b.id; S.form = null; S.askCancel = false; draw(); scrollDet(); };
          cell.appendChild(ch);
        });
        g.appendChild(cell);
      });
    }
    wrap.appendChild(g); return wrap;
  }
  function board(bs, now) { // settimana: giorni in alto, ore a sinistra, prenotazioni di tutti i campi
    var D = S.data, lo = 24 * 60, hi = 0, days = [], CC = S.court ? [courtOf(S.court)] : D.courts;
    for (var i = 0; i < 7; i++) days.push(addDays(S.strip, i));
    CC.forEach(function (c) { days.forEach(function (d) { slotsOf(c, d).forEach(function (s) { lo = Math.min(lo, s.s); hi = Math.max(hi, s.e); }); }); });
    var wrap = el('div', 'cp-board wk');
    if (hi <= lo) { wrap.appendChild(el('div', 'cp-load', 'Il centro sportivo è chiuso in questa settimana.')); return wrap; }
    lo = Math.floor(lo / 60) * 60; hi = Math.ceil(hi / 60) * 60;
    var H = (hi - lo) * PPM, g = el('div', 'cp-g');
    g.style.gridTemplateColumns = '44px repeat(7,minmax(' + (S.court ? 112 : 250) + 'px,1fr))';
    g.appendChild(el('div'));
    days.forEach(function (d) {
      var n = bookingsOn(d).filter(function (b) { return !S.court || b.court_id === S.court; }).length, h = el('button', 'cp-wh' + (d === now.date ? ' tod' : '')); h.type = 'button';
      h.setAttribute('aria-label', longDay(d) + ', ' + n + ' prenotazioni. Apri il giorno');
      h.appendChild(el('span', null, DN[parse(d).getUTCDay()])); h.appendChild(el('b', null, String(parse(d).getUTCDate()))); h.appendChild(el('i', null, n ? String(n) : ' '));
      h.onclick = function () { S.day = d; S.view = 'day'; try { localStorage.setItem('cpView', 'day'); } catch (e) {} S.sel = null; S.form = null; draw(); };
      g.appendChild(h);
    });
    var hr = el('div', 'cp-hrs'); hr.style.height = H + 'px';
    for (var m = lo; m <= hi; m += 60) { var l = el('em', m === lo ? 'first' : '', hhmm(m)); l.style.top = ((m - lo) * PPM) + 'px'; if (m === hi) l.style.display = 'none'; hr.appendChild(l); }
    g.appendChild(hr);
    days.forEach(function (d) {
      var col = el('div', 'cp-col'); col.style.height = H + 'px';
      CC.forEach(function (c) {
        ((c.hours && c.hours[String(wd(d))]) || []).forEach(function (h) {
          var o = el('div', 'cp-open'); o.style.top = ((mins(h[0]) - lo) * PPM) + 'px'; o.style.height = ((mins(h[1]) - mins(h[0])) * PPM) + 'px'; col.appendChild(o);
        });
      });
      for (var m2 = lo + 60; m2 < hi; m2 += 60) { var ln = el('div', 'cp-ln'); ln.style.top = ((m2 - lo) * PPM) + 'px'; col.appendChild(ln); }
      ((D.closures || []).filter(function (x) { return !x.court_id && d >= x.starts_on && d <= x.ends_on; })).forEach(function (x) {
        var a = Math.max(lo, x.from ? mins(x.from) : lo), z = Math.min(hi, x.to ? mins(x.to) : hi); if (z <= a) return;
        var cl = el('div', 'cp-closed', x.reason || 'Chiuso'); cl.style.top = ((a - lo) * PPM + 2) + 'px'; cl.style.height = ((z - a) * PPM - 4) + 'px'; cl.setAttribute('role', 'note'); col.appendChild(cl);
      });
      var items = bookingsOn(d).filter(function (b) { return !S.court || b.court_id === S.court; }).map(function (b) { return { b: b, s: mins(b.start), e: mins(b.end), lane: 0, n: 1 }; }).sort(function (a, b) { return a.s - b.s || a.e - b.e; });
      var cluster = [], cEnd = 0;
      function flush() { var n = 0; cluster.forEach(function (x) { n = Math.max(n, x.lane + 1); }); cluster.forEach(function (x) { x.n = n; }); cluster = []; }
      items.forEach(function (it) {
        if (cluster.length && it.s >= cEnd) flush();
        var used = cluster.filter(function (x) { return x.e > it.s; }).map(function (x) { return x.lane; }), ln2 = 0;
        while (used.indexOf(ln2) >= 0) ln2++;
        it.lane = ln2; cluster.push(it); cEnd = cluster.length === 1 ? it.e : Math.max(cEnd, it.e);
      });
      flush();
      items.forEach(function (it) {
        var b = it.b, c = courtOf(b.court_id) || { name: 'Campo' };
        var x = el('button', 'cp-b wk' + (it.n >= 3 ? ' mini' : '') + ((b.players || 0) >= 4 ? ' p4' : ' p2') + (S.sel === b.id ? ' on' : '')); x.type = 'button';
        x.style.top = ((it.s - lo) * PPM + 2) + 'px'; x.style.height = ((it.e - it.s) * PPM - 4) + 'px';
        x.style.left = 'calc(' + (it.lane * 100 / it.n) + '% + 2px)'; x.style.width = 'calc(' + (100 / it.n) + '% - 4px)'; x.style.right = 'auto';
        if ((it.e - it.s) * PPM < 46) x.classList.add('tight');
        x.setAttribute('aria-label', c.name + ' ' + b.start + '-' + b.end + ', ' + (b.last_name || '') + ' ' + (b.first_name || ''));
        x.style.setProperty('--cc', courtColor(c));
        var short = c.name.replace(/^Campo\s*/i, 'C'), t = el('span', 'cp-bt');
        t.appendChild(el('b', null, b.last_name || b.first_name || '—'));
        var l1 = el('small', 'l1');
        if (S.court) l1.textContent = b.start + '–' + b.end; else { l1.appendChild(el('em', null, short)); l1.appendChild(document.createTextNode(' · ' + b.start)); }
        t.appendChild(l1);
        var info = [b.players ? b.players + ' gioc.' : '', b.members == null ? '' : (b.members === 0 ? '0 soci' : soc(b.members))].filter(Boolean).join(' · ');
        if (info) t.appendChild(el('small', 'l2', info));
        x.appendChild(t);
        x.onclick = function () { S.sel = b.id; S.form = null; S.askCancel = false; draw(); scrollDet(); };
        col.appendChild(x);
      });
      if (d === now.date && now.min > lo && now.min < hi) { var nl = el('div', 'cp-nowl'); nl.style.top = ((now.min - lo) * PPM) + 'px'; col.appendChild(nl); }
      g.appendChild(col);
    });
    wrap.appendChild(g); return wrap;
  }

  function closeDet() {
    var d = root.querySelector('.cp-det'), go = function () { S.sel = null; S.form = null; S.askCancel = false; draw(); };
    if (!d) return go();
    d.classList.remove('enter'); d.classList.add('leave'); setTimeout(go, 170);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && (S.sel || S.form) && !document.querySelector('.cps-back')) closeDet(); });
  function scrollDet() { setTimeout(function () { var d = root.querySelector('.cp-det'); if (d && d.scrollIntoView) d.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 30); }
  // dalla campanella: la prenotazione toccata si evidenzia con l'effetto "pulsa" (solo dopo il tocco su una notifica), come nelle altre attivita'
  function fxOn() { var h = S.hl; return !!(h && Date.now() < h.exp && (!h.first || Date.now() - h.first < 4600)); }
  function fxHit(b) {
    if (!fxOn()) return false;
    var h = S.hl, nm = [b.first_name, b.last_name].filter(Boolean).join(' ').trim().toLowerCase(), c = courtOf(b.court_id);
    if (Math.abs(new Date(b.starts_at).getTime() - new Date(h.start).getTime()) >= 60000) return false;
    if (h.name && nm !== h.name) return false;
    return !(h.svc && c && String(c.name || '').trim().toLowerCase() !== h.svc);
  }
  function fxMark(node, b) {
    if (!fxHit(b)) return;
    var h = S.hl; if (!h.first) h.first = Date.now();
    node.classList.add('cp-fx'); if (h.bad) node.classList.add('bad');
    node.style.setProperty('--fx-d', (-(Date.now() - h.first)) + 'ms');
    root.classList.add('fxOn'); clearTimeout(S.fxT);
    S.fxT = setTimeout(function () { root.classList.remove('fxOn'); }, Math.max(100, 4600 - (Date.now() - h.first)));
    if (!h.scrolled) { h.scrolled = true; setTimeout(function () { try { node.scrollIntoView({ block: 'center', behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } catch (e) { } }, 160); }
  }
  function openFromBell(iso) { // la campanella chiama liaOpenDate: qui porta al giorno della prenotazione
    var tz = (S.data && S.data.timezone) || 'Europe/Rome', d;
    try { d = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso)); } catch (e) { return; }
    var fe = window.liaFocusEv || {};
    S.hl = { start: iso, name: String(fe.name || '').trim().toLowerCase(), svc: String(fe.svc || '').trim().toLowerCase(), bad: !!fe.bad, exp: Date.now() + 9000, first: 0, scrolled: false };
    var vd = document.getElementById('view-day'); if (vd && phWeek()) vd.click();
    S.view = 'day'; S.day = d; S.sel = null; S.form = null; S.askCancel = false; S.stripKeep = false;
    if (S.data && S.strip && d >= S.strip && d <= addDays(S.strip, 6)) draw();
    else { S.strip = monday(d); S.data = null; load(); }
  }
  window.liaOpenDate = openFromBell;
  document.addEventListener('lia:section', function () { window.liaOpenDate = openFromBell; });
  window.addEventListener('load', function () { window.liaOpenDate = openFromBell; });

  function dayList(bs, now) {
    var wrap = el('div', 'cp-list');
    var list = bs.slice().sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
    if (!list.length) {
      wrap.appendChild(el('div', 'cp-load', S.day < now.date ? 'Nessuna prenotazione in questo giorno.' : 'Nessuna prenotazione per ora in questo giorno.'));
    }
    var isToday = S.day === now.date;
    var pastL = isToday ? list.filter(function (b) { return mins(b.end) <= now.min; }) : [];
    var focus = isToday ? (list.filter(function (b) { return mins(b.start) <= now.min && now.min < mins(b.end); })[0] || list.filter(function (b) { return mins(b.start) > now.min; })[0]) : null;
    // oggi: prima la prenotazione in corso / la prossima e le successive, poi quelle finite (piu' scure) in fondo
    if (isToday) list = list.filter(function (b) { return pastL.indexOf(b) < 0; }).concat(pastL);
    list.forEach(function (b) {
      var c = courtOf(b.court_id) || { name: 'Campo' };
      var past = S.day < now.date || (S.day === now.date && mins(b.end) <= now.min), cur = S.day === now.date && mins(b.start) <= now.min && now.min < mins(b.end);
      var r = el('button', 'cp-li' + ((b.players || 0) >= 4 ? ' p4' : ' p2') + (S.sel === b.id ? ' on' : '') + (past ? ' past' : '') + (cur ? ' cur' : '') + (focus === b ? ' hl' : '')); r.type = 'button'; r.style.setProperty('--cc', courtColor(c)); fxMark(r, b);
      r.setAttribute('aria-expanded', S.sel === b.id ? 'true' : 'false');
      var t = el('span', 'cp-lt'); t.appendChild(el('b', null, b.start)); t.appendChild(el('small', null, 'fino alle ' + b.end)); r.appendChild(t);
      r.appendChild(courtSvg(c, b.players || 0, b.members, 'li'));
      var m = el('span', 'cp-lm'); m.appendChild(el('b', null, [b.first_name, b.last_name].filter(Boolean).join(' ') || '—'));
      var sub = [c.name, b.players ? b.players + ' giocatori' : '', b.members == null ? '' : (b.members === 0 ? 'nessun socio' : soc(b.members))].filter(Boolean).join(' · ');
      m.appendChild(el('small', null, sub)); r.appendChild(m);
      if (cur) r.appendChild(el('span', 'cp-live', 'In corso')); else if (focus === b) r.appendChild(el('span', 'cp-live nx', 'Prossima'));
      r.onclick = function () { S.sel = S.sel === b.id ? null : b.id; S.form = null; S.askCancel = false; draw(); if (S.sel) scrollDet(); };
      wrap.appendChild(r);
      if (S.sel === b.id) wrap.appendChild(detail(bs));
    });
    if (S.form) wrap.insertBefore(detail(bs), wrap.firstChild);
    return wrap;
  }
  function courtOf(id) { return S.data.courts.filter(function (c) { return c.id === id; })[0]; }
  function detail(bs) {
    var d = el('div', 'cp-det' + (S.animIn ? ' enter' : '')); d.setAttribute('aria-live', 'polite');
    var xb = el('button', 'cp-x'); xb.type = 'button'; xb.setAttribute('aria-label', 'Chiudi'); xb.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'; xb.onclick = closeDet; d.appendChild(xb);
    if (S.form) return formView(d);
    var b = (S.data.bookings || []).filter(function (x) { return x.id === S.sel; })[0];
    if (!b) { d.appendChild(el('p', null, 'Tocca una prenotazione per vedere chi l\'ha fatta, oppure un riquadro libero (+) per inserirne una a mano.')); return d; }
    var c = courtOf(b.court_id) || { name: 'Campo' };
    d.style.setProperty('--cc', courtColor(c));
    var hd = el('div', 'cp-dh'); hd.appendChild(courtSvg(c, b.players || 0, b.members, 'det'));
    var ht = el('div', 'cp-dt'); ht.appendChild(el('h3', null, [b.first_name, b.last_name].filter(Boolean).join(' ') || 'Prenotazione'));
    ht.appendChild(el('p', null, c.name + ' · ' + b.start + '–' + b.end)); if (b.date) ht.appendChild(el('p', 'cp-dd', longDay(b.date))); hd.appendChild(ht); d.appendChild(hd);
    var tl = el('div', 'cp-tiles');
    function tile2(l, v) { var t = el('div', 'cp-tile'); t.appendChild(el('span', null, l)); t.appendChild(el('b', null, v)); tl.appendChild(t); }
    if (!isSimple()) {
      tile2('Giocatori', b.players != null ? String(b.players) : '—');
      tile2('Soci', b.members != null ? String(b.members) : '—');
      tile2('Non soci', b.players != null && b.members != null ? String(Math.max(0, b.players - b.members)) : '—');
      d.appendChild(tl);
    }
    var kv = el('div', 'cp-kv');
    function row2(l, v, cls) { var r0 = el('div'); r0.appendChild(el('span', null, l)); var x = typeof v === 'string' ? el('b', cls || null, v) : v; r0.appendChild(x); kv.appendChild(r0); }
    if (b.price_eur != null) row2('Incasso', b.price_eur === 0 ? 'Gratis' : eur(b.price_eur));
    row2('Prenotata', b.channel === 'manual' ? 'Inserita a mano' : b.channel === 'chat' ? 'Tramite Lia' : 'Dal sito');
    if (b.phone) { var a = el('a', null, b.phone); a.href = 'tel:' + b.phone.replace(/[^+\d]/g, ''); row2('Telefono', a); }
    if (b.email) { var ea = el('a', 'cp-em', b.email); ea.href = 'mailto:' + b.email; row2('Email', ea); }
    d.appendChild(kv);
    var r = el('div', 'cp-row');
    var act = el('div', 'cp-row');
    if (!S.askCancel) {
      var cb = el('button', 'cp-btn bad', 'Annulla prenotazione'); cb.type = 'button'; cb.onclick = function () { S.askCancel = true; draw(); }; act.appendChild(cb);
    } else {
      act.appendChild(el('p', null, 'Vuoi annullare questa prenotazione? Il campo tornerà libero.'));
      var y = el('button', 'cp-btn bad', S.busy ? 'Annullo…' : 'Sì, annulla'); y.type = 'button'; y.disabled = S.busy; y.onclick = function () { doCancel(b.id); };
      var n = el('button', 'cp-btn', 'No, tienila'); n.type = 'button'; n.onclick = function () { S.askCancel = false; draw(); };
      act.appendChild(y); act.appendChild(n);
    }
    d.appendChild(act); return d;
  }
  function doCancel(id) {
    if (S.busy) return; S.busy = true; draw();
    call({ action: 'cancel', id: id }).then(function () { S.busy = false; S.sel = null; S.askCancel = false; toast('Prenotazione annullata'); S.data = null; load(); })
      .catch(function (e) { S.busy = false; toast(e.message, true); draw(); });
  }

  function formView(d) {
    var F = S.form, c = courtOf(F.court_id), D = S.data, now0 = nowIn();
    d.style.setProperty('--cc', courtColor(c));
    d.classList.add('cp-fv');
    var ORDER = ['court', 'day', 'time', 'dur', 'pl', 'who'];
    function go(n) { if (n === 'pl' && isSimple()) n = 'who'; F.hist.push(F.step); F.step = n; F.msg = ''; draw(); }
    function back() { F.step = F.hist.pop() || 'court'; F.msg = ''; draw(); }
    function busyAt(x, cc) { return bookingsOn(F.date).some(function (b) { return b.court_id === cc.id && mins(b.start) < x.e && mins(b.end) > x.s; }); }
    function freeSlots(cc, date) { return slotsOf(cc, date).filter(function (x) { return !closedAt(cc, date, x.s, x.e) && !busyAt(x, cc) && !(date < now0.date || (date === now0.date && x.e <= now0.min)); }); }
    function maxHours() { var m = 1; for (var k = 2; k <= 4; k++) { var e = mins(F.time) + k * c.slot_min; if (maxEnd(c) >= e && !busyAt({ s: mins(F.time) + (k - 1) * c.slot_min, e: e }, c)) m = k; else break; } return m; }
    function label(h) { var m = h * c.slot_min; return m >= 60 ? (m / 60).toString().replace('.', ',') + (m === 60 ? ' ora' : ' ore') : m + ' min'; }
    // testata: indietro, titolo, riepilogo, avanzamento
    var hd = el('div', 'cp-fh');
    if (F.hist.length) { var bk = el('button', 'cp-back'); bk.type = 'button'; bk.setAttribute('aria-label', 'Indietro'); bk.innerHTML = SVG_L; bk.onclick = back; hd.appendChild(bk); }
    else hd.appendChild(courtSvg(c, 0, 0, 'li'));
    var ht = el('div', 'cp-fht'); ht.appendChild(el('h3', null, 'Nuova prenotazione'));
    var rec = [];
    if (ORDER.indexOf(F.step) > 0) rec.push(c.name);
    if (ORDER.indexOf(F.step) > 1) rec.push(longDay(F.date));
    if (ORDER.indexOf(F.step) > 2 && F.time) rec.push(F.time + (F.hours > 1 ? '–' + hhmm(mins(F.time) + F.hours * c.slot_min) : ''));
    ht.appendChild(el('p', null, rec.length ? rec.join(' · ') : 'Pochi passaggi e hai finito.')); hd.appendChild(ht); d.appendChild(hd);
    var dots = el('div', 'cp-dots'); ORDER.forEach(function (k, n) { dots.appendChild(el('i', ORDER.indexOf(F.step) >= n ? 'on' : '')); }); d.appendChild(dots);
    var f = el('div', 'cp-form cp-wz');
    function q(t, sub) { f.appendChild(el('h4', 'cp-q', t)); if (sub) f.appendChild(el('p', 'cp-qs', sub)); }
    if (F.step === 'court') {
      q('Che campo?');
      var ls = el('div', 'cp-opts');
      D.courts.forEach(function (x) {
        var b = el('button', 'cp-opt' + (x.id === F.court_id && F.hist.length ? ' on' : '')); b.type = 'button'; b.appendChild(courtSvg(x, 0, 0, 'li'));
        var tx = el('span'); tx.appendChild(el('b', null, x.name)); tx.appendChild(el('small', null, [x.surface, x.indoor ? 'coperto' : ''].filter(Boolean).join(' · '))); b.appendChild(tx);
        b.onclick = function () { F.court_id = x.id; F.time = ''; F.hours = 1; F.ym = F.date.slice(0, 7); go('day'); }; ls.appendChild(b);
      });
      f.appendChild(ls);
    } else if (F.step === 'day') {
      q('Che giorno?', c.name);
      if (!F.ym) F.ym = F.date.slice(0, 7);
      F.mon = F.mon || {};
      var ym = F.ym;
      if (!F.mon[ym]) { F.mon[ym] = 'loading'; loadMonth(ym, function () { F.mon[ym] = 'ok'; if (S.form === F && F.step === 'day') draw(); }); }
      var y0 = +ym.slice(0, 4), m0 = +ym.slice(5, 7), nd = new Date(Date.UTC(y0, m0, 0)).getUTCDate(), off0 = (new Date(Date.UTC(y0, m0 - 1, 1)).getUTCDay() + 6) % 7;
      var cal = el('div', 'cp-mc'), mh = el('div', 'cp-mh');
      var pv = el('button', null, '‹'); pv.type = 'button'; pv.setAttribute('aria-label', 'Mese prima'); pv.disabled = ym <= D.today.slice(0, 7);
      var nxm = el('button', null, '›'); nxm.type = 'button'; nxm.setAttribute('aria-label', 'Mese dopo');
      pv.onclick = function () { F.ym = new Date(Date.UTC(y0, m0 - 2, 1)).toISOString().slice(0, 7); draw(); };
      nxm.onclick = function () { F.ym = new Date(Date.UTC(y0, m0, 1)).toISOString().slice(0, 7); draw(); };
      mh.appendChild(pv); mh.appendChild(el('b', null, MO[m0 - 1].charAt(0).toUpperCase() + MO[m0 - 1].slice(1) + ' ' + y0)); mh.appendChild(nxm); cal.appendChild(mh);
      var gr = el('div', 'cp-mg'); ['L', 'M', 'M', 'G', 'V', 'S', 'D'].forEach(function (l) { gr.appendChild(el('span', 'cp-mw', l)); });
      for (var i0 = 0; i0 < off0; i0++) gr.appendChild(el('span', 'cp-md pad'));
      for (var dn = 1; dn <= nd; dn++) (function (dn) {
        var dt = ym + '-' + (dn < 10 ? '0' : '') + dn, past = dt < D.today;
        var all = slotsOf(c, dt).filter(function (x) { return !closedAt(c, dt, x.s, x.e); }), fr = past ? [] : freeSlots(c, dt);
        var st = F.mon[ym] !== 'ok' ? '' : past || !all.length ? ' off' : fr.length ? ' ok' : ' full';
        var bt = el('button', 'cp-md' + st + (dt === D.today ? ' today' : '') + (dt === F.date ? ' on' : ''), String(dn)); bt.type = 'button';
        bt.disabled = F.mon[ym] === 'ok' && (past || !fr.length);
        bt.setAttribute('aria-label', longDay(dt) + (st === ' ok' ? ', con orari liberi' : st === ' full' ? ', completo' : ''));
        bt.onclick = function () { F.date = dt; F.time = ''; go('time'); };
        gr.appendChild(bt);
      })(dn);
      cal.appendChild(gr);
      var lg2 = el('div', 'cp-ml'); lg2.appendChild(el('span', null, 'Il pallino segna i giorni con orari liberi')); cal.appendChild(lg2);
      f.appendChild(cal);
    } else if (F.step === 'time') {
      q('A che ora?', c.name + ' · ' + longDay(F.date));
      var fr = freeSlots(c, F.date), tc = el('div', 'cp-chips');
      if (!fr.length) tc.appendChild(el('p', 'cp-none', 'Nessun orario libero. Torna indietro per cambiare giorno o campo.'));
      fr.forEach(function (x) { var t = hhmm(x.s), b = el('button', F.time === t ? 'on' : '', t); b.type = 'button'; b.onclick = function () { F.time = t; F.hours = 1; if (maxHours() > 1) go('dur'); else go('pl'); }; tc.appendChild(b); });
      f.appendChild(tc);
    } else if (F.step === 'dur') {
      q('Per quanto?');
      var du = el('div', 'cp-chips'), mh = maxHours();
      for (var h = 1; h <= mh; h++) (function (h) { var b = el('button', F.hours === h ? 'on' : '', label(h)); b.type = 'button'; b.onclick = function () { F.hours = h; go('pl'); }; du.appendChild(b); })(h);
      f.appendChild(du);
    } else if (F.step === 'pl') {
      q('Quanti giocano?', F.hours > 1 ? c.name + ' · ' + label(F.hours) : c.name);
      var sp = (D.club && D.club.sport) || 'tennis', two = sp === 'tennis' || sp === 'padel';
      if (two) { var pc = el('div', 'cp-chips'); [['2', 'Singolo · 2'], ['4', 'Doppio · 4']].forEach(function (x) { var b = el('button', F.players === x[0] ? 'on' : '', x[1]); b.type = 'button'; b.onclick = function () { F.players = x[0]; if (+F.members > +x[0]) F.members = x[0]; draw(); }; pc.appendChild(b); }); f.appendChild(pc); }
      var stepper = function (label, key, min, max) {
        var w = el('div', 'cp-st'); w.appendChild(el('span', 'cp-stl', label));
        var bx = el('div', 'cp-stb'), mi = el('button', null, '−'), v = el('b', null, String(F[key] === '' ? 0 : F[key])), pp = el('button', null, '+');
        mi.type = 'button'; pp.type = 'button'; mi.setAttribute('aria-label', 'Meno ' + label.toLowerCase()); pp.setAttribute('aria-label', 'Più ' + label.toLowerCase());
        function set(n) { n = Math.max(min, Math.min(max, n)); F[key] = String(n); if (key === 'players' && +F.members > n) F.members = String(n); draw(); }
        mi.onclick = function () { set((+F[key] || 0) - 1); }; pp.onclick = function () { set((+F[key] || 0) + 1); };
        bx.appendChild(mi); bx.appendChild(v); bx.appendChild(pp); w.appendChild(bx); return w;
      };
      var gp = el('div', 'cp-f2 st'); if (!two) gp.appendChild(stepper('Giocatori', 'players', 1, 22)); gp.appendChild(stepper('Di cui soci', 'members', 0, +F.players || 22)); f.appendChild(gp);
      var nx2 = el('button', 'cp-btn pri', 'Avanti'); nx2.type = 'button'; nx2.onclick = function () { go('who'); };
      var rw3 = el('div', 'cp-row cp-frow'); rw3.appendChild(nx2); f.appendChild(rw3);
    } else {
      q('Chi prenota?', isSimple() ? (F.hours > 1 ? c.name + ' · ' + label(F.hours) : c.name) : (F.players || '?') + (+F.players === 1 ? ' giocatore' : ' giocatori') + ' · ' + (F.members || 0) + (+F.members === 1 ? ' socio' : ' soci'));
      var sv = el('button', 'cp-btn pri', S.busy ? 'Salvo…' : 'Salva prenotazione'); sv.type = 'button';
      function ready() { return !!(F.first_name.trim() && F.last_name.trim() && F.phone.trim()); }
      function upd() { sv.disabled = S.busy || !ready(); }
      function inp(label, key, type, extra) {
        var l = el('label', null, label), i = el('input'); i.type = type || 'text'; i.value = F[key]; if (extra) for (var k in extra) i.setAttribute(k, extra[k]);
        i.setAttribute('data-k', key); i.oninput = function () { F[key] = i.value; upd(); }; l.appendChild(i); return l;
      }
      var r1 = el('div', 'cp-f2'); r1.appendChild(inp('Nome', 'first_name', 'text', { autocomplete: 'off', maxlength: 60 })); r1.appendChild(inp('Cognome', 'last_name', 'text', { autocomplete: 'off', maxlength: 60 })); f.appendChild(r1);
      f.appendChild(inp('Telefono', 'phone', 'tel', { inputmode: 'tel', maxlength: 30 }));
      f.appendChild(inp('Email (facoltativa: se la scrivi, il cliente riceve la conferma)', 'email', 'email', { inputmode: 'email', autocomplete: 'off', maxlength: 120 }));
      if (F.msg) { var m = el('div', 'cp-msg', F.msg); m.setAttribute('role', 'alert'); f.appendChild(m); }
      sv.onclick = save; upd();
      var rw2 = el('div', 'cp-row cp-frow'); rw2.appendChild(sv); f.appendChild(rw2);
    }
    d.appendChild(f); return d;
  }
  function firstTime(c, d) { var sl = slotsOf(c, d).filter(function (x) { return !closedAt(c, d, x.s, x.e); }); var fr = sl.filter(function (x) { return !bookingsOn(d).some(function (b) { return b.court_id === c.id && mins(b.start) < x.e && mins(b.end) > x.s; }); }); return fr.length ? hhmm(fr[0].s) : sl.length ? hhmm(sl[0].s) : ''; }
  function openForm(date, courtId, time) {
    var D = S.data, c = courtOf(courtId || D.courts[0].id), d = date || S.day; S.sel = null; S.askCancel = false;
    S.form = { step: time ? (isSimple() ? 'who' : 'pl') : courtId ? 'time' : 'court', hist: time ? ['court', 'day', 'time'] : courtId ? ['court', 'day'] : [], court_id: c.id, date: d, time: time || '', hours: 1, first_name: '', last_name: '', phone: '', email: '', players: defPlayers(c), members: isSimple() ? '' : '0', notes: '', msg: '', ym: d.slice(0, 7), mon: {} };
    draw(); focusForm();
  }
  function defPlayers(c) { if (isSimple()) return ''; var sp = (S.data.club && S.data.club.sport) || 'tennis'; if (sp === 'tennis' || sp === 'padel') return '2'; var m = /\b(?:a|da)\s?(5|7|11)\b/i.exec(String(c.name || '')); return m ? String(m[1] * 2) : '2'; }
  function loadMonth(ym, done) { // i giorni del mese si leggono a parte: il calendario mostra subito quali hanno posto
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7), n = new Date(Date.UTC(y, m, 0)).getUTCDate();
    fetch(URL0 + '&from=' + ym + '-01&days=' + n).then(function (r) { return r.json(); }).then(function (j) {
      var D = S.data; if (!D) return;
      (j.bookings || []).forEach(function (b) { if (!(D.bookings || []).some(function (x) { return x.id === b.id; })) D.bookings.push(b); });
      D.closures = D.closures || []; (j.closures || []).forEach(function (c) { if (!D.closures.some(function (x) { return x.id === c.id; })) D.closures.push(c); });
      done();
    }).catch(function () { done(); });
  }
  function maxEnd(c) { var m = 0; ((c.hours && c.hours[String(wd(S.form.date))]) || []).forEach(function (h) { if (mins(h[0]) <= mins(S.form.time) && mins(h[1]) > mins(S.form.time)) m = mins(h[1]); }); return m; }
  function focusForm() { setTimeout(function () { var i = root.querySelector('.cp-form input[data-k]'); if (i) { try { i.focus({ preventScroll: true }); } catch (e) { i.focus(); } } }, 30); }
  function save() {
    var F = S.form; if (S.busy) return;
    if (!F.time) { F.msg = 'Scegli un orario.'; draw(); return; }
    if (!F.first_name.trim() || !F.last_name.trim()) { F.msg = 'Scrivi nome e cognome.'; draw(); return; }
    if (!F.phone.trim()) { F.msg = 'Scrivi il telefono.'; draw(); return; }
    if (F.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(F.email.trim())) { F.msg = 'L\'email non sembra valida: correggila o lasciala vuota.'; draw(); return; }
    var p = F.players === '' ? null : +F.players, mm = F.members === '' ? null : +F.members;
    if (p !== null && mm !== null && mm > p) { F.msg = 'I soci non possono essere più dei giocatori.'; draw(); return; }
    F.msg = ''; S.busy = true; draw();
    call({ action: 'create', court_id: F.court_id, date: F.date, time: F.time, hours: F.hours, first_name: F.first_name, last_name: F.last_name, phone: F.phone, email: F.email, players: p, members: mm })
      .then(function (j) { S.busy = false; var fd = F.date; S.form = null; S.sel = j.booking && j.booking.id; S.day = fd; if (fd < S.strip || fd > addDays(S.strip, 6)) S.strip = monday(fd); toast(j.email_sent ? 'Prenotazione salvata, email di conferma inviata' : 'Prenotazione salvata'); S.data = null; load(); })
      .catch(function (e) { S.busy = false; F.msg = e.message; draw(); });
  }

  window.__cpOpen = function (id, iso) { // dal registro: apre quella prenotazione nel calendario
    var tz = (S.data && S.data.timezone) || 'Europe/Rome', d;
    try { d = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(iso)); } catch (e) { return; }
    S.view = 'day'; S.day = d; S.strip = monday(d); S.sel = id; S.form = null; S.askCancel = false; S.data = null; load();
    setTimeout(scrollDet, 700);
  };
  window.__cpReload = function () { S.data = null; S.strip = S.strip || null; load(); };
  load();
})();
