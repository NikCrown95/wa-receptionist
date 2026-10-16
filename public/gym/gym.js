/* Modalità palestra della dashboard di Lia.
   Si carica solo per le attività di tipo "palestra": cambia le voci del menu, sostituisce Calendario, Clienti e Statistiche
   con Lezioni, Iscritti e Statistiche della palestra, e aggiunge in Impostazioni corsi, abbonamenti e chiusure.
   I dati arrivano da /api/palestra?t=CODICE (stesso codice segreto dell'agenda). */
(function () {
  var token = (new URLSearchParams(location.search).get('t') || '').trim();
  if (!token) return;
  var API = '/api/palestra?t=' + encodeURIComponent(token);
  document.documentElement.classList.add('gym');
  document.body.classList.add('gym');

  var DN = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  var DL = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
  var WD = ['', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  var MO = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var MS = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  var CATL = { corsi: 'Corsi', circuiti: 'Circuiti', hyrox: 'Hyrox', pilates: 'Pilates', personal: 'Personal 1:1' };
  var IC = {
    users: '<circle cx="9" cy="8" r="3.3"/><path d="M2.8 20c.4-3.6 3-5.6 6.2-5.6s5.8 2 6.2 5.6"/><circle cx="17" cy="9" r="2.6"/><path d="M17.5 14.2c2.3.2 3.8 1.8 4.2 4.3"/>', check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.8 2.8L16.3 9.5"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.3 2"/>', alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.4v.1"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2"/>', dots: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>', chev: '<path d="m6 9 6 6 6-6"/>', l: '<path d="M15 6l-6 6 6 6"/>', r: '<path d="M9 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M2.5 10h19M6.5 15h4"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    weights: '<path d="M6.5 7v10M3.5 9.5v5M17.5 7v10M20.5 9.5v5M6.5 12h11"/>',
    off: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M10 14l4 4M14 14l-4 4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>'
  };
  function ic(n, s) { return '<svg width="' + (s || 21) + '" height="' + (s || 21) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>'; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n) { var d = parse(s); d.setDate(d.getDate() + n); return ymd(d); }
  function monday(s) { var d = parse(s), w = d.getDay() === 0 ? 7 : d.getDay(); return addDays(s, 1 - w); }
  function dlabel(s) { var d = parse(s); return DL[d.getDay()] + ' ' + d.getDate() + ' ' + MO[d.getMonth()]; }
  function short(s) { var d = parse(s); return d.getDate() + ' ' + MS[d.getMonth()]; }
  function cat(c) { return CATL[c] || (c.charAt(0).toUpperCase() + c.slice(1)); }
  function eur(n) { return n == null ? '' : (Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : Number(n).toFixed(2).replace('.', ',')) + ' €'; }

  var S = { data: null, today: ymd(new Date()), day: ymd(new Date()), view: 'giorno', sessions: null, week: null, open: null, flt: 'all', q: '', section: 'cal', stats: null };

  // ---------- comunicazione ----------
  function api(body, url) {
    var o = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    return fetch(url || API, o).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Errore'); return j; }); });
  }
  function toast(m, k) {
    var old = document.querySelector('.gxToast'); if (old) old.remove();
    var t = el('div', 'gxToast ' + (k || ''), m); document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4200);
  }
  function act(body, ok) { return api(body).then(function (j) { if (ok) toast(ok, 'ok'); return j; }).catch(function (e) { toast(e.message, 'bad'); throw e; }); }
  function load() {
    return api(null, API + '&data=1').then(function (d) { S.data = d; S.today = d.today; if (!S.dayInit) { S.day = d.today; S.dayInit = true; } return d; });
  }
  function reload() { S.sessions = null; S.week = null; S.stats = null; return load().then(function () { renderAll(); try { document.dispatchEvent(new CustomEvent('lia:gymchanged')); } catch (e) {} }); }

  // ---------- finestre dal basso ----------
  function sheet(title, build) {
    var sh = el('div', 'gxShade'), s = el('div', 'gxSheet'); sh.appendChild(s);
    function close() { if (sh.parentNode) sh.parentNode.removeChild(sh); }
    sh.addEventListener('click', function (e) { if (e.target === sh) close(); });
    s.appendChild(el('h3', null, title)); build(s, close); document.body.appendChild(sh); return close;
  }
  function field(lab, input) { var l = el('label', 'gxF'), s = el('span', null, lab); l.appendChild(s); l.appendChild(input); return l; }
  function inp(type, val, ph) { var i = el('input'); i.type = type || 'text'; if (val != null) i.value = val; if (ph) i.placeholder = ph; return i; }
  function sel(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }
  function btn(t, c, fn) { var b = el('button', 'gxBtn ' + (c || ''), t); b.type = 'button'; b.addEventListener('click', fn); return b; }
  function confirmBar(parent, text, onYes) {
    var w = el('div', 'gxWhy', text), a = el('div', 'gxActs');
    a.appendChild(btn('Sì, conferma', 'danger sm', onYes)); a.appendChild(btn('No', 'ghost sm', function () { w.remove(); }));
    w.appendChild(a); parent.appendChild(w);
  }

  // ---------- menu e intestazione ----------
  var MENU = { menuTabCal: 'Lezioni', menuTabClients: 'Iscritti', menuTabProfile: 'Panoramica' };
  Object.keys(MENU).forEach(function (id) {
    var b = document.getElementById(id); if (!b) return;
    for (var i = b.childNodes.length - 1; i >= 0; i--) { var n = b.childNodes[i]; if (n.nodeType === 3 && n.textContent.trim()) { n.textContent = '\n    ' + MENU[id] + '\n  '; break; } }
  });
  var LABELS = { cal: 'Lezioni', clients: 'Iscritti', stats: 'Statistiche', profile: 'Panoramica', shop: 'Shop', other: 'Impostazioni' };
  function setLabel(w) { var l = document.getElementById('sectionLabel'); if (l && LABELS[w]) l.textContent = LABELS[w]; }
  document.addEventListener('lia:section', function (e) { S.section = e.detail; setLabel(e.detail); showSection(e.detail); });

  // ---------- pannelli ----------
  var pCal = document.getElementById('panelCal'), pCli = document.getElementById('panelClients'), pSt = document.getElementById('panelStats');
  var xCal = el('div', 'gx'), xMem = el('div', 'gx'), xStat = el('div', 'gx');
  if (pCli) pCli.appendChild(xMem); if (pSt) pSt.appendChild(xStat);
  var fab = el('button', 'gxFab'); fab.type = 'button'; fab.hidden = true; fab.setAttribute('aria-label', 'Aggiungi'); fab.innerHTML = ic('plus', 26); document.body.appendChild(fab);
  fab.addEventListener('click', function () { if (S.section === 'clients') memberForm(); });

  function showSection(w) {
    fab.hidden = true;
    if (w === 'clients') renderMem(); else if (w === 'stats') renderStat();
    if (S.data && w !== 'cal' && w !== 'clients' && w !== 'stats') return;
    if (!S.data) load().then(function () { renderAll(); }).catch(function (e) { var x = w === 'clients' ? xMem : w === 'stats' ? xStat : xCal; x.textContent = ''; x.appendChild(el('div', 'gxWhy', e.message)); });
  }
  function renderAll() { if (S.section === 'clients') renderMem(); if (S.section === 'stats') renderStat(); }

  // ---------- Lezioni ----------
  function renderCal() {
    xCal.textContent = '';
    if (!S.data) { xCal.appendChild(el('div', 'gxEmpty', 'Carico...')); return; }
    var ttl = el('h2', 'gxTtl gxTop'); var d = parse(S.day);
    if (S.view === 'giorno') { ttl.innerHTML = '<span>' + DL[d.getDay()] + '</span> ' + d.getDate() + ' ' + MO[d.getMonth()]; }
    else { var m = monday(S.day); ttl.textContent = short(m) + ' – ' + short(addDays(m, 6)); }
    xCal.appendChild(ttl);
    var bar = el('div', 'gxBar'), left = el('div', 'gxNav');
    var p = el('button', 'gxArr'); p.type = 'button'; p.setAttribute('aria-label', 'Precedente'); p.innerHTML = ic('l', 18);
    var n = el('button', 'gxArr'); n.type = 'button'; n.setAttribute('aria-label', 'Successivo'); n.innerHTML = ic('r', 18);
    var step = S.view === 'giorno' ? 1 : 7;
    p.addEventListener('click', function () { S.day = addDays(S.day, -step); S.sessions = null; S.week = null; renderCal(); });
    n.addEventListener('click', function () { S.day = addDays(S.day, step); S.sessions = null; S.week = null; renderCal(); });
    left.appendChild(p); left.appendChild(n);
    if (S.day !== S.today && !(S.view === 'settimana' && monday(S.day) === monday(S.today))) { var t = btn('Oggi', 'gxToday', function () { S.day = S.today; S.sessions = null; S.week = null; renderCal(); }); t.className = 'gxToday'; left.appendChild(t); }
    var sg = el('div', 'gxSeg');
    [['giorno', 'Giorno'], ['settimana', 'Settimana']].forEach(function (v) {
      var b = el('button', null, v[1]); b.type = 'button'; b.setAttribute('aria-pressed', S.view === v[0] ? 'true' : 'false');
      b.addEventListener('click', function () { S.view = v[0]; S.sessions = null; S.week = null; renderCal(); }); sg.appendChild(b);
    });
    bar.appendChild(left); bar.appendChild(sg); xCal.appendChild(bar);
    var box = el('div'); xCal.appendChild(box);
    if (S.view === 'giorno') dayView(box); else weekView(box);
  }
  function dayView(box) {
    function draw() {
      box.textContent = '';
      if (!S.sessions) { box.appendChild(el('div', 'gxEmpty', 'Carico...')); return; }
      if (!S.sessions.length) { box.appendChild(el('div', 'gxEmpty', 'Nessuna lezione in questo giorno. Le aggiungi da Impostazioni, Corsi e programma.')); return; }
      S.sessions.forEach(function (s) {
        var key = S.day + '|' + s.schedule_id, openC = S.open === key;
        var c = el('div', 'gxCard tap'), r = el('div', 'gxRow'), l = el('div');
        l.appendChild(el('b', null, s.time + ' · ' + s.course.name)); l.appendChild(el('div', 'gxM', cat(s.course.category) + ' · ' + s.duration_min + ' min'));
        r.appendChild(l); r.appendChild(el('span', 'gxChip ' + (s.cancelled ? 'bad' : s.taken >= s.capacity ? 'warn' : 'ok'), s.cancelled ? 'Annullata' : s.taken + ' / ' + s.capacity)); c.appendChild(r);
        var bar = el('div', 'gxBar2'), i = el('i', s.taken >= s.capacity ? 'f' : ''); i.style.width = Math.min(100, Math.round(s.taken / s.capacity * 100)) + '%'; bar.appendChild(i); c.appendChild(bar);
        if (s.cancelled && s.cancel_reason) c.appendChild(el('div', 'gxM', s.cancel_reason));
        if (!openC) { c.appendChild(el('div', 'gxM', s.taken ? 'Tocca per vedere chi è prenotato' : 'Nessuno prenotato')); }
        else {
          if (!s.attendees.length) c.appendChild(el('div', 'gxM', 'Nessuno prenotato.'));
          s.attendees.forEach(function (a) {
            var row = el('div', 'gxAt'), nm = el('div'); nm.appendChild(el('span', null, a.name)); nm.appendChild(el('small', null, ' ' + a.phone)); row.appendChild(nm);
            row.appendChild(btn('Togli', 'ghost sm', function (ev) { ev.stopPropagation(); confirmBar(c, 'Togliere ' + a.name + ' da questa lezione? Se aveva usato un ingresso, gli torna.', function () { act({ action: 'booking_cancel', booking_id: a.booking_id, member_id: a.member_id }, 'Tolto.').then(function () { S.sessions = null; renderCal(); }); }); }));
            c.appendChild(row);
          });
          var ac = el('div', 'gxActs');
          if (!s.cancelled) {
            ac.appendChild(btn('Aggiungi iscritto', 'ghost sm', function (ev) { ev.stopPropagation(); addAtt(s, S.day); }));
            ac.appendChild(btn('Annulla lezione', 'danger sm', function (ev) { ev.stopPropagation(); annulla(s, S.day); }));
          } else ac.appendChild(btn('Riattiva lezione', 'ghost sm', function (ev) { ev.stopPropagation(); act({ action: 'session_restore', schedule_id: s.schedule_id, date: S.day }, 'Lezione riattivata.').then(function () { S.sessions = null; renderCal(); }); }));
          c.appendChild(ac);
        }
        c.addEventListener('click', function () { S.open = openC ? null : key; draw(); });
        box.appendChild(c);
      });
    }
    draw();
    if (!S.sessions) { var day = S.day; api(null, API + '&day=' + day).then(function (j) { if (day !== S.day) return; S.sessions = j.sessions; if (S.section === 'cal' && S.view === 'giorno') draw(); }).catch(function (e) { box.textContent = ''; box.appendChild(el('div', 'gxWhy', e.message)); }); }
  }
  function weekView(box) {
    function draw() {
      box.textContent = '';
      if (!S.week) { box.appendChild(el('div', 'gxEmpty', 'Carico...')); return; }
      var times = {}; S.week.days.forEach(function (d) { d.sessions.forEach(function (s) { times[s.time] = 1; }); });
      var ts = Object.keys(times).sort();
      if (!ts.length) { box.appendChild(el('div', 'gxEmpty', 'Nessuna lezione in programma. Le aggiungi da Impostazioni, Corsi e programma.')); return; }
      var g = el('div', 'gxWk'); g.style.gridTemplateColumns = '38px repeat(7,minmax(40px,1fr))';
      g.appendChild(el('div'));
      S.week.days.forEach(function (d) { var x = parse(d.date); g.appendChild(el('div', 'h' + (d.date === S.today ? ' today' : ''), DN[x.getDay()].toUpperCase() + ' ' + x.getDate())); });
      ts.forEach(function (t) {
        g.appendChild(el('div', 'tm', t));
        S.week.days.forEach(function (d) {
          var f = d.sessions.filter(function (s) { return s.time === t; });
          if (!f.length) { g.appendChild(el('div')); return; }
          var s = f[0], b = el('button', 'b c-' + (['corsi', 'circuiti', 'hyrox'].indexOf(s.course.category) >= 0 ? s.course.category : 'altro') + (s.cancelled ? ' x' : ''));
          b.type = 'button'; b.innerHTML = ''; b.appendChild(document.createTextNode(s.course.name.split(' ')[0])); b.appendChild(document.createElement('br')); b.appendChild(document.createTextNode(s.taken + '/' + s.capacity));
          if (f.length > 1) b.title = f.length + ' lezioni alla stessa ora';
          b.addEventListener('click', function () { S.view = 'giorno'; S.day = d.date; S.sessions = null; renderCal(); });
          g.appendChild(b);
        });
      });
      box.appendChild(g);
      box.appendChild(el('div', 'gxM', 'Tocca una lezione per aprire quel giorno.')).style.marginTop = '12px';
    }
    draw();
    if (!S.week) { var from = monday(S.day); api(null, API + '&week=' + from).then(function (j) { if (monday(S.day) !== from) return; S.week = j; if (S.section === 'cal' && S.view === 'settimana') draw(); }).catch(function (e) { box.textContent = ''; box.appendChild(el('div', 'gxWhy', e.message)); }); }
  }
  function addAtt(s, date) {
    sheet('Aggiungi a ' + s.course.name + ' (' + s.time + ')', function (w, close) {
      var ids = {}; s.attendees.forEach(function (a) { ids[a.member_id] = 1; });
      var opts = S.data.members.filter(function (m) { return !ids[m.id]; }).map(function (m) { return [m.id, m.last_name + ' ' + m.first_name + ' · ' + m.status.label]; });
      if (!opts.length) { w.appendChild(el('div', 'gxEmpty', 'Non ci sono altri iscritti da aggiungere.')); return; }
      var sl = sel(opts); w.appendChild(field('Iscritto', sl));
      var msg = el('div'); w.appendChild(msg);
      w.appendChild(btn('Aggiungi', 'block', function () { msg.textContent = ''; msg.className = ''; api({ action: 'booking_add', member_id: sl.value, schedule_id: s.schedule_id, date: date }).then(function () { toast('Aggiunto.', 'ok'); close(); refreshCal(); }).catch(function (e) { msg.className = 'gxWhy'; msg.textContent = e.message; }); }));
    });
  }
  function addAttPick() {
    if (S.view !== 'giorno') { S.view = 'giorno'; S.sessions = null; renderCal(); }
    var go = function (list) {
      var ok = (list || []).filter(function (s) { return !s.cancelled && !s.started; });
      if (!ok.length) { toast('In questo giorno non ci sono lezioni a cui aggiungere.', 'bad'); return; }
      sheet('Aggiungi a una lezione', function (w, close) {
        var sl = sel(ok.map(function (s, i) { return [i, s.time + ' · ' + s.course.name + ' (' + s.taken + '/' + s.capacity + ')']; }));
        w.appendChild(el('p', null, dlabel(S.day)));
        w.appendChild(field('Lezione', sl));
        w.appendChild(btn('Avanti', 'block', function () { close(); addAtt(ok[+sl.value], S.day); }));
      });
    };
    if (S.sessions) go(S.sessions); else api(null, API + '&day=' + S.day).then(function (j) { S.sessions = j.sessions; go(j.sessions); }).catch(function (e) { toast(e.message, 'bad'); });
  }
  function annulla(s, date) {
    sheet('Annulla ' + s.course.name + ' (' + s.time + ')', function (w, close) {
      w.appendChild(el('p', null, 'Chi è già prenotato viene tolto e gli ingressi tornano disponibili. Avvisa tu le persone: per ora non partono messaggi in automatico.'));
      var r = inp('text', '', 'Motivo (facoltativo)'); w.appendChild(field('Motivo', r));
      w.appendChild(btn('Annulla la lezione', 'danger block', function () { act({ action: 'session_cancel', schedule_id: s.schedule_id, date: date, reason: r.value }, 'Lezione annullata.').then(function () { close(); refreshCal(); }); }));
    });
  }


  // ---------- Dettaglio lezione: si apre toccando una lezione nel calendario di Lia ----------
  function refreshCal() {
    try { for (var i = localStorage.length - 1; i >= 0; i--) { var k = localStorage.key(i); if (k && k.indexOf('lia:month:v1:') === 0) localStorage.removeItem(k); } } catch (e) {}
    location.reload();
  }
  window.liaGymOpen = function (e) {
    var p = String(e.id).split(':'), sid = p[1], date = p[2];
    var go = function () {
      api(null, API + '&day=' + date).then(function (j) {
        var s = (j.sessions || []).filter(function (x) { return x.schedule_id === sid; })[0];
        if (!s) { toast('Lezione non trovata.', 'bad'); return; }
        sheet(s.time + ' · ' + s.course.name, function (w, close) {
          w.appendChild(el('p', null, dlabel(date) + ' · ' + cat(s.course.category) + ' · ' + s.duration_min + ' min'));
          var top = el('div', 'gxRow'); top.appendChild(el('b', null, s.cancelled ? 'Lezione annullata' : 'Prenotati'));
          top.appendChild(el('span', 'gxChip ' + (s.cancelled ? 'bad' : s.taken >= s.capacity ? 'warn' : 'ok'), s.taken + ' / ' + s.capacity)); w.appendChild(top);
          var bar = el('div', 'gxBar2'), i = el('i', s.taken >= s.capacity ? 'f' : ''); i.style.width = Math.min(100, Math.round(s.taken / s.capacity * 100)) + '%'; bar.appendChild(i); w.appendChild(bar);
          if (s.cancelled && s.cancel_reason) w.appendChild(el('div', 'gxM', s.cancel_reason));
          if (!s.attendees.length) w.appendChild(el('div', 'gxM', 'Nessuno prenotato.'));
          s.attendees.forEach(function (a) {
            var row = el('div', 'gxAt'), nm = el('div'); nm.appendChild(el('span', null, a.name)); nm.appendChild(el('small', null, ' ' + a.phone)); row.appendChild(nm);
            row.appendChild(btn('Togli', 'ghost sm', function () { confirmBar(w, 'Togliere ' + a.name + ' da questa lezione? Se aveva usato un ingresso, gli torna.', function () { act({ action: 'booking_cancel', booking_id: a.booking_id, member_id: a.member_id }, 'Tolto.').then(function () { refreshCal(); }); }); }));
            w.appendChild(row);
          });
          var ac = el('div', 'gxActs');
          if (!s.cancelled) {
            ac.appendChild(btn('Aggiungi iscritto', 'ghost sm', function () { close(); addAtt(s, date); }));
            ac.appendChild(btn('Annulla lezione', 'danger sm', function () { close(); annulla(s, date); }));
          } else ac.appendChild(btn('Riattiva lezione', 'ghost sm', function () { act({ action: 'session_restore', schedule_id: s.schedule_id, date: date }, 'Lezione riattivata.').then(function () { refreshCal(); }); }));
          w.appendChild(ac);
        });
      }).catch(function (er) { toast(er.message, 'bad'); });
    };
    if (S.data) go(); else load().then(go).catch(function (er) { toast(er.message, 'bad'); });
  };

  // ---------- Iscritti ----------
  var SORTS = { name: 'Nome', phone: 'Telefono', plan: 'Abbonamento', end: 'Scadenza' };
  function sortVal(m, k) {
    if (k === 'name') return (m.last_name + ' ' + m.first_name).toLowerCase();
    if (k === 'phone') return m.phone.replace(/\D/g, '');
    if (k === 'plan') { var c = curPlan(m); return c ? c.plan_name.toLowerCase() : '￿'; }
    return String(endOf(m));
  }
  function expTxt(dl) { return dl == null ? '' : dl < 0 ? 'scaduto da ' + (-dl) + (dl === -1 ? ' giorno' : ' giorni') : dl === 0 ? 'scade oggi' : dl === 1 ? 'scade domani' : 'tra ' + dl + ' giorni'; }
  function avRing(m) {
    var u = m.usage || {}, r = 19, c = 2 * Math.PI * r, p = u.max_period ? Math.min(1, (u.period || 0) / u.max_period) : 0;
    var hh = 0, nm = m.first_name + m.last_name; for (var i = 0; i < nm.length; i++) hh = (hh * 31 + nm.charCodeAt(i)) % 360;
    return '<span class="mxAv s-' + m.status.s + '" style="--h:' + hh + '"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="t" cx="22" cy="22" r="' + r + '" fill="none" stroke-width="3"/><circle class="p" cx="22" cy="22" r="' + r + '" fill="none" stroke-width="3" stroke-dasharray="' + (c * p).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg>' + esc((m.first_name[0] || '') + (m.last_name[0] || '')) + '</span>';
  }
  var MZH = [175, 205, 240, 275, 320, 350, 25, 150];
  var MZM = /^(luca|andrea|nicola|mattia|elia|tobia|gianluca|jonathan|enea|ezio|noah|joshua|santa?|mustafa|osama|bubi)$/i;
  function mzGen(m) { var f = String(m.first_name || '').trim().split(/\s+/)[0].toLowerCase(); if (MZM.test(f)) return 'gm'; return /a$/.test(f) ? 'gf' : 'gm'; }
  function mzHue(m) { var h = 0, n = m.first_name + m.last_name; for (var i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return MZH[h % MZH.length]; }
  function mzPips(cur, u) {
    if (!cur || !u.max_period) return '<span class="mzMute">—</span>';
    var n = u.max_period, k = Math.min(n, u.period || 0), h = '<span class="mzPips" title="' + k + ' su ' + n + ' ingressi usati">';
    if (n <= 12) { for (var i = 0; i < n; i++) h += '<i' + (i < k ? ' class="on"' : '') + '></i>'; } else h += '<span class="mzPb"><i style="width:' + Math.round(k / n * 100) + '%"></i></span>';
    return h + '</span><em class="mzPn">' + k + '/' + n + '</em>';
  }
  function mzRing(cur, dl) {
    var r = 26, c = 2 * Math.PI * r, f = 0;
    if (cur && cur.ends_on && dl != null) { var tot = cur.starts_on ? Math.max(1, Math.round((parse(cur.ends_on).getTime() - parse(cur.starts_on).getTime()) / 864e5)) : 30; f = Math.max(0, Math.min(1, dl / tot)); }
    return '<svg viewBox="0 0 60 60" aria-hidden="true"><circle class="t" cx="30" cy="30" r="' + r + '"/><circle class="p" cx="30" cy="30" r="' + r + '" stroke-dasharray="' + (c * f).toFixed(2) + ' ' + c.toFixed(2) + '"/></svg>';
  }
  function renderMem() {
    xMem.textContent = '';
    if (!S.data) { xMem.appendChild(el('div', 'gxEmpty', 'Carico...')); return; }
    if (S.mid) { var mm = S.data.members.filter(function (x) { return x.id === S.mid; })[0]; if (mm) { memberPage(mm); return; } S.mid = null; }
    var root = el('div', 'mx mxList'); xMem.appendChild(root);
    var mem = S.data.members, exd = S.data.settings.expiry_days || 5;
    var cnt = { all: mem.length, warn: 0, bad: 0, none: 0, ok: 0 };
    mem.forEach(function (m) { if (cnt[m.status.s] != null) cnt[m.status.s]++; });
    var valid = cnt.ok + cnt.warn, newM = mem.filter(function (m) { return m.created_at && (new Date(S.data.today).getTime() - new Date(m.created_at).getTime()) / 864e5 <= 30; }).length;
    function pc(n) { return cnt.all ? Math.round(n / cnt.all * 100) : 0; }
    var head = el('div', 'mzHead');
    head.innerHTML = '<div><div class="mzCrumb">' + esc((S.data.business && S.data.business.name) || 'Palestra') + ' / Gestione</div><h1>Iscritti</h1><p>Gestisci iscrizioni e abbonamenti</p></div>';
    var add = btn('', 'mzAdd', function () { memberForm(); }); add.innerHTML = ic('plus', 18) + '<span>Nuovo iscritto</span>'; head.appendChild(add); root.appendChild(head);
    function ring(p, c) { return '<span class="mzRing ' + c + '" style="--p:' + p + '"><b>' + p + '%</b></span>'; }
    var kp = el('div', 'mzKp');
    [['all', 'users', 'Iscritti', cnt.all, newM && newM < cnt.all ? '<span class="mzUp">↑ +' + newM + '</span><small>ultimi 30 giorni</small>' : '', ''],
     ['ok', 'check', 'Abbonamenti validi', valid, ring(pc(valid), 'ok'), 'ok'],
     ['warn', 'clock', 'In scadenza', cnt.warn, ring(pc(cnt.warn), 'warn'), 'warn'],
     ['bad', 'alert', 'Scaduti', cnt.bad, ring(pc(cnt.bad), 'bad'), 'bad']].forEach(function (k) {
      var on = k[0] === 'ok' ? S.flt === 'valid' : S.flt === k[0] || (k[0] === 'all' && S.flt === 'all');
      var b = el('button', 'mzK ' + (k[5] || 'all')); b.type = 'button'; b.setAttribute('aria-pressed', on && k[0] !== 'all' ? 'true' : 'false');
      b.innerHTML = '<span class="mzKi">' + ic(k[1], 24) + '</span><span class="mzKt"><b>' + k[3] + '</b><span>' + k[2] + '</span></span><span class="mzKr">' + k[4] + '</span>';
      b.addEventListener('click', function () { S.flt = k[0] === 'ok' ? (S.flt === 'valid' ? 'all' : 'valid') : k[0] === 'all' ? 'all' : (S.flt === k[0] ? 'all' : k[0]); S.more = false; renderMem(); }); kp.appendChild(b);
    });
    root.appendChild(kp);
    var bar = el('div', 'mzBar');
    var sr = el('label', 'mzSearch'); sr.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
    var q = el('input'); q.type = 'search'; q.placeholder = 'Cerca per nome o telefono'; q.value = S.q; q.autocomplete = 'off'; sr.appendChild(q); bar.appendChild(sr);
    function sel(opts, val, fn) { var w = el('label', 'mzSel'); var x = el('select'); opts.forEach(function (o) { var e = el('option', null, o[1]); e.value = o[0]; if (o[0] === val) e.selected = true; x.appendChild(e); }); x.addEventListener('change', function () { fn(x.value); }); w.appendChild(x); w.insertAdjacentHTML('beforeend', ic('chev', 16)); return w; }
    var planOpts = [['all', 'Tutti gli abbonamenti']].concat(S.data.plans.map(function (p) { return [p.id, p.name]; }));
    S.pf = S.pf || 'all'; S.srt = S.srt || 'end';
    bar.appendChild(sel([['all', 'Tutti gli stati'], ['ok', 'Attivi'], ['valid', 'Validi'], ['warn', 'In scadenza'], ['bad', 'Scaduti']].concat(cnt.none ? [['none', 'Senza abbonamento']] : []), S.flt, function (v) { S.flt = v; S.more = false; renderMem(); }));
    bar.appendChild(sel(planOpts, S.pf, function (v) { S.pf = v; S.more = false; renderMem(); }));
    bar.appendChild(sel([['end', 'Scadenza (più vicine)'], ['endd', 'Scadenza (più lontane)'], ['name', 'Nome A-Z'], ['named', 'Nome Z-A']], S.srt, function (v) { S.srt = v; renderMem(); }));
    root.appendChild(bar);
    var tbl = el('div', 'mzTable'); root.appendChild(tbl);
    function list() {
      tbl.textContent = '';
      var qq = S.q.trim().toLowerCase();
      var ms = mem.filter(function (m) {
        var cur = curPlan(m), ok = S.flt === 'all' || (S.flt === 'valid' ? (m.status.s === 'ok' || m.status.s === 'warn') : m.status.s === S.flt);
        return ok && (S.pf === 'all' || (cur && cur.plan_id === S.pf)) && (!qq || (m.first_name + ' ' + m.last_name + ' ' + m.phone).toLowerCase().indexOf(qq) >= 0);
      });
      var k = S.srt, d = /d$/.test(k) ? -1 : 1, key = k.indexOf('name') === 0 ? 'name' : 'end';
      ms.sort(function (a, b) { var x = sortVal(a, key), y = sortVal(b, key); return (x < y ? -1 : x > y ? 1 : 0) * d; });
      var hd = el('div', 'mzTh'); ['Nome', 'Telefono', 'Abbonamento', 'Ingressi', 'Scadenza', 'Stato', 'Azioni'].forEach(function (h, i) { hd.appendChild(el('span', i === 0 ? 'on' : '', h + (i === 0 && key === 'name' ? (d > 0 ? ' ↑' : ' ↓') : ''))); });
      tbl.appendChild(hd);
      if (!ms.length) { tbl.appendChild(el('div', 'mxEmpty', mem.length ? 'Nessun risultato. Prova a cambiare i filtri.' : 'Ancora nessun iscritto. Aggiungi il primo con "Nuovo iscritto".')); return; }
      var shown = (S.more || qq) ? ms : ms.slice(0, 30);
      shown.forEach(function (m) {
        var cur = curPlan(m), dl = cur && cur.ends_on ? daysTo(cur.ends_on) : null, u = m.usage || {}, hot = dl != null && dl <= exd && dl >= 0;
        var r = el('div', 'mzRow st-' + m.status.s); r.tabIndex = 0; r.setAttribute('role', 'button');
        var ing = cur && u.max_period ? (u.period || 0) + '/' + u.max_period : '—';
        var sc;
        if (cur && cur.ends_on) {
          var tot = cur.starts_on ? Math.max(1, Math.round((parse(cur.ends_on).getTime() - parse(cur.starts_on).getTime()) / 864e5)) : 30, fr = dl < 0 ? 1 : Math.max(0.04, Math.min(1, dl / tot));
          var big = dl < 0 ? '−' + (-dl) : String(dl), unit = Math.abs(dl) === 1 ? 'giorno' : 'giorni', cap = dl < 0 ? 'scaduto il' : dl === 0 ? 'scade oggi' : 'scade il';
          sc = '<span class="mzX ' + m.status.s + '"><span class="mzXn"><b>' + big + '</b><small>' + unit + '</small></span><span class="mzXd"><small>' + cap + '</small><b>' + short(cur.ends_on) + '</b></span></span>';
        } else sc = '<span class="mzMute">Nessun abbonamento</span>';
        r.innerHTML = '<span class="mzC mzN ' + mzGen(m) + '"><span class="mzAv s-' + m.status.s + '">' + mzRing(cur, dl) + '<i>' + esc((m.first_name[0] || '') + (m.last_name[0] || '')) + '</i></span><b>' + esc(m.first_name) + ' <span>' + esc(m.last_name) + '</span></b></span>' +
          '<span class="mzC mzP" data-l="Telefono">' + esc(m.phone) + '</span>' +
          '<span class="mzC" data-l="Abbonamento">' + (cur ? '<span class="mzPl pl' + (Math.max(0, S.data.plans.map(function (p) { return p.id; }).indexOf(cur.plan_id)) % 4) + '">' + esc(cur.plan_name) + '</span>' : '—') + '</span>' +
          '<span class="mzC mzI" data-l="Ingressi">' + mzPips(cur, u) + '</span>' +
          '<span class="mzC mzE ' + (hot ? 'hot' : '') + '" data-l="Scadenza">' + sc + '</span>' +
          '<span class="mzC"><span class="mzSt ' + m.status.s + '">' + esc(m.status.label) + '</span></span>' +
          '<span class="mzC mzA"></span>';
        var A = r.querySelector('.mzA');
        var tpl = cur && cur.plan_id ? S.data.plans.filter(function (p) { return p.id === cur.plan_id; })[0] : null; tpl = tpl || S.data.plans[0] || null;
        function open(tab) { S.mid = m.id; S.tab = tab || 'pren'; renderMem(); try { window.scrollTo(0, 0); } catch (e) { } }
        if (tpl) {
          var rn = el('button', 'mzRn', 'Rinnova'); rn.type = 'button';
          rn.addEventListener('click', function (e) { e.stopPropagation(); rn.disabled = true; var from = cur && cur.valid && cur.kind === 'time' && cur.ends_on >= S.data.today ? addDays(cur.ends_on, 1) : S.data.today; act({ action: 'member_plan_add', member_id: m.id, plan_id: tpl.id, starts_on: from }, 'Abbonamento rinnovato (parte il ' + short(from) + ').').then(function () { return reload(); }).catch(function () { rn.disabled = false; }); });
          A.appendChild(rn);
        }
        r.addEventListener('click', function () { open(); }); r.addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
        tbl.appendChild(r);
      });
      if (shown.length < ms.length) { tbl.appendChild(btn('Mostra altri ' + (ms.length - shown.length), 'mxMore', function () { S.more = true; list(); })); }
    }
    q.addEventListener('input', function () { S.q = q.value; list(); });
    list();
  }
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function curPlan(m) { return m.plans.filter(function (p) { return p.valid; })[0] || m.plans[0] || null; }
  function daysTo(iso) { return Math.round((parse(iso).getTime() - parse(S.data.today).getTime()) / 864e5); }
  function meter(n, max) { if (!max) return ''; var pct = Math.min(100, Math.round((n || 0) / max * 100)); return '<span class="gmMeter"><i class="' + (pct >= 100 ? 'f' : '') + '" style="width:' + pct + '%"></i></span>'; }
  function endOf(m) { var e = m.plans.filter(function (p) { return !p.cancelled && p.ends_on; }).map(function (p) { return p.ends_on; }).sort().pop(); return e || '9999'; }
  function memberForm(m) {
    sheet(m ? 'Modifica dati' : 'Nuovo iscritto', function (w, close) {
      var f = inp('text', m ? m.first_name : ''), l = inp('text', m ? m.last_name : ''), p = inp('tel', m ? m.phone : ''), n = el('textarea'); n.value = m ? m.notes : '';
      var two = el('div', 'gxTwo'); two.appendChild(field('Nome', f)); two.appendChild(field('Cognome', l)); w.appendChild(two);
      w.appendChild(field('Telefono', p));
      // abbonamento scelto subito (solo per un iscritto nuovo)
      var plans = !m && S.data && S.data.plans ? S.data.plans : [], pick = null, st = inp('date', S.data ? S.data.today : ''), pr = inp('number', ''), box = el('div', 'gxPlanBox');
      pr.step = '0.01'; pr.inputMode = 'decimal';
      if (plans.length) {
        w.appendChild(el('div', 'gxDh', 'Abbonamento'));
        w.appendChild(box);
        var drawPlan = function () {
          box.innerHTML = '';
          var ch = el('div', 'gxChips');
          var none = el('button', 'gxCp', 'Nessuno per ora'); none.type = 'button'; none.setAttribute('aria-pressed', pick ? 'false' : 'true'); none.addEventListener('click', function () { pick = null; drawPlan(); }); ch.appendChild(none);
          plans.forEach(function (x) { var b = el('button', 'gxCp', x.name + (x.price_eur != null ? ' · ' + eur(x.price_eur) : '')); b.type = 'button'; b.setAttribute('aria-pressed', pick && pick.id === x.id ? 'true' : 'false'); b.addEventListener('click', function () { pick = x; pr.value = x.price_eur != null ? x.price_eur : ''; drawPlan(); }); ch.appendChild(b); });
          box.appendChild(ch);
          if (pick) {
            var info = el('p', 'gxPlanInfo', (pick.kind === 'time' ? 'Dura ' + pick.days + ' giorni dalla data di inizio. ' : pick.entries + ' ingressi. ') + 'Include: ' + pick.covers.map(cat).join(', ') + '.');
            box.appendChild(info);
            var t2 = el('div', 'gxTwo'); t2.appendChild(field('Inizia il', st)); t2.appendChild(field('Pagato (€)', pr)); box.appendChild(t2);
          }
        };
        drawPlan();
      }
      w.appendChild(field('Note (facoltative)', n));
      w.appendChild(el('p', null, 'Nome, cognome e telefono servono all\'iscritto per entrare e prenotare: devono essere scritti come li dirà lui.'));
      var msg = el('div'); w.appendChild(msg);
      w.appendChild(btn(!m && plans.length ? 'Salva iscritto' : 'Salva', 'block', function () {
        msg.textContent = ''; msg.className = '';
        api({ action: 'member_save', id: m ? m.id : undefined, first_name: f.value, last_name: l.value, phone: p.value, notes: n.value }).then(function (j) {
          var next = pick && !m ? api({ action: 'member_plan_add', member_id: j.id, plan_id: pick.id, starts_on: st.value, price_paid: pr.value }) : Promise.resolve();
          return next.then(function () { toast(pick && !m ? 'Iscritto e abbonamento salvati.' : 'Salvato.', 'ok'); close(); return reload().then(function () { if (!m) { S.mid = j.id; S.tab = 'pren'; renderMem(); } }); }, function (e) { toast('Iscritto salvato, ma l\'abbonamento no: ' + e.message, 'bad'); close(); return reload().then(function () { if (!m) { S.mid = j.id; S.tab = 'pren'; renderMem(); } }); });
        }).catch(function (e) { msg.className = 'gxWhy'; msg.textContent = e.message; });
      }));
    });
  }
  function memberSheet(id) { S.mid = id; S.tab = 'pren'; if (S.section === 'clients') renderMem(); }
  function memberPage(m) {
    var id = m.id, cur = curPlan(m), u = m.usage || {}, dl = cur && cur.ends_on ? daysTo(cur.ends_on) : null, soon = S.data.settings.expiry_days || 5;
    var root = el('div', 'mx mxD'); xMem.appendChild(root);
    var hero = el('div', 'mxHero');
    var pos = 0, dsHtml = '';
    if (cur && cur.kind === 'time' && cur.starts_on && cur.ends_on) {
      var tot = Math.max(1, Math.round((parse(cur.ends_on) - parse(cur.starts_on)) / 864e5)), el_ = Math.max(0, Math.min(tot, Math.round((parse(S.data.today) - parse(cur.starts_on)) / 864e5))); pos = (el_ / tot * 100).toFixed(1);
      dsHtml = '<div class="mxTl"><div class="mxTr"><i style="width:' + pos + '%"></i><em style="left:' + pos + '%"></em></div><div class="mxDs"><span>Inizio <b>' + short(cur.starts_on) + '</b></span><span><b>' + esc(dl < 0 ? 'scaduto da ' + (-dl) + (dl === -1 ? ' giorno' : ' giorni') : dl === 0 ? 'scade oggi' : 'mancano ' + dl + (dl === 1 ? ' giorno' : ' giorni')) + '</b></span><span>Scadenza <b>' + short(cur.ends_on) + '</b></span></div></div>';
    } else if (cur && cur.kind === 'entries') {
      pos = cur.entries_total ? Math.round((cur.entries_total - cur.entries_left) / cur.entries_total * 100) : 0;
      dsHtml = '<div class="mxTl"><div class="mxTr"><i style="width:' + pos + '%"></i></div><div class="mxDs"><span>Usati <b>' + (cur.entries_total - cur.entries_left) + '</b></span><span><b>' + cur.entries_left + ' rimasti</b></span><span>Totali <b>' + cur.entries_total + '</b></span></div></div>';
    }
    hero.innerHTML = '<div class="mxBar"><button type="button" class="mxBack">‹ Iscritti</button><span class="mxTag">Tessera iscritto</span></div>' +
      '<h2>' + esc(m.first_name + ' ' + m.last_name) + '</h2><a class="mxTel" href="tel:' + esc(m.phone.replace(/[^\d+]/g, '')) + '">' + esc(m.phone) + '</a>' +
      '<div class="mxPl"><div><b>' + (cur ? esc(cur.plan_name) + (cur.price_paid != null ? ' · ' + eur(cur.price_paid) : '') : 'Nessun abbonamento') + '</b>' + (cur && (u.max_period || u.max_week) ? '<span>' + (u.max_period ? u.max_period + ' ingressi' : '') + (u.max_period && u.max_week ? ' · ' : '') + (u.max_week ? 'max ' + u.max_week + ' a settimana' : '') + '</span>' : '') + '</div><span class="gxChip ' + m.status.s + '">' + esc(m.status.label) + '</span></div>' + dsHtml;
    root.appendChild(hero);
    hero.querySelector('.mxBack').addEventListener('click', function () { S.mid = null; renderMem(); });
    var body = el('div', 'mxBody'); root.appendChild(body);
    function ringHtml(n, max) { var r = 26, c = 2 * Math.PI * r, p = max ? Math.min(1, n / max) : 0; return '<div class="mxRing"><svg viewBox="0 0 60 60"><circle class="t" cx="30" cy="30" r="' + r + '" fill="none" stroke-width="6"/><circle class="p' + (max && n >= max ? ' full' : '') + '" cx="30" cy="30" r="' + r + '" fill="none" stroke-width="6" stroke-dasharray="' + (c * p).toFixed(1) + ' ' + c.toFixed(1) + '"/></svg><b>' + n + (max ? '/' + max : '') + '</b></div>'; }
    var gs = el('div', 'mxGauges');
    gs.innerHTML = '<div class="mxG">' + ringHtml(u.period || 0, u.max_period) + '<div><label>Ingressi del mese</label><span>' + (u.max_period ? Math.max(0, u.max_period - (u.period || 0)) + ' ancora disponibili' : 'senza limite') + '</span></div></div>' +
      '<div class="mxG">' + ringHtml(u.week || 0, u.max_week) + '<div><label>Questa settimana</label><span>' + (u.max_week ? Math.max(0, u.max_week - (u.week || 0)) + ' ancora disponibili' : 'senza limite') + '</span></div></div>';
    body.appendChild(gs);
    var tpl = cur && cur.plan_id ? S.data.plans.filter(function (p) { return p.id === cur.plan_id; })[0] : null; tpl = tpl || S.data.plans[0] || null;
    var acts = el('div', 'mxActs');
    if (tpl) {
      var from = cur && cur.valid && cur.kind === 'time' && cur.ends_on >= S.data.today ? addDays(cur.ends_on, 1) : S.data.today;
      var rn = btn('Rinnova' + (tpl.price_eur != null ? ' · ' + eur(tpl.price_eur) : ''), 'mxPrim', function () {
        rn.disabled = true;
        act({ action: 'member_plan_add', member_id: m.id, plan_id: tpl.id, starts_on: from }, 'Abbonamento rinnovato (parte il ' + short(from) + ').').then(function () { return reload(); }).catch(function () { rn.disabled = false; });
      });
      acts.appendChild(rn);
    }
    acts.appendChild(btn('Prenota', 'mxGh', function () { if (window.liaGymBookFor) window.liaGymBookFor(m.id); else toast('Calendario non pronto.', 'bad'); }));
    var call = el('a', 'mxGh', 'Chiama'); call.href = 'tel:' + m.phone.replace(/[^\d+]/g, ''); acts.appendChild(call);
    body.appendChild(acts);
    var tabs = el('div', 'mxTabs'); body.appendChild(tabs);
    var pane = el('div', 'mxPane'); body.appendChild(pane);
    function drawTabs() {
      tabs.textContent = '';
      [['pren', 'Prenotazioni'], ['abb', 'Abbonamenti'], ['note', 'Note']].forEach(function (t) { var b = el('button', null, t[1]); b.type = 'button'; b.setAttribute('aria-pressed', S.tab === t[0] ? 'true' : 'false'); b.addEventListener('click', function () { S.tab = t[0]; drawTabs(); drawPane(); }); tabs.appendChild(b); });
    }
    function evRow(x, past) {
      var d = parse(x.date), r = el('div', 'mxEv' + (past && x.no_show ? ' ns' : ''));
      r.innerHTML = '<span class="mxDt"><b>' + d.getDate() + '</b><span>' + MS[d.getMonth()] + '</span></span><span class="mxTx"><b>' + esc(x.name) + '</b><span>' + esc(x.time) + (past ? (x.no_show ? ' · assente' : ' · presente') : ' · prenotato') + '</span></span>';
      if (past) r.appendChild(el('span', 'gxChip ' + (x.no_show ? 'bad' : 'ok'), x.no_show ? 'Assente' : 'Presente'));
      else r.appendChild(btn('Togli', 'ghost sm', function () { confirmBar(pane, 'Togliere ' + x.name + ' del ' + short(x.date) + '? Se aveva usato un ingresso, gli torna.', function () { act(x.kind === 'pt' ? { action: 'pt_cancel', booking_id: x.id, member_id: id } : { action: 'booking_cancel', booking_id: x.id, member_id: id }, 'Tolto.').then(function () { S.mcache = {}; return reload(); }); }); }));
      return r;
    }
    function drawPane() {
      pane.textContent = '';
      if (S.tab === 'pren') {
        var cache = (S.mcache = S.mcache || {});
        var fill = function (j) {
          pane.textContent = '';
          pane.appendChild(el('div', 'mxSec', 'In programma'));
          var l1 = el('div', 'mxLs'); if (!j.upcoming.length) l1.appendChild(el('div', 'mxEmpty', 'Nessuna prenotazione in programma.')); j.upcoming.slice(0, 12).forEach(function (x) { l1.appendChild(evRow(x, false)); }); pane.appendChild(l1);
          pane.appendChild(el('div', 'mxSec', 'Ultime presenze'));
          var l2 = el('div', 'mxLs'); if (!j.past.length) l2.appendChild(el('div', 'mxEmpty', 'Ancora nessuna lezione.')); j.past.slice(0, 10).forEach(function (x) { l2.appendChild(evRow(x, true)); }); pane.appendChild(l2);
        };
        if (cache[id]) fill(cache[id]);
        else { pane.appendChild(el('div', 'mxEmpty', 'Carico le prenotazioni...')); api(null, API + '&member=' + encodeURIComponent(id)).then(function (j) { cache[id] = j; if (S.mid === id && S.tab === 'pren') fill(j); }).catch(function () { pane.textContent = ''; }); }
      } else if (S.tab === 'abb') {
        var paid = m.plans.reduce(function (t, p) { return t + (Number(p.price_paid) || 0); }, 0);
        var tot2 = el('div', 'mxTot'); tot2.innerHTML = '<div><span>Totale versato</span><b>' + eur(paid) + '</b></div><span class="gxChip ok">' + m.plans.length + (m.plans.length === 1 ? ' abbonamento' : ' abbonamenti') + '</span>'; pane.appendChild(tot2);
        var ls = el('div', 'mxLs'); if (!m.plans.length) ls.appendChild(el('div', 'mxEmpty', 'Nessun abbonamento.'));
        m.plans.slice(0, 12).forEach(function (p) {
          var d = parse(p.starts_on || S.data.today), r = el('div', 'mxEv');
          r.innerHTML = '<span class="mxDt"><b>' + d.getDate() + '</b><span>' + MS[d.getMonth()] + '</span></span><span class="mxTx"><b>' + esc(p.plan_name) + '</b><span>' + (p.kind === 'time' ? short(p.starts_on) + ' → ' + short(p.ends_on) : p.entries_left + ' ingressi rimasti') + '</span></span><b>' + (p.price_paid != null ? eur(p.price_paid) : '') + '</b>';
          ls.appendChild(r);
        });
        pane.appendChild(ls);
        var ac = el('div', 'mxManage');
        ac.appendChild(btn('Nuovo abbonamento', 'ghost sm', function () { newPlan(m); }));
        if (cur) {
          ac.appendChild(btn(cur.kind === 'time' ? 'Cambia scadenza' : 'Cambia ingressi', 'ghost sm', function () { editPlan(cur, function () { }); }));
          ac.appendChild(btn('Annulla abbonamento', 'danger sm', function () { confirmBar(pane, 'Annullare l\'abbonamento in corso?', function () { act({ action: 'member_plan_update', id: cur.id, cancelled: true }, 'Annullato.').then(function () { return reload(); }); }); }));
        }
        pane.appendChild(ac);
      } else {
        pane.appendChild(el('div', 'mxNote', m.notes ? m.notes : 'Nessuna nota. Puoi scrivere ad esempio infortuni da tenere presenti, obiettivi o accordi particolari.'));
        var ac3 = el('div', 'mxManage');
        ac3.appendChild(btn(m.notes ? 'Modifica note e dati' : 'Aggiungi una nota', 'ghost sm', function () { memberForm(m); }));
        ac3.appendChild(btn('Elimina iscritto', 'danger sm', function () { confirmBar(pane, 'Eliminare ' + m.first_name + ' ' + m.last_name + '? Le sue prenotazioni future vengono tolte.', function () { act({ action: 'member_delete', id: m.id }, 'Eliminato.').then(function () { S.mid = null; return reload(); }); }); }));
        pane.appendChild(ac3);
      }
    }
    drawTabs(); drawPane();
  }
  function editPlan(p, closeParent) {
    sheet(p.plan_name, function (w, close) {
      var i = p.kind === 'time' ? inp('date', p.ends_on) : inp('number', p.entries_left); if (p.kind === 'entries') { i.min = '0'; i.inputMode = 'numeric'; }
      w.appendChild(field(p.kind === 'time' ? 'Scade il' : 'Ingressi rimasti', i));
      w.appendChild(btn('Salva', 'block', function () { var b = { action: 'member_plan_update', id: p.id }; if (p.kind === 'time') b.ends_on = i.value; else b.entries_left = i.value; act(b, 'Salvato.').then(function () { close(); closeParent(); return reload(); }); }));
    });
  }
  function newPlan(m) {
    sheet('Nuovo abbonamento per ' + m.first_name, function (w, close) {
      if (!S.data.plans.length) { w.appendChild(el('div', 'gxEmpty', 'Prima crea un tipo di abbonamento, da Impostazioni, Abbonamenti.')); return; }
      var ps = sel(S.data.plans.map(function (p) { return [p.id, p.name + (p.price_eur != null ? ' · ' + eur(p.price_eur) : '')]; }));
      var st = inp('date', S.data.today), pr = inp('number', ''); pr.step = '0.01'; pr.inputMode = 'decimal';
      var info = el('p');
      function upd() { var p = S.data.plans.filter(function (x) { return x.id === ps.value; })[0]; pr.value = p && p.price_eur != null ? p.price_eur : ''; info.textContent = p ? (p.kind === 'time' ? 'Dura ' + p.days + ' giorni dalla data di inizio. ' : p.entries + ' ingressi. ') + 'Include: ' + p.covers.map(cat).join(', ') + '.' : ''; }
      ps.addEventListener('change', upd); upd();
      w.appendChild(field('Tipo', ps)); w.appendChild(info);
      var two = el('div', 'gxTwo'); two.appendChild(field('Inizia il', st)); two.appendChild(field('Pagato (€)', pr)); w.appendChild(two);
      w.appendChild(btn('Aggiungi', 'block', function () { act({ action: 'member_plan_add', member_id: m.id, plan_id: ps.value, starts_on: st.value, price_paid: pr.value }, 'Abbonamento aggiunto.').then(function () { close(); return reload(); }); }));
    });
  }

  // ---------- Statistiche ----------
  function renderStat() {
    xStat.textContent = '';
    if (!S.stats) {
      xStat.appendChild(el('div', 'gxEmpty', 'Carico...'));
      api(null, API + '&stats=1').then(function (j) { S.stats = j; if (S.section === 'stats') renderStat(); }).catch(function (e) { xStat.textContent = ''; xStat.appendChild(el('div', 'gxWhy', e.message)); });
      return;
    }
    var s = S.stats, t = el('div', 'gxTiles');
    [[s.active, 'Iscritti attivi'], [s.soon, 'In scadenza'], [s.week_bookings, 'Prenotazioni questa settimana'], [s.sold_month, 'Abbonamenti venduti nel mese' + (s.revenue_month ? ' (' + eur(s.revenue_month) + ')' : '')]].forEach(function (x) { var d = el('div', 'gxTile'); d.appendChild(el('b', null, String(x[0]))); d.appendChild(el('span', null, x[1])); t.appendChild(d); });
    xStat.appendChild(t);
    if (s.expired) xStat.appendChild(el('div', 'gxM', s.expired + (s.expired === 1 ? ' iscritto ha l\'abbonamento scaduto o non ne ha uno.' : ' iscritti hanno l\'abbonamento scaduto o non ne hanno uno.'))).style.marginTop = '6px';
    xStat.appendChild(el('div', 'gxLb', 'Riempimento dei corsi, ultime 4 settimane'));
    if (!s.fill.length) xStat.appendChild(el('div', 'gxEmpty', 'Ancora nessun dato: compare dopo le prime lezioni.'));
    s.fill.forEach(function (x) { var h = el('div', 'gxHb'), d = el('div', null, x.name), tr = el('div', 't'), i = el('i'); i.style.width = x.pct + '%'; tr.appendChild(i); d.appendChild(tr); h.appendChild(d); h.appendChild(el('em', null, x.pct + '%')); xStat.appendChild(h); });
    if (s.fill.length) { var n = el('div', 'gxM', 'Un corso quasi sempre pieno si può raddoppiare; uno sotto la metà si può cambiare di orario.'); n.style.marginTop = '10px'; xStat.appendChild(n); }
  }

  // ---------- Impostazioni: corsi, abbonamenti, chiusure, regole ----------
  function mountSettings() {
    var menu = document.querySelector('#panelOther .stMenu'); if (!menu) return false;
    ['services', 'combos', 'hours', 'blocks', 'staff'].forEach(function (k) { var r = menu.querySelector('[data-st="' + k + '"]'); if (r) r.style.display = 'none'; });
    var groups = menu.querySelectorAll('.stGroup');
    groups.forEach(function (g) { var h = g.querySelector('h3'); if (h && /Canali clienti/i.test(h.textContent)) g.style.display = 'none'; if (h && /La tua attività/i.test(h.textContent)) h.textContent = 'La tua palestra'; });
    var bi = menu.querySelector('[data-st="bizinfo"] b'); if (bi) bi.textContent = 'Dati palestra';
    var first = menu.querySelector('.stGroup .stList'); if (!first || first.querySelector('[data-gx]')) return true;
    var anchor = menu.querySelector('[data-st="services"]');
    var rows = [
      ['corsi', 'c-violet', 'weights', 'Corsi e programma', 'Corsi, orari e posti'],
      ['abb', 'c-blue', 'card', 'Abbonamenti', 'Tipi, prezzi e ingressi'],
      ['chiusure', 'c-coral', 'off', 'Chiusure e ferie', 'Giorni senza lezioni'],
      ['regole', 'c-amber', 'gear', 'Regole e avvisi', 'Disdette, scadenze, ore del Personal']
    ];
    rows.forEach(function (r) {
      var b = el('button', 'stRow'); b.type = 'button'; b.setAttribute('data-gx', r[0]);
      b.innerHTML = '<span class="stIc ' + r[1] + ' gxI">' + ic(r[2]) + '</span><span class="stTx"><b>' + r[3] + '</b><small>' + r[4] + '</small></span><span class="stCh" aria-hidden="true">›</span>';
      b.addEventListener('click', function () { openSetting(r[0]); }); if (anchor && anchor.parentNode === first) first.insertBefore(b, anchor); else first.appendChild(b);
    });
    return true;
  }
  function openSetting(k) {
    var go = function () { ({ corsi: sCorsi, abb: sAbb, chiusure: sChiusure, regole: sRegole })[k](); };
    if (S.data) go(); else load().then(go).catch(function (e) { toast(e.message, 'bad'); });
  }
  function sCorsi() {
    var D = S.data;
    sheet('Programma', function (w, close) {
      var st = { mode: D.courses.length ? 'old' : 'new', cid: D.courses[0] ? D.courses[0].id : null, cap: D.courses[0] ? D.courses[0].capacity : 12, dur: 60, name: '', cat: 'corsi', days: [], times: [], extra: false, busy: false };
      var seg = el('div', 'gxSeg'), box = el('div'), msg = el('div');
      w.classList.add('gxProg'); var xb = el('button', 'gxX', '✕'); xb.type = 'button'; xb.setAttribute('aria-label', 'Chiudi'); xb.addEventListener('click', close); w.appendChild(xb);
      function ccol(x) { var k = x.category === 'hyrox' ? 'hyrox' : x.category === 'pilates' ? 'pilates' : 'circuit'; return 'var(--c-' + k + ')'; }
      w.appendChild(seg); w.appendChild(box); w.appendChild(msg);
      function course() { return D.courses.filter(function (c) { return c.id === st.cid; })[0]; }
      function stepper(label, val, step, min, max, set, fixed) {
        var f = el('div', 'gxF'); f.appendChild(el('span', null, label));
        var r = el('div', 'gxStep'), v = el('b', null, fixed || String(val));
        if (!fixed) { var mi = el('button', null, '−'), pl = el('button', null, '+'); mi.type = 'button'; pl.type = 'button'; mi.addEventListener('click', function () { set(Math.max(min, val - step)); }); pl.addEventListener('click', function () { set(Math.min(max, val + step)); }); r.appendChild(mi); r.appendChild(v); r.appendChild(pl); } else r.appendChild(v);
        f.appendChild(r); return f;
      }
      function pairs() { var o = []; st.days.slice().sort().forEach(function (d) { st.times.slice().sort().forEach(function (t) { o.push([d, t]); }); }); return o; }
      function draw() {
        seg.innerHTML = '';
        [['old', 'Corso esistente'], ['new', 'Nuovo corso']].forEach(function (m) {
          if (m[0] === 'old' && !D.courses.length) return;
          var b = el('button', null, m[1]); b.type = 'button'; b.setAttribute('aria-pressed', st.mode === m[0] ? 'true' : 'false');
          b.addEventListener('click', function () { st.mode = m[0]; if (m[0] === 'old' && course()) st.cap = course().capacity; draw(); }); seg.appendChild(b);
        });
        box.innerHTML = ''; msg.className = ''; msg.textContent = ''; var L = el('div', 'gxCol'), R = el('div', 'gxCol');
        var c = course();
        if (st.mode === 'old') {
          var hd = el('div', 'gxHd'); hd.appendChild(el('div', 'gxDh', 'Corso'));
          if (c) { var ed = el('button', 'gxLink', 'Modifica corso'); ed.type = 'button'; ed.addEventListener('click', function () { close(); courseForm(c); }); hd.appendChild(ed); }
          L.appendChild(hd);
          var ch = el('div', 'gxCourses');
          D.courses.forEach(function (x) { var b = el('button', 'gxCo', '<i></i>' + esc2(x.name)); b.innerHTML = '<i></i>' + esc2(x.name); b.type = 'button'; b.style.setProperty('--cc', ccol(x)); b.setAttribute('aria-pressed', x.id === st.cid ? 'true' : 'false'); b.addEventListener('click', function () { st.cid = x.id; st.cap = x.capacity; draw(); }); ch.appendChild(b); });
          L.appendChild(ch);
        } else {
          var n = inp('text', st.name, 'Es. Boxe, Yoga, CrossFit'); n.addEventListener('input', function () { st.name = n.value; sum(); });
          var ct = sel(D.categories.map(function (x) { return [x, cat(x)]; }), st.cat); ct.addEventListener('change', function () { st.cat = ct.value; });
          L.appendChild(field('Nome del corso', n)); L.appendChild(field('Tipo (decide quali abbonamenti lo includono)', ct));
        }
        var two = el('div', 'gxTwo gxSteps');
        two.appendChild(stepper('Capienza', st.cap, 1, 1, 200, function (v) { st.cap = v; draw(); }));
        two.appendChild(st.mode === 'old' ? stepper('Durata', 0, 0, 0, 0, null, (c ? c.duration_min : 60) + ' min') : stepper('Durata (min)', st.dur, 5, 15, 240, function (v) { st.dur = v; draw(); }));
        L.appendChild(two);
        R.appendChild(el('div', 'gxDh gxSecT', 'Giorni'));
        var dr = el('div', 'gxDays');
        [1, 2, 3, 4, 5, 6, 7].forEach(function (d) { var b = el('button', 'gxCp', WD[d].slice(0, 3)); b.type = 'button'; b.setAttribute('aria-pressed', st.days.indexOf(d) >= 0 ? 'true' : 'false'); b.addEventListener('click', function () { var i = st.days.indexOf(d); if (i >= 0) st.days.splice(i, 1); else st.days.push(d); draw(); }); dr.appendChild(b); });
        R.appendChild(dr);
        R.appendChild(el('div', 'gxDh gxSecT', 'Orario'));
        var base = ['08:00', '09:00', '10:00', '12:00', '17:00', '18:00', '19:00', '20:00'];
        st.times.forEach(function (t) { if (base.indexOf(t) < 0) base.push(t); }); base.sort();
        var tr = el('div', 'gxChips');
        base.forEach(function (t) { var b = el('button', 'gxCp', t); b.type = 'button'; b.setAttribute('aria-pressed', st.times.indexOf(t) >= 0 ? 'true' : 'false'); b.addEventListener('click', function () { var i = st.times.indexOf(t); if (i >= 0) st.times.splice(i, 1); else st.times.push(t); draw(); }); tr.appendChild(b); });
        if (st.extra) { var ti = inp('time', '18:30'); ti.addEventListener('change', function () { if (/^\d{2}:\d{2}$/.test(ti.value) && st.times.indexOf(ti.value) < 0) { st.times.push(ti.value); st.extra = false; draw(); } }); tr.appendChild(ti); }
        else { var ex = el('button', 'gxCp gxAlt', '+ Altro'); ex.type = 'button'; ex.addEventListener('click', function () { st.extra = true; draw(); }); tr.appendChild(ex); }
        R.appendChild(tr);
        var sm = el('div', 'gxSum'); R.appendChild(sm);
        var go = btn('', 'block gxGo', submit); R.appendChild(go);
        var lst = el('button', 'gxMore'); lst.type = 'button'; lst.innerHTML = '<span>Già in programma</span><em>' + D.schedule.length + ' lezioni a settimana</em><u>›</u>'; lst.addEventListener('click', function () { close(); sProgList(); }); R.appendChild(lst);
        function sumFn() {
          var nm = st.mode === 'old' ? (c ? c.name : '') : (st.name.trim() || 'Nuovo corso'), p = pairs();
          if (!p.length) { sm.innerHTML = '<b>RIEPILOGO</b>Scegli almeno un giorno e un orario.'; go.textContent = 'Aggiungi al programma'; go.disabled = true; return; }
          var ds = st.days.slice().sort().map(function (d) { return WD[d].toLowerCase(); }).join(', '), ts = st.times.slice().sort().join(' e ');
          sm.innerHTML = '<b>RIEPILOGO</b>' + esc2(nm) + ' · ' + ds + ' alle ' + ts + ' · ' + st.cap + ' posti<small>' + p.length + (p.length === 1 ? ' lezione' : ' lezioni') + ' a settimana</small>';
          go.textContent = 'Aggiungi ' + p.length + (p.length === 1 ? ' lezione' : ' lezioni'); go.disabled = st.mode === 'new' && !st.name.trim();
        }
        box.appendChild(L); box.appendChild(R); sum = sumFn; sumFn();
      }
      var sum = function () {};
      function esc2(x) { return String(x).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }
      function fail(e) { st.busy = false; msg.className = 'gxWhy'; msg.textContent = e.message || String(e); }
      function submit() {
        if (st.busy) return; st.busy = true; msg.className = ''; msg.textContent = '';
        var p = pairs(), c = course(), prep;
        if (st.mode === 'new') {
          var nm = st.name.trim();
          prep = api({ action: 'course_save', name: nm, category: st.cat, duration_min: st.dur, capacity: st.cap }).then(function () { return reload(); }).then(function () { D = S.data; var f = D.courses.filter(function (x) { return x.name === nm; }).pop(); if (!f) throw new Error('Corso non trovato dopo il salvataggio.'); return f; });
        } else prep = Promise.resolve(c);
        prep.then(function (cc) {
          var added = 0, skipped = 0, chain = Promise.resolve();
          p.forEach(function (x) { chain = chain.then(function () { return api({ action: 'schedule_add', course_id: cc.id, weekday: x[0], time: x[1], capacity: st.cap === cc.capacity ? '' : st.cap }).then(function () { added++; }).catch(function (e) { if (/già/i.test(e.message)) skipped++; else throw e; }); }); });
          return chain.then(function () { return reload(); }).then(function () { toast(added ? (added === 1 ? 'Aggiunta 1 lezione.' : 'Aggiunte ' + added + ' lezioni.') + (skipped ? ' ' + skipped + ' c\'erano già.' : '') : 'Erano già tutte in programma.', added ? 'ok' : 'bad'); close(); });
        }).catch(fail);
      }
      draw();
    });
  }
  function sProgList() {
    sheet('Già in programma', function (w, close) {
      var bk = btn('‹ Aggiungi al programma', 'ghost sm', function () { close(); sCorsi(); }); bk.style.marginBottom = '6px'; w.appendChild(bk);
      w.appendChild(el('div', 'gxDh', 'Corsi'));
      if (!S.data.courses.length) w.appendChild(el('div', 'gxEmpty', 'Nessun corso. Crea il primo.'));
      S.data.courses.forEach(function (c) { var r = el('div', 'gxLs'), l = el('div'); l.appendChild(el('b', null, c.name)); l.appendChild(el('div', 'gxM', cat(c.category) + ' · ' + c.duration_min + ' min · ' + c.capacity + ' posti')); r.appendChild(l); r.appendChild(btn('Modifica', 'ghost sm', function () { close(); courseForm(c); })); w.appendChild(r); });
      var a = btn('Nuovo corso', 'block', function () { close(); courseForm(); }); a.style.marginTop = '6px'; w.appendChild(a);
      w.appendChild(el('div', 'gxDh', 'Programma settimanale'));
      for (var d = 1; d <= 7; d++) {
        (function (d) {
          var items = S.data.schedule.filter(function (s) { return s.weekday === d; });
          w.appendChild(el('div', 'gxM', WD[d])).style.cssText = 'margin:10px 0 4px;font-weight:700';
          if (!items.length) { w.appendChild(el('div', 'gxM', 'Nessuna lezione')); return; }
          items.forEach(function (s) {
            var c = S.data.courses.filter(function (x) { return x.id === s.course_id; })[0]; if (!c) return;
            var r = el('div', 'gxLs'), l = el('div'); l.appendChild(el('b', null, s.time + ' · ' + c.name)); if (s.capacity) l.appendChild(el('div', 'gxM', s.capacity + ' posti')); r.appendChild(l);
            r.appendChild(btn('Modifica', 'ghost sm', function () { close(); lessonEdit(s, c, sProgList); }));
            r.appendChild(btn('Togli', 'ghost sm', function () { confirmBar(w, 'Togliere ' + c.name + ' del ' + WD[d].toLowerCase() + ' alle ' + s.time + '? Chi è prenotato viene tolto.', function () { act({ action: 'schedule_delete', id: s.id }, 'Tolta.').then(function () { close(); return reload().then(sProgList); }); }); }));
            w.appendChild(r);
          });
        })(d);
      }
      var b = btn('Aggiungi lezione', 'block', function () { close(); lessonForm(); }); b.style.marginTop = '12px'; w.appendChild(b);
    });
  }
  function lessonEdit(s, c, back) {
    sheet(WD[s.weekday] + ' ' + s.time + ' · ' + c.name, function (w, close) {
      var cap = s.capacity || c.capacity;
      w.appendChild(el('div', 'gxDh', 'Posti disponibili'));
      var st = el('div', 'gxStep'), mi = el('button', null, '−'), cv = el('b', null, String(cap)), pl = el('button', null, '+'); mi.type = 'button'; pl.type = 'button';
      mi.addEventListener('click', function () { cap = Math.max(1, cap - 1); cv.textContent = cap; }); pl.addEventListener('click', function () { cap = Math.min(200, cap + 1); cv.textContent = cap; });
      st.appendChild(mi); st.appendChild(cv); st.appendChild(pl); w.appendChild(st);
      w.appendChild(el('p', null, 'La modifica vale ogni settimana. Chi è già prenotato resta prenotato.'));
      var dd = sel([1, 2, 3, 4, 5, 6, 7].map(function (i) { return [i, WD[i]]; }), s.weekday), t = inp('time', s.time);
      var two = el('div', 'gxTwo'); two.appendChild(field('Giorno', dd)); two.appendChild(field('Ora', t)); w.appendChild(two);
      var msg = el('div'); w.appendChild(msg);
      w.appendChild(btn('Salva', 'block', function () {
        msg.className = ''; msg.textContent = '';
        api({ action: 'schedule_update', id: s.id, capacity: cap === c.capacity ? '' : cap, weekday: dd.value, time: t.value }).then(function () { toast('Salvato.', 'ok'); close(); return reload().then(back); }).catch(function (e) { msg.className = 'gxWhy'; msg.textContent = e.message; });
      }));
      var bk = btn('Indietro', 'ghost block', function () { close(); back(); }); bk.style.marginTop = '8px'; w.appendChild(bk);
    });
  }
  function courseForm(c) {
    sheet(c ? 'Modifica corso' : 'Nuovo corso', function (w, close) {
      var n = inp('text', c ? c.name : ''), ct = sel(S.data.categories.map(function (x) { return [x, cat(x)]; }), c ? c.category : 'corsi'), du = inp('number', c ? c.duration_min : 60), cp = inp('number', c ? c.capacity : 12), ds = inp('text', c ? c.description : '');
      du.inputMode = 'numeric'; cp.inputMode = 'numeric';
      w.appendChild(field('Nome', n)); w.appendChild(field('Tipo (decide quali abbonamenti lo includono)', ct));
      var two = el('div', 'gxTwo'); two.appendChild(field('Durata (minuti)', du)); two.appendChild(field('Posti', cp)); w.appendChild(two);
      w.appendChild(field('Descrizione breve (facoltativa)', ds));
      var msg = el('div'); w.appendChild(msg);
      w.appendChild(btn('Salva', 'block', function () { msg.className = ''; msg.textContent = ''; api({ action: 'course_save', id: c ? c.id : undefined, name: n.value, category: ct.value, duration_min: du.value, capacity: cp.value, description: ds.value }).then(function () { toast('Salvato.', 'ok'); close(); return reload().then(sCorsi); }).catch(function (e) { msg.className = 'gxWhy'; msg.textContent = e.message; }); }));
      if (c) { var dl = btn('Elimina corso', 'danger block', function () { confirmBar(w, 'Eliminare ' + c.name + ' e le sue lezioni? Chi è prenotato viene tolto.', function () { act({ action: 'course_delete', id: c.id }, 'Eliminato.').then(function () { close(); return reload().then(sCorsi); }); }); }); dl.style.marginTop = '8px'; w.appendChild(dl); }
    });
  }
  function lessonForm() {
    if (!S.data.courses.length) { toast('Prima crea un corso.', 'bad'); return; }
    sheet('Aggiungi lezione', function (w, close) {
      var c = sel(S.data.courses.map(function (x) { return [x.id, x.name]; })), dd = sel([1, 2, 3, 4, 5, 6, 7].map(function (i) { return [i, WD[i]]; }), 1), t = inp('time', '18:30'), cp = inp('number', ''); cp.inputMode = 'numeric';
      w.appendChild(field('Corso', c)); var two = el('div', 'gxTwo'); two.appendChild(field('Giorno', dd)); two.appendChild(field('Ora', t)); w.appendChild(two);
      w.appendChild(field('Posti (vuoto = quelli del corso)', cp));
      var msg = el('div'); w.appendChild(msg);
      w.appendChild(btn('Aggiungi', 'block', function () { msg.className = ''; msg.textContent = ''; api({ action: 'schedule_add', course_id: c.value, weekday: dd.value, time: t.value, capacity: cp.value }).then(function () { toast('Aggiunta.', 'ok'); close(); return reload().then(sCorsi); }).catch(function (e) { msg.className = 'gxWhy'; msg.textContent = e.message; }); }));
    });
  }
  function sAbb() {
    sheet('Abbonamenti', function (w, close) {
      if (!S.data.plans.length) w.appendChild(el('div', 'gxEmpty', 'Nessun abbonamento. Crea il primo, per esempio Mensile.'));
      S.data.plans.forEach(function (p) { var r = el('div', 'gxLs'), l = el('div'); l.appendChild(el('b', null, p.name + (p.price_eur != null ? ' · ' + eur(p.price_eur) : ''))); l.appendChild(el('div', 'gxM', (p.kind === 'time' ? p.days + ' giorni' : p.entries + ' ingressi') + (p.max_entries ? ' · ' + p.max_entries + ' ingressi al mese' : '') + (p.max_per_week ? ' · max ' + p.max_per_week + ' a settimana' : '') + ' · ' + p.covers.map(cat).join(', '))); r.appendChild(l); r.appendChild(btn('Modifica', 'ghost sm', function () { close(); planForm(p); })); w.appendChild(r); });
      var a = btn('Nuovo tipo', 'block', function () { close(); planForm(); }); a.style.marginTop = '8px'; w.appendChild(a);
    });
  }
  function planForm(p) {
    sheet(p ? 'Modifica abbonamento' : 'Nuovo tipo di abbonamento', function (w, close) {
      var n = inp('text', p ? p.name : ''), k = sel([['time', 'A tempo (mensile, annuale...)'], ['entries', 'A ingressi']], p ? p.kind : 'time'), dv = inp('number', p ? (p.kind === 'time' ? p.days : p.entries) : 30), pr = inp('number', p && p.price_eur != null ? p.price_eur : '');
      dv.inputMode = 'numeric'; pr.step = '0.01'; pr.inputMode = 'decimal';
      var lab = el('span', null, ''), dl = el('label', 'gxF'); dl.appendChild(lab); dl.appendChild(dv);
      function sync() { lab.textContent = k.value === 'time' ? 'Durata (giorni)' : 'Numero di ingressi'; }
      k.addEventListener('change', function () { sync(); dv.value = k.value === 'time' ? 30 : 10; }); sync();
      var mx = inp('number', p && p.max_entries ? p.max_entries : ''), mw = inp('number', p && p.max_per_week ? p.max_per_week : ''); mx.inputMode = 'numeric'; mw.inputMode = 'numeric'; mx.placeholder = 'nessun limite'; mw.placeholder = 'nessun limite';
      w.appendChild(field('Nome', n)); w.appendChild(field('Tipo', k)); w.appendChild(dl); w.appendChild(field('Prezzo (€)', pr));
      var lim = el('div', 'gxTwo'); lim.appendChild(field('Ingressi al mese (max)', mx)); lim.appendChild(field('A settimana (max)', mw)); w.appendChild(lim);
      w.appendChild(el('div', 'gxDh', 'Corsi inclusi'));
      var sel0 = p ? p.covers.slice() : (S.data.plan_categories || S.data.categories).slice(), ch = el('div', 'gxChips');
      (S.data.plan_categories || S.data.categories).forEach(function (c) { var b = el('button', 'gxCp', cat(c)); b.type = 'button'; function paint() { b.setAttribute('aria-pressed', sel0.indexOf(c) >= 0 ? 'true' : 'false'); } paint(); b.addEventListener('click', function () { var i = sel0.indexOf(c); if (i >= 0) sel0.splice(i, 1); else sel0.push(c); paint(); }); ch.appendChild(b); });
      w.appendChild(ch);
      var h = el('p', null, 'Esempio: il Mensile da 60 € include tutti i corsi e il Personal 1:1, con 8 ingressi al mese e massimo 2 a settimana.'); h.style.marginTop = '8px'; w.appendChild(h);
      var msg = el('div'); w.appendChild(msg);
      w.appendChild(btn('Salva', 'block', function () {
        var b = { action: 'plan_save', id: p ? p.id : undefined, name: n.value, kind: k.value, price_eur: pr.value, covers: sel0, max_entries: mx.value, max_per_week: mw.value }; if (k.value === 'time') b.days = dv.value; else b.entries = dv.value;
        msg.className = ''; msg.textContent = ''; api(b).then(function () { toast('Salvato.', 'ok'); close(); return reload().then(sAbb); }).catch(function (e) { msg.className = 'gxWhy'; msg.textContent = e.message; });
      }));
      if (p) { var d = btn('Elimina tipo', 'danger block', function () { confirmBar(w, 'Eliminare questo tipo? Gli abbonamenti già venduti restano validi.', function () { act({ action: 'plan_delete', id: p.id }, 'Eliminato.').then(function () { close(); return reload().then(sAbb); }); }); }); d.style.marginTop = '8px'; w.appendChild(d); }
    });
  }
  function sChiusure() {
    sheet('Chiusure e ferie', function (w, close) {
      w.appendChild(el('p', null, 'Le lezioni dei giorni scelti si annullano da sole. Chi era prenotato viene tolto e gli ingressi tornano disponibili.'));
      var list = S.data.closures || [];
      if (!list.length) w.appendChild(el('div', 'gxEmpty', 'Nessuna chiusura in programma.'));
      list.forEach(function (c) { var r = el('div', 'gxLs'), l = el('div'); l.appendChild(el('b', null, dlabel(c.date))); l.appendChild(el('div', 'gxM', (c.reason ? c.reason + ' · ' : '') + c.count + (c.count === 1 ? ' lezione annullata' : ' lezioni annullate'))); r.appendChild(l); r.appendChild(btn('Riapri', 'ghost sm', function () { act({ action: 'closure_delete', from: c.date, to: c.date }, 'Giorno riaperto.').then(function () { close(); return reload().then(sChiusure); }); })); w.appendChild(r); });
      w.appendChild(el('div', 'gxDh', 'Nuova chiusura'));
      var from = inp('date', S.data.today), to = inp('date', S.data.today), why = inp('text', '', 'Es. Ferragosto');
      var two = el('div', 'gxTwo'); two.appendChild(field('Dal', from)); two.appendChild(field('Al', to)); w.appendChild(two); w.appendChild(field('Motivo (facoltativo)', why));
      var msg = el('div'); w.appendChild(msg);
      w.appendChild(btn('Aggiungi chiusura', 'block', function () { msg.className = ''; msg.textContent = ''; api({ action: 'closure_add', from: from.value, to: to.value || from.value, reason: why.value }).then(function (j) { toast(j.lessons ? 'Annullate ' + j.lessons + (j.lessons === 1 ? ' lezione.' : ' lezioni.') : 'In quei giorni non c\'erano lezioni.', 'ok'); close(); return reload().then(sChiusure); }).catch(function (e) { msg.className = 'gxWhy'; msg.textContent = e.message; }); }));
    });
  }
  function sRegole() {
    sheet('Regole e avvisi', function (w, close) {
      var st = S.data.settings;
      var h = sel([[0, 'Fino all\'inizio'], [1, '1 ora prima'], [2, '2 ore prima'], [3, '3 ore prima'], [6, '6 ore prima'], [12, '12 ore prima'], [24, '1 giorno prima']], st.cutoff_min / 60);
      w.appendChild(field('Si può disdire fino a', h));
      w.appendChild(el('p', null, 'Se l\'iscritto disdice in tempo, l\'ingresso gli torna. Dopo no.'));
      var ex = sel([[3, '3 giorni prima'], [5, '5 giorni prima'], [7, '7 giorni prima'], [10, '10 giorni prima']], st.expiry_days || 5);
      w.appendChild(field('Avvisami della scadenza', ex));
      w.appendChild(el('p', null, 'Da quel giorno l\'abbonamento compare tra le notifiche e in "In scadenza".'));
      w.appendChild(el('div', 'gxDh', 'Ore del Personal 1:1'));
      var hours = (st.pt_hours || []).slice(), ch = el('div', 'gxChips');
      for (var hh = 7; hh <= 21; hh++) {
        (function (t) { var b = el('button', 'gxCp', t); b.type = 'button'; function paint() { b.setAttribute('aria-pressed', hours.indexOf(t) >= 0 ? 'true' : 'false'); } paint(); b.addEventListener('click', function () { var i = hours.indexOf(t); if (i >= 0) hours.splice(i, 1); else hours.push(t); paint(); }); ch.appendChild(b); })(pad(hh) + ':00');
      }
      w.appendChild(ch);
      var n = el('p', null, 'Il Personal compare solo in queste ore e solo se in quell\'ora non c\'è un corso.'); n.style.marginTop = '8px'; w.appendChild(n);
      w.appendChild(btn('Salva', 'block', function () { act({ action: 'settings_save', cutoff_hours: h.value, expiry_days: ex.value, pt_hours: hours.sort() }, 'Salvato.').then(function () { close(); return reload(); }); }));
    });
  }

  // ---------- Scheda palestra: stessa struttura delle altre attività, riempita con i dati della palestra ----------
  var pfObs = null, pfBusy = false;
  // l'intestazione compare una volta sola, già completa (niente scatti tra testo standard e testo della palestra)
  ['/gym/hero.jpg', '/gym/logo.png'].forEach(function (u) { try { new Image().src = u; } catch (e) { } });
  function pfReady() {
    var h = document.getElementById('pfHero'), nm = document.getElementById('pfName');
    if (!h || h.classList.contains('gpfReady')) return;
    if (nm && nm.textContent && nm.textContent !== 'La tua attività') h.classList.add('gpfReady');
  }
  setTimeout(function () { var h = document.getElementById('pfHero'); if (h) h.classList.add('gpfReady'); }, 3500);
  (function () { var k = document.getElementById('pfKind'); if (!k) return; var fix = function () { if (k.textContent !== 'Palestra') k.textContent = 'Palestra'; }; fix(); new MutationObserver(fix).observe(k, { childList: true, characterData: true, subtree: true }); })();
  function pfPaint() {
    var D = S.data, root = document.getElementById('panelProfile'); if (!D || !root || pfBusy) return;
    pfBusy = true; if (pfObs) pfObs.disconnect();
    try {
      var kd = document.getElementById('pfKind'); if (kd) kd.textContent = 'Palestra';
      var nm = document.getElementById('pfName'); if (nm && (!nm.textContent || nm.textContent === 'La tua attività') && D.business && D.business.name) nm.textContent = D.business.name;
      var CL = { circuiti: 'a', hyrox: 'c', pilates: 'd', personal: 'b' };
      // --- corsi e abbonamenti
      var sv = document.getElementById('pfServices');
      function row(col, name, meta, right, price) {
        var r = el('div', 'svRow'); r.style.setProperty('--sv', 'var(--wk-' + col + '-bd, var(--accent))'); r.appendChild(el('span', 'svBar'));
        var tx = el('div', 'svTx'); tx.appendChild(el('b', null, name)); tx.appendChild(el('span', null, meta)); r.appendChild(tx);
        if (right) r.appendChild(el('span', price ? 'svPrice' : 'gpfCnt', right)); return r;
      }
      if (sv) {
        var card = sv.closest('.pfCard'); if (card) { var h = card.querySelector('h3'); if (h) h.textContent = 'Corsi'; var sub = card.querySelector('.svSub'); if (sub) sub.textContent = 'Le lezioni che gli iscritti possono prenotare.'; }
        sv.innerHTML = ''; sv.className = 'gpfList';
        var perC = {}; (D.schedule || []).forEach(function (x) { perC[x.course_id] = (perC[x.course_id] || 0) + 1; });
        function head(t) { return el('div', 'gpfH', t); }
        if ((D.courses || []).length) {
          D.courses.forEach(function (c) { var n = perC[c.id] || 0; sv.appendChild(row(CL[c.category] || 'a', c.name, c.duration_min + ' min · max ' + c.capacity + ' posti', n ? n + (n === 1 ? ' lezione' : ' lezioni') + '/sett.' : 'non in programma')); });
        }
        var pth = (D.settings && D.settings.pt_hours) || [];
        sv.appendChild(row('b', 'Personal 1:1', 'Su prenotazione' + (pth.length ? ' · ' + pth.length + ' fasce al giorno' : ''), ''));
      }
      // --- abbonamenti: card a sé, subito dopo i corsi
      var pc = document.getElementById('gpfPlans');
      if (!pc) {
        var svCard = sv && sv.closest('.pfCard');
        if (svCard) {
          var c2 = el('div', 'pfCard gpfPlansCard'); c2.id = 'gpfPlansCard';
          var h2 = el('div', 'pf2H'); h2.appendChild(el('h3', null, 'Abbonamenti')); var ed = el('button', 'pf2Ed', 'Modifica'); ed.type = 'button'; ed.id = 'gpfPlansEd'; h2.appendChild(ed); c2.appendChild(h2);
          c2.appendChild(el('p', 'svSub', 'Quelli che gli iscritti possono sottoscrivere.'));
          pc = el('div', 'gpfList gpfPlans'); pc.id = 'gpfPlans'; c2.appendChild(pc);
          svCard.parentNode.insertBefore(c2, svCard.nextSibling);
          ed.onclick = function () { var m = document.getElementById('menuTabOther'); if (m) m.click(); setTimeout(function () { try { openSetting('abb'); } catch (e) { } }, 80); };
        }
      }
      if (pc) {
        pc.innerHTML = '';
        if (!(D.plans || []).length) pc.appendChild(el('p', 'pfHint', 'Nessun abbonamento ancora. Aggiungili da “Modifica”.'));
        (D.plans || []).forEach(function (p) {
          var meta = p.kind === 'entries' ? (p.entries || '') + ' ingressi' : (p.days === 30 ? 'Mensile' : p.days === 90 ? 'Trimestrale' : p.days === 180 ? 'Semestrale' : p.days === 365 ? 'Annuale' : p.days + ' giorni');
          if (p.max_per_week) meta += ' · max ' + p.max_per_week + ' a settimana';
          pc.appendChild(row('e', p.name, meta, eur(p.price_eur), true));
        });
      }
      // --- orari: dalle lezioni in programma
      var hb = document.getElementById('pfHours');
      if (hb) {
        var byD = {}; (D.schedule || []).forEach(function (x) { var c = (D.courses || []).filter(function (y) { return y.id === x.course_id; })[0], dur = c ? c.duration_min : 60, a = x.time.split(':'), st = (+a[0]) * 60 + (+a[1]), en = st + dur; var o = byD[x.weekday] || (byD[x.weekday] = { a: 1e9, b: 0 }); o.a = Math.min(o.a, st); o.b = Math.max(o.b, en); });
        function hm(m) { return pad(Math.floor(m / 60) % 24) + ':' + pad(m % 60); }
        var hc = hb.closest('.pfCard'); if (hc) hc.classList.add('gpfHrsCard');
        hb.innerHTML = '';
        for (var w = 1; w <= 7; w++) { var o = byD[w], r = el('div', 'pfRow' + (o ? '' : ' closed')); r.appendChild(el('span', 'pfRowName', WD[w])); r.appendChild(el('span', 'pfRowMeta', o ? hm(o.a) + '–' + hm(o.b) : 'Chiuso')); hb.appendChild(r); }
      }
      // --- ordine delle card (uguale alle altre attività, con gli abbonamenti a sé)
      function place(node, ord, full) { var c = node && (node.classList && node.classList.contains('pfCard') ? node : node.closest && node.closest('.pfCard')); if (c) { c.style.order = ord; c.style.gridColumn = full ? '1 / -1' : 'auto'; } }
      place(document.getElementById('pfRefCard'), 1, true); place(sv, 2); place(document.getElementById('pfHours'), 3); place(document.getElementById('gpfPlansCard'), 4, true);
      place(document.getElementById('pfTeamCard'), 5); place(document.getElementById('pfChannels'), 6); place(document.getElementById('pfContactsCard'), 7, true);
      // --- canali: solo il calendario online (niente WhatsApp, Telegram, webchat)
      root.querySelectorAll('#pfChannels .pf2Ch').forEach(function (r) { if (r.querySelector('.pf2Ci.chat, .pf2Ci.wa, .pf2Ci.tg')) r.remove(); });
      // --- aperto adesso, dalle lezioni in programma
      var on = document.getElementById('pfOpenNow');
      if (on && S.data.schedule && S.data.schedule.length) {
        var nw = new Date(), wd = nw.getDay() || 7, nm_ = nw.getHours() * 60 + nw.getMinutes(), until = null;
        S.data.schedule.forEach(function (x) { if (x.weekday !== wd) return; var c = (S.data.courses || []).filter(function (y) { return y.id === x.course_id; })[0], a = x.time.split(':'), st_ = (+a[0]) * 60 + (+a[1]), en_ = st_ + (c ? c.duration_min : 60); if (nm_ >= st_ - 30 && nm_ < en_) until = Math.max(until || 0, en_); });
        on.hidden = false; on.className = 'pfOpenNow' + (until ? ' open' : '');
        on.textContent = until ? 'Aperto ora · fino alle ' + pad(Math.floor(until / 60) % 24) + ':' + pad(until % 60) : 'Chiuso ora';
      }
      // --- "Modifica" porta alle impostazioni della palestra
      root.querySelectorAll('[data-pfedit]').forEach(function (b) { b.onclick = function () { var m = document.getElementById('menuTabOther'); if (m) m.click(); }; });
    } catch (e) { /* la scheda resta com’è */ }
    pfReady();
    pfBusy = false; pfWatch();
  }
  function pfWatch() {
    var root = document.getElementById('panelProfile'); if (!root) return;
    if (!pfObs) pfObs = new MutationObserver(function () { clearTimeout(pfObs.t); pfObs.t = setTimeout(pfPaint, 60); });
    pfObs.observe(root, { childList: true, subtree: true });
  }
  // "Invita un amico": se per qualche motivo la scheda standard non lo mostra, lo compila la palestra con gli stessi elementi
  var refTry = 0;
  function pfRefEnsure() {
    var card = document.getElementById('pfRefCard'); if (!card || !card.hidden || refTry >= 3) return;
    refTry++;
    fetch('/api/agenda?t=' + encodeURIComponent(token) + '&referral=1').then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.available || !d.link || !card.hidden) return;
      var st = document.getElementById('pfRefStats'), m = Number(d.credit_months) || 0;
      if (st) { st.innerHTML = ''; [['hi', 'In regalo', m], ['', 'Invitate', d.invited || 0], ['', 'Hanno pagato', m]].forEach(function (c) { var x = el('div', 'rfStat' + (c[0] ? ' ' + c[0] : '')); x.appendChild(el('small', null, c[1])); x.appendChild(el('b', null, String(c[2]))); st.appendChild(x); }); }
      var u = document.getElementById('pfRefUrl'); if (u) u.textContent = d.link.replace(/^https?:\/\//, '');
      var cd = document.getElementById('pfRefCode'); if (cd) cd.textContent = d.code || '';
      function copy(txt, b, lab) { try { navigator.clipboard.writeText(txt); } catch (e) { } var sp = b.querySelector('span'); if (sp) { sp.textContent = 'Copiato'; setTimeout(function () { sp.textContent = lab; }, 1500); } }
      var cp = document.getElementById('pfRefCopy'), sh = document.getElementById('pfRefShare'), cc = document.getElementById('pfRefCodeCopy');
      var msg = 'Uso Prenolia per gestire gli appuntamenti della mia attività. Provalo gratis da qui (o usa il codice ' + (d.code || '') + '):';
      if (cp) cp.onclick = function () { copy(d.link, cp, 'Copia link'); };
      if (cc) cc.onclick = function () { copy(d.code || '', cc, 'Copia codice'); };
      if (sh) sh.onclick = function () { if (navigator.share) navigator.share({ title: 'Prenolia', text: msg, url: d.link }).catch(function () { }); else copy(msg + ' ' + d.link, sh, 'Condividi'); };
      card.hidden = false;
    }).catch(function () { });
  }
  document.addEventListener('lia:gymchanged', function () { pfPaint(); });
  pfWatch();
  setTimeout(pfRefEnsure, 3500);
  document.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#menuTabProfile')) { refTry = 0; setTimeout(pfRefEnsure, 2500); } }, true);

  // ---------- condivisione con il calendario (cal.js) ----------
  window.liaGym = {
    S: S, API: API, api: api, act: act, load: load, reload: reload, toast: toast, sheet: sheet, field: field, inp: inp, sel: sel, btn: btn, el: el, confirmBar: confirmBar,
    ymd: ymd, parse: parse, addDays: addDays, monday: monday, dlabel: dlabel, short: short, cat: cat, eur: eur, pad: pad, ic: ic,
    DN: DN, DL: DL, MO: MO, MS: MS, WD: WD, memberSheet: memberSheet, memberForm: memberForm, newPlan: newPlan, openSetting: openSetting
  };
  // dalla campanella: "Abbonamento in scadenza" apre la scheda di quell'iscritto
  window.liaGymMember = function (id) {
    var cb = document.getElementById('menuTabClients'); if (cb) cb.click();
    var go = function () { if (id) memberSheet(id); };
    if (S.data) setTimeout(go, 120); else load().then(function () { setTimeout(go, 120); }).catch(function (e) { toast(e.message, 'bad'); });
  };

  // ---------- avvio ----------
  setLabel('cal');
  var tries = 0, t = setInterval(function () { if (mountSettings() || ++tries > 20) clearInterval(t); }, 250);
  var current = 'cal';
  try { var ap = document.querySelector('.tabPanel.on'); if (ap) current = ({ panelCal: 'cal', panelClients: 'clients', panelStats: 'stats', panelProfile: 'profile', panelShop: 'shop', panelOther: 'other' })[ap.id] || 'cal'; } catch (e) { /* si resta su cal */ }
  S.section = current; setLabel(current);
  showSection(current);
  (S.data ? Promise.resolve() : load().catch(function () {})).then(function () { pfPaint(); });
})();
