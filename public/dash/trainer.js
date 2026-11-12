// --- Personal trainer: stessa agenda dei servizi alla persona, ma "iscritti" e "pacchetti" ---
(function () {
  if (!window.__LIA_PT) return;
  /* niente "Sconti e promozioni" e niente combinazioni di servizi ("Pacchetti") in Impostazioni: qui i pacchetti sono i servizi */
  var hs = document.createElement('style'); hs.textContent = '.stRow[data-st="promos"],.stRow[data-st="combos"],.stPage[data-st="promos"],.stPage[data-st="combos"],.stRow[data-st="staff"],.stPage[data-st="staff"],.stPage[data-st="staffdetail"],#pfTeamCard,.nx-more{display:none!important}'; document.head.appendChild(hs);
  /* esempi del modulo "Nuovo pacchetto": niente taglio capelli */
  function ph() { [['svcNewName', 'Es. Pacchetto 10 coaching'], ['svcNewPrice', 'Es. 450'], ['svcNewMin', 'Es. 60']].forEach(function (x) { var e = document.getElementById(x[0]); if (e) e.placeholder = x[1]; }); }
  function cx() { [].forEach.call(document.querySelectorAll('.stHint'), function (e) { if (/chiesto di chiamarti/.test(e.textContent)) e.textContent = 'Fino a quanto tempo prima del coaching l\u2019iscritto può annullare da solo. Se annulla dopo questo termine, il coaching di quel giorno viene perso e l\u2019ingresso viene scalato.'; }); }
  function all() { ph(); cx(); }
  all(); document.addEventListener('DOMContentLoaded', all); setTimeout(all, 1500); document.addEventListener('click', function () { setTimeout(all, 60); }, true);
  function tok() { return (new URLSearchParams(location.search).get('t') || '').trim(); }
  function url(extra) { return '/api/agenda?t=' + encodeURIComponent(tok()) + '&pt=1' + (extra || ''); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]; }); }

  /* ---------- 1) parole: clienti -> iscritti, servizi -> pacchetti ---------- */
  var RULES = [
    [/\bil cliente\b/g, "l'iscritto"], [/\bIl cliente\b/g, "L'iscritto"],
    [/\bdel cliente\b/g, "dell'iscritto"], [/\bal cliente\b/g, "all'iscritto"], [/\bdal cliente\b/g, "dall'iscritto"],
    [/\bi clienti\b/g, 'gli iscritti'], [/\bI clienti\b/g, 'Gli iscritti'],
    [/\bdei clienti\b/g, 'degli iscritti'], [/\bai clienti\b/g, 'agli iscritti'], [/\bdai clienti\b/g, 'dagli iscritti'],
    [/\bClienti\b/g, 'Iscritti'], [/\bclienti\b/g, 'iscritti'],
    [/\bCliente\b/g, 'Iscritto'], [/\bcliente\b/g, 'iscritto'],
    [/\bNessuna visita\b/g, 'Nessun coaching'], [/\bVisite\b/g, 'Coaching'], [/\bvisite\b/g, 'coaching'], [/\bvisita\b/g, 'coaching'],
    [/\bNuovo appuntamento\b/g, 'Nuova prenotazione coaching'], [/\bAnnulla appuntamento\b/g, 'Annulla prenotazione'], [/\bNessun appuntamento\b/g, 'Nessuna prenotazione'], [/\bAppuntamenti\b/g, 'Prenotazioni'],
    [/\bServizi\b/g, 'Pacchetti'], [/\bservizi\b/g, 'pacchetti'],
    [/\bServizio\b/g, 'Pacchetto'], [/\bservizio\b/g, 'pacchetto']
  ];
  function swap(t) {
    if (!t || !/clien|serviz|Clien|Serviz|visit|Visit|ppuntament/.test(t)) return t;
    for (var i = 0; i < RULES.length; i++) t = t.replace(RULES[i][0], RULES[i][1]);
    return t;
  }
  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };
  var ATTRS = ['placeholder', 'aria-label', 'title'];
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { fixText(root); return; }
    if (root.nodeType !== 1 || SKIP[root.tagName]) return;
    fixAttrs(root);
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode: function (n) { return n.nodeType === 1 && SKIP[n.tagName] ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var n;
    while ((n = tw.nextNode())) { if (n.nodeType === 3) fixText(n); else fixAttrs(n); }
  }
  function fixText(n) {
    var p = n.parentNode;
    if (!p || SKIP[p.tagName]) return;
    var v = swap(n.nodeValue);
    if (v !== n.nodeValue) n.nodeValue = v;
  }
  function fixAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var a = el.getAttribute(ATTRS[i]);
      if (a) { var v = swap(a); if (v !== a) el.setAttribute(ATTRS[i], v); }
    }
  }
  var obs = new MutationObserver(function (list) {
    obs.disconnect();
    try {
      list.forEach(function (m) {
        if (m.type === 'characterData') fixText(m.target);
        else if (m.type === 'attributes') fixAttrs(m.target);
        else m.addedNodes.forEach(walk);
      });
      decorate();
    } catch (e) { }
    start();
  });
  function start() { obs.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); }

  /* ---------- 2) scheda iscritto: pacchetti e ingressi ---------- */
  var cache = {};
  function loadPacks(phone) {
    return fetch(url('&phone=' + encodeURIComponent(phone)), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) { cache[phone] = d; return d; });
  }
  function render(box, d, phone, name) {
    var packs = d.packs || [], svcs = d.services || [];
    var h = '<div class="ptH">Pacchetti</div>';
    if (!packs.length) h += '<div class="ptEmpty">Nessun pacchetto assegnato. Senza ingressi non può prenotare.</div>';
    packs.forEach(function (p) {
      h += '<div class="ptRow"><div><b>' + esc(p.name) + '</b><small>' + p.left + ' di ' + p.total + ' ingressi rimasti</small></div>' +
        '<button type="button" class="ptX" data-rm="' + esc(p.id) + '" aria-label="Togli pacchetto">Togli</button></div>';
    });
    if (svcs.length) {
      h += '<div class="ptAdd"><select class="ptSel">' + svcs.map(function (s) { return '<option value="' + esc(s.id) + '">' + esc(s.name) + ' · ' + s.entries + ' ingressi</option>'; }).join('') +
        '</select><button type="button" class="ptGo">Assegna</button></div>';
    } else h += '<div class="ptEmpty">Crea prima un pacchetto da Impostazioni.</div>';
    h += '<div class="ptErr" role="alert" hidden></div>';
    box.innerHTML = h;
    var err = box.querySelector('.ptErr');
    function fail(m) { err.textContent = m; err.hidden = false; }
    function post(b) {
      return fetch(url(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(function (r) {
        return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Errore'); return j; });
      });
    }
    var go = box.querySelector('.ptGo');
    if (go) go.onclick = function () {
      go.disabled = true;
      post({ action: 'assign', service_id: box.querySelector('.ptSel').value, name: name, phone: phone })
        .then(function () { refresh(); return loadPacks(phone); }).then(function (dd) { render(box, dd, phone, name); })
        .catch(function (e) { go.disabled = false; fail(e.message); });
    };
    box.querySelectorAll('[data-rm]').forEach(function (b) {
      b.onclick = function () {
        b.disabled = true;
        post({ action: 'remove', id: b.getAttribute('data-rm') })
          .then(function () { refresh(); return loadPacks(phone); }).then(function (dd) { render(box, dd, phone, name); })
          .catch(function (e) { b.disabled = false; fail(e.message); });
      };
    });
  }
  function decorate() {
    document.querySelectorAll('#clDet .cd, #clSheet .cd').forEach(function (cd) {
      if (cd.querySelector('.ptBox')) return;
      var a = cd.querySelector('a.cd-act[href^="tel:"]'), h2 = cd.querySelector('.cd-hero h2'), pe = cd.querySelector('.cd-hero .p');
      var acts = cd.querySelector('.cd-acts');
      if (!a || !acts || !h2 || !pe) return;
      var phone = pe.textContent.trim(), name = h2.textContent.trim();
      var box = document.createElement('div');
      box.className = 'ptBox';
      var warm = cache[phone];
      if (warm) render(box, warm, phone, name);
      else { box.style.minHeight = '96px'; box.innerHTML = '<div class="ptEmpty">Carico i pacchetti…</div>'; }
      acts.insertAdjacentElement('afterend', box);
      loadPacks(phone).then(function (d) { box.style.minHeight = ''; render(box, d, phone, name); }).catch(function () { if (!warm) box.remove(); });
    });
  }


  /* ---------- 3) elenco iscritti (diverso dai clienti): solo chi ha un pacchetto ---------- */
  function pn(p) { var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('0039') === 0) d = d.slice(4); else if (d.indexOf('39') === 0 && d.length > 10) d = d.slice(2); return d; }
  var ROSTER = null;
  window.liaPtMerge = function (clients) {
    return fetch(url('&roster=1'), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
      ROSTER = d; var by = {};
      clients.forEach(function (c) { by[pn(c.phone)] = c; });
      return (d.members || []).map(function (m) {
        var c = by[pn(m.phone)] || { phone: m.phone, email: '', visits: 0, last: '', lastDate: null, ago: null, past: [], next: null, svc: '', noshow: 0 };
        c.name = m.name; c.phone = m.phone;
        c.svc = m.left + (m.left === 1 ? ' ingresso' : ' ingressi') + ' rimasti';
        return c;
      });
    });
  };
  window.liaPtOpenNew = function (svcs) { newMember(svcs); };
  function refresh() { if (window.liaPtRefresh) { window.liaPtRefresh(); return; } window.liaClients = null; if (window.liaEnsureClients) window.liaEnsureClients(); }

  function newMember(svcsIn) {
    var svcs = svcsIn || (ROSTER && ROSTER.services) || [];
    var bg = document.createElement('div'); bg.className = 'liaSheetBg';
    var sh = document.createElement('div'); sh.className = 'liaSheet'; sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    sh.innerHTML = '<div class="grab"></div><h2>Nuovo iscritto</h2><p class="lsub">Inseriscilo dopo che ha pagato: potrà prenotare da solo fino a esaurimento degli ingressi.</p>' +
      '<div class="lrow"><div class="lf"><label for="nmF">Nome</label><input id="nmF" type="text" autocomplete="off"></div><div class="lf"><label for="nmL">Cognome</label><input id="nmL" type="text" autocomplete="off"></div></div>' +
      '<div class="lf"><label for="nmP">Telefono</label><input id="nmP" type="tel" inputmode="tel" autocomplete="off"></div>' +
      '<div class="lf"><label for="nmS">Pacchetto sottoscritto</label><select id="nmS" class="ptSel" style="width:100%">' + svcs.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + ' · ' + x.entries + ' ingressi</option>'; }).join('') + '</select></div>' +
      '<div class="lerr" role="alert" hidden></div><button type="button" class="lb lsave">Salva</button><button type="button" class="lb lcancel">Annulla</button>';
    document.body.appendChild(bg); document.body.appendChild(sh);
    var $ = function (q) { return sh.querySelector(q); }, err = $('.lerr');
    function close() { bg.classList.remove('on'); sh.classList.remove('on'); setTimeout(function () { bg.remove(); sh.remove(); }, 300); }
    bg.addEventListener('click', close); $('.lcancel').addEventListener('click', close);
    requestAnimationFrame(function () { bg.classList.add('on'); sh.classList.add('on'); });
    $('.lsave').addEventListener('click', function () {
      var f = $('#nmF').value.trim(), l = $('#nmL').value.trim(), p = $('#nmP').value.trim(), b = this;
      function fail(m) { err.textContent = m; err.hidden = false; }
      if (!svcs.length) return fail('Crea prima un pacchetto da Impostazioni.');
      if (f.length < 2 || l.length < 2) return fail('Scrivi nome e cognome.');
      if (pn(p).length < 6) return fail('Scrivi il numero di telefono.');
      b.disabled = true; err.hidden = true;
      fetch(url(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'assign', service_id: $('#nmS').value, first_name: f, last_name: l, phone: p }) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Errore'); }); })
        .then(function () { close(); refresh(); }).catch(function (e) { b.disabled = false; fail(e.message); });
    });
  }
  function addNewBtn() {
    var sm = document.getElementById('clientSummary');
    if (!sm || document.getElementById('ptNewBtn')) return;
    var b = document.createElement('button'); b.type = 'button'; b.id = 'ptNewBtn'; b.className = 'ptGo'; b.textContent = '+ Nuovo iscritto'; b.style.margin = '6px 0 10px';
    b.onclick = function () { if (ROSTER) newMember(); else window.liaPtMerge([]).then(newMember); };
    sm.insertAdjacentElement('beforebegin', b);
  }

  var css = document.createElement('style');
  css.textContent = '.ptBox{margin:14px 0;padding:14px;border:1px solid var(--line,#e5e7eb);border-radius:14px;background:var(--card,#fff)}' +
    '.ptH{font-weight:700;margin-bottom:8px}.ptEmpty{color:var(--muted,#6b7280);font-size:.9rem}' +
    '.ptRow{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid var(--line,#eee)}' +
    '.ptRow small{display:block;color:var(--muted,#6b7280)}.ptX{border:0;background:none;color:#b42318;font:inherit;font-size:.85rem;cursor:pointer;padding:6px}' +
    '.ptAdd{display:flex;gap:8px;margin-top:10px}.ptSel{flex:1;min-width:0;padding:10px;border-radius:10px;border:1px solid var(--line,#d1d5db);font:inherit;background:#fff}' +
    '.ptGo{padding:10px 16px;border:0;border-radius:10px;background:var(--accent,#0f766e);color:#fff;font:inherit;font-weight:600;cursor:pointer}' +
    '.ptGo:disabled{opacity:.6}.ptErr{color:#b42318;font-size:.88rem;margin-top:8px}' +
    '.ptDurRow{display:flex;flex-wrap:wrap;gap:8px}.ptDurB{padding:8px 12px;border-radius:999px;border:1px solid var(--line2,#2a3648);background:transparent;color:var(--ink,inherit);font:inherit;font-size:.86rem;cursor:pointer}.ptDurB.on{background:var(--accent-soft,rgba(45,210,220,.15));border-color:var(--accent,#2dd2dc);color:var(--accent-ink,var(--accent,#2dd2dc))}' +
    '.ptNewBox{grid-column:1/-1;display:flex;flex-direction:column;gap:12px;margin:4px 0 6px}.ptNewGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ptNewF{min-width:0}.ptNewL{display:block;font-weight:600;margin-bottom:6px}'+'.ptStep{display:flex;align-items:stretch;border:1px solid var(--line2,#2a3648);border-radius:14px;overflow:hidden;background:var(--field,transparent)}.ptStep button{flex:0 0 44px;border:0;background:transparent;color:var(--accent,#2dd2dc);font:inherit;font-size:1.4rem;cursor:pointer}.ptStep button:active{background:var(--accent-soft,rgba(45,210,220,.15))}'+'.ptStep input{flex:1;min-width:0;width:100%;border:0;background:transparent;color:inherit;font:inherit;font-weight:600;text-align:center;padding:12px 0;outline:0;-moz-appearance:textfield}.ptStep input::-webkit-outer-spin-button,.ptStep input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}'+'.ptNewHint{font-size:.82rem;line-height:1.4;color:var(--muted,#8896a8);padding:10px 12px;border-radius:12px;background:rgba(127,140,160,.1)}'+
    '.ptEnW{margin-top:8px}.cd [data-del=ask]{display:none}';
  document.head.appendChild(css);

  /* campi "Coaching", "Durata" e "Massimo a settimana" nel modulo di nuovo pacchetto */
  window.__ptNew = { months: 0 };
  var DURS = [[0, 'Senza scadenza'], [1, 'Mensile'], [3, 'Trimestrale'], [6, 'Semestrale'], [12, 'Annuale']];
  function paintDur(box) { [].forEach.call(box.children, function (b) { var on = Number(b.getAttribute('data-m')) === window.__ptNew.months; b.className = 'ptDurB' + (on ? ' on' : ''); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }); }
  window.liaPtNewReset = function () { window.__ptNew = { months: 0 }; var b = document.getElementById('svcNewDur'), w = document.getElementById('svcNewWeek'); if (b) paintDur(b); if (w) w.value = ''; if (window.__ptRefresh) window.__ptRefresh(); };
  function stepper(id, min, max, ph, val) {
    var w = document.createElement('div'); w.className = 'ptStep';
    var dn = document.createElement('button'); dn.type = 'button'; dn.setAttribute('aria-label', 'Meno'); dn.textContent = '−';
    var up = document.createElement('button'); up.type = 'button'; up.setAttribute('aria-label', 'Più'); up.textContent = '+';
    var i = document.createElement('input'); i.id = id; i.type = 'number'; i.min = min; i.max = max; i.step = 1; i.inputmode = 'numeric'; i.placeholder = ph; if (val) i.value = val;
    function bump(d) { var v = parseInt(i.value, 10); if (isNaN(v)) v = d > 0 ? (min - 1) : min; v = Math.max(min - 1, Math.min(max, v + d)); i.value = v < min ? '' : v; i.dispatchEvent(new Event('input', { bubbles: true })); }
    dn.addEventListener('click', function () { bump(-1); }); up.addEventListener('click', function () { bump(1); });
    w.appendChild(dn); w.appendChild(i); w.appendChild(up); return w;
  }
  function addEntriesField() {
    var m = document.getElementById('svcNewMin');
    if (!m || document.getElementById('svcNewEntries')) return;
    var lab = m.closest('label');
    if (!lab) return;
    var box = document.createElement('div'); box.className = 'ptNewBox';
    var g = document.createElement('div'); g.className = 'ptNewGrid';
    var c1 = document.createElement('div'); c1.className = 'ptNewF';
    c1.innerHTML = '<span class="ptNewL">Coaching totali</span>'; c1.appendChild(stepper('svcNewEntries', 1, 1000, '10', 10));
    var c2 = document.createElement('div'); c2.className = 'ptNewF';
    c2.innerHTML = '<span class="ptNewL">Max a settimana</span>'; c2.appendChild(stepper('svcNewWeek', 1, 7, '∞', ''));
    g.appendChild(c1); g.appendChild(c2); box.appendChild(g);
    var hint = document.createElement('div'); hint.className = 'ptNewHint'; hint.id = 'svcNewHint';
    var sec = document.createElement('div'); sec.className = 'ptNewF';
    sec.innerHTML = '<span class="ptNewL">Durata del pacchetto</span><div class="ptDurRow" id="svcNewDur" role="group" aria-label="Durata del pacchetto"></div>';
    box.appendChild(sec); box.appendChild(hint);
    lab.insertAdjacentElement('afterend', box);
    var row = sec.querySelector('#svcNewDur');
    function refresh() {
      paintDur(row);
      var mo = window.__ptNew.months, w = parseInt((document.getElementById('svcNewWeek') || {}).value, 10);
      var d = mo ? 'Scade ' + (mo === 1 ? '1 mese' : mo + ' mesi') + ' dopo l’assegnazione; i coaching non usati si perdono (puoi prolungare a mano).' : 'Nessuna scadenza: i coaching restano finché non li usa.';
      hint.textContent = d + (w ? ' Massimo ' + w + ' a settimana (lun–dom).' : ' Nessun limite settimanale.');
    }
    DURS.forEach(function (o) { var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-m', o[0]); b.textContent = o[1]; b.addEventListener('click', function () { window.__ptNew.months = o[0]; refresh(); }); row.appendChild(b); });
    box.addEventListener('input', refresh);
    window.__ptRefresh = refresh; refresh();
  }
  var _dec = decorate;
  decorate = function () { _dec(); addEntriesField(); addNewBtn(); };

  function init() { walk(document.body); decorate(); start(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
