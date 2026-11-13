/* public/dash/sound.js  (Prenolia: vibrazione per le notifiche e gli avvisi con la dashboard aperta)
   Nessun suono: solo vibrazione (dove il telefono la permette).
   Si puo' spegnere dal pannello delle notifiche; la scelta resta su questo dispositivo. */
(function () {
  "use strict";
  var KEY = "lia:sound", last = 0;
  function on() { try { return localStorage.getItem(KEY) !== "off"; } catch (e) { return true; } }
  function buzz(n) {
    try {
      if (!navigator.vibrate) return;
      var p = [], i;
      n = Math.max(1, Math.min(3, n || 1));
      for (i = 0; i < n; i++) { if (i) p.push(160); p.push(220); }
      navigator.vibrate(p);
    } catch (e) {}
  }
  window.liaChime = function (n) {
    try {
      if (!on()) return;
      var t = Date.now();
      if (t - last < 1500) return;
      last = t;
      buzz(n);
    } catch (e) {}
  };
  window.liaSoundOn = on;
  window.liaSoundSet = function (v) {
    try { localStorage.setItem(KEY, v ? "on" : "off"); } catch (e) {}
    if (v) { last = 0; window.liaChime(1); }
  };
})();
