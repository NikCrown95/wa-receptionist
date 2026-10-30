// nav.js - il menu della dashboard admin e la campanella dei problemi, in un solo posto.
// Per aggiungere una pagina basta aggiungere una riga qui sotto.
(function () {
  var PAGES = [
    { label: 'Panoramica', href: '/admin/', also: ['/admin/index.html'] },
    { label: 'Clienti', href: '/admin/clienti.html', also: ['/admin/attivita.html'] },
    { label: 'In diretta', href: '/admin/diretta.html' },
    { label: 'Richieste', href: '/admin/richieste.html', badge: true },
    { label: 'Andamento', href: '/admin/andamento.html' },
    { label: 'Uso di Lia', href: '/admin/lia.html' },
    { label: 'Ricavi', href: '/admin/soldi.html' },
    { label: 'Costi', href: '/admin/costi.html' },
    { label: 'Referral', href: '/admin/referral.html' },
    { label: 'Annunci', href: '/admin/annunci.html' },
    { label: 'Sistema', href: '/admin/sistema.html' }
  ];
  var nav = document.getElementById('mainNav');
  if (!nav) return;
  var path = location.pathname.replace(/\/+$/, '') || '/';
  function is(p) { return path === p.replace(/\/+$/, '') || (p === '/admin/' && path === '/admin'); }
  nav.innerHTML = '';
  nav.hidden = true;
  var menu = document.createElement('div');
  menu.id = 'liaMenu'; menu.className = 'lia-menu'; menu.hidden = true; menu.setAttribute('role', 'navigation'); menu.setAttribute('aria-label', 'Menu');
  PAGES.forEach(function (p) {
    var a = document.createElement('a');
    a.href = p.href;
    a.textContent = p.label;
    var on = is(p.href) || (p.also || []).some(is);
    if (on) { a.className = 'on'; a.setAttribute('aria-current', 'page'); }
    if (p.badge) { a.id = 'navRichieste'; a.setAttribute('data-badge', 'richieste'); }
    menu.appendChild(a);
  });
  var pushBtn = document.createElement('button');
  pushBtn.type = 'button'; pushBtn.id = 'liaPush'; pushBtn.className = 'lia-out lia-push'; pushBtn.hidden = true;
  menu.appendChild(pushBtn);
  var outLink = document.createElement('button');
  outLink.type = 'button'; outLink.id = 'liaLogout'; outLink.className = 'lia-out'; outLink.textContent = 'Esci';
  outLink.addEventListener('click', function () { if (window.liaLogout) window.liaLogout(); else location.href = '/admin/login.html'; });
  menu.appendChild(outLink);

  // numerino rosso con le richieste nuove (le pagine possono aggiornarlo con window.liaNavBadge)
  window.liaNavBadge = function (n) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-badge="richieste"]'), function (a) {
      var b = a.querySelector('.nav-badge');
      if (!n) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); b.className = 'nav-badge'; b.style.cssText = 'margin-left:auto;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#FF8A8A;color:#2a0a0a;font-size:.76rem;font-weight:800;line-height:22px;text-align:center'; a.appendChild(b); }
      b.textContent = n > 99 ? '99+' : String(n);
    });
  };
  var onLogin = /\/admin\/login/.test(location.pathname);
  if (window.liaApi && !onLogin) {
    window.liaApi('/api/admin/clients?view=requests_count').then(function (j) { window.liaNavBadge(j && j.new); }).catch(function () {});
  }

  var row = nav.parentNode;

  // ---------- campanella dei problemi ----------
  var css = document.createElement('style');
  css.textContent =
    '#mainNav{display:none !important}.top-row .spacer{display:block !important}' +
    '.lia-burger{flex:none;width:42px;height:42px;border-radius:13px;border:1px solid var(--line2,#2A3648);background:var(--card2,#161D29);color:var(--ink,#F9F6F0);display:grid;place-items:center;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}' +
    '.lia-burger[aria-expanded="true"]{background:var(--accent,#2DD2DC);color:var(--on-accent,#031016);border-color:var(--accent,#2DD2DC)}' +
    '.lia-menu{display:flex;flex-direction:column;gap:0;white-space:normal;position:fixed;z-index:61;right:14px;top:0;margin-top:calc(env(safe-area-inset-top,0px) + 66px);width:min(260px,calc(100vw - 28px));max-height:calc(100dvh - 96px);overflow-y:auto;overscroll-behavior:contain;padding:8px;border-radius:16px;background:var(--card2,#161D29);border:1px solid var(--line2,#2A3648);box-shadow:0 20px 44px rgba(0,0,0,.5);transform:translateY(-8px) scale(.97);opacity:0;pointer-events:none;transition:transform .16s cubic-bezier(.2,.8,.2,1),opacity .14s ease}' +
    '.lia-menu.on{transform:none;opacity:1;pointer-events:auto}.lia-menu[hidden]{display:none !important}' +
    '.lia-menu a{display:flex;align-items:center;flex:none;min-height:46px;padding:0 12px;border-radius:11px;color:var(--ink,#F9F6F0);text-decoration:none;font-weight:600;font-size:.96rem}' +
    '.lia-menu a:hover{background:var(--card,#0E131B)}.lia-menu a.on{color:var(--accent-ink,#A5EDF2);background:var(--card,#0E131B)}' +
    '.lia-menu .lia-out{display:flex;align-items:center;width:100%;min-height:46px;margin-top:6px;padding:0 12px;border:0;border-top:1px solid var(--line2,#2A3648);border-radius:0;background:transparent;color:#FF8A8A;font:inherit;font-weight:600;font-size:.96rem;cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent}' +
    '.lia-menu .lia-push{flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;flex:none;margin-top:6px;color:var(--ink,#F9F6F0);font-size:.92rem;line-height:1.3;padding-top:8px;padding-bottom:8px}.lia-menu .lia-push small{display:block;color:var(--muted,#9BA6B5);font-weight:500;font-size:.78rem}.lia-menu .lia-push[hidden]{display:none}' +
    '.lia-menu .lia-out:hover{background:rgba(255,138,138,.1);border-radius:11px}' +
    '.lia-mback{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:opacity .15s}.lia-mback.on{opacity:1;pointer-events:auto}.lia-mback[hidden]{display:none}' +
    '.lia-bell{position:relative;flex:none;width:42px;height:42px;border-radius:13px;border:1px solid var(--line2,#2A3648);background:var(--card2,#161D29);color:var(--ink,#F9F6F0);display:grid;place-items:center;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}' +
    '.lia-bell:hover{filter:brightness(1.12)}' +
    '.lia-bell .bn{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 6px;border-radius:10px;font-weight:800;font-size:.72rem;line-height:20px;text-align:center;color:#2a0a0a;background:#FF8A8A;box-shadow:0 0 0 3px var(--bg,#050608)}' +
    '.lia-bell .bn.ok{display:none}' +
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
    '@media (max-width:760px){.lia-pop{left:12px;right:12px;width:auto;max-height:calc(100dvh - 120px)}.lia-bell,.lia-burger{width:44px;height:44px}.lia-menu{right:12px}.top{transition:transform .25s ease}.top.lia-hide{transform:translateY(-100%)}}' +
    '@media (prefers-reduced-motion:reduce){.top{transition:none}.lia-menu,.lia-mback{transition:none}}';
  
  // pulsante Esci uguale su tutte le pagine (alcune pagine non definiscono .btn.ghost)
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
  var burger, mback, hideTimer = null, openedAt = 0, openY = 0;
  function menuOpen(o) {
    if (!burger) return;
    clearTimeout(hideTimer);
    if (o) {
      close(); menu.hidden = false; mback.hidden = false; menu.scrollTop = 0;
      openedAt = Date.now(); openY = window.scrollY || 0;
      // l'intestazione resta visibile finche' il menu e' aperto, cosi' il menu non resta staccato
      var tp = document.querySelector('.top'); if (tp) tp.classList.remove('lia-hide');
      requestAnimationFrame(function () { requestAnimationFrame(function () { menu.classList.add('on'); mback.classList.add('on'); }); });
    } else {
      menu.classList.remove('on'); mback.classList.remove('on');
      hideTimer = setTimeout(function () { if (!menu.classList.contains('on')) { menu.hidden = true; mback.hidden = true; } }, 200);
    }
    burger.setAttribute('aria-expanded', o ? 'true' : 'false');
  }
  if (row && !onLogin) {
    burger = document.createElement('button');
    burger.id = 'liaBurger'; burger.type = 'button'; burger.className = 'lia-burger'; burger.setAttribute('aria-label', 'Menu'); burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
    mback = document.createElement('div'); mback.className = 'lia-mback'; mback.hidden = true;
    row.appendChild(burger);
    document.body.appendChild(mback);
    document.body.appendChild(menu);
    burger.addEventListener('click', function (e) { e.stopPropagation(); menuOpen(burger.getAttribute('aria-expanded') !== 'true'); });
    mback.addEventListener('click', function () { menuOpen(false); });
    bell.addEventListener('click', function () { if (burger.getAttribute('aria-expanded') === 'true') menuOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') menuOpen(false); });
    // il menu si chiude se scorri la pagina davvero (non per i piccoli scatti della barra del browser)
    window.addEventListener('scroll', function () {
      if (burger.getAttribute('aria-expanded') !== 'true') return;
      if (Date.now() - openedAt < 500 || Math.abs((window.scrollY || 0) - openY) < 24) return;
      menuOpen(false);
    }, { passive: true });
  }

  // ---------- menu laterale e ricerca (desktop) ----------
  // Da 900px in su il menu sta a sinistra, sempre visibile. Sotto i 900px (telefono, iPad in verticale) resta il burger.
  (function () {
    if (onLogin) return;
    var IC = {
      'Panoramica': '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
      'Clienti': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2 .7 3.5 2.6 3.5 5.6"/>',
      'In diretta': '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
      'Richieste': '<path d="M4 13.5 6.2 5.8A2 2 0 0 1 8.1 4.5h7.8a2 2 0 0 1 1.9 1.3L20 13.5"/><path d="M4 13.5V18a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18v-4.5h-4.2l-1 2h-5.6l-1-2Z"/>',
      'Andamento': '<path d="M4 19V5M4 19h16"/><path d="m7.5 14 3.5-4 3 2.5 4.5-6"/>',
      'Uso di Lia': '<path d="M21 12a8 8 0 0 1-11.7 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12Z"/>',
      'Ricavi': '<path d="M17.5 7.5A6 6 0 1 0 17.5 16.5"/><path d="M4.5 10.5h8M4.5 13.5h8"/>',
      'Costi': '<path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2z"/><path d="M9 8.5h6M9 12h6"/>',
      'Referral': '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
      'Annunci': '<path d="M3 10v4a1 1 0 0 0 1 1h3l8 4V5L7 9H4a1 1 0 0 0-1 1z"/><path d="M19 9a4 4 0 0 1 0 6"/>',
      'Sistema': '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'
    };
    function svg(l) { return '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IC[l] || '') + '</svg>'; }
    var st = document.createElement('style');
    st.textContent =
      '.lia-side{display:none}' +
      '@media (min-width:900px){' +
        'html.lia-hassidebar body{padding-left:64px}' +
        'html.lia-hassidebar .top .brand,html.lia-hassidebar #liaBurger{display:none !important}' +
        '.lia-side{display:flex;flex-direction:column;position:fixed;z-index:15;left:0;top:0;bottom:0;width:64px;padding:calc(env(safe-area-inset-top,0px) + 14px) 10px calc(env(safe-area-inset-bottom,0px) + 14px);background:var(--bg2,#0A0D12);border-right:1px solid var(--line,#1C2532);overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;transition:width .18s ease,box-shadow .18s ease}' +
        '.lia-side.open{width:232px;padding-left:12px;padding-right:12px;z-index:40;box-shadow:18px 0 48px rgba(0,0,0,.55)}' +
        '.lia-side:not(.open) .ls-brand,.lia-side:not(.open) .ls-search,.lia-side:not(.open) .ls-foot{display:none}' +
        '.lia-side:not(.open) .ls-nav a{justify-content:center;padding:0;position:relative}.lia-side:not(.open) .ls-nav a>span:not(.nav-badge){display:none}' +
        '.lia-side:not(.open) .nav-badge{position:absolute;top:4px;right:4px;min-width:10px !important;width:10px;height:10px !important;padding:0 !important;font-size:0 !important;line-height:0 !important;margin:0 !important}' +
        '.ls-tog{display:flex;align-items:center;justify-content:center;width:44px;height:44px;flex:none;border:0;border-radius:12px;background:transparent;color:var(--muted,#9BA6B5);cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}.ls-tog:hover{background:var(--card,#0E131B);color:var(--ink,#F9F6F0)}' +
        '.lia-side.open .ls-tog{align-self:flex-end;margin-bottom:-36px;position:relative;z-index:2}' +
        '.ls-scrim{position:fixed;inset:0;z-index:39;background:rgba(0,0,0,.35)}.ls-scrim[hidden]{display:none}' +
      '}' +
      '.lia-side .ls-brand{padding:2px 8px 14px}.lia-side .logo{display:block;width:120px;height:30px;background:var(--logo) center / contain no-repeat}' +
      '.lia-side .ls-brand small{display:block;margin-top:7px;color:var(--muted,#9BA6B5);font-size:.72rem;letter-spacing:.04em}' +
      '.ls-nav{display:flex;flex-direction:column;gap:2px;margin-top:12px}' +
      '.ls-nav a{display:flex;align-items:center;gap:12px;min-height:42px;padding:0 10px;border-radius:10px;color:var(--muted,#9BA6B5);text-decoration:none;font-weight:600;font-size:.92rem}' +
      '.ls-nav a svg{flex:none}.ls-nav a:hover{background:var(--card,#0E131B);color:var(--ink,#F9F6F0)}' +
      '.ls-nav a.on{background:var(--card2,#161D29);color:var(--ink,#F9F6F0)}.ls-nav a.on svg{color:var(--accent,#2DD2DC)}' +
      '.ls-foot{margin-top:auto;padding-top:12px;display:flex;flex-direction:column}' +
      '.lia-side .lia-out{display:flex;align-items:center;width:100%;min-height:44px;margin-top:6px;padding:0 10px;border:0;border-top:1px solid var(--line2,#2A3648);border-radius:0;background:transparent;color:#FF8A8A;font:inherit;font-weight:600;font-size:.92rem;cursor:pointer;text-align:left}' +
      '.lia-side .lia-out:hover{background:rgba(255,138,138,.1);border-radius:10px}' +
      '.lia-side .lia-push{flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;color:var(--ink,#F9F6F0);font-size:.88rem;line-height:1.3;padding-top:8px;padding-bottom:8px}.lia-side .lia-push small{display:block;color:var(--muted,#9BA6B5);font-weight:500;font-size:.76rem}.lia-side .lia-push[hidden]{display:none}' +
      '.ls-sw{position:relative;margin:0 0 4px}.ls-sw svg{position:absolute;left:12px;top:12px;color:var(--muted,#9BA6B5);pointer-events:none}' +
      '.ls-sw input{width:100%;min-height:42px;border-radius:11px;border:1px solid var(--line2,#2A3648);background:var(--card,#0E131B);color:var(--ink,#F9F6F0);padding:0 12px 0 38px;font:inherit;font-size:16px;font-size:max(16px,.92rem)}' +
      '.ls-sw input::placeholder{color:var(--muted,#9BA6B5)}' +
      '.ls-res{position:absolute;left:0;right:0;top:48px;z-index:5;padding:6px;border-radius:12px;background:var(--card2,#161D29);border:1px solid var(--line2,#2A3648);box-shadow:0 18px 40px rgba(0,0,0,.55)}.ls-res[hidden]{display:none}' +
      '.lia-menu .ls-sw{margin:2px 0 6px}.lia-menu .ls-res{position:static;margin-top:6px;box-shadow:none}' +
      '.ls-res a{display:flex;justify-content:space-between;align-items:center;gap:10px;min-height:40px;padding:0 10px;border-radius:8px;color:var(--ink,#F9F6F0);text-decoration:none;font-weight:600;font-size:.9rem}' +
      '.ls-res a small{color:var(--muted,#9BA6B5);font-weight:500;font-size:.76rem;white-space:nowrap}.ls-res a:hover,.ls-res a.hl{background:var(--card,#0E131B)}.ls-res .none{padding:10px;color:var(--muted,#9BA6B5);font-size:.86rem}';
    document.head.appendChild(st);

    var side = document.createElement('aside');
    side.className = 'lia-side'; side.setAttribute('aria-label', 'Pagine');
    side.innerHTML = '<div class="ls-brand"><span class="logo" role="img" aria-label="Prenolia"></span><small>Super dashboard</small></div><div class="ls-search"></div><nav class="ls-nav"></nav><div class="ls-foot"></div>';
    var tog = document.createElement('button');
    tog.type = 'button'; tog.className = 'ls-tog'; tog.setAttribute('aria-label', 'Apri il menu delle pagine'); tog.setAttribute('aria-expanded', 'false');
    tog.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M9.5 4.5v15"/></svg>';
    side.insertBefore(tog, side.firstChild);
    var scrim = document.createElement('div'); scrim.className = 'ls-scrim'; scrim.hidden = true; document.body.appendChild(scrim);
    function setOpen(o) { side.classList.toggle('open', o); scrim.hidden = !o; tog.setAttribute('aria-expanded', o ? 'true' : 'false'); tog.setAttribute('aria-label', o ? 'Chiudi il menu' : 'Apri il menu delle pagine'); }
    tog.addEventListener('click', function () { setOpen(!side.classList.contains('open')); });
    scrim.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && side.classList.contains('open')) setOpen(false); });
    var canHover = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches, hov = null;
    if (canHover) {
      // si apre solo se il mouse si muove davvero sopra la colonna (non quando la pagina si carica con il puntatore gia' li')
      var p0 = null;
      side.addEventListener('mousemove', function (e) {
        if (side.classList.contains('open')) { clearTimeout(hov); return; }
        if (!p0) { p0 = [e.clientX, e.clientY, Date.now()]; return; }
        if (Date.now() - p0[2] > 800 || Math.abs(e.clientX - p0[0]) + Math.abs(e.clientY - p0[1]) > 6) { if (Math.abs(e.clientX - p0[0]) + Math.abs(e.clientY - p0[1]) > 6) { clearTimeout(hov); hov = setTimeout(function () { setOpen(true); }, 120); } p0 = [e.clientX, e.clientY, Date.now()]; }
      });
      side.addEventListener('mouseleave', function () { p0 = null; clearTimeout(hov); hov = setTimeout(function () { if (!side.contains(document.activeElement) || document.activeElement === tog) setOpen(false); }, 220); });
    }
    var navBox = side.querySelector('.ls-nav');
    PAGES.forEach(function (p) {
      var a = document.createElement('a');
      a.href = p.href;
      a.innerHTML = svg(p.label) + '<span></span>';
      a.lastChild.textContent = p.label; a.title = p.label;
      if (is(p.href) || (p.also || []).some(is)) { a.className = 'on'; a.setAttribute('aria-current', 'page'); }
      if (p.badge) a.setAttribute('data-badge', 'richieste');
      navBox.appendChild(a);
    });
    document.body.appendChild(side);
    document.documentElement.classList.add('lia-hassidebar');

    // il pulsante delle notifiche e "Esci" stanno nella barra laterale su desktop e nel burger sul telefono
    var foot = side.querySelector('.ls-foot'), mq = window.matchMedia('(min-width:900px)');
    function place() { var host = mq.matches ? foot : menu; host.appendChild(pushBtn); host.appendChild(outLink); }
    place();
    if (mq.addEventListener) mq.addEventListener('change', place); else if (mq.addListener) mq.addListener(place);

    // ricerca: attivita' (elenco clienti, letto alla prima volta) e pagine
    var clients = null, loading = false;
    function loadClients() {
      if (clients || loading || !window.liaApi) return;
      loading = true;
      window.liaApi('/api/admin/clients').then(function (j) { clients = (j && j.clients) || []; }).catch(function () { clients = []; }).then(function () { loading = false; refreshAll(); });
    }
    var boxes = [];
    function mkSearch(host) {
      var wrap = document.createElement('div'); wrap.className = 'ls-sw';
      wrap.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" autocomplete="off" placeholder="Cerca attività…" aria-label="Cerca un’attività o una pagina"><div class="ls-res" hidden></div>';
      var inp = wrap.querySelector('input'), res = wrap.querySelector('.ls-res');
      var box = { inp: inp, res: res };
      boxes.push(box);
      inp.addEventListener('focus', loadClients);
      inp.addEventListener('input', function () { render(box); });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { res.hidden = true; inp.blur(); }
        if (e.key === 'Enter') { var a = res.querySelector('a'); if (a) { e.preventDefault(); location.href = a.href; } }
      });
      host.insertBefore(wrap, host.firstChild);
    }
    function render(box) {
      var v = box.inp.value.trim().toLowerCase();
      if (!v) { box.res.hidden = true; return; }
      var hits = [];
      PAGES.forEach(function (p) { if (p.label.toLowerCase().indexOf(v) >= 0) hits.push({ t: p.label, s: 'Pagina', h: p.href }); });
      (clients || []).forEach(function (c) { if (String(c.name || '').toLowerCase().indexOf(v) >= 0) hits.push({ t: c.name, s: c.type || 'Attività', h: '/admin/attivita.html?id=' + encodeURIComponent(c.id) }); });
      box.res.innerHTML = '';
      hits.slice(0, 7).forEach(function (x) {
        var a = document.createElement('a'); a.href = x.h;
        var t = document.createElement('span'); t.textContent = x.t;
        var sm = document.createElement('small'); sm.textContent = x.s;
        a.appendChild(t); a.appendChild(sm); box.res.appendChild(a);
      });
      if (!hits.length) { var n = document.createElement('div'); n.className = 'none'; n.textContent = clients === null ? 'Carico le attività…' : 'Nessun risultato.'; box.res.appendChild(n); }
      box.res.hidden = false;
    }
    function refreshAll() { boxes.forEach(function (b) { if (b.inp.value.trim()) render(b); }); }
    mkSearch(side.querySelector('.ls-search'));
    mkSearch(menu);
    document.addEventListener('click', function (e) { boxes.forEach(function (b) { if (!b.res.parentNode.contains(e.target)) b.res.hidden = true; }); });
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      var typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
      if (!mq.matches || e.metaKey && e.key !== 'k' || e.altKey) return;
      if ((e.key === '/' && !typing) || ((e.metaKey || e.ctrlKey) && e.key === 'k')) { e.preventDefault(); boxes[0].inp.focus(); }
    });
  })();

  // ---------- notifiche push sul telefono (messaggi all'assistenza) ----------
  (function () {
    if (onLogin || !pushBtn) return;
    var supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    var info = null, busy = false;
    function keyBytes(k) { var p = '='.repeat((4 - k.length % 4) % 4), r = atob((k + p).replace(/-/g, '+').replace(/_/g, '/')), o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
    function post(body) { return window.liaApi('/api/admin/system', { method: 'POST', body: JSON.stringify(body) }); }
    function curSub() { return navigator.serviceWorker.getRegistration().then(function (g) { return g && g.pushManager ? g.pushManager.getSubscription() : null; }).catch(function () { return null; }); }
    function paint(on, note) {
      pushBtn.hidden = false;
      pushBtn.innerHTML = (on ? 'Notifiche attive' : 'Attiva le notifiche') + '<small>' + (note || (on ? 'Tocca per spegnerle su questo telefono' : 'Ti avviso quando un\u2019attività scrive all\u2019assistenza')) + '</small>';
      pushBtn.dataset.on = on ? '1' : '';
    }
    function refresh() {
      if (!supported) return;
      window.liaApi('/api/admin/system?view=push').then(function (j) {
        info = j;
        if (!j || !j.configured || j.table === false) return;
        if (Notification.permission === 'denied') { paint(false, 'Bloccate: riattivale dalle impostazioni del telefono'); return; }
        return curSub().then(function (sub) { paint(!!sub && Notification.permission === 'granted'); });
      }).catch(function () {});
    }
    function enable() {
      return Promise.resolve(Notification.requestPermission()).then(function (p) {
        if (p !== 'granted') throw new Error('denied');
        return navigator.serviceWorker.register('/sw.js');
      }).then(function () { return navigator.serviceWorker.ready; }).then(function (reg) {
        function go() { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(info.key) }); }
        return go().catch(function () { return reg.pushManager.getSubscription().then(function (o) { if (!o) throw new Error('sub'); return o.unsubscribe().then(go); }); });
      }).then(function (sub) {
        return post({ action: 'push_subscribe', subscription: sub.toJSON(), ua: String(navigator.userAgent || '').slice(0, 200) });
      }).then(function () { return post({ action: 'push_test' }).catch(function () {}); }).then(function () { paint(true, 'Attivate. Ti ho mandato una prova.'); });
    }
    function disable() {
      return curSub().then(function (sub) {
        if (!sub) return;
        var ep = sub.endpoint;
        return sub.unsubscribe().then(function () { return post({ action: 'push_unsubscribe', endpoint: ep }).catch(function () {}); });
      }).then(function () { paint(false); });
    }
    pushBtn.addEventListener('click', function () {
      if (busy || !info) return; busy = true;
      var job = pushBtn.dataset.on ? disable() : enable();
      job.catch(function (e) { paint(false, e && e.message === 'denied' ? 'Permesso non concesso: riprova' : 'Non sono riuscito ad attivarle: riprova'); }).then(function () { busy = false; });
    });
    // se il telefono e' gia' registrato, tengo allineato il server
    function sync() {
      if (!supported || Notification.permission !== 'granted') return;
      navigator.serviceWorker.register('/sw.js').then(function () { return curSub(); }).then(function (sub) {
        if (sub) return post({ action: 'push_subscribe', subscription: sub.toJSON(), ua: String(navigator.userAgent || '').slice(0, 200) });
      }).catch(function () {});
    }
    setTimeout(function () { refresh(); sync(); }, 1200);
  })();
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
        if (!phone.matches || y < 90 || (pop && !pop.hidden) || (burger && burger.getAttribute('aria-expanded') === 'true')) top.classList.remove('lia-hide');
        else if (y > lastY + 6) top.classList.add('lia-hide');
        else if (y < lastY - 6) top.classList.remove('lia-hide');
        lastY = y; ticking = false;
      });
    }, { passive: true });
  })();

  // pulsante "Installa app": compare solo quando Chrome dice che l'app e' installabile (e non e' gia' installata)
  (function () {
    var deferred = null;
    var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
    if (standalone || onLogin) return;
    var st = document.createElement('style');
    st.textContent = '#liaInstall{flex:none;min-height:42px;padding:0 13px;border-radius:13px;border:1px solid transparent;background:var(--accent-soft,#0B2C33);color:var(--accent-ink,#A5EDF2);font:inherit;font-weight:700;font-size:.9rem;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;-webkit-tap-highlight-color:transparent}@media (max-width:760px){#liaInstall{min-height:44px}}';
    document.head.appendChild(st);
    function drop() { var x = document.getElementById('liaInstall'); if (x) x.remove(); deferred = null; }
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault(); deferred = e;
      if (document.getElementById('liaInstall') || !row) return;
      var b = document.createElement('button');
      b.id = 'liaInstall'; b.type = 'button'; b.textContent = 'Installa'; b.setAttribute('aria-label', 'Installa l\u2019app');
      b.addEventListener('click', function () {
        if (!deferred) return;
        deferred.prompt();
        deferred.userChoice.then(function (c) { if (c && c.outcome === 'accepted') drop(); }).catch(function () {});
      });
      var bg = document.getElementById('liaBurger');
      if (bg) row.insertBefore(b, bg); else row.appendChild(b);
    });
    window.addEventListener('appinstalled', drop);
  })();
})();
