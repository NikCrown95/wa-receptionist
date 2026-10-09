/* public/recap.js  (Prenolia: icona di Lia accanto alla campana + recap giornaliero mattina/sera)
   Carica /api/agenda?t=TOKEN&recap=1. Se qualcosa non va, l'icona resta nascosta e la dashboard non cambia. */
(function () {
  "use strict";
  var token = "";
  try { token = (new URLSearchParams(location.search).get("t") || "").trim(); } catch (e) {}
  if (!token) return;

  var data = null, btn, dot, tip, scrim, panel, busy = false, lastFocus = null;
  var SEEN = "lia:recap:seen:" + token + ":";
  var VIS = "lia:recap:vis:" + token;
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

  var LOGO = '<img src="/lia-a.png" width="30" height="27" alt="" draggable="false" style="display:block">';
  var WA = '<span aria-hidden="true" style="display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:#25D366;box-shadow:inset 0 1px 0 rgba(255,255,255,.18)"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></span>';
  var TG = '<span aria-hidden="true" style="display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:#26A5E4;box-shadow:inset 0 1px 0 rgba(255,255,255,.18)"><svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg></span>';
  var WEB = '<span aria-hidden="true" style="display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:linear-gradient(145deg,#35A2AD,#27808A);box-shadow:inset 0 1px 0 rgba(255,255,255,.18)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.8 3.8H17.2A4 4 0 0 1 21.2 7.8V13.2A4 4 0 0 1 17.2 17.2H11.6L8.2 20.3C7.55 20.9 6.6 20.45 6.6 19.6V17.2H6.8A4 4 0 0 1 2.8 13.2V7.8A4 4 0 0 1 6.8 3.8Z" fill="#fff"/><path d="M12 6.2c.4 2.6 1.7 3.9 4.3 4.3-2.6.4-3.9 1.7-4.3 4.3-.4-2.6-1.7-3.9-4.3-4.3 2.6-.4 3.9-1.7 4.3-4.3z" fill="#1F7581"/></svg></span>';
  var QR = '<span aria-hidden="true" style="display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:linear-gradient(145deg,#9279F4,#6E52DB);box-shadow:inset 0 1px 0 rgba(255,255,255,.18)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3.2" y="5.2" width="17.6" height="15.6" rx="3.6" fill="#fff"/><path d="M3.2 9.8H20.8V8.8A3.6 3.6 0 0 0 17.2 5.2H6.8A3.6 3.6 0 0 0 3.2 8.8Z" fill="#533DB5" fill-opacity=".30"/><path d="M8 3v3.8M16 3v3.8" stroke="#fff" stroke-width="2" stroke-linecap="round"/><g fill="#533DB5" fill-opacity=".5"><circle cx="7.8" cy="13.4" r="1.15"/><circle cx="12" cy="13.4" r="1.15"/><circle cx="16.2" cy="13.4" r="1.15"/><circle cx="7.8" cy="17.2" r="1.15"/><circle cx="12" cy="17.2" r="1.15"/></g><circle cx="16.2" cy="17.2" r="2.25" fill="#533DB5"/></svg></span>';
  var VET = '<span aria-hidden="true" style="display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:linear-gradient(145deg,#F7AA2B,#E88A17);box-shadow:inset 0 1px 0 rgba(255,255,255,.18)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.4"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.4"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.4"/><path d="M14 14h2.6v2.6H14zM20.5 14v.01M14 20.5h.01M17.5 18v2.5h3"/></svg></span>';
  var X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var SPARK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/></svg>';

  function build() {
    var bell = document.getElementById("bellBtn");
    if (!bell || !bell.parentNode) return false;
    btn = document.getElementById("liaRecapBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "liaRecapBtn"; btn.type = "button"; btn.hidden = true;
      btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Recap di Lia");
      btn.innerHTML = LOGO + '<span class="liaRDot" hidden></span>';
      bell.parentNode.insertBefore(btn, bell);
    }
    dot = btn.querySelector(".liaRDot");

    tip = document.createElement("div"); tip.id = "liaRecapTip"; tip.hidden = true; tip.setAttribute("role", "status");
    scrim = document.createElement("div"); scrim.id = "liaRecapScrim"; scrim.hidden = true;
    panel = document.createElement("div"); panel.id = "liaRecapPanel"; panel.hidden = true;
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); panel.setAttribute("aria-labelledby", "liaRecapTitle");
    document.body.appendChild(tip); document.body.appendChild(scrim); document.body.appendChild(panel);

    btn.addEventListener("click", function () {
      if (!panel.hidden) return closePanel();
      if (data) return openPanel();
      busy = false; load(false, true);
    });
    scrim.addEventListener("click", closePanel);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) closePanel(); });
    return true;
  }

  function isSeen() { return !!data && ls("g", SEEN + data.key) === "1"; }
  function markSeen() { if (data && data.period) ls("s", SEEN + data.key, "1"); }

  function paintBtn() {
    if (!data) { btn.hidden = true; ls("s", VIS, "0"); document.body.classList.remove("liaRecapOn"); return; }
    btn.hidden = false;
    ls("s", VIS, "1");
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
    return '<div>' + logo + '<span class="n">' + esc(name) + '</span><span class="c">' + count + "</span></div>";
  }

  function channels(d) {
    var c = d.channels || {};
    var list = [
      ["WhatsApp", c.whatsapp || 0, WA, "#25D366"],
      ["Telegram", c.telegram || 0, TG, "#26A5E4"],
      ["Webchat", c.webchat || 0, WEB, "#2B8A94"],
      ["QR link", c.qr || 0, QR, "#7C62E6"],
      ["QR vetrina", c.vetrina || 0, VET, "#F09A20"]
    ].filter(function (x) { return x[1] > 0; });
    var total = list.reduce(function (s, x) { return s + x[1]; }, 0);
    if (!total) return "";
    var all = (d.appointments || {}).confirmed || 0;
    var bar = list.map(function (x) { return '<i style="flex:' + x[1] + ';background:' + x[3] + '"></i>'; }).join("");
    var leg = list.map(function (x) { return row(x[2], x[0], x[1]); }).join("");
    return '<div class="lr-chan"><div class="lr-chan-h"><b>Come hanno prenotato</b><span>' + total + " su " + plural(all, "appuntamento", "appuntamenti") + '</span></div>' +
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

  function load(refreshOpen, thenOpen) {
    if (busy || document.visibilityState === "hidden") return;
    busy = true;
    fetch("/api/agenda?t=" + encodeURIComponent(token) + "&recap=1", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("recap"); return r.json(); })
      .then(function (d) {
        data = d;
        if (refreshOpen && !panel.hidden) render();
        paintBtn();
        if (thenOpen) openPanel();
      })
      .catch(function () { if (!data) { btn.hidden = true; document.body.classList.remove("liaRecapOn"); } })
      .then(function () { busy = false; });
  }

  function init() {
    if (!build()) { if (init.n++ < 20) setTimeout(init, 400); return; }
    if (ls("g", VIS) === "1") { btn.hidden = false; document.body.classList.add("liaRecapOn"); }
    load();
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") load(true); });
    setInterval(function () { load(true); }, 5 * 60 * 1000);
  }
  init.n = 0;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
