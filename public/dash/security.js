/* Prenolia: Impostazioni › Sicurezza (password e verifica in due passaggi).
   Pagina interna delle impostazioni: usa i colori e i componenti della dashboard, quindi segue tema chiaro/scuro.
   QR code: libreria "qrcode-generator" (MIT, Kazuhiko Arase), caricata solo se serve. */
(function () {
  "use strict";
  var $ = function (i) { return document.getElementById(i); };
  if (!$("scTfa")) return;

  var css = document.createElement("style");
  css.textContent =
    "#panelOther .scBadge{display:inline-block;margin-left:8px;padding:3px 10px;border-radius:99px;font-size:.72rem;font-weight:800;letter-spacing:0;text-transform:none;vertical-align:middle}" +
    "#panelOther .scBadge.on{background:var(--accent-soft);color:var(--accent-ink);box-shadow:inset 0 0 0 1px var(--accent)}" +
    "#panelOther .scBadge.off{background:var(--card2);color:var(--muted);box-shadow:inset 0 0 0 1px var(--line2)}" +
    "#panelOther .scSt{margin:0;padding-left:20px;color:var(--muted);font-size:.9rem;line-height:1.5}#panelOther .scSt b{color:var(--ink)}" +
    "#panelOther .scQr{background:#fff;border-radius:16px;padding:12px;width:fit-content;margin:0 auto}" +
    "#panelOther .scQr svg,#panelOther .scQr img{display:block;width:200px;height:200px}" +
    "#panelOther .scKey{font-family:ui-monospace,Menlo,monospace;letter-spacing:.06em;background:var(--bg);border:1px solid var(--line2);border-radius:12px;padding:12px;word-break:break-all;text-align:center;font-size:.95rem;user-select:all}" +
    "#panelOther .scCodes{display:grid;grid-template-columns:1fr 1fr;gap:8px}" +
    "#panelOther .scCodes span{font-family:ui-monospace,Menlo,monospace;background:var(--bg);border:1px solid var(--line2);border-radius:10px;padding:10px;text-align:center;font-size:.95rem;user-select:all}" +
    "#panelOther .set-input.scCode{letter-spacing:.35em;text-align:center;font-size:1.4rem;font-variant-numeric:tabular-nums}" +
    "#panelOther .scRules{list-style:none;margin:0;padding:0;font-size:.84rem;color:var(--muted)}" +
    "#panelOther .scRules li{display:flex;gap:8px;align-items:center;min-height:24px}" +
    "#panelOther .scRules li::before{content:\"\\25CB\";color:var(--line2)}" +
    "#panelOther .scRules li.ok{color:var(--ink)}#panelOther .scRules li.ok::before{content:\"\\2713\";color:var(--accent-ink)}" +
    "#panelOther a.stBtn{text-decoration:none}";
  document.head.appendChild(css);

  function msg(id, text, err) { var e = $(id); if (!e) return; e.textContent = text || ""; e.className = "stMsg" + (err ? " err" : ""); }
  function api(action, data) {
    var o = data ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) } : {};
    return fetch("/api/business-auth?action=" + action, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && j.authenticated === false) { var e = new Error("Per questa sezione serve un nuovo accesso: esci e rientra da Prenolia."); throw e; }
        if (!r.ok) throw new Error(j.error || "Qualcosa non ha funzionato");
        return j;
      });
    });
  }
  function rulesOf(p) { return [p.length >= 8, /[0-9]/.test(p), /[^A-Za-z0-9\u00C0-\u00FF\s]/.test(p)]; }
  function paint(ul, p) { var r = rulesOf(p); for (var i = 0; i < r.length; i++) ul.children[i].className = r[i] ? "ok" : ""; }
  function view(name) { ["scOff", "scSetup", "scDone", "scOn"].forEach(function (k) { $(k).hidden = (k !== name); }); }
  function badge(on) { var b = $("scBadge"); b.textContent = on ? "Attiva" : "Non attiva"; b.className = "scBadge " + (on ? "on" : "off"); }

  function status() {
    return api("2fa-status").then(function (j) {
      badge(!!j.enabled);
      if (j.enabled) { $("scLeft").textContent = "Codici di emergenza rimasti: " + j.recovery_left + "."; view("scOn"); }
      else view("scOff");
      msg("scMsgT", "");
    }).catch(function (e) { view("scOff"); msg("scMsgT", e.message, true); });
  }

  var plain = "";
  $("scStart").addEventListener("click", function () {
    var b = $("scStart"); b.disabled = true; msg("scMsgT", "");
    api("2fa-setup", {}).then(function (j) {
      plain = j.secret; $("scKey").textContent = j.secret; $("scOpen").href = j.uri; view("scSetup");
      var s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
      s.onload = function () { try { var q = qrcode(0, "M"); q.addData(j.uri); q.make(); $("scQr").innerHTML = q.createSvgTag(5, 0, "QR code", "QR code"); $("scQr").hidden = false; } catch (e) {} };
      document.head.appendChild(s);
    }).catch(function (e) { msg("scMsgT", e.message, true); }).then(function () { b.disabled = false; });
  });
  $("scCopyKey").addEventListener("click", function () { try { navigator.clipboard.writeText(plain.replace(/\s/g, "")); $("scCopyKey").textContent = "Copiata ✓"; } catch (e) {} });
  $("scFe").addEventListener("submit", function (e) {
    e.preventDefault(); msg("scMsgE", ""); var b = $("scGoE"); b.disabled = true;
    api("2fa-enable", { code: $("scC1").value }).then(function (j) {
      $("scCodes").innerHTML = "";
      j.codes.forEach(function (c) { var s = document.createElement("span"); s.textContent = c; $("scCodes").appendChild(s); });
      window._scCodes = j.codes; $("scC1").value = ""; badge(true); view("scDone");
    }).catch(function (x) { msg("scMsgE", x.message, true); }).then(function () { b.disabled = false; });
  });
  $("scCopyCodes").addEventListener("click", function () { try { navigator.clipboard.writeText((window._scCodes || []).join("\n")); $("scCopyCodes").textContent = "Copiati ✓"; } catch (e) {} });
  $("scFin").addEventListener("click", function () { window._scCodes = null; $("scCodes").innerHTML = ""; status(); });
  $("scFd").addEventListener("submit", function (e) {
    e.preventDefault(); msg("scMsgD", ""); var b = $("scGoD"); b.disabled = true;
    api("2fa-disable", { password: $("scDp").value, code: $("scDc").value }).then(function () { $("scDp").value = ""; $("scDc").value = ""; return status(); })
      .catch(function (x) { msg("scMsgD", x.message, true); }).then(function () { b.disabled = false; });
  });

  var np = $("scNp"), rl = $("scRules");
  np.addEventListener("input", function () { paint(rl, np.value); });
  $("scFp").addEventListener("submit", function (e) {
    e.preventDefault(); msg("scMsgP", ""); var b = $("scGoP"); b.disabled = true;
    api("change-password", { current: $("scCur").value, password: np.value }).then(function () {
      msg("scMsgP", "Password aggiornata."); $("scCur").value = ""; np.value = ""; paint(rl, "");
    }).catch(function (x) { msg("scMsgP", x.message, true); }).then(function () { b.disabled = false; });
  });

  /* lo stato si legge ogni volta che si apre la pagina */
  document.addEventListener("click", function (e) {
    var r = e.target.closest && e.target.closest('.stRow[data-st="security"]');
    if (r) { view("scOff"); badge(false); $("scBadge").textContent = "…"; status(); }
  });
  var wasWide = function () { return window.matchMedia && window.matchMedia("(min-width:900px)").matches; };
  if (wasWide()) { /* su schermo largo la pagina può essere già visibile: stato caricato al primo clic */ }
})();
