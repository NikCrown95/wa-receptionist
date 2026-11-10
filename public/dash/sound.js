/* public/dash/sound.js  (Prenolia: suono delle notifiche e degli avvisi con la dashboard aperta)
   Il suono e' generato dal browser (nessun file). I browser lo permettono solo dopo il primo tocco sulla pagina.
   Si puo' spegnere dal pannello delle notifiche; la scelta resta su questo dispositivo. */
(function () {
  "use strict";
  var KEY = "lia:sound", ctx = null, last = 0;
  function on() { try { return localStorage.getItem(KEY) !== "off"; } catch (e) { return true; } }
  function unlock() {
    try {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      if (!ctx) ctx = new C();
      if (ctx.state === "suspended") ctx.resume();
    } catch (e) {}
  }
  ["pointerdown", "touchstart", "keydown", "click"].forEach(function (ev) { document.addEventListener(ev, unlock, { passive: true }); });
  function tone(t, f, d, v) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + d + 0.02);
  }
  window.liaChime = function () {
    try {
      if (!on() || !ctx || ctx.state !== "running") return;
      var n = Date.now();
      if (n - last < 2500) return; // piu' notifiche insieme: un solo suono
      last = n;
      var t = ctx.currentTime + 0.01;
      tone(t, 880, 0.35, 0.18);
      tone(t + 0.14, 1318.5, 0.5, 0.16);
    } catch (e) {}
  };
  window.liaSoundOn = on;
  window.liaSoundSet = function (v) {
    try { localStorage.setItem(KEY, v ? "on" : "off"); } catch (e) {}
    if (v) { unlock(); setTimeout(function () { last = 0; window.liaChime(); }, 60); }
  };
})();
