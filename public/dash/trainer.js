// --- Personal trainer: stessa agenda dei servizi alla persona, ma "iscritti" e "pacchetti" ---
(function () {
  if (!window.__LIA_PT) return;
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
      box.innerHTML = '<div class="ptEmpty">Carico i pacchetti…</div>';
      acts.insertAdjacentElement('afterend', box);
      loadPacks(phone).then(function (d) { render(box, d, phone, name); }).catch(function () { box.remove(); });
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
    '.ptEnW{margin-top:8px}.cd [data-del=ask]{display:none}';
  document.head.appendChild(css);

  /* campo "Ingressi" nel modulo di nuovo pacchetto */
  function addEntriesField() {
    var m = document.getElementById('svcNewMin');
    if (!m || document.getElementById('svcNewEntries')) return;
    var lab = m.closest('label');
    if (!lab) return;
    var l2 = document.createElement('label');
    l2.className = lab.className;
    l2.innerHTML = '<span>Ingressi (coaching inclusi)</span><input class="set-input" id="svcNewEntries" type="number" min="1" max="1000" step="1" inputmode="numeric" placeholder="10">';
    lab.insertAdjacentElement('afterend', l2);
  }
  var _dec = decorate;
  decorate = function () { _dec(); addEntriesField(); addNewBtn(); };

  function init() { walk(document.body); decorate(); start(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
