// nav.js - il menu della dashboard admin, in un solo posto.
// Per aggiungere una pagina basta aggiungere una riga qui sotto.
(function () {
  var PAGES = [
    { label: 'I tuoi clienti', href: '/admin/clienti.html', also: ['/admin/attivita.html'] },
    { label: 'Richieste', href: '/admin/richieste.html', badge: true },
    { label: 'Andamento', href: '/admin/', also: ['/admin/index.html'] },
    { label: 'Uso di Lia', href: '/admin/lia.html' },
    { label: 'Ricavi', href: '/admin/soldi.html' },
    { label: 'Costi', href: '/admin/costi.html' }
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
  // numerino rosso con le richieste nuove (le pagine possono aggiornarlo con window.liaNavBadge)
  window.liaNavBadge = function (n) {
    var a = document.getElementById('navRichieste'); if (!a) return;
    var b = a.querySelector('.nav-badge');
    if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('span'); b.className = 'nav-badge'; b.style.cssText = 'display:inline-block;min-width:20px;height:20px;margin-left:7px;padding:0 6px;border-radius:999px;background:#FF8A8A;color:#2a0a0a;font-size:.74rem;font-weight:800;line-height:20px;text-align:center;vertical-align:1px'; a.appendChild(b); }
    b.textContent = n > 99 ? '99+' : String(n);
  };
  if (window.liaApi && !/\/admin\/login/.test(location.pathname)) {
    window.liaApi('/api/admin/clients?view=requests_count').then(function (j) { window.liaNavBadge(j && j.new); }).catch(function () {});
  }
  // pulsante Esci
  var row = nav.parentNode;
  if (row && !document.getElementById('liaLogout')) {
    var b = document.createElement('button');
    b.id = 'liaLogout'; b.type = 'button'; b.className = 'btn ghost small'; b.textContent = 'Esci';
    b.addEventListener('click', function () { if (window.liaLogout) window.liaLogout(); else location.href = '/admin/login.html'; });
    row.appendChild(b);
  }
})();
