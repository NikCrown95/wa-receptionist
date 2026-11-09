// Temi extra "Nero" e "Rosa": solo per i personal trainer. I fogli di stile (theme-nero.css, theme-rosa.css)
// sono generati da scripts/build-themes.js e si scaricano solo quando il tema viene scelto.
(function () {
  if (!window.__LIA_PT) return;
  var V = { rosa: '5d114753', nero: '3bdcad6c' };
  function href(t) { return '/dash/theme-' + t + '.css?v=' + V[t]; }
  var first = null; try { first = localStorage.getItem('lia_theme_v2'); } catch (e) {}
  if (first === 'rosa' || first === 'nero') {
    document.write('<link rel="stylesheet" id="liaThemeCss" href="' + href(first) + '">');
    document.documentElement.setAttribute('data-theme', first);
  }
  window.liaThemeUse = function (t, done) {
    var l = document.getElementById('liaThemeCss');
    if (t !== 'rosa' && t !== 'nero') { if (l) l.disabled = true; if (done) done(); return; }
    if (l && l.getAttribute('href') === href(t)) { l.disabled = false; if (done) done(); return; }
    var n = document.createElement('link'), fin = false;
    n.rel = 'stylesheet'; n.id = 'liaThemeCssNew'; n.href = href(t);
    function go() { if (fin) return; fin = true; if (l && l.parentNode) l.parentNode.removeChild(l); n.id = 'liaThemeCss'; if (done) done(); }
    n.onload = go; n.onerror = go; setTimeout(go, 4000);
    (document.body || document.documentElement).appendChild(n);
  };
  // pulsanti del selettore in Impostazioni > Aspetto
  function sw(t, label) {
    var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-theme', t); b.setAttribute('aria-pressed', 'false');
    b.setAttribute('onclick', "window.liaSetTheme('" + t + "')");
    b.innerHTML = '<span class="stTp tp-' + t + '"><i></i><i></i><i></i></span><b>' + label + '</b>';
    return b;
  }
  function add() {
    var p = document.getElementById('themePick'); if (!p || p.querySelector('[data-theme="rosa"]')) return;
    p.appendChild(sw('nero', 'Nero')); p.appendChild(sw('rosa', 'Rosa'));
    var hint = document.querySelector('.stPage[data-st="theme"] .stPh p'); if (hint) hint.textContent = 'Scegli come vuoi vedere la dashboard.';
    var cur = document.documentElement.getAttribute('data-theme');
    [].forEach.call(p.querySelectorAll('button[data-theme]'), function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-theme') === cur ? 'true' : 'false'); });
  }
  var st = document.createElement('style');
  st.textContent = '#panelOther .stThemes{grid-template-columns:repeat(2,minmax(0,1fr))}.stTp.tp-nero{background:#050505;border-color:#363636}.stTp.tp-nero i:nth-child(1){background:#191919}.stTp.tp-nero i:nth-child(2){background:#987328}.stTp.tp-nero i:nth-child(3){background:#363636}' +
    '.stTp.tp-rosa{background:#0B0709;border-color:#402835}.stTp.tp-rosa i:nth-child(1){background:#1E141A}.stTp.tp-rosa i:nth-child(2){background:#D63B7C}.stTp.tp-rosa i:nth-child(3){background:#402835}';
  document.head.appendChild(st);
  document.addEventListener('DOMContentLoaded', add); add(); setTimeout(add, 1200);
})();
