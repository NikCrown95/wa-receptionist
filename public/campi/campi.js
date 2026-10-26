/* Calendario del circolo (campi sportivi) per la dashboard di Lia.
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
  function wd(s) { var g = parse(s).getUTCDay(); return g === 0 ? 7 : g; }
  function longDay(s) { var d = parse(s); return DL[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MO[d.getUTCMonth()]; }
  function eur(n) { return n == null ? '' : (Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : Number(n).toFixed(2).replace('.', ',')) + ' €'; }
  function soc(n) { return n === 0 ? 'Nessun socio' : n === 1 ? '1 socio' : n + ' soci'; }

  var S = { data: null, strip: null, day: null, sel: null, form: null, err: '', loading: true, busy: false, askCancel: false };
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
    var u = body ? URL0 : URL0 + '&from=' + S.strip + '&days=7';
    return fetch(u, o).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Errore, riprova.'); return j; }); });
  }
  function load() {
    var my = ++tick; S.loading = !S.data; S.err = ''; draw();
    call().then(function (j) { if (my !== tick) return; S.data = j; S.loading = false; if (!S.day) S.day = j.today; draw(); })
      .catch(function (e) { if (my !== tick) return; S.loading = false; S.err = e.message; draw(); });
  }

  // ---------- calcoli ----------
  function nowIn() { // data e minuti attuali nel fuso del circolo
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
    root.textContent = '';
    if (S.err && !S.data) {
      var e = el('div', 'cp-err'); e.appendChild(el('span', null, S.err));
      var rb = el('button', 'cp-btn', 'Riprova'); rb.type = 'button'; rb.onclick = load; e.appendChild(rb); root.appendChild(e); return;
    }
    if (!S.data) { root.appendChild(el('div', 'cp-load', 'Carico il calendario…')); return; }
    var D = S.data;
    if (!D.courts.length) { root.appendChild(el('div', 'cp-load', 'Non hai ancora nessun campo attivo. Aggiungili dalle Impostazioni.')); return; }
    if (!S.strip) S.strip = D.today;

    // testata
    var top = el('div', 'cp-top');
    var ti = el('div', 'cp-title', D.club.name || 'Circolo'); ti.appendChild(el('small', null, longDay(S.day)));
    top.appendChild(ti);
    var nb = el('button', 'cp-now', 'Oggi'); nb.type = 'button';
    nb.onclick = function () { S.day = D.today; S.sel = null; S.form = null; if (S.strip !== D.today) { S.strip = D.today; S.data = null; load(); } else draw(); };
    top.appendChild(nb); root.appendChild(top);
    if (S.err) { var er = el('div', 'cp-err'); er.appendChild(el('span', null, S.err)); var r2 = el('button', 'cp-btn', 'Riprova'); r2.type = 'button'; r2.onclick = load; er.appendChild(r2); root.appendChild(er); }

    // giorni
    var st = el('div', 'cp-strip'); st.setAttribute('role', 'group'); st.setAttribute('aria-label', 'Giorni');
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
    nx.onclick = function () { shift(7); }; st.appendChild(nx); root.appendChild(st);

    // riepilogo
    var bs = bookingsOn(S.day), s0 = stat(S.day), now = nowIn();
    var nosoc = bs.filter(function (b) { return b.members === 0; }).length;
    var sum = el('div', 'cp-sum');
    function tile(a, b) { var k = el('div', 'cp-k'); k.appendChild(el('span', null, a)); k.appendChild(el('b', null, b)); sum.appendChild(k); }
    tile('Occupati', s0.occ + ' su ' + s0.tot);
    if (S.day === now.date) {
      var lib = D.courts.filter(function (c) { return slotsOf(c, S.day).some(function (sl) { return sl.s <= now.min && now.min < sl.e; }) && !bs.some(function (b) { return b.court_id === c.id && mins(b.start) <= now.min && now.min < mins(b.end); }); }).length;
      tile('Liberi ora', lib === 1 ? '1 campo' : lib + ' campi');
    } else tile('Slot liberi', String(s0.tot - s0.occ));
    tile('Senza soci', String(nosoc));
    root.appendChild(sum);

    var lg = el('div', 'cp-leg');
    lg.innerHTML = '<span><i style="background:var(--accent,#2B8A94)"></i>Almeno un socio</span><span><i style="background:var(--sec,#3B9CFF)"></i>Solo non soci</span>';
    root.appendChild(lg);

    root.appendChild(board(bs, now));
    root.appendChild(detail(bs));
  }
  function shift(n) { S.strip = addDays(S.strip, n); S.day = S.strip; S.sel = null; S.form = null; S.askCancel = false; load(); }

  function board(bs, now) {
    var D = S.data, lo = 24 * 60, hi = 0;
    D.courts.forEach(function (c) { slotsOf(c, S.day).forEach(function (s) { lo = Math.min(lo, s.s); hi = Math.max(hi, s.e); }); });
    var wrap = el('div', 'cp-board');
    if (hi <= lo) { wrap.appendChild(el('div', 'cp-load', 'Il circolo è chiuso in questo giorno.')); return wrap; }
    lo = Math.floor(lo / 60) * 60; hi = Math.ceil(hi / 60) * 60;
    var H = (hi - lo) * PPM, g = el('div', 'cp-g');
    g.style.gridTemplateColumns = '38px repeat(' + D.courts.length + ',minmax(' + (D.courts.length > 5 ? 88 : 0) + 'px,1fr))';
    g.appendChild(el('div'));
    D.courts.forEach(function (c) {
      var h = el('div', 'cp-ch', c.name); h.appendChild(el('small', null, [c.surface, c.indoor ? 'coperto' : ''].filter(Boolean).join(' · ') || ' ')); g.appendChild(h);
    });
    var hr = el('div', 'cp-hrs'); hr.style.height = H + 'px';
    for (var m = lo; m <= hi; m += 60) { var l = el('em', m === lo ? 'first' : '', hhmm(m)); l.style.top = ((m - lo) * PPM) + 'px'; if (m === hi) l.style.display = 'none'; hr.appendChild(l); }
    g.appendChild(hr);
    D.courts.forEach(function (c) {
      var col = el('div', 'cp-col'); col.style.height = H + 'px';
      ((c.hours && c.hours[String(wd(S.day))]) || []).forEach(function (h) {
        var o = el('div', 'cp-open'); o.style.top = ((mins(h[0]) - lo) * PPM) + 'px'; o.style.height = ((mins(h[1]) - mins(h[0])) * PPM) + 'px'; col.appendChild(o);
      });
      for (var m2 = lo + 60; m2 < hi; m2 += 60) { var ln = el('div', 'cp-ln'); ln.style.top = ((m2 - lo) * PPM) + 'px'; col.appendChild(ln); }
      var mine = bs.filter(function (b) { return b.court_id === c.id; });
      slotsOf(c, S.day).forEach(function (sl) {
        if (S.day < now.date || (S.day === now.date && sl.e <= now.min)) return; // passato
        if (mine.some(function (b) { return mins(b.start) < sl.e && mins(b.end) > sl.s; })) return;
        if (closedAt(c, S.day, sl.s, sl.e)) return;
        var f = el('button', 'cp-free' + (S.form && S.form.court_id === c.id && S.form.time === hhmm(sl.s) ? ' pick' : ''), '+'); f.type = 'button';
        f.setAttribute('aria-label', c.name + ' alle ' + hhmm(sl.s) + ', libero. Prenota a mano');
        f.style.top = ((sl.s - lo) * PPM + 2) + 'px'; f.style.height = ((sl.e - sl.s) * PPM - 4) + 'px';
        f.onclick = function () { S.sel = null; S.askCancel = false; S.form = { court_id: c.id, time: hhmm(sl.s), hours: 1, first_name: '', last_name: '', phone: '', players: '', members: '', notes: '', msg: '' }; draw(); focusForm(); };
        col.appendChild(f);
      });
      closuresOf(c, S.day).forEach(function (x) {
        var a = Math.max(lo, x.from ? mins(x.from) : lo), z = Math.min(hi, x.to ? mins(x.to) : hi); if (z <= a) return;
        var cl = el('div', 'cp-closed', x.reason || 'Chiuso'); cl.style.top = ((a - lo) * PPM + 2) + 'px'; cl.style.height = ((z - a) * PPM - 4) + 'px'; cl.setAttribute('role', 'note'); col.appendChild(cl);
      });
      mine.forEach(function (b) {
        var x = el('button', 'cp-b' + (b.members === 0 ? ' ns' : '') + (S.sel === b.id ? ' on' : '')); x.type = 'button';
        x.style.top = ((mins(b.start) - lo) * PPM + 2) + 'px'; x.style.height = ((mins(b.end) - mins(b.start)) * PPM - 4) + 'px';
        x.setAttribute('aria-label', c.name + ' ' + b.start + '-' + b.end + ', ' + (b.last_name || '') + ' ' + (b.first_name || ''));
        x.appendChild(el('b', null, b.last_name || b.first_name || '—'));
        x.appendChild(el('small', null, b.members == null ? (b.players ? b.players + ' giocatori' : '') : (b.members === 0 ? 'Non soci' : soc(b.members))));
        x.onclick = function () { S.sel = b.id; S.form = null; S.askCancel = false; draw(); };
        col.appendChild(x);
      });
      if (S.day === now.date && now.min > lo && now.min < hi) { var nl = el('div', 'cp-nowl'); nl.style.top = ((now.min - lo) * PPM) + 'px'; col.appendChild(nl); }
      g.appendChild(col);
    });
    wrap.appendChild(g); return wrap;
  }

  function courtOf(id) { return S.data.courts.filter(function (c) { return c.id === id; })[0]; }
  function detail(bs) {
    var d = el('div', 'cp-det'); d.setAttribute('aria-live', 'polite');
    if (S.form) return formView(d);
    var b = bs.filter(function (x) { return x.id === S.sel; })[0];
    if (!b) { d.appendChild(el('p', null, 'Tocca una prenotazione per vedere chi l\'ha fatta, oppure un riquadro libero (+) per inserirne una a mano.')); return d; }
    var c = courtOf(b.court_id) || { name: 'Campo' };
    d.appendChild(el('h3', null, [b.first_name, b.last_name].filter(Boolean).join(' ') + ' · ' + c.name + ', ' + b.start + '–' + b.end));
    var parts = ['Referente della prenotazione.'];
    if (b.players != null) parts.push(b.players + (b.players === 1 ? ' giocatore' : ' giocatori') + (b.members != null ? ': ' + (b.members === 0 ? 'nessun socio' : b.members === 1 ? '1 socio' : b.members + ' soci') + ', ' + (b.players - b.members === 0 ? 'nessun non socio' : b.players - b.members === 1 ? '1 non socio' : (b.players - b.members) + ' non soci') + '.' : '.'));
    d.appendChild(el('p', null, parts.join(' ')));
    var r = el('div', 'cp-row');
    if (b.members != null) r.appendChild(el('span', 'cp-tag', soc(b.members)));
    if (S.data.club.fit) r.appendChild(el('span', 'cp-tag ' + (b.fit_declared ? 'f' : 'w'), b.fit_declared ? 'Tessera FIT e certificato dichiarati' : (b.channel === 'manual' ? 'Tessera FIT da controllare' : 'Tessera FIT non dichiarata')));
    if (b.price_eur != null) r.appendChild(el('span', 'cp-tag', b.price_eur === 0 ? 'Gratis' : eur(b.price_eur) + ' al circolo'));
    r.appendChild(el('span', 'cp-tag', b.channel === 'manual' ? 'Inserita a mano' : b.channel === 'chat' ? 'Da Lia' : 'Dal sito'));
    if (b.phone) { var a = el('a', 'cp-tag', b.phone); a.href = 'tel:' + b.phone.replace(/[^+\d]/g, ''); r.appendChild(a); }
    d.appendChild(r);
    if (b.notes) d.appendChild(el('p', null, 'Note: ' + b.notes));
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
    var F = S.form, c = courtOf(F.court_id), D = S.data;
    d.appendChild(el('h3', null, 'Nuova prenotazione · ' + c.name));
    d.appendChild(el('p', null, longDay(S.day) + ', dalle ' + F.time + '. Per chi prenota al telefono o di persona.'));
    var f = el('div', 'cp-form');
    function inp(label, key, type, extra) {
      var l = el('label', null, label), i = el('input'); i.type = type || 'text'; i.value = F[key]; if (extra) for (var k in extra) i.setAttribute(k, extra[k]);
      i.setAttribute('data-k', key); i.oninput = function () { F[key] = i.value; }; l.appendChild(i); return l;
    }
    var r1 = el('div', 'cp-f2'); r1.appendChild(inp('Nome', 'first_name', 'text', { autocomplete: 'off', maxlength: 60 })); r1.appendChild(inp('Cognome', 'last_name', 'text', { autocomplete: 'off', maxlength: 60 })); f.appendChild(r1);
    f.appendChild(inp('Telefono', 'phone', 'tel', { inputmode: 'tel', maxlength: 30 }));
    var r2 = el('div', 'cp-f2');
    var ld = el('label', null, 'Durata'), sel = el('select');
    var mx = Math.max(1, Math.min(4, Math.floor((maxEnd(c) - mins(F.time)) / c.slot_min)));
    for (var h = 1; h <= mx; h++) { var o = el('option', null, (h * c.slot_min >= 60 ? (h * c.slot_min / 60).toString().replace('.', ',') + (h * c.slot_min === 60 ? ' ora' : ' ore') : h * c.slot_min + ' min')); o.value = String(h); if (h === F.hours) o.selected = true; sel.appendChild(o); }
    sel.onchange = function () { F.hours = +sel.value; }; ld.appendChild(sel); r2.appendChild(ld);
    r2.appendChild(inp('Giocatori', 'players', 'number', { inputmode: 'numeric', min: 1, max: 22 })); f.appendChild(r2);
    f.appendChild(inp('Di cui soci', 'members', 'number', { inputmode: 'numeric', min: 0, max: 22 }));
    f.appendChild(inp('Note (facoltative)', 'notes', 'text', { maxlength: 300 }));
    if (F.msg) { var m = el('div', 'cp-msg', F.msg); m.setAttribute('role', 'alert'); f.appendChild(m); }
    var row = el('div', 'cp-row');
    var sv = el('button', 'cp-btn pri', S.busy ? 'Salvo…' : 'Salva prenotazione'); sv.type = 'button'; sv.disabled = S.busy; sv.onclick = save;
    var cn = el('button', 'cp-btn', 'Annulla'); cn.type = 'button'; cn.onclick = function () { S.form = null; draw(); };
    row.appendChild(sv); row.appendChild(cn); f.appendChild(row); d.appendChild(f); return d;
  }
  function maxEnd(c) { var m = 0; ((c.hours && c.hours[String(wd(S.day))]) || []).forEach(function (h) { if (mins(h[0]) <= mins(S.form.time) && mins(h[1]) > mins(S.form.time)) m = mins(h[1]); }); return m; }
  function focusForm() { setTimeout(function () { var i = root.querySelector('.cp-form input'); if (i) { i.focus(); i.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, 30); }
  function save() {
    var F = S.form; if (S.busy) return;
    if (!F.first_name.trim() || !F.last_name.trim()) { F.msg = 'Scrivi nome e cognome.'; draw(); return; }
    if (!F.phone.trim()) { F.msg = 'Scrivi il telefono.'; draw(); return; }
    var p = F.players === '' ? null : +F.players, mm = F.members === '' ? null : +F.members;
    if (p !== null && mm !== null && mm > p) { F.msg = 'I soci non possono essere più dei giocatori.'; draw(); return; }
    F.msg = ''; S.busy = true; draw();
    call({ action: 'create', court_id: F.court_id, date: S.day, time: F.time, hours: F.hours, first_name: F.first_name, last_name: F.last_name, phone: F.phone, players: p, members: mm, notes: F.notes })
      .then(function (j) { S.busy = false; S.form = null; S.sel = j.booking && j.booking.id; toast('Prenotazione salvata'); S.data = null; load(); })
      .catch(function (e) { S.busy = false; F.msg = e.message; draw(); });
  }

  window.__cpReload = function () { S.data = null; S.strip = S.strip || null; load(); };
  load();
})();
