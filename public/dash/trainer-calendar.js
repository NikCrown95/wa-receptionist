/* Prenolia (personal trainer): Impostazioni › Calendario.
   Solo su iPhone e iPad: aggiunge le prenotazioni al Calendario del telefono con un tocco ("Iscriviti"). */
(function () {
  "use strict";
  if (!window.__LIA_PT) return;
  var $ = function (i) { return document.getElementById(i); };
  if (!$("calAdd")) return;

  var css = document.createElement("style");
  css.textContent =
    "#panelOther a.stBtn#calAdd{display:flex;align-items:center;justify-content:center;text-decoration:none}" +
    "#panelOther a.stBtn#calAdd[aria-disabled=\"true\"]{opacity:.5;pointer-events:none}" +
    "#panelOther .calList{display:flex;flex-direction:column;gap:10px;margin:0}" +
    "#panelOther .calList div{display:flex;justify-content:space-between;gap:14px;font-size:.92rem}" +
    "#panelOther .calList span:first-child{color:var(--muted)}" +
    "#panelOther .calList span:last-child{text-align:right}";
  document.head.appendChild(css);

  function tok() { return (window.__liaT || new URLSearchParams(location.search).get("t") || "").trim(); }
  function msg(text, err) { var e = $("calMsg"); if (!e) return; e.textContent = text || ""; e.className = "stMsg" + (err ? " err" : ""); }
  function call(action) {
    return fetch("/api/agenda?t=" + encodeURIComponent(tok()) + "&callink=1", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: action })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || "Qualcosa non ha funzionato. Riprova.");
        return j;
      });
    });
  }

  function setLink(j) {
    var a = $("calAdd");
    a.href = j.webcal;
    a.setAttribute("aria-disabled", "false");
  }
  function load() {
    var a = $("calAdd");
    a.setAttribute("aria-disabled", "true"); a.removeAttribute("href"); msg("");
    call("link").then(setLink).catch(function (e) { msg(e.message, true); });
  }

  var armed = false, timer = 0;
  function disarm() { armed = false; clearTimeout(timer); $("calReset").textContent = "Crea un nuovo link"; }
  $("calReset").addEventListener("click", function () {
    if (!armed) {
      armed = true; $("calReset").textContent = "Conferma: crea un nuovo link";
      timer = setTimeout(disarm, 6000); return;
    }
    disarm();
    var b = $("calReset"); b.disabled = true; msg("");
    call("reset").then(function (j) {
      setLink(j);
      msg("Fatto. Il vecchio calendario non si aggiorna più: aggiungi di nuovo quello nuovo con il pulsante qui sopra.");
    }).catch(function (e) { msg(e.message, true); }).then(function () { b.disabled = false; });
  });

  /* il link si prepara ogni volta che si apre la pagina */
  document.addEventListener("click", function (e) {
    var r = e.target.closest && e.target.closest('.stRow[data-st="calendar"]');
    if (r) { disarm(); load(); }
  });
})();
