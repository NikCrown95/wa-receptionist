/* public/estetista/hero.js  (Prenolia: se l'attivita' e' un centro estetico, la parte alta della scheda usa sfondo e logo dedicati) */
(function () {
  "use strict";
  var token = "";
  try { token = (new URLSearchParams(location.search).get("t") || "").trim(); } catch (e) {}
  var K = "lia:hero:est:" + token;
  function apply() {
    var hero = document.getElementById("pfHero"), kind = document.getElementById("pfKind");
    if (!hero || !kind) return;
    var est = /centro estetico/i.test(kind.textContent || "");
    if (!kind.textContent) return; // dati non ancora arrivati: lascia lo stato ricordato
    hero.classList.toggle("est", est);
    try { localStorage.setItem(K, est ? "1" : "0"); } catch (e) {}
  }
  function init() {
    var kind = document.getElementById("pfKind");
    if (!kind) return;
    new MutationObserver(apply).observe(kind, { childList: true, characterData: true, subtree: true });
    apply();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
