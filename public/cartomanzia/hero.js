/* public/cartomanzia/hero.js  (Prenolia: se l'attivita' e' di cartomanzia/astrologia, la scheda usa sfondo e logo dedicati) */
(function () {
  "use strict";
  function apply() {
    var hero = document.getElementById("pfHero"), kind = document.getElementById("pfKind");
    if (!hero || !kind || !kind.textContent) return;
    hero.classList.toggle("car", /cartomanzia/i.test(kind.textContent || ""));
  }
  function init() {
    var kind = document.getElementById("pfKind");
    if (!kind) return;
    new MutationObserver(apply).observe(kind, { childList: true, characterData: true, subtree: true });
    apply();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
