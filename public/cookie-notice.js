/* public/cookie-notice.js  (Prenolia: avviso sui cookie)
   Prenolia usa solo cookie e dati tecnici: non serve il consenso, ma informiamo chi visita. Un solo pulsante "Ho capito",
   perche' non c'e' niente da accettare o rifiutare. Se un giorno si aggiungono strumenti non tecnici, qui va aggiunta la scelta.
   Si ricorda in localStorage (anch'esso tecnico). Non compare nella pagina della cookie policy. */
(function () {
  "use strict";
  var KEY = "prenolia_cookie_notice";
  try { if (/^\/cookie\/?$/.test(location.pathname)) return; } catch (e) {}
  try { if (localStorage.getItem(KEY)) return; } catch (e) {}
  if (document.getElementById("pcnBox")) return;

  var css = "#pcnBox{position:fixed;z-index:2147483000;left:16px;bottom:16px;max-width:440px;width:calc(100% - 32px);box-sizing:border-box;padding:16px 18px;border:1px solid #2A3648;border-radius:14px;background:#0E131B;color:#F9F6F0;font:400 14px/1.5 Inter,system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.35);margin-bottom:env(safe-area-inset-bottom,0)}" +
    "#pcnBox p{margin:0 0 12px;color:#D5DCE6}#pcnBox b{color:#F9F6F0;font-weight:600}" +
    "#pcnBox .pcnRow{display:flex;align-items:center;gap:14px;flex-wrap:wrap}" +
    "#pcnBox button{font:inherit;font-weight:600;min-height:42px;padding:0 20px;border:0;border-radius:10px;background:#2DD2DC;color:#04141A;cursor:pointer}" +
    "#pcnBox button:focus-visible,#pcnBox a:focus-visible{outline:2px solid #F9F6F0;outline-offset:2px}" +
    "#pcnBox a{color:#9BA6B5;text-decoration:underline;text-underline-offset:3px}#pcnBox a:hover{color:#F9F6F0}" +
    "@media(max-width:520px){#pcnBox{left:10px;right:10px;width:auto;bottom:10px;max-width:none;padding:14px 16px}#pcnBox button{flex:1 1 auto}}" +
    "@media print{#pcnBox{display:none}}";

  function build() {
    if (document.getElementById("pcnBox")) return;
    var st = document.createElement("style"); st.id = "pcnStyle"; st.textContent = css; document.head.appendChild(st);
    var box = document.createElement("div");
    box.id = "pcnBox"; box.setAttribute("role", "region"); box.setAttribute("aria-label", "Informativa sui cookie");
    box.innerHTML = '<p><b>Cookie.</b> Usiamo solo cookie tecnici, necessari al funzionamento. Nessuna pubblicit\u00e0, nessun tracciamento.</p>' +
      '<div class="pcnRow"><button type="button" id="pcnOk">Ho capito</button><a href="/cookie">Cookie policy</a></div>';
    document.body.appendChild(box);
    document.getElementById("pcnOk").addEventListener("click", function () {
      try { localStorage.setItem(KEY, "1"); } catch (e) {}
      box.parentNode && box.parentNode.removeChild(box);
    });
  }
  if (document.body) build(); else document.addEventListener("DOMContentLoaded", build);
})();
