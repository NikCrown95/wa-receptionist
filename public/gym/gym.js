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
  var CATL = { corsi: 'Corsi', circuiti: 'Circuiti', hyrox: 'Hyrox' };
  var IC = {
    l: '<path d="M15 6l-6 6 6 6"/>', r: '<path d="M9 6l6 6-6 6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
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
  function reload() { S.sessions = null; S.week = null; S.stats = null; return load().then(function () { renderAll(); }); }

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
  var MENU = { menuTabCal: 'Lezioni', menuTabClients: 'Iscritti', menuTabProfile: 'Scheda palestra' };
  Object.keys(MENU).forEach(function (id) {
    var b = document.getElementById(id); if (!b) return;
    for (var i = b.childNodes.length - 1; i >= 0; i--) { var n = b.childNodes[i]; if (n.nodeType === 3 && n.textContent.trim()) { n.textContent = '\n    ' + MENU[id] + '\n  '; break; } }
  });
  var LABELS = { cal: 'Lezioni', clients: 'Iscritti', stats: 'Statistiche', profile: 'Scheda palestra', shop: 'Shop', other: 'Impostazioni' };
  function setLabel(w) { var l = document.getElementById('sectionLabel'); if (l && LABELS[w]) l.textContent = LABELS[w]; }
  document.addEventListener('lia:section', function (e) { S.section = e.detail; setLabel(e.detail); showSection(e.detail); });

  // ---------- pannelli ----------
  var pCal = document.getElementById('panelCal'), pCli = document.getElementById('panelClients'), pSt = document.getElementById('panelStats');
  var xCal = el('div', 'gx'), xMem = el('div', 'gx'), xStat = el('div', 'gx');
  if (pCal) pCal.appendChild(xCal); if (pCli) pCli.appendChild(xMem); if (pSt) pSt.appendChild(xStat);
  var fab = el('button', 'gxFab'); fab.type = 'button'; fab.hidden = true; fab.setAttribute('aria-label', 'Aggiungi'); fab.innerHTML = ic('plus', 26); document.body.appendChild(fab);
  fab.addEventListener('click', function () { if (S.section === 'cal') addAttPick(); else if (S.section === 'clients') memberForm(); });

  function showSection(w) {
    fab.hidden = !(w === 'cal' || w === 'clients');
    if (w === 'cal') renderCal(); else if (w === 'clients') renderMem(); else if (w === 'stats') renderStat();
    if (S.data && w !== 'cal' && w !== 'clients' && w !== 'stats') return;
    if (!S.data) load().then(function () { renderAll(); }).catch(function (e) { var x = w === 'clients' ? xMem : w === 'stats' ? xStat : xCal; x.textContent = ''; x.appendChild(el('div', 'gxWhy', e.message)); });
  }
  function renderAll() { if (S.section === 'cal') renderCal(); if (S.section === 'clients') renderMem(); if (S.section === 'stats') renderStat(); }

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
      w.appendChild(btn('Aggiungi', 'block', function () { msg.textContent = ''; msg.className = ''; api({ action: 'booking_add', member_id: sl.value, schedule_id: s.schedule_id, date: date }).then(function () { toast('Aggiunto.', 'ok'); close(); S.sessions = null; S.week = null; renderCal(); }).catch(function (e) { msg.className = 'gxWhy'; msg.textContent = e.message; }); }));
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
      w.appendChild(btn('Annulla la lezione', 'danger block', function () { act({ action: 'session_cancel', schedule_id: s.schedule_id, date: date, reason: r.value }, 'Lezione annullata.').then(function () { close(); S.sessions = null; S.week = null; renderCal(); }); }));
    });
  }

  // ---------- Iscritti ----------
  function renderMem() {
    xMem.textContent = '';
    if (!S.data) { xMem.appendChild(el('div', 'gxEmpty', 'Carico...')); return; }
    var q = el('input', 'gxSearch'); q.type = 'search'; q.placeholder = 'Cerca per nome o telefono'; q.value = S.q; xMem.appendChild(q);
    var fl = el('div', 'gxFl');
    [['all', 'Tutti'], ['warn', 'In scadenza'], ['bad', 'Scaduti'], ['none', 'Senza abbonamento']].forEach(function (f) {
      var b = el('button', 'gxCp', f[1]); b.type = 'button'; b.setAttribute('aria-pressed', S.flt === f[0] ? 'true' : 'false');
      b.addEventListener('click', function () { S.flt = f[0]; renderMem(); }); fl.appendChild(b);
    });
    xMem.appendChild(fl);
    var box = el('div'); xMem.appendChild(box);
    function list() {
      box.textContent = '';
      var qq = S.q.trim().toLowerCase();
      var ms = S.data.members.filter(function (m) { return (S.flt === 'all' || m.status.s === S.flt) && (!qq || (m.first_name + ' ' + m.last_name + ' ' + m.phone).toLowerCase().indexOf(qq) >= 0); });
      if (!ms.length) { box.appendChild(el('div', 'gxEmpty', S.data.members.length ? 'Nessun risultato.' : 'Ancora nessun iscritto. Aggiungi il primo con il pulsante più.')); return; }
      ms.forEach(function (m) {
        var r = el('button', 'gxMr'); r.type = 'button';
        r.appendChild(el('div', 'gxAv', (m.first_name[0] || '') + (m.last_name[0] || '')));
        var tx = el('div', 'gxTx'); tx.appendChild(el('b', null, m.first_name + ' ' + m.last_name)); tx.appendChild(el('small', null, m.status.detail)); r.appendChild(tx);
        r.appendChild(el('span', 'gxChip ' + m.status.s, m.status.label));
        r.addEventListener('click', function () { memberSheet(m.id); }); box.appendChild(r);
      });
    }
    q.addEventListener('input', function () { S.q = q.value; list(); });
    list();
  }
  function memberForm(m) {
    sheet(m ? 'Modifica dati' : 'Nuovo iscritto', function (w, close) {
      var f = inp('text', m ? m.first_name : ''), l = inp('text', m ? m.last_name : ''), p = inp('tel', m ? m.phone : ''), n = el('textarea'); n.value = m ? m.notes : '';
      var two = el('div', 'gxTwo'); two.appendChild(field('Nome', f)); two.appendChild(field('Cognome', l)); w.appendChild(two);
      w.appendChild(field('Telefono', p)); w.appendChild(field('Note (facoltative)', n));
      w.appendChild(el('p', null, 'Nome, cognome e telefono servono all\'iscritto per entrare e prenotare: devono essere scritti come li dirà lui.'));
      var msg = el('div'); w.appendChild(msg);
      w.appendChild(btn('Salva', 'block', function () {
        msg.textContent = ''; msg.className = '';
        api({ action: 'member_save', id: m ? m.id : undefined, first_name: f.value, last_name: l.value, phone: p.value, notes: n.value }).then(function (j) { toast('Salvato.', 'ok'); close(); return reload().then(function () { if (!m) memberSheet(j.id); }); }).catch(function (e) { msg.className = 'gxWhy'; msg.textContent = e.message; });
      }));
    });
  }
  function memberSheet(id) {
    var m = S.data.members.filter(function (x) { return x.id === id; })[0]; if (!m) return;
    sheet(m.first_name + ' ' + m.last_name, function (w, close) {
      var top = el('div', 'gxRow'), l = el('div'); l.appendChild(el('div', 'gxM', m.phone)); if (m.notes) l.appendChild(el('div', 'gxM', m.notes));
      top.appendChild(l); top.appendChild(el('span', 'gxChip ' + m.status.s, m.status.label)); w.appendChild(top);
      w.appendChild(el('div', 'gxDh', 'Abbonamenti'));
      if (!m.plans.length) w.appendChild(el('div', 'gxEmpty', 'Nessun abbonamento.'));
      m.plans.forEach(function (p) {
        var c = el('div', 'gxCard'), r = el('div', 'gxRow'), x = el('div'); x.appendChild(el('b', null, p.plan_name));
        x.appendChild(el('div', 'gxM', p.kind === 'time' ? 'Dal ' + short(p.starts_on) + ' al ' + short(p.ends_on) + ' ' + p.ends_on.slice(0, 4) : p.entries_left + ' ingressi rimasti su ' + p.entries_total));
        x.appendChild(el('div', 'gxM', p.covers.map(cat).join(', ') + (p.price_paid != null ? ' · ' + eur(p.price_paid) : '')));
        r.appendChild(x); r.appendChild(el('span', 'gxChip ' + (p.valid ? 'ok' : 'bad'), p.valid ? 'Valido' : 'Non valido')); c.appendChild(r);
        var ac = el('div', 'gxActs');
        ac.appendChild(btn(p.kind === 'time' ? 'Cambia scadenza' : 'Cambia ingressi', 'ghost sm', function () { editPlan(p, close); }));
        ac.appendChild(btn('Annulla', 'danger sm', function () { confirmBar(c, 'Annullare questo abbonamento?', function () { act({ action: 'member_plan_update', id: p.id, cancelled: true }, 'Annullato.').then(function () { close(); return reload().then(function () { memberSheet(id); }); }); }); }));
        c.appendChild(ac); w.appendChild(c);
      });
      var add = btn('Nuovo abbonamento', 'block', function () { close(); newPlan(m); }); add.style.marginTop = '10px'; w.appendChild(add);
      var ac2 = el('div', 'gxActs');
      ac2.appendChild(btn('Modifica dati', 'ghost sm', function () { close(); memberForm(m); }));
      ac2.appendChild(btn('Elimina iscritto', 'danger sm', function () { confirmBar(w, 'Eliminare ' + m.first_name + ' ' + m.last_name + '? Le sue prenotazioni future vengono tolte.', function () { act({ action: 'member_delete', id: m.id }, 'Eliminato.').then(function () { close(); return reload(); }); }); }));
      w.appendChild(ac2);
    });
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
      w.appendChild(btn('Aggiungi', 'block', function () { act({ action: 'member_plan_add', member_id: m.id, plan_id: ps.value, starts_on: st.value, price_paid: pr.value }, 'Abbonamento aggiunto.').then(function () { close(); return reload().then(function () { memberSheet(m.id); }); }); }));
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
      ['regole', 'c-amber', 'gear', 'Disdette', 'Fino a quando si può disdire']
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
    sheet('Corsi e programma', function (w, close) {
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
            r.appendChild(btn('Togli', 'ghost sm', function () { confirmBar(w, 'Togliere ' + c.name + ' del ' + WD[d].toLowerCase() + ' alle ' + s.time + '? Chi è prenotato viene tolto.', function () { act({ action: 'schedule_delete', id: s.id }, 'Tolta.').then(function () { close(); return reload().then(sCorsi); }); }); }));
            w.appendChild(r);
          });
        })(d);
      }
      var b = btn('Aggiungi lezione', 'block', function () { close(); lessonForm(); }); b.style.marginTop = '12px'; w.appendChild(b);
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
      S.data.plans.forEach(function (p) { var r = el('div', 'gxLs'), l = el('div'); l.appendChild(el('b', null, p.name + (p.price_eur != null ? ' · ' + eur(p.price_eur) : ''))); l.appendChild(el('div', 'gxM', (p.kind === 'time' ? p.days + ' giorni' : p.entries + ' ingressi') + ' · ' + p.covers.map(cat).join(', '))); r.appendChild(l); r.appendChild(btn('Modifica', 'ghost sm', function () { close(); planForm(p); })); w.appendChild(r); });
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
      w.appendChild(field('Nome', n)); w.appendChild(field('Tipo', k)); w.appendChild(dl); w.appendChild(field('Prezzo (€)', pr));
      w.appendChild(el('div', 'gxDh', 'Corsi inclusi'));
      var sel0 = p ? p.covers.slice() : ['corsi', 'circuiti'], ch = el('div', 'gxChips');
      S.data.categories.forEach(function (c) { var b = el('button', 'gxCp', cat(c)); b.type = 'button'; function paint() { b.setAttribute('aria-pressed', sel0.indexOf(c) >= 0 ? 'true' : 'false'); } paint(); b.addEventListener('click', function () { var i = sel0.indexOf(c); if (i >= 0) sel0.splice(i, 1); else sel0.push(c); paint(); }); ch.appendChild(b); });
      w.appendChild(ch);
      var h = el('p', null, 'Esempio: il Mensile include Corsi e Circuiti; un extra "Hyrox +" include solo Hyrox.'); h.style.marginTop = '8px'; w.appendChild(h);
      var msg = el('div'); w.appendChild(msg);
      w.appendChild(btn('Salva', 'block', function () {
        var b = { action: 'plan_save', id: p ? p.id : undefined, name: n.value, kind: k.value, price_eur: pr.value, covers: sel0 }; if (k.value === 'time') b.days = dv.value; else b.entries = dv.value;
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
    sheet('Disdette', function (w, close) {
      var h = sel([[0, 'Fino all\'inizio'], [1, '1 ora prima'], [2, '2 ore prima'], [3, '3 ore prima'], [6, '6 ore prima'], [12, '12 ore prima'], [24, '1 giorno prima']], S.data.settings.cutoff_min / 60);
      w.appendChild(field('Si può disdire fino a', h));
      w.appendChild(el('p', null, 'Se l\'iscritto disdice in tempo, l\'ingresso gli torna. Dopo no.'));
      w.appendChild(btn('Salva', 'block', function () { act({ action: 'settings_save', cutoff_hours: h.value }, 'Salvato.').then(function () { close(); return reload(); }); }));
    });
  }

  // ---------- avvio ----------
  setLabel('cal');
  var tries = 0, t = setInterval(function () { if (mountSettings() || ++tries > 20) clearInterval(t); }, 250);
  var current = 'cal';
  try { var ap = document.querySelector('.tabPanel.on'); if (ap) current = ({ panelCal: 'cal', panelClients: 'clients', panelStats: 'stats', panelProfile: 'profile', panelShop: 'shop', panelOther: 'other' })[ap.id] || 'cal'; } catch (e) { /* si resta su cal */ }
  S.section = current; setLabel(current);
  showSection(current);
})();
