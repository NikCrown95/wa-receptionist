// nav.js - il menu della dashboard admin, in un solo posto.
// Per aggiungere una pagina basta aggiungere una riga qui sotto.
(function () {
  var PAGES = [
    { label: 'I tuoi clienti', href: '/admin/clienti.html', also: ['/admin/attivita.html'] },
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
    nav.appendChild(a);
  });
  // pulsante Esci
  var row = nav.parentNode;
  if (row && !document.getElementById('liaLogout')) {
    var b = document.createElement('button');
    b.id = 'liaLogout'; b.type = 'button'; b.className = 'btn ghost small'; b.textContent = 'Esci';
    b.addEventListener('click', function () { if (window.liaLogout) window.liaLogout(); else location.href = '/admin/login.html'; });
    row.appendChild(b);
  }
})();
