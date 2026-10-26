/* Impostazioni del circolo (campi sportivi) per la dashboard di Lia: regole, campi e orari, chiusure.
   Si apre dalle voci aggiunte in Impostazioni. Dati da /api/agenda?t=CODICE&courts=1 (&view=settings). */
(function () {
  var token = (new URLSearchParams(location.search).get('t') || '').trim();
  if (!token) return;
  var URL0 = '/api/agenda?t=' + encodeURIComponent(token) + '&courts=1';
  var DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
  var MO = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  var IC = {
    rules: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
    court: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M12 6v12M3 12h18"/>',
    off: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M10 14l4 4M14 14l-4 4"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    chev: '<polyline points="6 9 12 15 18 9"></polyline>'
  };
  function svg(p, s) { return '<svg width="' + (s || 21) + '" height="' + (s || 21) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
  function mins(t) { return +t.slice(0, 2) * 60 + +t.slice(3, 5); }
  function toast(m, bad) {
    var o = document.querySelector('.cp-toast'); if (o) o.remove();
    var t = el('div', 'cp-toast' + (bad ? ' bad' : ''), m); t.setAttribute('role', 'status'); document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 4200);
  }
  function call(body, view) {
    var o = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    return fetch(URL0 + (view ? '&view=' + view : ''), o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Errore, riprova.'); return j; }); });
  }
  function fmtDay(s) { var p = s.split('-'); return +p[2] + ' ' + MO[+p[1] - 1]; }
  function dur(m) { return m < 60 ? m + ' min' : m === 60 ? '1 ora' : m % 60 === 0 ? (m / 60) + ' ore' : Math.floor(m / 60) + ' ora e ' + (m % 60); }

  // ---------- finestra ----------
  var openSheet = null;
  function sheet(title, build) {
    closeSheet();
    var back = el('div', 'cps-back'), box = el('div', 'cps-box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
    var hd = el('div', 'cps-hd'); hd.appendChild(el('h2', null, title));
    var x = el('button', 'cps-x'); x.type = 'button'; x.setAttribute('aria-label', 'Chiudi'); x.innerHTML = svg(IC.x, 20); hd.appendChild(x);
    var body = el('div', 'cps-body'); box.appendChild(hd); box.appendChild(body); back.appendChild(box); document.body.appendChild(back); document.body.classList.add('cps-lock');
    var prev = document.activeElement;
    function close() { closeSheet(); if (prev && prev.focus) try { prev.focus(); } catch (e) { } }
    openSheet = { back: back, close: close, onKey: onKey };
    x.onclick = close; back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    var onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    build(body, close); x.focus();
  }
  function closeSheet() { if (openSheet) { var b = openSheet.back; document.removeEventListener('keydown', openSheet.onKey, true); openSheet = null; if (b.parentNode) b.parentNode.removeChild(b); document.body.classList.remove('cps-lock'); if (window.__cpReload) window.__cpReload(); } }

  // ---------- pezzi di modulo ----------
  function field(label, node, help) { var l = el('label', null, label); l.appendChild(node); if (help) l.appendChild(el('span', 'cps-help', help)); return l; }
  function input(type, val, attrs) { var i = el('input'); i.type = type; i.value = val == null ? '' : val; for (var k in (attrs || {})) i.setAttribute(k, attrs[k]); return i; }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }
  function toggle(on, label) { var b = el('button', 'cps-sw'); b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-label', label); b.setAttribute('aria-checked', on ? 'true' : 'false'); return b; }
  function swRow(title, small, sw) { var r = el('div', 'cps-row'), t = el('div', 'cps-t'); t.appendChild(el('b', null, title)); if (small) t.appendChild(el('small', null, small)); r.appendChild(t); r.appendChild(sw); return r; }
  function btn(label, cls, fn) { var b = el('button', 'cps-btn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; b.onclick = fn; return b; }
  function msgBox() { var m = el('div', 'cps-msg'); m.setAttribute('role', 'alert'); return m; }

  var D = null; // ultime impostazioni lette
  function load() { return call(null, 'settings').then(function (j) { D = j; return j; }); }
  function withData(fn) { load().then(fn).catch(function (e) { toast(e.message, true); }); }

  // ---------- regole del circolo ----------
  function sRules() {
    withData(function () {
      sheet('Regole del circolo', function (w, close) {
        var C = D.club, st = { fit: C.fit === true, open_to: C.open_to, lim: C.member_daily_limit_min || null };
        var fit = toggle(st.fit, 'Circolo affiliato FIT');
        w.appendChild(swRow('Circolo affiliato FIT', 'Chi prenota deve avere tessera FIT e certificato medico', fit));
        var note = el('p', 'cps-note', 'La pagina di prenotazione chiede una spunta obbligatoria, e le email di conferma ricordano tessera e certificato.');
        w.appendChild(note);
        fit.onclick = function () { st.fit = !st.fit; fit.setAttribute('aria-checked', st.fit); note.hidden = !st.fit; }; note.hidden = !st.fit;
        var who = el('div', 'cps-seg');
        [['all', 'Soci e non soci'], ['members', 'Solo con almeno un socio']].forEach(function (o) {
          var b = el('button', null, o[1]); b.type = 'button'; b.setAttribute('aria-pressed', st.open_to === o[0] ? 'true' : 'false');
          b.onclick = function () { st.open_to = o[0]; Array.prototype.forEach.call(who.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); };
          who.appendChild(b);
        });
        var wr = el('div', 'cps-blk'); wr.appendChild(el('b', null, 'Chi può prenotare')); wr.appendChild(el('small', null, 'Il circolo lo comunica sempre ai clienti, nella pagina di prenotazione')); wr.appendChild(who); w.appendChild(wr);
        var lim = toggle(!!st.lim, 'Limite giornaliero per i soci');
        w.appendChild(swRow('Limite per i soci', 'Quante ore di campo al giorno può prenotare chi è socio', lim));
        var ls = select([[30, '30 minuti'], [60, '1 ora'], [90, '1 ora e mezza'], [120, '2 ore'], [180, '3 ore']], st.lim || 60);
        var lf = field('Ore di campo al giorno per socio', ls, 'Vale per le prenotazioni in cui c\'è almeno un socio. Chi non è socio non ha limiti.');
        w.appendChild(lf); lf.hidden = !st.lim;
        lim.onclick = function () { var on = lim.getAttribute('aria-checked') !== 'true'; lim.setAttribute('aria-checked', on); lf.hidden = !on; };
        var msg = msgBox(); w.appendChild(msg);
        var sv = btn('Salva', 'pri', function () {
          sv.disabled = true; msg.textContent = '';
          call({ action: 'save_rules', fit: st.fit, open_to: st.open_to, member_daily_limit_min: lim.getAttribute('aria-checked') === 'true' ? +ls.value : null })
            .then(function () { toast('Regole salvate'); close(); }).catch(function (e) { sv.disabled = false; msg.textContent = e.message; });
        });
        w.appendChild(sv);
      });
    });
  }

  // righe degli orari (da lunedi a domenica): usate per un campo e per tutto il circolo
  function drawHours(hb, H) {
          hb.textContent = '';
          for (var d = 1; d <= 7; d++) (function (d) {
            var rng = H[d] || (H[d] = []), row = el('div', 'cps-day');
            row.appendChild(el('span', 'cps-dn', DAYS[d - 1].slice(0, 3)));
            var col = el('div', 'cps-rg');
            if (!rng.length) col.appendChild(el('span', 'cps-cl', 'Chiuso'));
            rng.forEach(function (r, k) {
              var line = el('div', 'cps-line'), a = input('time', r[0]), z = input('time', r[1]);
              a.setAttribute('aria-label', DAYS[d - 1] + ' apre'); z.setAttribute('aria-label', DAYS[d - 1] + ' chiude');
              a.onchange = function () { r[0] = a.value; }; z.onchange = function () { r[1] = z.value; };
              var rm = el('button', 'cps-rm'); rm.type = 'button'; rm.setAttribute('aria-label', 'Togli la fascia'); rm.innerHTML = svg(IC.x, 16); rm.onclick = function () { rng.splice(k, 1); drawHours(hb, H); };
              line.appendChild(a); line.appendChild(z); line.appendChild(rm); col.appendChild(line);
            });
            row.appendChild(col);
            var ad = el('button', 'cps-add', '+'); ad.type = 'button'; ad.setAttribute('aria-label', 'Aggiungi una fascia di ' + DAYS[d - 1]);
            ad.onclick = function () { if (rng.length >= 3) return; rng.push(rng.length ? [rng[rng.length - 1][1], '22:00'] : ['08:00', '22:00']); drawHours(hb, H); };
            row.appendChild(ad); hb.appendChild(row);
          })(d);
        }

  // ---------- campi e orari ----------
  function sCourts() {
    withData(function () { courtsSheet(null); });
  }
  function courtsSheet(openId) {
    sheet('Campi e orari', function (w, close) {
      function list() {
        w.textContent = '';
        D.courts.forEach(function (c) {
          var card = el('button', 'cps-card'); card.type = 'button';
          var t = el('div', 'cps-t'); t.appendChild(el('b', null, c.name));
          t.appendChild(el('small', null, [c.surface, c.indoor ? 'coperto' : '', dur(c.slot_min), (c.price_member_eur != null || c.price_guest_eur != null) ? 'socio ' + (c.price_member_eur || 0) + ' € · non socio ' + (c.price_guest_eur || 0) + ' €' : 'senza prezzo'].filter(Boolean).join(' · ')));
          card.appendChild(t); card.appendChild(el('span', 'cps-pill' + (c.active ? '' : ' off'), c.active ? 'Attivo' : 'Spento'));
          card.onclick = function () { edit(c); }; w.appendChild(card);
        });
        w.appendChild(btn('+ Aggiungi un campo', 'dash', function () { edit(null); }));
        w.appendChild(el('p', 'cps-help', 'Durata dello slot e prezzi a testa si scelgono per ogni campo. I prezzi sono facoltativi e il pagamento si fa sempre al circolo.'));
      }
      function edit(c) {
        var isNew = !c, F = c ? JSON.parse(JSON.stringify(c)) : { id: null, name: 'Campo ' + (D.courts.length + 1), surface: '', indoor: false, slot_min: 60, price_member_eur: null, price_guest_eur: null, active: true, hours: { 1: [['08:00', '22:00']], 2: [['08:00', '22:00']], 3: [['08:00', '22:00']], 4: [['08:00', '22:00']], 5: [['08:00', '22:00']], 6: [['08:00', '20:00']], 7: [['08:00', '20:00']] } };
        w.textContent = '';
        var back = el('button', 'cps-back2', '‹ Tutti i campi'); back.type = 'button'; back.onclick = function () { load().then(list).catch(function (e) { toast(e.message, true); }); }; w.appendChild(back);
        var n = input('text', F.name, { maxlength: 60, autocomplete: 'off' }), sf = input('text', F.surface, { maxlength: 40, placeholder: 'Terra, cemento, erba…', autocomplete: 'off' });
        var r1 = el('div', 'cps-f2'); r1.appendChild(field('Nome', n)); r1.appendChild(field('Fondo', sf)); w.appendChild(r1);
        var sl = select([[30, '30 minuti'], [45, '45 minuti'], [60, '1 ora'], [90, '1 ora e mezza'], [120, '2 ore']], F.slot_min);
        if (![30, 45, 60, 90, 120].includes(F.slot_min)) { var o = el('option', null, dur(F.slot_min)); o.value = F.slot_min; o.selected = true; sl.appendChild(o); }
        var pm = input('number', F.price_member_eur, { inputmode: 'decimal', min: 0, step: '0.5', placeholder: 'Es. 2' }), pg = input('number', F.price_guest_eur, { inputmode: 'decimal', min: 0, step: '0.5', placeholder: 'Es. 7' });
        w.appendChild(field('Durata di uno slot', sl));
        var r2 = el('div', 'cps-f2'); r2.appendChild(field('Prezzo a testa, socio (€)', pm)); r2.appendChild(field('Prezzo a testa, non socio (€)', pg)); w.appendChild(r2);
        w.appendChild(el('p', 'cps-help', 'Il prezzo della prenotazione è la somma di quanto paga ogni giocatore: i soci il prezzo socio, gli altri il prezzo non socio. Lascia vuoto se non vuoi mostrare prezzi; 0 se i soci non pagano.'));
        var ind = toggle(F.indoor, 'Campo coperto'); ind.onclick = function () { F.indoor = !F.indoor; ind.setAttribute('aria-checked', F.indoor); };
        w.appendChild(swRow('Campo coperto', null, ind));
        w.appendChild(el('b', 'cps-h', 'Orari di apertura'));
        var hb = el('div', 'cps-hrs'); w.appendChild(hb);
        function drawH() { drawHours(hb, F.hours); }
        drawH();
        w.appendChild(btn('Copia gli orari del lunedì su tutti i giorni', 'ghost', function () { var m = F.hours[1] || []; for (var d = 2; d <= 7; d++) F.hours[d] = JSON.parse(JSON.stringify(m)); drawH(); }));
        var msg = msgBox(); w.appendChild(msg);
        function collect(active) { return { action: 'save_court', id: F.id, name: n.value, surface: sf.value, indoor: F.indoor, slot_min: +sl.value, price_member_eur: pm.value === '' ? null : +pm.value, price_guest_eur: pg.value === '' ? null : +pg.value, active: active, hours: F.hours }; }
        var acts = el('div', 'cps-acts');
        var sv = btn('Salva', 'pri', function () {
          sv.disabled = true; msg.textContent = '';
          call(collect(F.active)).then(function () { toast('Campo salvato'); return load(); }).then(list).catch(function (e) { sv.disabled = false; msg.textContent = e.message; });
        });
        acts.appendChild(sv);
        if (!isNew) acts.appendChild(btn(F.active ? 'Spegni il campo' : 'Riattiva il campo', '', function () {
          msg.textContent = ''; call(collect(!F.active)).then(function () { toast(F.active ? 'Campo spento' : 'Campo riattivato'); return load(); }).then(list).catch(function (e) { msg.textContent = e.message; });
        }));
        w.appendChild(acts);
        if (!isNew) w.appendChild(el('p', 'cps-help', 'Spegnere un campo lo toglie dalla pagina di prenotazione e dal calendario, e tiene lo storico. Le prenotazioni già fissate restano.'));
        n.focus();
      }
      var first = openId && D.courts.filter(function (x) { return x.id === openId; })[0];
      if (first) edit(first); else list();
    });
  }


  // ---------- orari del circolo: gli stessi orari per tutti i campi ----------
  function sHours() {
    withData(function () {
      sheet('Orari del circolo', function (w, close) {
        var act = D.courts.filter(function (c) { return c.active; });
        if (!act.length) { w.appendChild(el('p', 'cps-help', 'Aggiungi prima un campo da "Campi e orari".')); return; }
        var H = JSON.parse(JSON.stringify(act[0].hours || {}));
        w.appendChild(el('p', 'cps-note2', 'Fuori da questi orari nessun campo si può prenotare, né dalla pagina né da Lia. Gli orari valgono per tutti i campi; un campo con orari diversi si cambia da "Campi e orari".'));
        var hb = el('div', 'cps-hrs'); w.appendChild(hb); drawHours(hb, H);
        w.appendChild(btn('Copia gli orari del lunedì su tutti i giorni', 'ghost', function () { var m = H[1] || []; for (var d = 2; d <= 7; d++) H[d] = JSON.parse(JSON.stringify(m)); drawHours(hb, H); }));
        var msg = msgBox(); w.appendChild(msg);
        var sv = btn('Applica a tutti i campi', 'pri', function () {
          sv.disabled = true; msg.textContent = '';
          var i = 0;
          (function next() {
            if (i >= D.courts.length) { toast('Orari salvati per ' + D.courts.length + (D.courts.length === 1 ? ' campo' : ' campi')); close(); return; }
            var c = D.courts[i++];
            call({ action: 'save_court', id: c.id, name: c.name, surface: c.surface, indoor: c.indoor, slot_min: c.slot_min, price_member_eur: c.price_member_eur, price_guest_eur: c.price_guest_eur, active: c.active, hours: H }).then(next).catch(function (e) { sv.disabled = false; msg.textContent = (i > 1 ? 'Salvati solo i primi ' + (i - 1) + ' campi. ' : '') + e.message; });
          })();
        });
        w.appendChild(sv);
        w.appendChild(el('p', 'cps-help', 'Gli orari attuali di tutti i campi, anche di quelli spenti, vengono sostituiti da questi.'));
      });
    });
  }

  // ---------- chiusure ----------
  function sClosures() {
    withData(function () {
      sheet('Chiusure e indisponibilità', function (w) {
        var ask = null;
        function draw() {
          w.textContent = '';
          w.appendChild(el('p', 'cps-note2', 'Nei giorni e negli orari di una chiusura il campo non si può prenotare, e il calendario lo mostra chiuso.'));
          if (!D.closures.length) w.appendChild(el('p', 'cps-help', 'Nessuna chiusura in programma.'));
          D.closures.forEach(function (c) {
            var card = el('div', 'cps-clo'), t = el('div', 'cps-t');
            var who = c.court_id ? ((D.courts.filter(function (x) { return x.id === c.court_id; })[0] || { name: 'Campo' }).name) : 'Tutti i campi';
            t.appendChild(el('b', null, who + ' · ' + (c.starts_on === c.ends_on ? fmtDay(c.starts_on) : fmtDay(c.starts_on) + ' – ' + fmtDay(c.ends_on))));
            t.appendChild(el('small', null, (c.from ? c.from + '–' + c.to : 'Tutto il giorno') + (c.reason ? ' · ' + c.reason : '')));
            if (c.bookings) t.appendChild(el('small', 'cps-warn', c.bookings + (c.bookings === 1 ? ' prenotazione già fissata: avvisa il cliente' : ' prenotazioni già fissate: avvisa i clienti')));
            card.appendChild(t);
            if (ask === c.id) {
              var a = el('div', 'cps-acts'); a.appendChild(btn('Sì, elimina', 'bad', function () { call({ action: 'delete_closure', id: c.id }).then(function () { ask = null; toast('Chiusura eliminata'); return load(); }).then(draw).catch(function (e) { toast(e.message, true); }); }));
              a.appendChild(btn('No', '', function () { ask = null; draw(); })); card.appendChild(a);
            } else card.appendChild(btn('Elimina', 'bad small', function () { ask = c.id; draw(); }));
            w.appendChild(card);
          });
          w.appendChild(el('b', 'cps-h', 'Aggiungi una chiusura'));
          var who = select([['', 'Tutti i campi']].concat(D.courts.map(function (c) { return [c.id, c.name]; })), '');
          var a = input('date', '', { min: D.today }), z = input('date', '', { min: D.today }), t1 = input('time', ''), t2 = input('time', ''), why = input('text', '', { maxlength: 120, placeholder: 'Torneo sociale, manutenzione, pioggia…', autocomplete: 'off' });
          w.appendChild(field('Quali campi', who));
          var r1 = el('div', 'cps-f2'); r1.appendChild(field('Dal', a)); r1.appendChild(field('Al (vuoto = un solo giorno)', z)); w.appendChild(r1);
          var r2 = el('div', 'cps-f2'); r2.appendChild(field('Dalle', t1)); r2.appendChild(field('Alle', t2)); w.appendChild(r2);
          w.appendChild(el('p', 'cps-help', 'Lascia vuote le ore per chiudere tutto il giorno.'));
          w.appendChild(field('Motivo (lo vedi solo tu)', why));
          var msg = msgBox(); w.appendChild(msg);
          var sv = btn('Aggiungi chiusura', 'pri', function () {
            sv.disabled = true; msg.textContent = '';
            call({ action: 'add_closure', court_id: who.value || null, starts_on: a.value, ends_on: z.value || a.value, from: t1.value, to: t2.value, reason: why.value })
              .then(function () { toast('Chiusura aggiunta'); return load(); }).then(draw).catch(function (e) { sv.disabled = false; msg.textContent = e.message; });
          });
          w.appendChild(sv);
        }
        draw();
      });
    });
  }

  // ---------- voci in Impostazioni ----------
  var HIDE = ['services', 'combos', 'hours', 'blocks', 'staff', 'rules', 'promos', 'areas'];
  function wide() { return !!(window.matchMedia && window.matchMedia('(min-width:900px)').matches); }
  function fixDefault() {
    var on = document.querySelector('#stShell .stPage.on');
    if (wide() && (!on || HIDE.indexOf(on.getAttribute('data-st')) >= 0) && window.liaSettingsOpen) window.liaSettingsOpen('bizinfo');
  }
  function mount() {
    var menu = document.querySelector('#panelOther .stMenu'); if (!menu) return false;
    if (menu.querySelector('[data-cx]')) return true;
    HIDE.forEach(function (k) { var r = menu.querySelector('[data-st="' + k + '"]'); if (r) r.style.display = 'none'; });
    Array.prototype.forEach.call(menu.querySelectorAll('.stGroup'), function (g) { var h = g.querySelector('h3'); if (h && /Canali clienti/i.test(h.textContent)) g.style.display = 'none'; if (h && /La tua attività/i.test(h.textContent)) h.textContent = 'Il tuo circolo'; });
    var bi = menu.querySelector('[data-st="bizinfo"] b'); if (bi) bi.textContent = 'Dati del circolo';
    var grp = el('div', 'stGroup'), h3 = el('h3', null, 'Campi e regole'), list = el('div', 'stList'); grp.appendChild(h3); grp.appendChild(list);
    [['hours', 'c-amber', IC.clock, 'Orari del circolo', 'Quando i campi si possono prenotare', sHours], ['rules', 'c-amber', IC.rules, 'Regole del circolo', 'Soci, FIT e limite giornaliero', sRules], ['courts', 'c-teal', IC.court, 'Campi e orari', 'Nome, slot, prezzo e apertura', sCourts], ['closures', 'c-coral', IC.off, 'Chiusure', 'Tornei, manutenzione, giorni senza campi', sClosures]].forEach(function (r) {
      var b = el('button', 'stRow'); b.type = 'button'; b.setAttribute('data-cx', r[0]);
      b.innerHTML = '<span class="stIc ' + r[1] + '">' + svg(r[2]) + '</span><span class="stTx"><b>' + r[3] + '</b><small>' + r[4] + '</small></span><span class="stCh" aria-hidden="true">›</span>';
      b.addEventListener('click', r[5]); list.appendChild(b);
    });
    menu.insertBefore(grp, menu.firstChild);
    fixDefault(); return true;
  }
  document.addEventListener('lia:section', function (e) { if (e.detail === 'other') setTimeout(fixDefault, 0); });
  window.addEventListener('resize', function () { setTimeout(fixDefault, 0); });
  window.liaCampiOpen = function (k) { ({ hours: sHours, rules: sRules, courts: sCourts, closures: sClosures })[k](); };
  if (!mount()) document.addEventListener('DOMContentLoaded', mount);
  window.addEventListener('load', mount);
})();
