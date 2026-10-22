// nav.js - il menu della dashboard admin e la campanella dei problemi, in un solo posto.
// Per aggiungere una pagina basta aggiungere una riga qui sotto.
(function () {
  var PAGES = [
    { label: 'Panoramica', href: '/admin/', also: ['/admin/index.html'] },
    { label: 'Clienti', href: '/admin/clienti.html', also: ['/admin/attivita.html'] },
    { label: 'Richieste', href: '/admin/richieste.html', badge: true },
    { label: 'Andamento', href: '/admin/andamento.html' },
    { label: 'Uso di Lia', href: '/admin/lia.html' },
    { label: 'Ricavi', href: '/admin/soldi.html' },
    { label: 'Costi', href: '/admin/costi.html' },
    { label: 'Referral', href: '/admin/referral.html' },
    { label: 'Sistema', href: '/admin/sistema.html' }
  ];
  var nav = document.getElementById('mainNav');
  if (!nav) return;
  var path = location.pathname.replace(/\/+$/, '') || '/';
  function is(p) { return path === p.replace(/\/+$/, '') || (p === '/admin/' && path === '/admin'); }
  nav.innerHTML = '';
  PAGES.forEach(function (p) {
    var a = document.createElement('a');
    a.href = p.href;
    a.textContent = p.label;
    var on = is(p.href) || (p.also || []).some(is);
    if (on) a.className = 'on';
    if (p.badge) a.id = 'navRichieste';
    nav.appendChild(a);
  });
  // sul telefono il menu scorre: porto la voce attiva in vista
  var cur = nav.querySelector('a.on');
  if (cur) { try { var dx = cur.getBoundingClientRect().left - nav.getBoundingClientRect().left; nav.scrollLeft = Math.max(0, nav.scrollLeft + dx - (nav.clientWidth - cur.offsetWidth) / 2); } catch (e) {} }

  // numerino rosso con le richieste nuove (le pagine possono aggiornarlo con window.liaNavBadge)
  window.liaNavBadge = function (n) {
    var a = document.getElementById('navRichieste'); if (!a) return;
    var b = a.querySelector('.nav-badge');
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'nav-badge'; b.style.cssText = 'display:inline-block;min-width:20px;height:20px;margin-left:7px;padding:0 6px;border-radius:999px;background:#FF8A8A;color:#2a0a0a;font-size:.74rem;font-weight:800;line-height:20px;text-align:center;vertical-align:1px'; a.appendChild(b); }
    b.textContent = n > 99 ? '99+' : String(n);
  };
  var onLogin = /\/admin\/login/.test(location.pathname);
  if (window.liaApi && !onLogin) {
    window.liaApi('/api/admin/clients?view=requests_count').then(function (j) { window.liaNavBadge(j && j.new); }).catch(function () {});
  }

  var row = nav.parentNode;

  // ---------- campanella dei problemi ----------
  var css = document.createElement('style');
  css.textContent =
    '#mainNav{min-width:0;overflow-x:auto;scrollbar-width:none}#mainNav::-webkit-scrollbar{display:none}#mainNav a{white-space:nowrap;padding-left:11px;padding-right:11px}' +
    '.lia-bell{position:relative;flex:none;width:42px;height:42px;border-radius:13px;border:1px solid var(--line2,#2A3648);background:var(--card2,#161D29);color:var(--ink,#F9F6F0);display:grid;place-items:center;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}' +
    '.lia-bell:hover{filter:brightness(1.12)}' +
    '.lia-bell .bn{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;font-weight:800;font-size:.72rem;line-height:20px;text-align:center;color:#2a0a0a;background:#FF8A8A;box-shadow:0 0 0 3px var(--bg,#050608)}' +
    '.lia-bell .bn.warn{background:#F5C15E}.lia-bell .bn.ok{display:none}' +
    '.lia-pop{position:fixed;z-index:60;right:14px;left:auto;width:min(400px,calc(100vw - 28px));max-height:calc(100dvh - 96px);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:var(--card,#0E131B);border:1px solid var(--line2,#2A3648);border-radius:20px;padding:8px;box-shadow:0 28px 70px rgba(0,0,0,.65)}' +
    '.lia-pop[hidden]{display:none}' +
    '.lia-pop h3{margin:0;padding:12px 12px 6px;font-size:.95rem;font-weight:700;display:flex;justify-content:space-between;align-items:center}' +
    '.lia-pop h3 small{font-size:.76rem;font-weight:500;color:var(--muted,#9BA6B5)}' +
    '.lia-pr{display:grid;grid-template-columns:12px 1fr;gap:12px;padding:13px 12px;border-radius:14px;color:inherit;text-decoration:none;min-height:56px}' +
    '.lia-pr:hover,.lia-pr:active{background:var(--card2,#161D29)}' +
    '.lia-pr+.lia-pr{border-top:1px solid var(--line,#1C2532);border-top-left-radius:0;border-top-right-radius:0}' +
    '.lia-pr i{width:10px;height:10px;border-radius:50%;margin-top:6px}' +
    '.lia-pr i.crit{background:#FF8A8A;box-shadow:0 0 0 4px rgba(255,138,138,.16)}.lia-pr i.warn{background:#F5C15E;box-shadow:0 0 0 4px rgba(245,193,94,.14)}.lia-pr i.info{background:#8CC6FF}' +
    '.lia-pr b{display:block;font-size:.94rem;font-weight:600;line-height:1.3}' +
    '.lia-pr span{display:block;margin-top:2px;font-size:.83rem;line-height:1.4;color:var(--muted,#9BA6B5)}' +
    '.lia-empty{padding:22px 14px 24px;text-align:center;color:var(--muted,#9BA6B5);font-size:.92rem;line-height:1.5}' +
    '.lia-empty b{display:block;color:#3FE08A;font-size:1rem;margin-bottom:4px}' +
    '@media (max-width:760px){.lia-pop{left:12px;right:12px;width:auto;max-height:calc(100dvh - 120px)}.lia-bell{width:44px;height:44px}.top{transition:transform .25s ease}.top.lia-hide{transform:translateY(-100%)}}' +
    '@media (prefers-reduced-motion:reduce){.top{transition:none}}';
  
  // pulsante Esci uguale su tutte le pagine (alcune pagine non definiscono .btn.ghost)
  css.textContent += '#liaLogout{flex:none;min-height:42px;padding:0 16px;border-radius:13px;border:1px solid var(--line2,#2A3648);background:var(--card2,#161D29);color:var(--ink,#F9F6F0);font:inherit;font-weight:600;font-size:.9rem;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}#liaLogout:hover{filter:brightness(1.12)}@media (max-width:760px){#liaLogout{min-height:44px}}';
  document.head.appendChild(css);

  // tabelle sul telefono: ogni riga diventa una scheda con le etichette delle colonne (mobile.css fa il resto)
  (function () {
    var pending = false;
    function run() {
      pending = false;
      Array.prototype.forEach.call(document.querySelectorAll('table:not(.cards)'), function (t) {
        var heads = Array.prototype.map.call(t.querySelectorAll('thead th'), function (h) { return (h.textContent || '').trim(); });
        if (!heads.length) return;
        Array.prototype.forEach.call(t.querySelectorAll('tbody tr'), function (tr) {
          Array.prototype.forEach.call(tr.children, function (td, i) {
            if (td.colSpan > 1) { td.classList.add('mc-wide'); return; }
            if (heads[i] && td.getAttribute('data-l') !== heads[i]) td.setAttribute('data-l', heads[i]);
            if (td.querySelector('button,.rowbtns') && !td.textContent.replace(/\s+/g, '').match(/[0-9€]/)) td.classList.add('mc-act');
          });
        });
        t.classList.add('mcards');
        if (t.classList.contains('tbl')) t.classList.add('mlist');
      });
    }
    function sched() { if (!pending) { pending = true; requestAnimationFrame(run); } }
    new MutationObserver(sched).observe(document.body || document.documentElement, { childList: true, subtree: true });
    run();
  })();

  var bell, bn, pop;
  function mkBell() {
    if (!row || onLogin || document.getElementById('liaBell')) return;
    bell = document.createElement('button');
    bell.id = 'liaBell'; bell.type = 'button'; bell.className = 'lia-bell'; bell.setAttribute('aria-label', 'Problemi di sistema'); bell.setAttribute('aria-expanded', 'false');
    bell.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span class="bn ok" id="liaBellN"></span>';
    bn = bell.querySelector('.bn');
    pop = document.createElement('div');
    pop.id = 'liaPop'; pop.className = 'lia-pop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Problemi di sistema');
    row.appendChild(bell);
    document.body.appendChild(pop);
    bell.addEventListener('click', function (e) { e.stopPropagation(); toggle(); });
    document.addEventListener('click', function (e) { if (!pop.hidden && !pop.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', place);
  }
  function place() {
    if (!pop || pop.hidden || !bell) return;
    var r = bell.getBoundingClientRect();
    pop.style.top = Math.round(r.bottom + 10) + 'px';
  }
  function close() { if (!pop) return; pop.hidden = true; bell.setAttribute('aria-expanded', 'false'); }
  function toggle() {
    if (!pop.hidden) { close(); return; }
    pop.hidden = false; bell.setAttribute('aria-expanded', 'true'); place(); load();
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var last = null;
  function paint() {
    if (!bell || !last) return;
    var c = last.counts || {}, n = (c.crit || 0) + (c.warn || 0);
    bn.textContent = n > 99 ? '99+' : String(n);
    bn.className = 'bn ' + (c.crit ? '' : c.warn ? 'warn' : 'ok');
    var list = last.problems || [];
    var html = '<h3>Da sistemare<small>' + (list.length ? list.length + (list.length === 1 ? ' voce' : ' voci') : '') + '</small></h3>';
    if (!list.length) html += '<div class="lia-empty"><b>Tutto in ordine</b>Credito, scadenze, email e clienti sono a posto.</div>';
    list.forEach(function (p) {
      html += '<a class="lia-pr" href="' + esc(p.href || '#') + '"><i class="' + esc(p.severity) + '"></i><div><b>' + esc(p.title) + '</b><span>' + esc(p.detail) + '</span></div></a>';
    });
    pop.innerHTML = html;
  }
  function load() {
    if (!window.liaApi || onLogin) return;
    window.liaApi('/api/admin/system?view=problems').then(function (j) { last = j; paint(); }).catch(function () {
      if (pop && !pop.hidden && !last) pop.innerHTML = '<div class="lia-empty">Non riesco a controllare il sistema in questo momento. Riprova tra poco.</div>';
    });
  }
  mkBell();
  load();
  window.liaBellRefresh = load;
  setInterval(function () { if (!document.hidden) load(); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });

  // sul telefono l'intestazione si nasconde scorrendo verso il basso e torna scorrendo verso l'alto: piu' spazio per i contenuti
  (function () {
    var top = document.querySelector('.top'); if (!top) return;
    var lastY = window.scrollY || 0, ticking = false, phone = window.matchMedia('(max-width:760px)');
    window.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY || 0;
        if (!phone.matches || y < 90 || (pop && !pop.hidden)) top.classList.remove('lia-hide');
        else if (y > lastY + 6) top.classList.add('lia-hide');
        else if (y < lastY - 6) top.classList.remove('lia-hide');
        lastY = y; ticking = false;
      });
    }, { passive: true });
  })();

  // pulsante Esci
  if (row && !document.getElementById('liaLogout')) {
    var b = document.createElement('button');
    b.id = 'liaLogout'; b.type = 'button'; b.className = 'btn ghost small'; b.textContent = 'Esci';
    b.addEventListener('click', function () { if (window.liaLogout) window.liaLogout(); else location.href = '/admin/login.html'; });
    row.appendChild(b);
  }
})();
