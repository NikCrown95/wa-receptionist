/* public/recap.js  (Prenolia: icona di Lia accanto alla campana)
   Il pannello di Lia mostra gli avvisi (chiusure e assenze del lunedi', "come ti trovi", abbonamento in scadenza)
   e il recap unico di fine mese. Carica /api/agenda?t=TOKEN&recap=1.
   Se qualcosa non va, l'icona resta nascosta e la dashboard non cambia. */
(function () {
  "use strict";
  var token = "";
  try { token = (new URLSearchParams(location.search).get("t") || "").trim(); } catch (e) {}
  if (!token) return;

  var data = null, btn, dot, tip, scrim, panel, busy = false, lastFocus = null;
  var SEEN = "lia:recap:seen:" + token + ":";
  var VIS = "lia:recap:vis:" + token;
  var TIPK = "lia:recap:tip:" + token;
  var LIFE = 5 * 3600000; // un avviso gia' letto sparisce dopo 5 ore; uno non letto resta
  var pinned = {}; // avvisi visti all'apertura: restano nel pannello finche' e' aperto, anche se nel frattempo risultano letti

  function ls(op, k, v) {
    try { if (op === "g") return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {}
    return null;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function eur(n) {
    n = Math.round(Number(n) || 0);
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " \u20ac";
  }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  var LOGO = '<img src="/lia-a.png" width="30" height="27" alt="" draggable="false" style="display:block">';
  var X = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var CHEV = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';
  var IC = {
    closures: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18M9.5 15.5h5"/></svg>',
    feedback: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>',
    med: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 9v5M9.5 11.5h5"/></svg>',
    sub: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10.5h18M7 15h4"/></svg>',
    clock: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'
  };
  var CLS = { closures_reminder: "k1", feedback_ask: "k2", sub_expiring: "k3", member_expiring: "k3", medical_expiring: "k4" };
  var ICN = { closures_reminder: IC.closures, feedback_ask: IC.feedback, sub_expiring: IC.sub, member_expiring: IC.clock, medical_expiring: IC.med };

  function build() {
    var bell = document.getElementById("bellBtn");
    if (!bell || !bell.parentNode) return false;
    btn = document.getElementById("liaRecapBtn");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "liaRecapBtn"; btn.type = "button"; btn.hidden = true;
      btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", "Avvisi");
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

  /* ---- cosa mostrare ---- */
  function kOf(n) { return n.type + ":" + n.id; }
  function isSeen(k) { return ls("g", SEEN + k) === "1"; }
  function markSeen(k) { ls("s", SEEN + k, "1"); }
  function noticeAlive(n) {
    // il promemoria del lunedi' gia' letto sparisce dopo 5 ore; gli altri restano finche' servono (lo dice il server)
    if (n.type !== "closures_reminder") return true;
    if (pinned[kOf(n)]) return true;
    var t = Date.parse(n.created_at);
    return !isSeen(kOf(n)) || !(Date.now() - t >= LIFE);
  }
  function monthItem() {
    var m = data && data.month;
    return m && !m.empty ? { type: "month_recap", id: m.key } : null;
  }
  function visibleNotices() { return ((data && data.notices) || []).filter(noticeAlive); }
  function unreadKeys() {
    var out = [], mi = monthItem();
    if (mi && !isSeen(kOf(mi))) out.push(kOf(mi));
    visibleNotices().forEach(function (n) { if (!isSeen(kOf(n))) out.push(kOf(n)); });
    return out;
  }

  function paintBtn() {
    if (!data || data.hidden) { btn.hidden = true; ls("s", VIS, "0"); document.body.classList.remove("liaRecapOn"); return; }
    btn.hidden = false;
    ls("s", VIS, "1");
    document.body.classList.add("liaRecapOn");
    var un = unreadKeys(), lit = un.length > 0;
    btn.setAttribute("data-lit", lit ? "1" : "0");
    dot.hidden = !lit;
    btn.setAttribute("aria-label", lit ? "Avvisi: ci sono novit\u00e0" : "Avvisi");
    tip.hidden = true;
  }

  function showTip(un) {
    var n = parseInt(ls("g", TIPK) || "0", 10) || 0;
    if (n >= 3 || !panel.hidden) return;
    var key = un.join("|");
    if (tip.getAttribute("data-k") === key) return;
    tip.setAttribute("data-k", key);
    ls("s", TIPK, String(n + 1));
    tip.textContent = un.some(function (k) { return k.indexOf("month_recap:") === 0; }) ? "Il recap del mese \u00e8 pronto" : "Hai un avviso da leggere";
    tip.hidden = false;
    var r = btn.getBoundingClientRect(), w = 176;
    var left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w + 14));
    tip.style.left = left + "px";
    tip.style.top = (r.bottom + 10) + "px";
    tip.style.setProperty("--ax", Math.round(w - (r.left + r.width / 2 - left) - 5) + "px");
    setTimeout(function () { tip.hidden = true; }, 6000);
  }

  /* ---- testi ---- */
  function when(iso) {
    try { return new Date(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" }); } catch (e) { return ""; }
  }
  function ago(iso) {
    var m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (!(m >= 0)) return "";
    if (m < 2) return "Adesso";
    if (m < 60) return m + " minuti fa";
    var h = Math.round(m / 60);
    if (h < 24) return h === 1 ? "1 ora fa" : h + " ore fa";
    var d = Math.round(h / 24);
    return d === 1 ? "Ieri" : d + " giorni fa";
  }
  function noticeText(n) {
    var meta = n.meta || {}, d;
    if (n.type === "closures_reminder") {
      return {
        title: "Chiusure e assenze della settimana",
        text: data.team ? "Controlla chiusure, ferie e assenze." : "Controlla chiusure e ferie.",
        cta: "Apri Chiusure e ferie", time: ago(n.created_at)
      };
    }
    if (n.type === "feedback_ask") {
      return { title: "Come ti trovi con Prenolia?", text: "Ci vuole un minuto: dicci cosa funziona e cosa manca.", cta: "Rispondi", time: "" };
    }
    if (n.type === "medical_expiring") {
      var md = Number(meta.days_left) || 0, ud = "";
      try { ud = new Date(meta.until + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long" }); } catch (e) {}
      return { title: meta.name || "Iscritto", text: md < 0 ? "Certificato scaduto da " + (-md) + (md === -1 ? " giorno" : " giorni") + ". Non pu\u00f2 prenotare." : "Certificato medico " + (md === 0 ? "scade oggi" : md === 1 ? "scade domani" : "scade tra " + md + " giorni") + (ud ? ", " + ud : ""), cta: "Apri la scheda", time: "" };
    }
    if (n.type === "member_expiring") {
      var dl = Number(meta.days_left) || 0, ed = "";
      try { ed = new Date(meta.ends_on + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long" }); } catch (e) {}
      return { title: meta.name || "Iscritto", text: (meta.plan ? meta.plan + " \u00b7 " : "") + (dl <= 0 ? "scade oggi" : dl === 1 ? "scade domani" : "scade tra " + dl + " giorni") + (ed ? ", " + ed : ""), cta: "Apri la scheda", time: "" };
    }
    d = Number(meta.days) || 0;
    var tra = d <= 0 ? "oggi" : d === 1 ? "domani" : "tra " + d + " giorni";
    var dt = meta.ends_at ? when(meta.ends_at) : "";
    return {
      title: meta.trial ? "La prova gratuita sta per finire" : "Il tuo abbonamento sta per scadere",
      text: (meta.trial ? "La prova gratuita finisce " : "Il piano Smart scade ") + tra + (dt ? ", " + dt : "") + ".",
      cta: "Apri Abbonamento", time: ""
    };
  }

  function tile(l, v, s, cls, sc) {
    return '<div class="lr-mt' + (cls ? " " + cls : "") + '"><div class="l">' + l + '</div><div class="v">' + v + '</div><div class="s' + (sc ? " " + sc : "") + '">' + s + "</div></div>";
  }
  function monthCard(un) {
    var m = data.month, a = m.appointments || {}, o = m.online || {}, dp = a.delta_pct;
    var dtxt = dp == null ? "Primo mese di dati" : (dp >= 0 ? "+" : "\u2212") + Math.abs(dp) + "% su " + esc(m.prev_label || "il mese scorso");
    var onl = (o.count || 0) + " su " + (a.count || 0) + (o.lia > 0 ? ", di cui " + o.lia + " con Lia" : "");
    var top = m.top_service ? '<div class="lr-mtop"><span>Pi\u00f9 richiesto</span><b>' + esc(m.top_service.name) + "</b><span>\u00b7 " + m.top_service.count + "</span></div>" : "";
    return '<div class="lr-month' + (un ? " un" : "") + '"><div><div class="lr-k">Recap del mese \u00b7 ' + esc(m.last_day) + "</div><h3>" + esc(m.label) + "</h3></div>" +
      '<div class="lr-mg">' +
      tile("Appuntamenti", a.count || 0, dtxt, "hero", dp != null && dp >= 0 ? "up" : "") +
      tile("Incasso stimato", eur(m.revenue), "dai prezzi dei servizi") +
      tile("Prenotati online", (o.pct || 0) + "%", onl) +
      tile("Clienti nuovi", m.new_clients || 0, "prima volta da te") +
      "</div>" + top + "</div>";
  }
  function noticeRow(n, un) {
    var t = noticeText(n);
    return '<button type="button" class="lr-it' + (un ? " un" : "") + (n.type === "medical_expiring" ? " med" + (Number(n.meta && n.meta.days_left) < 0 ? " bad" : "") : "") + '" data-type="' + esc(n.type) + '" data-mid="' + esc(n.meta && n.meta.member_id || "") + '"><span class="ic ' + (CLS[n.type] || "k1") + '">' + (ICN[n.type] || IC.closures) + "</span>" +
      '<span class="tx"><b>' + esc(t.title) + "</b><span>" + esc(t.text) + "</span></span>" + (t.time ? "<time>" + esc(t.time) + "</time>" : "") + (un ? '<i class="lr-dot"></i>' : "") + "</button>";
  }

  /* palestre: abbonamenti e certificati nello stesso elenco, con filtri */
  var GF = "all";
  var GIC = {
    sub: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.795 21h-6.795a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v4"/><circle cx="18" cy="18" r="4"/><path d="M15 3v4M7 3v4M3 11h16M18 16.496v1.504l1 1"/></svg>',
    med: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19.5 13.572l-7.5 7.428l-2.896 -2.868m-6.117 -8.104a5 5 0 0 1 9.013 -3.022a5 5 0 1 1 7.5 6.572"/><path d="M3 13h2l2 3l2 -6l1 3h3"/></svg>'
  };
  function gdays(d) { return d <= 0 ? "oggi" : d === 1 ? "domani" : "tra " + d + " giorni"; }
  function gymRow(n, un) {
    var m = n.meta || {}, dl = Number(m.days_left) || 0, isMed = n.type === "medical_expiring", bad = isMed && dl < 0, ds = "";
    try { ds = new Date((isMed ? m.until : m.ends_on) + "T12:00:00").toLocaleDateString("it-IT", { day: "numeric", month: "long" }); } catch (e) {}
    var kind = bad ? "bad" : isMed ? "med" : "sub";
    var desc = bad ? "Certificato scaduto da " + (-dl) + (dl === -1 ? " giorno" : " giorni")
      : isMed ? "Certificato medico" + (ds ? " · " + ds : "")
      : ((m.plan ? m.plan + " · " : "") + (ds || "Abbonamento"));
    var pill = bad ? "Non prenota" : gdays(dl);
    return '<button type="button" class="lr-it lr-g ' + kind + (un ? " un" : "") + '" data-type="' + esc(n.type) + '" data-mid="' + esc(m.member_id || "") + '"><span class="ic">' + (isMed ? GIC.med : GIC.sub) + "</span>" +
      '<span class="tx"><b>' + esc(m.name || "Iscritto") + "</b><span>" + esc(desc) + '</span></span><span class="lr-pill">' + pill + "</span>" + (un ? '<i class="lr-dot"></i>' : "") + "</button>";
  }
  function gymBlock(items) {
    if (!items.length) return "";
    var isMed = function (n) { return n.type === "medical_expiring"; };
    var nSub = items.filter(function (n) { return !isMed(n); }).length, nMed = items.length - nSub;
    var days = function (n) { return Number(n.meta && n.meta.days_left) || 0; };
    if (GF === "sub" && !nSub) GF = "all";
    if (GF === "med" && !nMed) GF = "all";
    var out = "";
    if (nSub && nMed) {
      out += '<div class="lr-chips">' + [["all", "Tutti " + items.length], ["sub", "Abbonamenti " + nSub], ["med", "Certificati " + nMed]].map(function (c) {
        return '<button type="button" class="lr-chip' + (GF === c[0] ? " on" : "") + '" data-f="' + c[0] + '">' + c[1] + "</button>";
      }).join("") + "</div>";
    }
    var vis = items.filter(function (n) { return GF === "all" || (GF === "med" ? isMed(n) : !isMed(n)); }).sort(function (a, b) { return days(a) - days(b); });
    var urgent = vis.filter(function (n) { return isMed(n) && days(n) < 0; }), soon = vis.filter(function (n) { return !(isMed(n) && days(n) < 0); });
    var row = function (n) { return gymRow(n, !isSeen(kOf(n))); };
    if (urgent.length) out += '<p class="lr-sec">Da risolvere subito</p>' + urgent.map(row).join("");
    if (soon.length) out += '<p class="lr-sec">In scadenza</p>' + soon.map(row).join("");
    return out;
  }

  function render() {
    var h = '<div class="lr-head"><h2 id="liaRecapTitle">Avvisi</h2><button type="button" class="lr-x" aria-label="Chiudi">' + X + "</button></div>";
    var body = "", mi = monthItem(), list = visibleNotices();
    if (mi) body += monthCard(!isSeen(kOf(mi)));
    if (list.length) {
      if (mi && !data.gym) body += '<p class="lr-sec">Avvisi</p>';
      var isG = function (n) { return n.type === "member_expiring" || n.type === "medical_expiring"; };
      body += list.filter(function (n) { return !isG(n); }).map(function (n) { return noticeRow(n, !isSeen(kOf(n))); }).join("");
      body += gymBlock(list.filter(isG));
    }
    if (!mi && !list.length) {
      body = '<div class="lr-empty"><b>Nessun avviso</b>Qui trovi i promemoria di Lia: chiusure, abbonamenti in scadenza e altro.</div>';
    }
    panel.innerHTML = h + '<div class="lr-body">' + body + "</div>" + (mi ? '<div class="lr-ft">Incasso stimato dai prezzi dei servizi.</div>' : "");
    panel.querySelector(".lr-x").addEventListener("click", closePanel);
    panel.querySelectorAll(".lr-chip").forEach(function (c) {
      c.addEventListener("click", function () { GF = c.getAttribute("data-f"); render(); });
    });
    panel.querySelectorAll(".lr-it").forEach(function (b) {
      b.addEventListener("click", function () { go(b.getAttribute("data-type"), b.getAttribute("data-mid")); });
    });
  }

  /* un tocco su un avviso porta direttamente dove si risolve */
  function openSettings(page) {
    var om = document.getElementById("menuTabOther"); if (om) om.click();
    setTimeout(function () { if (window.liaSettingsOpen) window.liaSettingsOpen(page); }, 60);
  }
  function go(type, mid) {
    closePanel();
    if ((type === "member_expiring" || type === "medical_expiring") && window.liaGymMember) return window.liaGymMember(mid);
    if (type === "closures_reminder") { if (data && data.gym && window.liaGym) { var om = document.getElementById("menuTabOther"); if (om) om.click(); return setTimeout(function () { window.liaGym.openSetting("chiusure"); }, 80); } return openSettings("blocks"); }
    if (type === "sub_expiring") return openSettings("subscription");
    if (type === "feedback_ask" && window.liaFeedbackOpen) window.liaFeedbackOpen(true);
  }

  function openPanel() {
    if (!data || data.hidden) return;
    var bell = document.getElementById("bellBtn");
    if (bell && bell.getAttribute("aria-expanded") === "true") bell.click();
    tip.hidden = true;
    lastFocus = document.activeElement;
    pinned = {}; visibleNotices().forEach(function (n) { pinned[kOf(n)] = 1; });
    render();
    panel.hidden = false; scrim.hidden = false;
    btn.setAttribute("aria-expanded", "true");
    // dopo l'apertura tutto risulta letto: i puntini restano nel pannello aperto, l'icona si spegne
    unreadKeys().forEach(markSeen); paintBtn();
    var x = panel.querySelector(".lr-x"); if (x) x.focus();
    load(true);
  }
  function closePanel() {
    pinned = {};
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

/* Smartphone: la data nel calendario e il nome attivita' nelle altre sezioni stanno sempre su una riga.
   Si parte dalla dimensione normale e si rimpicciolisce solo quanto serve (minimo 15px, poi puntini). */
(function () {
  "use strict";
  var mq = window.matchMedia ? window.matchMedia("(max-width:699px)") : null;
  var MIN = 10, queued = false;

  function fit(el, maxPx) {
    if (!el) return;
    /* nessuna cache: va rimisurato ogni volta, perche' dopo il caricamento del font il testo diventa piu' largo
       a parita' di testo e di larghezza (la cache lasciava il titolo grande e troncato dai puntini) */
    var s = maxPx;
    el.style.setProperty("font-size", s + "px", "important");
    while (el.scrollWidth > el.clientWidth + 0.5 && s > MIN) {
      s -= 0.5;
      el.style.setProperty("font-size", s + "px", "important");
    }
  }
  /* nome attivita' nell'intestazione: si misura il testo vero contro lo spazio fino ai pulsanti, cosi' non viene mai tagliato */
  function fitName(el, maxPx) {
    var row = el.closest(".mainTopRow"), left = el.getBoundingClientRect().left, lim = window.innerWidth - 12;
    if (row) Array.prototype.forEach.call(row.querySelectorAll("button"), function (b) {
      var r = b.getBoundingClientRect(); if (r.width > 0 && r.left > left) lim = Math.min(lim, r.left);
    });
    var room = lim - left - 12, s = maxPx;
    el.style.setProperty("display", "inline-block", "important");
    el.style.setProperty("font-size", s + "px", "important");
    while (el.getBoundingClientRect().width > room && s > MIN) { s -= 0.5; el.style.setProperty("font-size", s + "px", "important"); }
  }
  function reset(el) { if (el) { el.style.removeProperty("font-size"); el.style.removeProperty("display"); } }

  function run() {
    queued = false;
    var range = document.querySelector("#calSubApp .controls .range");
    var biz = document.getElementById("businessName");
    if (!mq || !mq.matches) { reset(range); reset(biz); return; }
    var inCal = document.body.classList.contains("lia-sec-cal");
    /* la dimensione di partenza e' quella del CSS (stessa formula); si riduce solo se la data e' troppo lunga */
    if (inCal) { var rr = document.body.classList.contains("liaRecapOn") ? 176 : 126; fit(range, Math.min(30, Math.max(MIN, (window.innerWidth - rr) / 9.2))); }
    else reset(range);
    if (!inCal && biz && biz.offsetParent !== null) fitName(biz, 22.4);
  }
  function queue() { if (queued) return; queued = true; requestAnimationFrame(run); }

  function start() {
    queue();
    try {
      new MutationObserver(queue).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
    } catch (e) {}
    window.addEventListener("resize", queue);
    window.addEventListener("orientationchange", queue);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", queue);
    try {
      var ro = new ResizeObserver(queue), r1 = document.querySelector("#calSubApp .controls .range"), r2 = document.getElementById("businessName");
      if (r1) ro.observe(r1); if (r2) ro.observe(r2);
    } catch (e) {}
    setTimeout(queue, 600); setTimeout(queue, 1800);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
