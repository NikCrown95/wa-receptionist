/* public/recap.js  (Prenolia: icona di Lia accanto alla campana + recap giornaliero mattina/sera)
   Carica /api/agenda?t=TOKEN&recap=1. Se qualcosa non va, l'icona resta nascosta e la dashboard non cambia. */
(function () {
  "use strict";
  var token = "";
  try { token = (new URLSearchParams(location.search).get("t") || "").trim(); } catch (e) {}
  if (!token) return;

  var data = null, btn, dot, tip, scrim, panel, busy = false, lastFocus = null;
  var SEEN = "lia:recap:seen:" + token + ":";
  var TIPK = "lia:recap:tip:" + token;

  function ls(op, k, v) {
    try { if (op === "g") return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function eur(n) {
    n = Math.round(Number(n) || 0);
    return "€" + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  var LOGO = '<svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="liaRG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#19E3FF"/><stop offset="1" stop-color="#1E78FF"/></linearGradient></defs>' +
    '<circle cx="22" cy="26" r="13.5" fill="none" stroke="url(#liaRG)" stroke-width="9"/><rect x="33" y="12" width="9" height="30" rx="4.5" fill="url(#liaRG)"/>' +
    '<ellipse cx="22" cy="26" rx="9" ry="6.6" fill="#04111A"/><rect x="16.8" y="22.8" width="2.8" height="6.4" rx="1.4" fill="#5CF2FF"/><rect x="24.4" y="22.8" width="2.8" height="6.4" rx="1.4" fill="#5CF2FF"/></svg>';
  var WA = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#25D366" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.37A9.9 9.9 0 1 0 12.04 2z"/><path fill="#fff" d="M16.6 14.2c-.25-.12-1.46-.72-1.69-.8-.23-.09-.39-.12-.56.12-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06a6.8 6.8 0 0 1-2-1.24 7.5 7.5 0 0 1-1.38-1.72c-.14-.25 0-.38.1-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.41-.56-.42h-.47c-.16 0-.43.06-.66.31-.22.25-.86.85-.86 2.07s.88 2.4 1 2.56c.12.17 1.74 2.65 4.2 3.72.59.25 1.05.4 1.4.52.59.19 1.13.16 1.55.1.47-.07 1.46-.6 1.66-1.18.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.47-.28z"/></svg>';
  var TG = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#2AABEE"/><path fill="#fff" d="M5.4 11.9l11.1-4.3c.5-.2 1 .1.8.9l-1.9 8.9c-.1.6-.5.8-1 .5l-2.8-2.1-1.4 1.3c-.1.1-.3.3-.6.3l.2-2.9 5.3-4.8c.2-.2 0-.3-.3-.1l-6.6 4.1-2.8-.9c-.6-.2-.6-.6.1-.9z"/></svg>';
  var WEB = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var QR = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4"/></svg>';
  var OTH = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>';
  var X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var SPARK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>';

  function build() {
    var bell = document.getElementById("bellBtn");
    if (!bell || !bell.parentNode) return false;
    btn = document.createElement("button");
    btn.id = "liaRecapBtn"; btn.type = "button"; btn.hidden = true;
    btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Recap di Lia");
    btn.innerHTML = LOGO + '<span class="liaRDot" hidden></span>';
    dot = btn.querySelector(".liaRDot");
    bell.parentNode.insertBefore(btn, bell);

    tip = document.createElement("div"); tip.id = "liaRecapTip"; tip.hidden = true; tip.setAttribute("role", "status");
    scrim = document.createElement("div"); scrim.id = "liaRecapScrim"; scrim.hidden = true;
    panel = document.createElement("div"); panel.id = "liaRecapPanel"; panel.hidden = true;
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-labelledby", "liaRecapTitle");
    document.body.appendChild(tip); document.body.appendChild(scrim); document.body.appendChild(panel);

    btn.addEventListener("click", function () { panel.hidden ? openPanel() : closePanel(); });
    scrim.addEventListener("click", closePanel);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) closePanel(); });
    return true;
  }

  function isSeen() { return !!data && ls("g", SEEN + data.key) === "1"; }
  function markSeen() { if (data && data.period) ls("s", SEEN + data.key, "1"); }

  function paintBtn() {
    if (!data) { btn.hidden = true; document.body.classList.remove("liaRecapOn"); return; }
    btn.hidden = false;
    document.body.classList.add("liaRecapOn");
    var lit = !!data.period && !isSeen();
    btn.setAttribute("data-lit", lit ? "1" : "0");
    dot.hidden = !lit;
    btn.setAttribute("aria-label", lit ? "Recap di Lia: nuovo" : "Recap di Lia");
    if (lit) showTip(); else tip.hidden = true;
  }

  function showTip() {
    var n = parseInt(ls("g", TIPK) || "0", 10) || 0;
    if (n >= 3 || !panel.hidden) return;
    var key = data.key;
    if (tip.getAttribute("data-k") === key) return;
    tip.setAttribute("data-k", key);
    ls("s", TIPK, String(n + 1));
    tip.textContent = data.view === "s" ? "Il recap della serata è pronto" : "Il recap di oggi è pronto";
    tip.hidden = false;
    var r = btn.getBoundingClientRect(), w = 176;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w + 14));
    tip.style.left = left + "px";
    tip.style.top = (r.bottom + 10) + "px";
    tip.style.setProperty("--ax", Math.round(w - (r.left + r.width / 2 - left) - 5) + "px");
    setTimeout(function () { tip.hidden = true; }, 6000);
  }

  function row(logo, name, count) {
    return '<div><span aria-hidden="true" style="display:grid;place-items:center;width:20px">' + logo + '</span><span class="n">' + esc(name) + '</span><span class="c">' + count + "</span></div>";
  }

  function channels(d) {
    var c = d.channels || {};
    var list = [
      ["WhatsApp", c.whatsapp, WA, "#25D366"],
      ["Telegram", c.telegram, TG, "#2AABEE"],
      ["Webchat", c.webchat, WEB, "var(--accent)"],
      ["QR in vetrina", c.qr, QR, "var(--lr-v)"],
      ["Altri canali", c.other, OTH, "var(--muted)"]
    ].filter(function (x) { return x[1] > 0; });
    var total = list.reduce(function (s, x) { return s + x[1]; }, 0);
    if (!total) return "";
    var bar = list.map(function (x) { return '<i style="flex:' + x[1] + ';background:' + x[3] + '"></i>'; }).join("");
    var leg = list.map(function (x) { return row(x[2], x[0], x[1]); }).join("");
    return '<div class="lr-chan"><div class="lr-chan-h"><b>Come hanno prenotato</b><span>' + plural(total, "appuntamento", "appuntamenti") + '</span></div>' +
      '<div class="lr-stack" role="img" aria-label="Prenotazioni per canale">' + bar + '</div><div class="lr-leg">' + leg + "</div></div>";
  }

  function tile(l, v, s, cls, sc) {
    return '<div class="lr-kt' + (cls ? " " + cls : "") + '"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s' + (sc ? " " + sc : "") + '">' + s + "</div></div>";
  }
  function strip(html) { return '<div class="lr-strip"><span class="ic">' + SPARK + "</span><div>" + html + "</div></div>"; }

  function render() {
    var d = data, ev = d.view === "s";
    var name = d.owner ? ", " + esc(d.owner) : "";
    var title = ev ? "La tua giornata" : "Buongiorno" + name;
    var h = '<div class="lr-head"><h2 id="liaRecapTitle">' + title + '</h2><button type="button" class="lr-x" aria-label="Chiudi">' + X + "</button></div>";
    var body = "";
    if (d.empty) {
      body = '<div class="lr-empty"><b>Nessun appuntamento oggi</b>Quando arriveranno prenotazioni le vedrai qui.</div>';
    } else {
      var a = d.appointments || {}, rv = d.revenue || {}, dp = rv.delta_pct;
      var dtxt = dp == null ? "" : (dp >= 0 ? "+" : "−") + Math.abs(dp) + "% vs " + (d.weekday ? d.weekday.slice(0, 3) + ". scorso" : "settimana scorsa");
      var kp;
      body += '<p class="lr-greet">' + (ev ? "Ecco com’è andata oggi" + (d.weekday ? ", " + esc(d.weekday) : "") + "." : "Ecco cosa ti aspetta oggi" + (d.weekday ? ", " + esc(d.weekday) : "") + ".") + "</p>";
      if (ev) {
        kp = tile("Incasso stimato", eur(rv.today), dtxt || "Dai prezzi dei servizi", "hero", dp != null && dp >= 0 ? "good" : "") +
          tile("Appuntamenti", a.confirmed || 0, a.cancelled > 0 ? plural(a.cancelled, "annullato", "annullati") : "Nessuna cancellazione") +
          tile("Clienti nuovi", (d.new_clients || {}).fresh || 0, "su " + ((d.new_clients || {}).served || 0) + " serviti");
      } else {
        var sl = d.slots, st = sl ? (sl.count ? (sl.times && sl.times.length ? sl.times.join(" · ") : "Ancora disponibili") : "Giornata piena") : "—";
        kp = tile("Appuntamenti", a.confirmed || 0, a.first ? "Il primo alle " + esc(a.first) : "Nessuno in programma") +
          tile("Incasso previsto", eur(rv.today), dtxt || "Dai prezzi dei servizi", "hero", dp != null && dp >= 0 ? "good" : "") +
          tile("Slot liberi", sl ? sl.count : "—", st);
      }
      body += '<div class="lr-kpis">' + kp + "</div>";

      var ln = d.lia ? (ev ? (d.night || {}).evening : (d.night || {}).morning) : null;
      if (d.lia && !ev && ln && ln.count > 0) {
        body += strip("<b>Mentre eri via</b>, Lia ha preso " + plural(ln.count, "prenotazione", "prenotazioni") + (ln.value > 0 ? " per circa <b>" + eur(ln.value) + "</b>" : "") + ".");
      }
      var ls_ = d.lia_stats || {};
      if (d.lia && ev && (ls_.bookings > 0 || ls_.conversations > 0)) {
        var t = "<b>Lia oggi</b> ha parlato con " + plural(ls_.conversations, "cliente", "clienti") + " e preso " + plural(ls_.bookings, "prenotazione", "prenotazioni") + (ls_.value > 0 ? " (<b>" + eur(ls_.value) + "</b>)" : "") + ".";
        if (ln && ln.count > 0) t += " " + (ln.count === 1 ? "1 è arrivata" : ln.count + " sono arrivate") + " a negozio chiuso.";
        if (ls_.month_bookings > 0) t += " Questo mese: " + plural(ls_.month_bookings, "prenotazione", "prenotazioni") + (ls_.month_value > 0 ? ", <b>" + eur(ls_.month_value) + "</b>" : "") + ".";
        body += strip(t);
      }
      body += channels(d);
    }
    panel.innerHTML = h + '<div class="lr-body">' + body + "</div>" + (d.empty ? "" : '<div class="lr-ft">Incasso stimato dai prezzi dei servizi.</div>');
    panel.querySelector(".lr-x").addEventListener("click", closePanel);
  }

  function openPanel() {
    if (!data) return;
    var bell = document.getElementById("bellBtn");
    if (bell && bell.getAttribute("aria-expanded") === "true") bell.click();
    tip.hidden = true;
    lastFocus = document.activeElement;
    render();
    panel.hidden = false; scrim.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    markSeen(); paintBtn();
    var x = panel.querySelector(".lr-x"); if (x) x.focus();
    load(true);
  }
  function closePanel() {
    panel.hidden = true; scrim.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  function load(refreshOpen) {
    if (busy || document.visibilityState === "hidden") return;
    busy = true;
    fetch("/api/agenda?t=" + encodeURIComponent(token) + "&recap=1", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("recap"); return r.json(); })
      .then(function (d) {
        data = d;
        if (refreshOpen && !panel.hidden) render();
        paintBtn();
      })
      .catch(function () { if (!data) { btn.hidden = true; } })
      .then(function () { busy = false; });
  }

  function init() {
    if (!build()) { if (init.n++ < 20) setTimeout(init, 400); return; }
    load();
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") load(true); });
    setInterval(function () { load(true); }, 5 * 60 * 1000);
  }
  init.n = 0;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
