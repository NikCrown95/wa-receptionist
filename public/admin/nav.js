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
    { label: 'Sistema', href: '/admin/sistema.html' }
  ];
  var nav = document.getElementById('mainNav');
  if (!nav) return;
  var path = location.pathname.replace(/\/+$/, '') || '/';
  function is(p) { return path === p.replace(/\/+$/, '') || (p === '/admin/' && path === '/admin'); }
  nav.innerHTML = '';
  nav.hidden = true;
  var menu = document.createElement('nav');
  menu.id = 'liaMenu'; menu.className = 'lia-menu'; menu.hidden = true; menu.setAttribute('aria-label', 'Menu');
  PAGES.forEach(function (p) {
    var a = document.createElement('a');
    a.href = p.href;
    a.textContent = p.label;
    var on = is(p.href) || (p.also || []).some(is);
    if (on) { a.className = 'on'; a.setAttribute('aria-current', 'page'); }
    if (p.badge) a.id = 'navRichieste';
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
    var a = document.getElementById('navRichieste'); if (!a) return;
    var b = a.querySelector('.nav-badge');
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'nav-badge'; b.style.cssText = 'margin-left:auto;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#FF8A8A;color:#2a0a0a;font-size:.76rem;font-weight:800;line-height:22px;text-align:center'; a.appendChild(b); }
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
    '#mainNav{display:none !important}.top-row .spacer{display:block !important}' +
    '.lia-burger{flex:none;width:42px;height:42px;border-radius:13px;border:1px solid var(--line2,#2A3648);background:var(--card2,#161D29);color:var(--ink,#F9F6F0);display:grid;place-items:center;cursor:pointer;padding:0;-webkit-tap-highlight-color:transparent}' +
    '.lia-burger[aria-expanded="true"]{background:var(--accent,#2DD2DC);color:var(--on-accent,#031016);border-color:var(--accent,#2DD2DC)}' +
    '.lia-menu{position:fixed;z-index:61;right:14px;top:0;margin-top:calc(env(safe-area-inset-top,0px) + 66px);width:min(260px,calc(100vw - 28px));max-height:calc(100dvh - 96px);overflow-y:auto;overscroll-behavior:contain;padding:8px;border-radius:16px;background:var(--card2,#161D29);border:1px solid var(--line2,#2A3648);box-shadow:0 20px 44px rgba(0,0,0,.5);transform:translateY(-8px) scale(.97);opacity:0;pointer-events:none;transition:transform .16s cubic-bezier(.2,.8,.2,1),opacity .14s ease}' +
    '.lia-menu.on{transform:none;opacity:1;pointer-events:auto}.lia-menu[hidden]{display:none}' +
    '.lia-menu a{display:flex;align-items:center;min-height:46px;padding:0 12px;border-radius:11px;color:var(--ink,#F9F6F0);text-decoration:none;font-weight:600;font-size:.96rem}' +
    '.lia-menu a:hover{background:var(--card,#0E131B)}.lia-menu a.on{color:var(--accent-ink,#A5EDF2);background:var(--card,#0E131B)}' +
    '.lia-menu .lia-out{display:flex;align-items:center;width:100%;min-height:46px;margin-top:6px;padding:0 12px;border:0;border-top:1px solid var(--line2,#2A3648);border-radius:0;background:transparent;color:#FF8A8A;font:inherit;font-weight:600;font-size:.96rem;cursor:pointer;text-align:left;-webkit-tap-highlight-color:transparent}' +
    '.lia-menu .lia-push{flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;flex:none;margin-top:6px;color:var(--ink,#F9F6F0);font-size:.92rem;line-height:1.3;padding-top:8px;padding-bottom:8px}.lia-menu .lia-push small{display:block;color:var(--muted,#9BA6B5);font-weight:500;font-size:.78rem}.lia-menu .lia-push[hidden]{display:none}' +
    '.lia-menu .lia-out:hover{background:rgba(255,138,138,.1);border-radius:11px}' +
    '.lia-mback{position:fixed;inset:0;z-index:60;background:rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:opacity .15s}.lia-mback.on{opacity:1;pointer-events:auto}.lia-mback[hidden]{display:none}' +
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
