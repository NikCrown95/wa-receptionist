/* Impostazioni del circolo (campi sportivi) per la dashboard di Lia.
   Stesso schema delle altre attivita': lista a sinistra, dettaglio a destra (su telefono: pagina intera con freccia indietro).
   Dati da /api/agenda?t=CODICE&courts=1 (&view=settings). */
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
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    euro: '<path d="M17 7.5a6 6 0 1 0 0 9M5 10.5h8M5 13.5h8"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  function svg(p, s) { return '<svg width="' + (s || 21) + '" height="' + (s || 21) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>'; }
  function el(t, c, x) { var e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; }
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
  function dur(m) { return m < 60 ? m + ' min' : m === 60 ? '1 ora' : m % 60 === 0 ? (m / 60) + ' ore' : Math.floor(m / 60) + ' h ' + (m % 60) + ' min'; }
  function euro(n) { return String(n).replace('.', ',') + ' €'; }
  function courtColor(c) { var s = (c.surface || '').toLowerCase(); return /terra/.test(s) ? '#D9784A' : /cement/.test(s) ? '#5B8DB8' : /erba|prato/.test(s) ? '#5DB07A' : '#4BB3D6'; }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function changed() { if (window.__cpReload) { try { window.__cpReload(); } catch (e) { } } }

  var D = null; // ultime impostazioni lette
  function load() { return call(null, 'settings').then(function (j) { D = j; sums(); return j; }); }

  // ---------- pezzi di modulo, con le classi gia' usate nelle altre impostazioni ----------
  function card(title, cls) { var c = el('div', 'stCard cx-card' + (cls ? ' ' + cls : '')); if (title) c.appendChild(el('h4', null, title)); return c; }
  function hint(t, cls) { return el('p', 'stHint' + (cls ? ' ' + cls : ''), t); }
  function sf(label, node) { var l = el('label', 'stF'); l.appendChild(el('span', null, label)); l.appendChild(node); return l; }
  function input(type, val, attrs) { var i = el('input', 'set-input'); i.type = type; i.value = val == null ? '' : val; for (var k in (attrs || {})) i.setAttribute(k, attrs[k]); return i; }
  function btn(label, cls, fn) { var b = el('button', 'stBtn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; if (fn) b.onclick = fn; return b; }
  function msgBox() { var m = el('p', 'stMsg'); m.setAttribute('role', 'status'); return m; }
  function row2(a, b) { var r = el('div', 'stRow2'); r.appendChild(a); r.appendChild(b); return r; }
  function chips(opts, val, on, cls) {
    var w = el('div', cls || 'stChips'); w.setAttribute('role', 'group');
    opts.forEach(function (o) {
      var b = el('button', null, o[1]); b.type = 'button'; b.setAttribute('aria-pressed', String(o[0]) === String(val) ? 'true' : 'false');
      b.onclick = function () { Array.prototype.forEach.call(w.children, function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); on(o[0]); };
      w.appendChild(b);
    });
    return w;
  }
  function sw(on, label, fn) {
    var b = el('button', 'cx-sw'); b.type = 'button'; b.setAttribute('role', 'switch'); b.setAttribute('aria-label', label); b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.onclick = function () { var v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', v ? 'true' : 'false'); fn(v); };
    return b;
  }
  function swRow(title, small, on, fn) {
    var r = el('div', 'cx-swrow'), t = el('div', 'cx-t'); t.appendChild(el('b', null, title)); if (small) t.appendChild(el('small', null, small));
    r.appendChild(t); r.appendChild(sw(on, title, fn)); return r;
  }
  function guard(b, msg, p) { b.disabled = true; msg.className = 'stMsg'; msg.textContent = ''; return p.then(function (v) { b.disabled = false; return v; }, function (e) { b.disabled = false; msg.className = 'stMsg err'; msg.textContent = e.message; throw e; }); }

  // ---------- 1. CAMPI ----------
  function pCourts(w) {
    var edit = null;
    function list() {
      w.textContent = '';
      var c0 = card();
      if (!D.courts.length) c0.appendChild(hint('Non hai ancora nessun campo. Aggiungi il primo: poi potrai scegliere orari e prezzi.'));
      D.courts.forEach(function (c) {
        var r = el('button', 'cx-item'); r.type = 'button';
        var dot = el('i', 'cx-dot'); dot.style.background = courtColor(c); r.appendChild(dot);
        var t = el('div', 'cx-t'); t.appendChild(el('b', null, c.name));
        t.appendChild(el('small', null, [c.surface, c.indoor ? 'coperto' : 'scoperto', 'prenotazioni da ' + dur(c.slot_min)].filter(Boolean).join(' · ')));
        r.appendChild(t); r.appendChild(el('span', 'cx-pill' + (c.active ? '' : ' off'), c.active ? 'Attivo' : 'Spento')); r.appendChild(el('span', 'cx-ch', '›'));
        r.onclick = function () { edit = c; form(); }; c0.appendChild(r);
      });
      w.appendChild(c0);
      w.appendChild(btn('+ Aggiungi un campo', 'ghost', function () { edit = null; form(true); }));
    }
    function form(isNew) {
      var c = edit, F = c ? copy(c) : { id: null, name: 'Campo ' + (D.courts.length + 1), surface: '', indoor: false, slot_min: 60, price_member_eur: null, price_guest_eur: null, active: true, hours: null };
      if (!F.hours) { var base = D.courts.filter(function (x) { return x.active; })[0] || D.courts[0]; F.hours = base ? copy(base.hours) : { 1: [['08:00', '22:00']], 2: [['08:00', '22:00']], 3: [['08:00', '22:00']], 4: [['08:00', '22:00']], 5: [['08:00', '22:00']], 6: [['08:00', '22:00']], 7: [['08:00', '22:00']] }; }
      w.textContent = '';
      var back = el('button', 'cx-back', '‹ Tutti i campi'); back.type = 'button'; back.onclick = list; w.appendChild(back);
      var c1 = card(c ? 'Modifica ' + c.name : 'Nuovo campo');
      var n = input('text', F.name, { maxlength: 60, autocomplete: 'off', placeholder: 'Es. Campo 1' });
      c1.appendChild(sf('Nome', n));
      var surf = ['Terra rossa', 'Cemento', 'Erba', 'Erba sintetica', 'Moquette'];
      var sv0 = F.surface && surf.indexOf(F.surface) < 0 ? surf.concat([F.surface]) : surf;
      var lf = el('div', 'stF'); lf.appendChild(el('span', null, 'Fondo (facoltativo)'));
      lf.appendChild(chips(sv0.map(function (x) { return [x, x]; }), F.surface, function (v) { F.surface = F.surface === v ? '' : v; var bs = lf.querySelectorAll('.stChips button'); Array.prototype.forEach.call(bs, function (b) { b.setAttribute('aria-pressed', b.textContent === F.surface ? 'true' : 'false'); }); }));
      c1.appendChild(lf);
      c1.appendChild(swRow('Campo coperto', 'Si gioca anche con la pioggia', F.indoor, function (v) { F.indoor = v; }));
      w.appendChild(c1);
      var c2 = card('Durata delle prenotazioni');
      var slots = [[30, '30 minuti'], [45, '45 minuti'], [60, '1 ora'], [90, '1 ora e mezza'], [120, '2 ore']];
      if (!slots.some(function (s) { return s[0] === F.slot_min; })) slots.push([F.slot_min, dur(F.slot_min)]);
      c2.appendChild(chips(slots, F.slot_min, function (v) { F.slot_min = +v; }));
      c2.appendChild(hint('Ogni prenotazione dura uno o più di questi blocchi. Gli orari di apertura li imposti da "Orari di apertura".'));
      w.appendChild(c2);
      var c3 = card('Stato');
      c3.appendChild(swRow('Campo attivo', 'Se lo spegni sparisce dalla pagina di prenotazione e dal calendario. Lo storico resta e le prenotazioni già fissate non si cancellano.', F.active, function (v) { F.active = v; }));
      w.appendChild(c3);
      var msg = msgBox(); w.appendChild(msg);
      var sv = btn(isNew ? 'Aggiungi il campo' : 'Salva modifiche', '', function () {
        guard(sv, msg, call({ action: 'save_court', id: F.id, name: n.value, surface: F.surface, indoor: F.indoor, slot_min: F.slot_min, price_member_eur: F.price_member_eur, price_guest_eur: F.price_guest_eur, active: F.active, hours: F.hours })
          .then(load)).then(function () { toast(isNew ? 'Campo aggiunto' : 'Campo salvato'); changed(); list(); if (isNew) toast('Campo aggiunto: ora imposta il prezzo da "Prezzi"'); }).catch(function () { });
      });
      w.appendChild(sv);
    }
    list();
  }

  // ---------- 2. PREZZI ----------
  function pPrices(w) {
    if (!D.courts.length) { var c0 = card(); c0.appendChild(hint('Aggiungi prima un campo da "Campi".')); w.appendChild(c0); return; }
    var c1 = card('Prezzo a testa');
    c1.appendChild(hint('Ogni giocatore paga la sua quota. Il prezzo della prenotazione è la somma: i soci pagano il prezzo socio, gli altri il prezzo non socio. Il pagamento si fa sempre al circolo.'));
    var head = el('div', 'cx-pr cx-prh'); head.appendChild(el('span', null, 'Campo')); head.appendChild(el('span', null, 'Socio (€)')); head.appendChild(el('span', null, 'Non socio (€)')); c1.appendChild(head);
    var rows = [];
    D.courts.forEach(function (c) {
      var r = el('div', 'cx-pr'), nm = el('div', 'cx-prn'), dot = el('i', 'cx-dot'); dot.style.background = courtColor(c); nm.appendChild(dot); nm.appendChild(el('b', null, c.name));
      var a = input('number', c.price_member_eur, { inputmode: 'decimal', min: 0, step: '0.5', placeholder: '—' }), b = input('number', c.price_guest_eur, { inputmode: 'decimal', min: 0, step: '0.5', placeholder: '—' });
      a.setAttribute('aria-label', c.name + ', prezzo socio'); b.setAttribute('aria-label', c.name + ', prezzo non socio');
      r.appendChild(nm); r.appendChild(a); r.appendChild(b); c1.appendChild(r); rows.push([c, a, b]);
    });
    c1.appendChild(hint('Lascia vuoto per non mostrare il prezzo. Scrivi 0 se per i soci il campo è gratis.'));
    if (D.courts.length > 1) c1.appendChild(btn('Usa i prezzi del primo campo per tutti', 'ghost', function () { rows.forEach(function (x, i) { if (i) { x[1].value = rows[0][1].value; x[2].value = rows[0][2].value; } }); }));
    w.appendChild(c1);
    var msg = msgBox(); w.appendChild(msg);
    var sv = btn('Salva prezzi', '', function () {
      var i = 0;
      guard(sv, msg, new Promise(function (ok, ko) {
        (function next() {
          if (i >= rows.length) return ok();
          var x = rows[i++], c = x[0];
          call({ action: 'save_court', id: c.id, name: c.name, surface: c.surface, indoor: c.indoor, slot_min: c.slot_min, price_member_eur: x[1].value === '' ? null : +x[1].value, price_guest_eur: x[2].value === '' ? null : +x[2].value, active: c.active, hours: c.hours }).then(next).catch(ko);
        })();
      }).then(load)).then(function () { toast('Prezzi salvati'); changed(); }).catch(function () { });
    });
    w.appendChild(sv);
  }

  // ---------- 3. ORARI DI APERTURA ----------
  function pHours(w) {
    if (!D.courts.length) { var c0 = card(); c0.appendChild(hint('Aggiungi prima un campo da "Campi".')); w.appendChild(c0); return; }
    var act = D.courts.filter(function (c) { return c.active; }), H = copy((act[0] || D.courts[0]).hours || {});
    var c1 = card('Quando il circolo è aperto');
    c1.appendChild(hint('Fuori da questi orari nessun campo si può prenotare, né dalla pagina né da Lia. Valgono per tutti i campi.'));
    var box = el('div', 'cx-days'); c1.appendChild(box);
    function sel(val, label) {
      var o = []; for (var m = 0; m < 24 * 60; m += 30) { var t = ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); o.push([t, t]); }
      if (!o.some(function (x) { return x[0] === val; })) o.push([val, val]);
      var e = el('select', 'set-input cx-sel'); e.setAttribute('aria-label', label);
      o.forEach(function (x) { var op = el('option', null, x[1]); op.value = x[0]; if (x[0] === val) op.selected = true; e.appendChild(op); }); return e;
    }
    function draw() {
      box.textContent = '';
      for (var d = 1; d <= 7; d++) (function (d) {
        var rng = H[d] || (H[d] = []), row = el('div', 'cx-day' + (rng.length ? '' : ' off'));
        row.appendChild(el('b', 'cx-dn', DAYS[d - 1]));
        var tm = el('div', 'cx-tm');
        if (!rng.length) tm.appendChild(el('span', 'cx-cl', 'Chiuso'));
        rng.forEach(function (r) {
          var a = sel(r[0], DAYS[d - 1] + ' apre alle'), z = sel(r[1], DAYS[d - 1] + ' chiude alle');
          a.onchange = function () { r[0] = a.value; }; z.onchange = function () { r[1] = z.value; };
          tm.appendChild(a); tm.appendChild(el('span', 'cx-to', '–')); tm.appendChild(z);
        });
        row.appendChild(tm);
        row.appendChild(sw(rng.length > 0, DAYS[d - 1] + ' aperto', function (v) { H[d] = v ? [['08:00', '22:00']] : []; draw(); }));
        box.appendChild(row);
      })(d);
    }
    draw();
    c1.appendChild(btn('Copia gli orari del lunedì su tutti i giorni', 'ghost', function () { var m = H[1] || []; for (var d = 2; d <= 7; d++) H[d] = copy(m); draw(); }));
    w.appendChild(c1);
    var msg = msgBox(); w.appendChild(msg);
    var sv = btn('Salva gli orari', '', function () {
      var i = 0;
      guard(sv, msg, new Promise(function (ok, ko) {
        (function next() {
          if (i >= D.courts.length) return ok();
          var c = D.courts[i++];
          call({ action: 'save_court', id: c.id, name: c.name, surface: c.surface, indoor: c.indoor, slot_min: c.slot_min, price_member_eur: c.price_member_eur, price_guest_eur: c.price_guest_eur, active: c.active, hours: H }).then(next).catch(ko);
        })();
      }).then(load)).then(function () { toast('Orari salvati'); changed(); }).catch(function () { });
    });
    w.appendChild(sv);
    w.appendChild(hint('Per chiudere un campo o il circolo solo per alcuni giorni (torneo, lavori, maltempo) usa "Chiusure e lavori": non serve cambiare gli orari.'));
  }

  // ---------- 4. CHIUSURE E LAVORI ----------
  function pClosures(w) {
    var ask = null, S = { who: '', allday: true, why: '' };
    function draw() {
      w.textContent = '';
      var c1 = card('In programma');
      if (!D.closures.length) c1.appendChild(hint('Nessuna chiusura in programma: tutti i campi sono prenotabili negli orari di apertura.'));
      D.closures.forEach(function (c) {
        var r = el('div', 'cx-clo'), t = el('div', 'cx-t');
        var cn = c.court_id ? (D.courts.filter(function (x) { return x.id === c.court_id; })[0] || { name: 'Campo' }).name : null;
        t.appendChild(el('b', null, (cn ? cn + ' non disponibile' : 'Circolo chiuso')));
        t.appendChild(el('small', null, (c.starts_on === c.ends_on ? fmtDay(c.starts_on) : fmtDay(c.starts_on) + ' – ' + fmtDay(c.ends_on)) + ' · ' + (c.from ? 'dalle ' + c.from + ' alle ' + c.to : 'tutto il giorno') + (c.reason ? ' · ' + c.reason : '')));
        if (c.bookings) t.appendChild(el('small', 'cx-warn', c.bookings + (c.bookings === 1 ? ' prenotazione già fissata: avvisa il cliente' : ' prenotazioni già fissate: avvisa i clienti')));
        r.appendChild(t);
        if (ask === c.id) {
          var a = el('div', 'cx-ask'); a.appendChild(btn('Sì, elimina', 'danger', function () { call({ action: 'delete_closure', id: c.id }).then(function () { ask = null; toast('Chiusura eliminata'); return load(); }).then(function () { changed(); draw(); }).catch(function (e) { toast(e.message, true); }); }));
          a.appendChild(btn('No', 'ghost', function () { ask = null; draw(); })); r.appendChild(a);
        } else { var rm = btn('Elimina', 'outline-danger cx-small', function () { ask = c.id; draw(); }); r.appendChild(rm); }
        c1.appendChild(r);
      });
      w.appendChild(c1);

      var c2 = card('Nuova chiusura');
      var l1 = el('div', 'stF'); l1.appendChild(el('span', null, 'Cosa non è disponibile'));
      l1.appendChild(chips([['', 'Tutto il circolo']].concat(D.courts.map(function (c) { return [c.id, c.name]; })), S.who, function (v) { S.who = v; })); c2.appendChild(l1);
      var a = input('date', '', { min: D.today }), z = input('date', '', { min: D.today });
      c2.appendChild(row2(sf('Dal giorno', a), sf('Al giorno (vuoto = solo quel giorno)', z)));
      var l2 = el('div', 'stF'); l2.appendChild(el('span', null, 'Orario'));
      var t1 = input('time', ''), t2 = input('time', ''), hrs = row2(sf('Dalle', t1), sf('Alle', t2)); hrs.hidden = S.allday;
      l2.appendChild(chips([['1', 'Tutto il giorno'], ['0', 'Solo alcune ore']], S.allday ? '1' : '0', function (v) { S.allday = v === '1'; hrs.hidden = S.allday; })); c2.appendChild(l2); c2.appendChild(hrs);
      var why = input('text', S.why, { maxlength: 120, placeholder: 'Scrivi il motivo (lo vedi solo tu)', autocomplete: 'off' });
      var l3 = el('div', 'stF'); l3.appendChild(el('span', null, 'Motivo (lo vedi solo tu)'));
      l3.appendChild(chips([['Torneo', 'Torneo'], ['Manutenzione', 'Manutenzione'], ['Lavori', 'Lavori'], ['Maltempo', 'Maltempo'], ['Evento privato', 'Evento privato']], '', function (v) { why.value = v; }));
      l3.appendChild(why); c2.appendChild(l3);
      c2.appendChild(hint('Nei giorni e negli orari indicati il campo (o tutto il circolo) non si può prenotare e il calendario lo mostra chiuso.'));
      w.appendChild(c2);
      var msg = msgBox(); w.appendChild(msg);
      var sv = btn('Aggiungi la chiusura', '', function () {
        S.why = why.value;
        guard(sv, msg, call({ action: 'add_closure', court_id: S.who || null, starts_on: a.value, ends_on: z.value || a.value, from: S.allday ? '' : t1.value, to: S.allday ? '' : t2.value, reason: why.value }).then(load))
          .then(function () { S.why = ''; toast('Chiusura aggiunta'); changed(); draw(); }).catch(function () { });
      });
      w.appendChild(sv);
    }
    draw();
  }

  // ---------- 5. CHI PUO' PRENOTARE ----------
  function pRules(w) {
    var C = D.club, st = { fit: C.fit === true, open_to: C.open_to || 'all', lim: C.member_daily_limit_min || 0 };
    var c1 = card('Chi può prenotare');
    c1.appendChild(chips([['all', 'Soci e non soci'], ['members', 'Solo con almeno un socio']], st.open_to, function (v) { st.open_to = v; }, 'stSeg'));
    c1.appendChild(hint('Il circolo lo comunica sempre ai clienti, nella pagina di prenotazione.'));
    w.appendChild(c1);
    var c2 = card('Limite di ore per i soci');
    c2.appendChild(hint('Quante ore di campo al giorno può prenotare chi è socio. Vale per le prenotazioni in cui c\'è almeno un socio; chi non è socio non ha limiti.'));
    c2.appendChild(chips([[0, 'Nessun limite'], [30, '30 min'], [60, '1 ora'], [90, '1 ora e mezza'], [120, '2 ore'], [180, '3 ore']], st.lim, function (v) { st.lim = +v; }));
    w.appendChild(c2);
    var c3 = card('Affiliazione FIT');
    var note = hint('La pagina di prenotazione chiede una spunta obbligatoria, e le email di conferma ricordano tessera e certificato.', 'ok'); note.hidden = !st.fit;
    c3.appendChild(swRow('Circolo affiliato FIT', 'Chi prenota deve avere tessera FIT e certificato medico', st.fit, function (v) { st.fit = v; note.hidden = !v; }));
    c3.appendChild(note); w.appendChild(c3);
    var msg = msgBox(); w.appendChild(msg);
    var sv = btn('Salva le regole', '', function () {
      guard(sv, msg, call({ action: 'save_rules', fit: st.fit, open_to: st.open_to, member_daily_limit_min: st.lim || null }).then(load)).then(function () { toast('Regole salvate'); changed(); }).catch(function () { });
    });
    w.appendChild(sv);
  }

  // ---------- pagine e voci in Impostazioni ----------
  var PAGES = [
    ['courts', 'c-teal', IC.court, 'Campi', 'Nome, fondo e durata delle prenotazioni', 'I campi', 'I campi del circolo. Tocca un campo per modificarlo o aggiungine uno nuovo.', pCourts],
    ['prices', 'c-amber', IC.euro, 'Prezzi', 'Quanto paga ogni giocatore', 'Prezzi', 'Quanto paga a testa chi gioca, socio e non socio, per ogni campo.', pPrices],
    ['hours', 'c-blue', IC.clock, 'Orari di apertura', 'Quando i campi si possono prenotare', 'Orari di apertura', 'I giorni e le ore in cui il circolo è aperto e i campi si possono prenotare.', pHours],
    ['closures', 'c-red', IC.off, 'Chiusure e lavori', 'Tornei, manutenzione, maltempo', 'Chiusure e lavori', 'Quando il circolo o un singolo campo non è disponibile: tornei, lavori, manutenzione, maltempo.', pClosures],
    ['rules', 'c-violet', IC.rules, 'Chi può prenotare', 'Soci, FIT e limite giornaliero', 'Chi può prenotare', 'Le regole che i clienti trovano nella pagina di prenotazione.', pRules]
  ];
  var made = {}, rowOf = {}, curKey = null;
  function shell() { return document.getElementById('stShell'); }
  function unmark() { curKey = null; Object.keys(made).forEach(function (k) { made[k].pane.classList.remove('on'); rowOf[k].classList.remove('on'); }); }
  function wide() { return !!(window.matchMedia && window.matchMedia('(min-width:900px)').matches); }
  function sums() {
    if (!D || !rowOf.courts) return;
    function s(k, t) { var e = rowOf[k] && rowOf[k].querySelector('small'); if (e && t) e.textContent = t; }
    var n = D.courts.length, a = D.courts.filter(function (c) { return c.active; }).length;
    s('courts', n ? (n === 1 ? '1 campo' : n + ' campi') + (a < n ? ' · ' + a + ' attivi' : '') : 'Nessun campo: aggiungine uno');
    var pr = [].concat.apply([], D.courts.map(function (c) { return [c.price_member_eur, c.price_guest_eur].filter(function (x) { return x != null; }); }));
    s('prices', pr.length ? 'Da ' + euro(Math.min.apply(null, pr)) + ' a ' + euro(Math.max.apply(null, pr)) + ' a testa' : 'Nessun prezzo impostato');
    s('closures', D.closures.length ? D.closures.length + (D.closures.length === 1 ? ' chiusura in programma' : ' chiusure in programma') : 'Nessuna in programma');
    var C = D.club; s('rules', (C.open_to === 'members' ? 'Solo con un socio' : 'Soci e non soci') + (C.fit ? ' · FIT' : ''));
  }
  function openPane(k) {
    var p = made[k]; if (!p) return;
    load().then(function () {
      p.body.textContent = ''; p.render(p.body);
      if (window.liaSettingsOpen) window.liaSettingsOpen('cx-' + k); // fa tornare "attivo" lo schema di navigazione (telefono: pagina intera)
      unmark(); curKey = k; p.pane.classList.add('on'); rowOf[k].classList.add('on');
      var sh = shell(); if (sh && !wide()) sh.classList.add('inPage');
      var wrap = document.querySelector('#panelOther .otherWrap'); if (wrap) wrap.scrollTop = 0;
    }).catch(function (e) { toast(e.message, true); });
  }
  var HIDE = ['services', 'combos', 'hours', 'blocks', 'staff', 'rules', 'promos', 'areas'];
  function fixDefault() {
    var sh = shell(); if (!sh) return;
    var on = sh.querySelector('.stPage.on');
    if (wide() && (!on || HIDE.indexOf(on.getAttribute('data-st')) >= 0) && !curKey) openPane('courts');
  }
  function mount() {
    var menu = document.querySelector('#panelOther .stMenu'), sh = shell(), det = sh && sh.querySelector('.stDetail'); if (!menu || !det) return false;
    if (menu.querySelector('[data-cx]')) return true;
    HIDE.forEach(function (k) { var r = menu.querySelector('[data-st="' + k + '"]'); if (r) r.style.display = 'none'; });
    Array.prototype.forEach.call(menu.querySelectorAll('.stGroup'), function (g) { var h = g.querySelector('h3'); if (h && /Canali clienti/i.test(h.textContent)) g.style.display = 'none'; if (h && /La tua attività/i.test(h.textContent)) h.textContent = 'Il circolo'; });
    Array.prototype.forEach.call(menu.querySelectorAll('.stGroup'), function (g) { var rows = g.querySelectorAll('.stRow'); if (rows.length && Array.prototype.every.call(rows, function (r) { return r.style.display === 'none'; })) g.style.display = 'none'; });
    var bi = menu.querySelector('[data-st="bizinfo"] b'); if (bi) bi.textContent = 'Dati del circolo';
    var groups = [['Campi e prezzi', ['courts', 'prices']], ['Disponibilità', ['hours', 'closures']], ['Regole', ['rules']]], first = menu.firstChild;
    var byK = {}; PAGES.forEach(function (p) { byK[p[0]] = p; });
    groups.forEach(function (g) {
      var grp = el('div', 'stGroup'), list = el('div', 'stList'); grp.appendChild(el('h3', null, g[0])); grp.appendChild(list);
      g[1].forEach(function (k) {
        var p = byK[k], b = el('button', 'stRow'); b.type = 'button'; b.setAttribute('data-cx', k);
        b.innerHTML = '<span class="stIc ' + p[1] + '">' + svg(p[2]) + '</span><span class="stTx"><b>' + p[3] + '</b><small>' + p[4] + '</small></span><span class="stCh" aria-hidden="true">›</span>';
        b.addEventListener('click', function () { openPane(k); }); list.appendChild(b); rowOf[k] = b;
        var pane = el('section', 'stPage cx-page'); pane.setAttribute('data-st', 'cx-' + k);
        var hd = el('header', 'stPh'), bk = el('button', 'stBack'); bk.type = 'button'; bk.innerHTML = '<span aria-hidden="true">‹</span> Impostazioni';
        bk.addEventListener('click', function () { sh.classList.remove('inPage'); var wr = document.querySelector('#panelOther .otherWrap'); if (wr) wr.scrollTop = 0; });
        hd.appendChild(bk); hd.appendChild(el('h2', null, p[5])); hd.appendChild(el('p', null, p[6]));
        var body = el('div', 'cx-body'); pane.appendChild(hd); pane.appendChild(body); det.appendChild(pane);
        made[k] = { pane: pane, body: body, render: p[7] };
      });
      menu.insertBefore(grp, first);
    });
    // cliccando una voce normale, le mie pagine si spengono
    menu.addEventListener('click', function (e) { var r = e.target.closest && e.target.closest('.stRow'); if (r && !r.hasAttribute('data-cx')) unmark(); }, true);
    var orig = window.liaSettingsOpen;
    if (typeof orig === 'function' && !orig.__cx) { var w2 = function (k) { if (String(k).indexOf('cx-') !== 0) unmark(); return orig(k); }; w2.__cx = 1; window.liaSettingsOpen = w2; }
    load().catch(function () { });
    fixDefault(); return true;
  }
  document.addEventListener('lia:section', function (e) { if (e.detail === 'other') setTimeout(fixDefault, 0); });
  window.addEventListener('resize', function () { setTimeout(fixDefault, 0); });
  window.liaCampiOpen = function (k) { if (made[k]) openPane(k); };
  if (!mount()) document.addEventListener('DOMContentLoaded', mount);
  window.addEventListener('load', mount);
})();
