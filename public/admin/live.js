// live.js - il flusso "in diretta" della Super Dashboard (account, appuntamenti, chat, pagamenti...).
// Si usa in due posti: Panoramica (tutto) e scheda di una singola attivita'.
//   liaLive.mount(elemento, { business: 'UUID' | '', filters: true, max: 60 })
// Richiede auth.js (window.liaApi). Aggiorna da solo ogni 12 secondi, e si ferma quando la pagina e' in secondo piano.
(function () {
  var CSS =
    '.lv-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}' +
    '.lv-live{display:inline-flex;align-items:center;gap:7px;font-size:.8rem;font-weight:700;color:#3FE08A}' +
    '.lv-live i{width:8px;height:8px;border-radius:50%;background:#3FE08A;animation:lvp 1.8s infinite}' +
    '.lv-live.off{color:#9BA6B5}.lv-live.off i{background:#9BA6B5;animation:none}' +
    '@keyframes lvp{0%{box-shadow:0 0 0 0 rgba(63,224,138,.55)}70%{box-shadow:0 0 0 9px rgba(63,224,138,0)}100%{box-shadow:0 0 0 0 rgba(63,224,138,0)}}' +
    '.lv-chips{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -2px 10px;padding:2px;-webkit-overflow-scrolling:touch}' +
    '.lv-chips::-webkit-scrollbar{display:none}' +
    '.lv-chip{flex:none;min-height:38px;padding:0 14px;border-radius:999px;border:1px solid var(--line,#1C2532);background:var(--card2,#161D29);color:var(--muted,#9BA6B5);font-weight:600;font-size:.84rem;font-family:inherit;cursor:pointer;white-space:nowrap;-webkit-tap-highlight-color:transparent}' +
    '.lv-chip[aria-pressed="true"]{background:var(--accent-soft,#0B2C33);border-color:rgba(45,210,220,.45);color:var(--accent,#2DD2DC)}' +
    '.lv-feed{display:grid;max-height:min(70vh,640px);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;margin-right:-6px;padding-right:6px}' +
    '.lv-ev{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line,#1C2532);color:inherit;text-decoration:none}' +
    '.lv-ev:last-child{border-bottom:0}' +
    'a.lv-ev:active{background:var(--card2,#161D29)}' +
    '.lv-ev.new{animation:lvin .9s ease}' +
    '@keyframes lvin{from{background:rgba(45,210,220,.18);transform:translateY(-6px)}to{background:transparent;transform:none}}' +
    '.lv-ic{width:40px;height:40px;border-radius:13px;display:grid;place-items:center}' +
    '.lv-ic.acc{background:rgba(63,224,138,.14);color:#3FE08A}.lv-ic.app{background:#0B2C33;color:#2DD2DC}.lv-ic.man{background:rgba(140,198,255,.12);color:#8CC6FF}' +
    '.lv-ic.chat{background:rgba(183,164,255,.14);color:#B7A4FF}.lv-ic.can{background:rgba(255,138,138,.14);color:#FF8A8A}' +
    '.lv-ic.pay{background:rgba(245,193,94,.14);color:#F5C15E}.lv-ic.req{background:rgba(140,198,255,.14);color:#8CC6FF}' +
    '.lv-t{font-weight:600;font-size:.94rem;line-height:1.3;overflow-wrap:anywhere}' +
    '.lv-t em{font-style:normal;font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--card2,#161D29);color:var(--muted,#9BA6B5);margin-left:6px;vertical-align:1px;white-space:nowrap}' +
    '.lv-d{color:var(--muted,#9BA6B5);font-size:.83rem;line-height:1.4;margin-top:1px;overflow-wrap:anywhere}' +
    '.lv-b{color:var(--accent-ink,#A5EDF2);font-size:.8rem;font-weight:600;margin-top:2px;overflow-wrap:anywhere}' +
    '.lv-w{color:var(--muted,#9BA6B5);font-size:.76rem;white-space:nowrap;font-variant-numeric:tabular-nums;align-self:start;padding-top:2px}' +
    '.lv-empty{padding:26px 8px;text-align:center;color:var(--muted,#9BA6B5);font-size:.92rem;line-height:1.5}' +
    '@media (max-width:760px){.lv-chips{flex-wrap:wrap;overflow:visible;margin:0 0 12px;padding:0;gap:8px}.lv-chip{min-height:40px;padding:0 15px}.lv-feed{max-height:none;overflow:visible;margin-right:0;padding-right:0}.lv-ev{padding:14px 0;gap:12px}.lv-ev .lv-w{font-size:.74rem}}' +
    '@media (prefers-reduced-motion:reduce){.lv-live i,.lv-ev.new{animation:none}}';

  var ICONS = {
    acc: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M19 8v6M16 11h6"/></svg>',
    app: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m9.5 15 2 2 3.5-4"/></svg>',
    chat: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.7 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12Z"/></svg>',
    can: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="m10 14 4 4M14 14l-4 4"/></svg>',
    pay: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M2.5 10h19M6.5 15h3"/></svg>',
    req: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13.5 6.2 5.8A2 2 0 0 1 8.1 4.5h7.8a2 2 0 0 1 1.9 1.3L20 13.5"/><path d="M4 13.5V18a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 18v-4.5h-4.2l-1 2h-5.6l-1-2Z"/></svg>'
  };
  var KIND = { acc: ['acc', 'acc'], app: ['app', 'app'], app_manual: ['app', 'man'], chat: ['chat', 'chat'], can: ['can', 'can'], can_sub: ['can', 'can'], pay: ['pay', 'pay'], req: ['req', 'req'] };
  var CHIPS = [
    { k: 'all', l: 'Tutto' }, { k: 'acc', l: 'Nuovi account' }, { k: 'app', l: 'Appuntamenti', m: ['app', 'app_manual'] },
    { k: 'chat', l: 'Chat' }, { k: 'can', l: 'Annullamenti', m: ['can', 'can_sub'] }, { k: 'pay', l: 'Pagamenti e ordini' }, { k: 'req', l: 'Richieste' }
  ];

  function injectCss() {
    if (document.getElementById('lvCss')) return;
    var s = document.createElement('style'); s.id = 'lvCss'; s.textContent = CSS; document.head.appendChild(s);
  }
  var fmtT = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hour12: false });
  var fmtD = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'short' });
  var fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' });
  function when(iso) {
    var t = new Date(iso), diff = Date.now() - t.getTime();
    if (diff < 60000) return 'adesso';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' min';
    var today = fmtDay.format(new Date()), day = fmtDay.format(t);
    if (day === today) return fmtT.format(t);
    var y = fmtDay.format(new Date(Date.now() - 86400000));
    if (day === y) return 'ieri ' + fmtT.format(t);
    return fmtD.format(t) + ' ' + fmtT.format(t);
  }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function mount(root, opts) {
    injectCss();
    opts = opts || {};
    var biz = opts.business || '', max = opts.max || 60;
    var events = [], seen = {}, filter = 'all', timer = null, newest = '', failed = 0, firstLoad = true;

    root.innerHTML = '';
    var bar = el('div', 'lv-bar');
    var live = el('span', 'lv-live'); live.appendChild(el('i')); var liveTxt = el('span', null, 'In diretta'); live.appendChild(liveTxt);
    bar.appendChild(live);
    root.appendChild(bar);
    var chipsBox = null;
    if (opts.filters !== false) {
      chipsBox = el('div', 'lv-chips'); chipsBox.setAttribute('role', 'group'); chipsBox.setAttribute('aria-label', 'Filtra per tipo');
      CHIPS.forEach(function (c) {
        if (biz && (c.k === 'acc' || c.k === 'pay')) return;
        var b = el('button', 'lv-chip', c.l); b.type = 'button'; b.setAttribute('aria-pressed', String(c.k === 'all')); b.dataset.k = c.k;
        b.addEventListener('click', function () {
          filter = c.k;
          Array.prototype.forEach.call(chipsBox.children, function (x) { x.setAttribute('aria-pressed', String(x.dataset.k === filter)); });
          paint(false);
        });
        chipsBox.appendChild(b);
      });
      root.appendChild(chipsBox);
    }
    var feed = el('div', 'lv-feed'); feed.setAttribute('aria-live', 'polite');
    root.appendChild(feed);
    feed.appendChild(el('div', 'lv-empty', 'Carico l’attività…'));

    function matches(e) {
      if (filter === 'all') return true;
      var c = CHIPS.filter(function (x) { return x.k === filter; })[0];
      return (c && c.m ? c.m : [filter]).indexOf(e.type) >= 0;
    }
    function row(e, isNew) {
      var k = KIND[e.type] || ['req', 'req'];
      var a = (e.business_id && !biz) ? el('a', 'lv-ev' + (isNew ? ' new' : '')) : el('div', 'lv-ev' + (isNew ? ' new' : ''));
      if (a.tagName === 'A') a.href = '/admin/attivita.html?id=' + encodeURIComponent(e.business_id);
      var ic = el('div', 'lv-ic ' + k[1]); ic.innerHTML = ICONS[k[0]]; ic.setAttribute('aria-hidden', 'true'); a.appendChild(ic);
      var mid = el('div'); mid.style.minWidth = '0';
      var t = el('div', 'lv-t', e.title); if (e.channel) t.appendChild(el('em', null, e.channel)); mid.appendChild(t);
      if (e.detail) mid.appendChild(el('div', 'lv-d', e.detail));
      if (e.business && !biz && e.type !== 'acc' && e.business !== 'Stripe') mid.appendChild(el('div', 'lv-b', e.business));
      a.appendChild(mid);
      var w = el('div', 'lv-w', when(e.at)); w.dataset.at = e.at; a.appendChild(w);
      return a;
    }
    function paint(animateNew) {
      feed.innerHTML = '';
      var list = events.filter(matches);
      if (!list.length) {
        feed.appendChild(el('div', 'lv-empty', filter === 'all' ? (biz ? 'Ancora nessuna attività recente per questa attività.' : 'Ancora nessuna attività: appena succede qualcosa la vedi qui.') : 'Nessun evento di questo tipo, per ora.'));
        return;
      }
      list.forEach(function (e) { feed.appendChild(row(e, animateNew && e._new)); });
      events.forEach(function (e) { e._new = false; });
    }
    function setLive(ok) {
      live.className = 'lv-live' + (ok ? '' : ' off');
      liveTxt.textContent = ok ? 'In diretta' : 'Connessione interrotta, riprovo…';
    }
    function url(since) {
      var u = '/api/admin/system?view=feed&limit=' + max;
      if (biz) u += '&business=' + encodeURIComponent(biz);
      if (since) u += '&since=' + encodeURIComponent(since);
      return u;
    }
    function load() {
      if (!window.liaApi) return;
      window.liaApi(url(firstLoad ? '' : newest)).then(function (j) {
        failed = 0; setLive(true);
        var add = (j.events || []).filter(function (e) { return !seen[e.id]; });
        add.forEach(function (e) { seen[e.id] = 1; e._new = !firstLoad; });
        if (add.length || firstLoad) {
          events = add.concat(events).sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; }).slice(0, 200);
          if (events.length) newest = events[0].at;
          var scrollTop = feed.scrollTop;
          paint(!firstLoad);
          feed.scrollTop = scrollTop;
        }
        firstLoad = false;
      }).catch(function () { failed++; if (failed >= 2) setLive(false); if (firstLoad && failed >= 1) { feed.innerHTML = ''; feed.appendChild(el('div', 'lv-empty', 'Non riesco a caricare l’attività. Riprovo tra poco.')); } });
    }
    function tick() { if (!document.hidden) load(); }
    load();
    timer = setInterval(tick, 12000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) load(); });
    // aggiorna le etichette dell'ora ("3 min") senza ricaricare
    setInterval(function () {
      Array.prototype.forEach.call(feed.querySelectorAll('.lv-w'), function (w) { if (w.dataset.at) w.textContent = when(w.dataset.at); });
    }, 30000);
    return { reload: load };
  }
  window.liaLive = { mount: mount };
})();
