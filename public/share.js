/* public/share.js  (Prenolia: menu corto, barra "La tua pagina di prenotazione" e guida "Come si usa")
   - nel menu burger: barra "La tua pagina di prenotazione" (QR piccolo, Condividi, Mostra il QR) e voce "Come si usa";
   - foglio "Condividi la tua pagina" (link, QR, WhatsApp, scarica il QR, locandina);
   - pagina "Come si usa", ordinata per importanza e diversa per le attivita' con appuntamenti e per le palestre.
   Se qualcosa non va, il menu resta quello di prima (le regole grafiche valgono solo con body.mnOn). */
(function () {
  "use strict";
  var token = "";
  try { token = (new URLSearchParams(location.search).get("t") || "").trim(); } catch (e) {}
  if (!token) return;

  var obsOn = false;
  var menu = null, biz = null, loading = null, sheet = null, guide = null, cur = 0, lastFocus = null, msgT = null;
  var NEWK = "lia:guide:seen:" + token, FULLK = "lia:guide:full:" + token;

  function $(id) { return document.getElementById(id); }
  function ls(op, k, v) { try { if (op === "g") return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function mk(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function abs(u) { u = String(u || ""); if (!u) return ""; return u.charAt(0) === "/" ? location.origin + u : u; }
  function slug(s) { return String(s || "qr").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "qr"; }

  var S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var I = {
    x: '<svg width="18" height="18" viewBox="0 0 24 24" ' + S + ' stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 24 24" ' + S + ' stroke-width="2.3"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
    share: '<svg width="16" height="16" viewBox="0 0 24 24" ' + S + ' stroke-width="2.3"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"/></svg>',
    chev: '<svg width="14" height="14" viewBox="0 0 24 24" ' + S + ' stroke-width="2.4"><path d="M9 6l6 6-6 6"/></svg>',
    down: '<svg width="18" height="18" viewBox="0 0 24 24" ' + S + ' stroke-width="2"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>',
    print: '<svg width="18" height="18" viewBox="0 0 24 24" ' + S + ' stroke-width="2"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
    wa: '<svg width="18" height="18" viewBox="0 0 24 24" ' + S + ' stroke-width="2"><path d="M21 11.5a8.4 8.4 0 01-12.4 7.4L3 20.5l1.7-5.4A8.4 8.4 0 1121 11.5z"/></svg>',
    qr: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M3 3h7v7H3V3zm2 2v3h3V5H5zM14 3h7v7h-7V3zm2 2v3h3V5h-3zM3 14h7v7H3v-7zm2 2v3h3v-3H5zM14 14h3v3h-3zM18 18h3v3h-3zM18 14h3v2h-3zM14 18h2v3h-2z"/></svg>',
    help: '<svg width="19" height="19" viewBox="0 0 24 24" ' + S + ' stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2"/><path d="M12 17h.01"/></svg>',
    back: '<svg width="20" height="20" viewBox="0 0 24 24" ' + S + ' stroke-width="2.2"><path d="M15 6l-6 6 6 6"/></svg>',
    search: '<svg width="18" height="18" viewBox="0 0 24 24" ' + S + ' stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    down2: '<svg viewBox="0 0 24 24" ' + S + ' stroke-width="2.2"><path d="M6 9l6 6 6-6"/></svg>',
    chat: '<svg width="20" height="20" viewBox="0 0 24 24" ' + S + ' stroke-width="2"><path d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-6.4A8 8 0 1121 12z"/></svg>',
    qrs: '<svg width="16" height="16" viewBox="0 0 24 24" ' + S + ' stroke-width="2.2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3M21 14v.01M14 21h.01M17 21h4v-4"/></svg>',
    burger: '<svg width="18" height="18" viewBox="0 0 24 24" ' + S + ' stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
  };

  /* ---------- dati dell'attivita' ---------- */
  function getJson(u) {
    return fetch(u, { cache: "no-store" }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error((d && d.error) || "Errore"); return d; }); });
  }
  var CK = "lia:mnbiz:" + token;
  function readCache() {
    try { var o = JSON.parse(ls("g", CK) || "null"); if (o && o.raw && Array.isArray(o.links)) return o; } catch (e) {}
    return null;
  }
  function writeCache(b) {
    try {
      var r = b.raw || {};
      ls("s", CK, JSON.stringify({ raw: { name: r.name || b.name || "", slug: r.slug || "", business_type: r.business_type || (b.gym ? "palestra" : ""), address: r.address || "" }, name: b.name || "", plan: b.plan || "", gym: !!b.gym, classes: b.classes !== false, personal: b.personal !== false, rental: !!b.rental, links: b.links }));
    } catch (e) {}
  }
  function planLabel(n) {
    n = String(n || "");
    if (n === "Base+Lia") return "Smart";
    if (n === "Base") return "Base";
    if (n === "Premium") return "Premium";
    return "";
  }
  function load() {
    if (loading) return loading;
    var p = window.liaSettingsData ? Promise.resolve(window.liaSettingsData) : getJson("/api/agenda?t=" + encodeURIComponent(token) + "&settings=1");
    function fin(b, g0) {
      var gym = b.business_type === "palestra";
      var o = b.gym_offers || null;
      var res = { raw: b, name: b.name || "", plan: planLabel(b.plan_name), gym: gym, classes: !gym || !o || o.classes !== false, personal: !gym || !o || o.personal !== false, rental: false, links: [] };
      var main = String(b.public_link || "");
      if (main) res.links.push({ key: "main", seg: gym ? "Prenotazioni" : "Prenota", url: abs(main) });
      if (!gym) return res;
      var gp = g0 ? Promise.resolve(g0) : getJson("/api/palestra?t=" + encodeURIComponent(token) + "&data=1");
      return gp.then(function (g) {
        var gl = g && g.business && g.business.public_link;
        if (!res.links.length && gl) res.links.push({ key: "main", seg: "Prenotazioni", url: abs(gl) });
        if (!res.name && g && g.business && g.business.name) res.name = g.business.name;
        var on = !!(g && g.settings && g.settings.rental && g.settings.rental.on);
        var rl = g && g.business && g.business.rental_link;
        if (on && rl) { res.rental = true; res.links.push({ key: "rent", seg: "Affitto sala", url: abs(rl) }); }
        return res;
      }).catch(function () { return res; });
    }
    loading = p.catch(function () { return null; }).then(function (d) {
      var b = d && d.business;
      if (b) return fin(b, null);
      /* palestre senza orari standard: le impostazioni rispondono con un errore, si usano i dati della palestra */
      return getJson("/api/palestra?t=" + encodeURIComponent(token) + "&data=1").then(function (g) {
        var gb = g && g.business; if (!gb) throw new Error("no");
        return fin({ name: gb.name || "", business_type: "palestra", public_link: gb.public_link || "", gym_offers: null }, g);
      });
    }).then(function (res) { biz = res; return res; }).catch(function () { loading = null; if (!readCache()) biz = null; return null; });
    return loading;
  }

  /* ---------- copia, QR, condivisione ---------- */
  function copyText(text, btn) {
    var span = btn && (btn.querySelector("span") || btn), old = span ? span.textContent : "";
    var done = function () { if (!span) return; span.textContent = "Copiato ✓"; setTimeout(function () { span.textContent = old; }, 1400); };
    var fallback = function () {
      try { var t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;opacity:0;top:0;left:0"; document.body.appendChild(t); t.select(); document.execCommand("copy"); document.body.removeChild(t); } catch (e) {}
      done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  }
  function qrFor(link) {
    var t = window.liaQrLink ? window.liaQrLink(link, "qr") : link, M = null;
    try { if (window.liaPoster && window.liaPoster.qr) M = window.liaPoster.qr(t); } catch (e) {}
    if (M && M.length) {
      var N = M.length, q = 4, d = "", x, y;
      for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (M[y][x]) d += "M" + (x + q) + " " + (y + q) + "h1v1h-1z";
      var W = N + q * 2;
      return { M: M, N: N, svg: '<svg viewBox="0 0 ' + W + " " + W + '" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="' + W + '" height="' + W + '" fill="#fff"/><path d="' + d + '" fill="#0B1A20"/></svg>' };
    }
    try { if (window.liaQRMatrix) { var s = window.liaQRMatrix(t); if (s && s.outerHTML) return { M: null, N: 0, svg: s.outerHTML }; } } catch (e) {}
    return null;
  }
  function qrPng(qr, cb) {
    var N = qr.N, q = 4, k = 14, W = (N + q * 2) * k, c = document.createElement("canvas"), x, y;
    c.width = W; c.height = W;
    var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, W, W); g.fillStyle = "#0B1A20";
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) if (qr.M[y][x]) g.fillRect((x + q) * k, (y + q) * k, k, k);
    if (c.toBlob) c.toBlob(cb, "image/png"); else cb(null);
  }
  function msg(t) {
    if (!sheet) return;
    var m = sheet.querySelector(".mnMsg"); if (!m) return;
    m.textContent = t || ""; clearTimeout(msgT); if (t) msgT = setTimeout(function () { m.textContent = ""; }, 3500);
  }
  function closeMenu() {
    var bd = $("menuBackdrop");
    if (menu && menu.classList.contains("on") && bd) bd.click();
  }

  /* ---------- menu ---------- */
  function buildMenu() {
    menu = $("burgerMenu");
    if (menu) menu.addEventListener("click", function (ev) { var bt = ev.target.closest && ev.target.closest("button"); if (bt && bt.id !== "menuTabGuide") closeGuide(); });
    var cal = $("menuTabCal"), other = $("menuTabOther"), out = $("logoutBtn");
    if (!menu || !cal || !other || menu.getAttribute("data-mn")) return false;
    menu.setAttribute("data-mn", "1");

    var card = mk("div", "mnShare",
      '<span class="mnShareKick">La tua pagina di prenotazione</span>' +
      '<button type="button" class="mnShareTop" data-a="profile"><span class="mnAv" id="mnAv" aria-hidden="true"></span>' +
      '<span class="mnShareTxt"><small id="mnKind"></small><b id="mnBizName">La tua attività</b><span id="mnBizAddr" hidden></span></span><span class="mnShareGo" aria-hidden="true">' + I.chev + '</span></button>' +
      '<div class="mnShareAct"><button type="button" class="mnBtnA" data-a="share">' + I.share + "<span>Condividi</span></button>" +
      '<button type="button" class="mnBtnB" data-a="qr">' + I.qrs + "<span>Mostra il QR</span></button></div>");
    card.id = "mnShareCard"; card.hidden = true;
    card.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-a]"); if (!b) return;
      if (!biz) { var bb = b; load().then(function () { if (biz) { biz.__w = 1; bb.click(); } }); return; }
      var a = b.getAttribute("data-a");
      if (a === "profile") { var pf = $("menuTabProfile"); if (pf) pf.click(); return; }
      if (!biz.links.length) return;
      if (a === "share") {
        var u = biz.links[0].url;
        if (navigator.share) navigator.share({ title: biz.name || "Prenota", text: "Prenota da " + (biz.name || "noi"), url: u }).catch(function () {});
        else openSheet(0);
      } else openSheet(0, a === "qr");
    });

    var g = mk("button", "", I.help + '<span>Guida</span><span class="mnNew">Nuovo</span>');
    g.type = "button"; g.id = "menuTabGuide"; g.setAttribute("role", "menuitem"); g.setAttribute("aria-current", "false");
    g.querySelector("span:first-of-type").style.flex = "1";
    var nw = g.querySelector(".mnNew"); if (ls("g", NEWK)) nw.hidden = true;
    g.addEventListener("click", function () { closeMenu(); openGuide(); });

    menu.insertBefore(card, cal);
    /* Disponibilita': orari del negozio e del team, chiusure e assenze (non per le palestre, che hanno i loro orari) */
    var av = mk("button", "", '<svg width="18" height="18" viewBox="0 0 24 24" ' + S + ' stroke-width="1.9"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>Disponibilità');
    av.type = "button"; av.id = "menuTabAvail"; av.setAttribute("role", "menuitem"); av.setAttribute("aria-current", "false");
    av.addEventListener("click", function () { closeMenu(); if (window.liaAvailOpen) window.liaAvailOpen(); });
    menu.insertBefore(av, other);
    /* ordine: ... Impostazioni, Come si usa, separatore, Esci */
    var sep = mk("div", "mnSep");
    if (out) { menu.insertBefore(g, out); menu.insertBefore(sep, out); }
    else { menu.appendChild(g); }
    var oi = other.querySelector("svg");
    if (oi) oi.innerHTML = '<path d="M4 7h9M19 7h1M4 17h1M11 17h9"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/>';
    document.body.classList.add("mnOn");
    var pt = $("menuTabProfile");
    if (pt && window.MutationObserver) new MutationObserver(markCur).observe(pt, { attributes: true, attributeFilter: ["aria-current"] });
    markCur();
    return true;
  }
  function txt(id) { var e = $(id); return e && !e.hidden ? String(e.textContent || "").trim() : ""; }
  function markCur() {
    var c = $("mnShareCard"), p = $("menuTabProfile");
    if (c) c.classList.toggle("cur", !!p && p.getAttribute("aria-current") === "true");
  }
  /* logo dell'attivita' al posto dell'icona (per slug), come per palestra e centro estetico */
  var SKINS = { style2: "/brand/style2.jpg" };
  function syncProfile() {
    var av = $("mnAv"), card = $("mnShareCard"); if (!av || !card || !biz) return;
    var live = window.liaSettingsData && window.liaSettingsData.business, raw = live || biz.raw || {};
    var k = window.liaHeroKindOf ? window.liaHeroKindOf(raw) : null;
    var isGym = biz.gym || String(raw.business_type || "") === "palestra";
    av.className = "mnAv" + (isGym ? " gym" : k ? (k.key === "estetista" ? " est" : k.key === "cartomante" ? " car" : "") : "");
    if (isGym) { card.style.setProperty("--mnh", "36"); av.innerHTML = ""; }
    else if (k) {
      card.style.setProperty("--mnh", String(k.h));
      av.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" ' + S + ' stroke-width="1.7">' + k.icon + "</svg>";
    } else av.textContent = String(raw.name || biz.name || "A").charAt(0).toUpperCase();
    var skinImg = SKINS[String(raw.slug || "").toLowerCase()] || "";
    if (skinImg) { av.className = "mnAv skin"; av.innerHTML = ""; av.style.setProperty("--skin", "url(" + skinImg + ")"); } else av.style.removeProperty("--skin");
    var kd = $("mnKind"); if (kd) { kd.textContent = isGym ? "Palestra" : k ? k.label : ""; kd.hidden = !(isGym || k); }
    var pn = txt("pfName"), name = (pn && pn !== "La tua attività") ? pn : (raw.name || biz.name || "La tua attività");
    var nm = $("mnBizName"); if (nm) nm.textContent = name;
    var ad = $("mnBizAddr"), addr = txt("pfAddr") || String(raw.address || "").trim();
    if (ad) { ad.textContent = addr; ad.hidden = !addr; }
  }
  function paintMenu() {
    var c = $("mnShareCard");
    var avb = $("menuTabAvail"); if (avb) avb.style.display = biz && biz.gym ? "none" : "";
    if (c) {
      c.hidden = !biz;
      var nl = !!biz && !biz.links.length;
      c.classList.toggle("mnNoLink", nl);
      var kk = c.querySelector(".mnShareKick"); if (kk) kk.textContent = nl ? "La tua attività" : "La tua pagina di prenotazione";
    }
    if (!c || !biz) return;
    syncProfile();
    if (window.MutationObserver && menu && !obsOn) { obsOn = true; new MutationObserver(syncProfile).observe(menu, { attributes: true, attributeFilter: ["class", "hidden"] }); }
  }

  /* ---------- foglio "Condividi la tua pagina" ---------- */
  function buildSheet() {
    sheet = mk("div", "mnLayer");
    sheet.id = "mnShareSheet"; sheet.hidden = true;
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-labelledby", "mnShT");
    sheet.innerHTML =
      '<button type="button" class="mnScrim" id="mnShareScrim" aria-label="Chiudi"></button>' +
      '<div class="mnSheet"><div class="mnGrab"></div>' +
      '<div class="mnSH"><div><span class="mnQrKick">Il tuo QR code</span><h2 id="mnShT">Condividi la tua pagina</h2><p class="mnSub" id="mnShSub"></p></div><button type="button" class="mnClose" data-a="close" aria-label="Chiudi">' + I.x + "</button></div>" +
      '<div class="mnSeg" role="group" aria-label="Quale link" hidden></div>' +
      '<div class="mnQrCard"><div class="mnQrFrame"><i></i><i></i><i></i><i></i><div class="mnQrBox" id="mnQrBox"></div></div><div class="mnQrInfo"><b id="mnQrName"></b><span id="mnQrHint"></span></div></div>' +
      '<div class="mnLinkRow"><code id="mnLinkTxt"></code><button type="button" class="mnCopy" data-a="copy">' + I.copy + "<span>Copia</span></button></div>" +
      '<div class="mnActs">' +
      '<button type="button" class="mnAct" data-a="wa"><i class="wa">' + I.wa + '</i><span class="mnT">Invia su WhatsApp</span></button>' +
      '<button type="button" class="mnAct" data-a="dl" id="mnDl"><i>' + I.down + '</i><span class="mnT">Scarica il QR</span></button>' +
      '<button type="button" class="mnAct" data-a="poster"><i>' + I.print + '</i><span class="mnT">Locandina per la vetrina<small>PDF pronto da stampare</small></span>' + I.chev + "</button>" +
      "</div>" +
      '<p class="mnMsg" role="status"></p></div>';
    document.body.appendChild(sheet);
    sheet.addEventListener("click", function (ev) {
      if (ev.target.id === "mnShareScrim") { closeSheet(); return; }
      var s = ev.target.closest(".mnSeg button");
      if (s) { cur = Number(s.getAttribute("data-i")) || 0; paintSheet(); return; }
      var b = ev.target.closest("[data-a]"); if (!b || !biz) return;
      var l = biz.links[cur]; if (!l) return;
      var a = b.getAttribute("data-a");
      if (a === "close") closeSheet();
      else if (a === "copy") copyText(l.url, b);
      else if (a === "wa") window.open("https://wa.me/?text=" + encodeURIComponent("Prenota da " + (biz.name || "noi") + ": " + l.url), "_blank");
      else if (a === "dl") download(l);
      else if (a === "poster") { closeSheet(); var p = $("menuTabProfile"); if (p) p.click(); setTimeout(function () { var t = $("pfPoster") || $("panelProfile"); if (t && t.scrollIntoView) t.scrollIntoView({ behavior: "smooth", block: "start" }); }, 280); }
    });
  }
  function paintSheet() {
    if (!sheet || !biz) return;
    var l = biz.links[cur] || biz.links[0], seg = sheet.querySelector(".mnSeg");
    seg.hidden = biz.links.length < 2;
    seg.innerHTML = "";
    biz.links.forEach(function (x, i) {
      var b = mk("button"); b.type = "button"; b.setAttribute("data-i", String(i)); b.setAttribute("aria-pressed", i === cur ? "true" : "false"); b.textContent = x.seg; seg.appendChild(b);
    });
    var rent = l.key === "rent";
    $("mnShSub").textContent = rent ? "Chi vuole affittare la sala prenota da solo, in un tocco." : (biz.gym ? "Gli iscritti prenotano da soli, a qualsiasi ora." : "I clienti prenotano da soli, a qualsiasi ora.");
    $("mnQrName").textContent = biz.name || "La tua attività";
    $("mnQrHint").textContent = rent ? "Inquadra con la fotocamera per affittare la sala." : "Inquadra con la fotocamera per aprire la pagina di prenotazione.";
    if (sheet.classList.contains("mnQrOnly")) $("mnQrHint").textContent = rent ? "Inquadra per affittare la sala" : "Inquadra con la fotocamera per prenotare";
    $("mnLinkTxt").textContent = l.url.replace(/^https?:\/\//, "");
    var q = qrFor(l.url);
    $("mnQrBox").innerHTML = q ? q.svg : "";
    $("mnDl").hidden = !(q && q.M);
    msg("");
  }
  function download(l) {
    var q = qrFor(l.url);
    if (!q || !q.M) { msg("Non riesco a creare il QR su questo dispositivo."); return; }
    qrPng(q, function (blob) {
      if (!blob) { msg("Non riesco a creare il QR su questo dispositivo."); return; }
      var name = "qr-" + slug(biz.name) + (l.key === "rent" ? "-sala" : "") + ".png";
      try {
        var f = new File([blob], name, { type: "image/png" });
        if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: biz.name || "QR code" }).catch(function () {}); return; }
      } catch (e) {}
      var u = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = u; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      msg("QR scaricato.");
    });
  }
  /* il link dell'affitto sala c'e' solo se e' attivo nelle impostazioni (dati vivi del modulo palestra, se gia' caricati) */
  function syncRent() {
    if (!biz || !biz.gym) return;
    var D = window.liaGym && window.liaGym.S && window.liaGym.S.data; if (!D) return;
    var on = !!(D.settings && D.settings.rental && D.settings.rental.on), rl = D.business && D.business.rental_link;
    biz.links = biz.links.filter(function (k) { return k.key !== "rent"; });
    biz.rental = !!(on && rl);
    if (biz.rental) biz.links.push({ key: "rent", seg: "Affitto sala", url: abs(rl) });
  }
  function openSheet(i, qrOnly) {
    closeMenu();
    load().then(function (b) {
      syncRent();
      if (!b || !b.links.length) return;
      if (!sheet) buildSheet();
      cur = Math.min(Number(i) || 0, b.links.length - 1);
      sheet.classList.toggle("mnQrOnly", !!qrOnly);
      var st = $("mnShT"); if (st) st.textContent = qrOnly ? (b.name || "La tua attività") : "Condividi la tua pagina";
      paintSheet();
      lastFocus = document.activeElement;
      sheet.hidden = false;
      var c = sheet.querySelector(".mnClose"); if (c) c.focus();
    });
  }
  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  /* ---------- guida "Come si usa": dalle informazioni piu' importanti a quelle di approfondimento ---------- */
  var GI = {
    bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
    cal: '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 10h18M8 2v4M16 2v4"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    cli: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2a6.5 6.5 0 0 1 3.5 5.8"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    sta: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    msg: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>',
    card: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>'
  };
  function gi(k, s) { return '<svg width="' + (s || 19) + '" height="' + (s || 19) + '" viewBox="0 0 24 24" ' + S + ' stroke-width="1.9">' + GI[k] + "</svg>"; }

  function guideFor(b) {
    var link = b.links.length > 0;
    var M = "Menu › ";
    if (!b.gym) {
      var t1 = [
        ["Cosa devo fare per iniziare?", "Servono tre passi: inserisci i servizi con durata e prezzo, imposta gli orari in cui ricevi e condividi il link con i clienti. Dopo questi tre sei già operativo.", M + "Impostazioni › Servizi e prezzi"],
        ["Come prenotano i miei clienti?", "Aprono il tuo link o inquadrano il QR, scelgono servizio, giorno e orario e lasciano nome e telefono. Tu ricevi subito la notifica e l’appuntamento compare nel calendario.", link ? M + "Condividi la tua pagina" : ""],
        ["Quanto in anticipo si può prenotare?", "Fino a 90 giorni avanti. Il preavviso minimo è di 15 minuti e puoi aumentarlo nelle Regole di prenotazione.", M + "Impostazioni › Regole di prenotazione"]
      ];
      var t7q = [];
      if (link) t7q.push(["Dove trovo il mio link e il QR?", "Puoi condividere il link, mostrare il QR da inquadrare o inviarlo su WhatsApp.", M + "Condividi la tua pagina"]);
      t7q.push(["Come faccio prenotare dalla vetrina?", "Scarica la locandina con il tuo QR, stampala e attaccala in vetrina: chi passa inquadra e prenota anche a negozio chiuso.", M + "Scheda attività"]);
      return {
        start: [["clock", "Controlla servizi e orari", "Cosa offri e quando ricevi", "t5"], ["link", "Condividi il link ai clienti", "Così possono prenotare da soli", "t1"], ["cal", "Guarda il calendario", "Qui vedi le prenotazioni", "t2"]],
        can: [
          ["link", "Ricevere prenotazioni a qualsiasi ora", "I clienti prenotano da soli dal tuo link o dal QR", "t1"],
          ["cal", "Tenere l’agenda sotto controllo", "Giorno, settimana e mese, con notifiche in tempo reale", "t2"],
          ["cli", "Conoscere i tuoi clienti", "Scheda, storico delle visite e note", "t4"],
          ["clock", "Organizzare orari, ferie e collaboratori", "Decidi tu quando e con chi si può prenotare", "t5"],
          ["sta", "Capire come va l’attività", "Incassi, giorni pieni e orari più richiesti", "t8"],
          ["msg", "Avere Lia che risponde ai clienti", "In chat, anche quando sei occupato o chiuso", "t9"]
        ],
        tiers: [
          { k: "Essenziale", s: "Parti da qui", topics: [{ id: "t1", ic: "bolt", n: "Mettere online la tua attività", d: "Le tre cose da fare subito", q: t1 }] },
          { k: "Ogni giorno", s: "Quello che userai di più", topics: [
            { id: "t2", ic: "cal", n: "Il calendario", d: "Vedere e gestire gli appuntamenti", q: [
              ["Cosa vedo nelle tre viste?", "Giorno mostra la giornata ora per ora, Settimana l’intera settimana, Mese l’occupazione di ogni giorno con la percentuale di posti pieni.", M + "Calendario"],
              ["Come aggiungo un appuntamento a mano?", "Tocca il pulsante + del calendario e scegli cliente, servizio, giorno e ora. Serve per chi prenota per telefono o di persona.", M + "Calendario"],
              ["Come segno che un cliente non è venuto?", "Apri l’appuntamento e segnalo come non presentato. Il dato resta nella scheda del cliente.", M + "Calendario › tocca l’appuntamento"]
            ] },
            { id: "t3", ic: "bell", n: "Notifiche e avvisi", d: "Non perderti nessuna prenotazione", q: [
              ["Cosa mi segnala la campanella?", "Le nuove prenotazioni e le cancellazioni. Restano finché non chiudi il pannello, poi risultano lette. Toccandone una vai dritto all’appuntamento.", "Campanella in alto a destra"],
              ["A cosa serve l’icona con la “a”?", "Raccoglie gli avvisi di Prenolia: il promemoria del lunedì per ferie e chiusure, la scadenza del piano e il riepilogo di fine mese.", "Icona “a” in alto a destra"]
            ] },
            { id: "t4", ic: "cli", n: "I tuoi clienti", d: "Schede, note e contatti", q: [
              ["Dove trovo la scheda di un cliente?", "Cerchi per nome o telefono e tocchi il cliente. Vedi prossimo appuntamento, storico delle visite e i pulsanti per chiamare, scrivere su WhatsApp o prenotare.", M + "Clienti"],
              ["Posso scrivere note sui clienti?", "Sì, in due modi: una nota fissa sul cliente e una nota per ogni singola visita. Le vedi sia nella scheda sia nell’appuntamento.", M + "Clienti › scheda cliente"],
              ["I clienti ricevono un promemoria?", "Se lasciano l’email in fase di prenotazione ricevono la conferma e un promemoria il giorno prima, con il link per annullare.", ""]
            ] }
          ] },
          { k: "Quando ti serve", s: "Si imposta una volta e poi si aggiorna", topics: [
            { id: "t5", ic: "clock", n: "Orari, ferie e collaboratori", d: "Quando e con chi si può prenotare", q: [
              ["Come blocco ferie e giorni di chiusura?", "Segna i giorni: i clienti non potranno prenotarli. Ogni lunedì ti ricordiamo di controllarli.", M + "Impostazioni › Chiusure e ferie"],
              ["Come cambio gli orari di apertura?", "Scegli i giorni e le ore in cui ricevi. La modifica vale subito anche sulla pagina dei clienti.", M + "Impostazioni › Orari di apertura"],
              ["Come aggiungo un collaboratore?", "Aggiungi le persone con i loro orari e le loro ferie. I clienti potranno scegliere con chi prenotare.", M + "Impostazioni › Chi lavora da te"],
              ["Posso decidere quando i clienti annullano?", "Sì: imposti il preavviso minimo per prenotare e il limite entro cui un cliente può annullare.", M + "Impostazioni › Regole di prenotazione"]
            ] },
            { id: "t6", ic: "tag", n: "Servizi e scheda attività", d: "Cosa offri e come ti presenti", q: [
              ["Come cambio servizi e prezzi?", "Aggiungi, modifica o togli i servizi. Le modifiche valgono subito sulla pagina di prenotazione.", M + "Impostazioni › Servizi e prezzi"],
              ["Cosa vedo in Scheda attività?", "Il riepilogo della tua attività: dati, canali dei clienti, servizi, orari e chi lavora da te.", M + "Scheda attività"]
            ] },
            { id: "t7", ic: "link", n: "Farsi trovare dai clienti", d: "Link, QR e locandina", q: t7q }
          ] },
          { k: "Per approfondire", s: "Quando vuoi sfruttare di più Prenolia", topics: [
            { id: "t8", ic: "sta", n: "Statistiche", d: "Capire come va l’attività", q: [
              ["Cosa mostrano le statistiche?", "Fatturato e proiezione, servizi più richiesti, occupazione media per giorno e gli orari più pieni. Tocca un grafico per vedere il dettaglio.", M + "Statistiche"]
            ] },
            { id: "t9", ic: "msg", n: "Lia e i canali", d: "L’assistente che risponde ai clienti", q: [
              ["Cosa fa Lia?", "Risponde ai clienti in chat e li aiuta a prenotare, anche quando sei occupato o l’attività è chiusa. Funziona su webchat e Telegram.", M + "Scheda attività › Canali clienti"],
              ["Come collego Telegram?", "Crei il tuo bot in un tocco e i clienti prenotano da lì. Ricevi l’agenda del giorno sul tuo Telegram e puoi spegnerla.", M + "Impostazioni › Telegram"]
            ] },
            { id: "t10", ic: "card", n: "Piano e account", d: "Costi, prova e disdetta", q: [
              ["Quanto costa e cosa include?", "Il piano Smart costa 24,99 € al mese: calendario, prenotazione online dei clienti e Lia su webchat e Telegram.", M + "Impostazioni › Abbonamento"],
              ["Come funzionano prova e scadenza?", "Hai 14 giorni di prova gratuita. Alla scadenza del piano ci sono 3 giorni di tolleranza prima della sospensione.", M + "Impostazioni › Abbonamento"],
              ["Posso disdire?", "Sì, quando vuoi. Il servizio resta attivo fino alla fine del mese già pagato, senza rimborsi.", M + "Impostazioni › Abbonamento"]
            ] }
          ] }
        ]
      };
    }
    /* palestre */
    var who = b.classes && b.personal ? "le lezioni libere e gli orari del Personal" : (b.classes ? "le lezioni libere e i posti rimasti" : "gli orari liberi per il Personal");
    var g1 = [["Come aggiungo un nuovo iscritto?", "Vai in Iscritti e tocca “Nuovo iscritto”. Scrivi nome, cognome e telefono e scegli subito l’abbonamento. Solo chi è in elenco può prenotare.", M + "Iscritti"]];
    if (b.classes) g1.push(["Come creo o cambio le lezioni?", "Dal calendario tocca “Programma”: scegli corso, posti e durata, poi giorni e orari. Le lezioni si ripetono ogni settimana finché non le modifichi.", M + "Calendario › Programma"]);
    if (link) {
      g1.push(["Dove trovo il link per far prenotare gli iscritti?", "Puoi condividere il link, mostrare il QR da mandare agli iscritti o da stampare per la palestra.", M + "Condividi la tua pagina"]);
      g1.push(["Come prenota un iscritto?", "Apre il link e scrive nome, cognome e telefono. Se corrispondono a un iscritto, vede " + who + " e prenota con un tocco.", ""]);
    }
    var g2 = [
      ["Perché un iscritto non riesce a prenotare?", "Controlla tre cose nella sua scheda: abbonamento valido, certificato medico non scaduto e ingressi ancora disponibili. Se manca una di queste, la prenotazione è bloccata.", M + "Iscritti › scheda iscritto"],
      ["Come rinnovo un abbonamento?", "In Iscritti tocca “Rinnova” accanto al nome. La nuova scadenza si aggiorna subito.", M + "Iscritti"],
      ["Come registro il certificato medico?", "Nella scheda dell’iscritto scrivi quando è stato fatto e quando scade. Ti avvisiamo noi prima della scadenza.", M + "Iscritti › scheda iscritto"]
    ];
    var topics2 = [{ id: "g2", ic: "cli", n: "Iscritti e abbonamenti", d: "Chi può prenotare e fino a quando", q: g2 }];
    if (b.classes) topics2.push({ id: "g3", ic: "cal", n: "Disdette", d: "Liberare un posto in una lezione", q: [["Come gestisco una disdetta?", "L’iscritto ti avvisa entro i termini che hai stabilito. Tu apri la lezione e tocca “Togli” accanto al nome: il posto torna libero.", M + "Calendario › apri la lezione"]] });
    var tiers = [
      { k: "Essenziale", s: "Parti da qui", topics: [{ id: "g1", ic: "bolt", n: "Mettere online la palestra", d: "Iscritti, lezioni e link", q: g1 }] },
      { k: "Ogni giorno", s: "Quello che userai di più", topics: topics2 }
    ];
    if (b.rental) tiers.push({ k: "Per approfondire", s: "Quando vuoi sfruttare di più Prenolia", topics: [{ id: "g4", ic: "clock", n: "Affitto della sala", d: "Ore libere dopo la chiusura", q: [["Come funziona l’affitto della sala?", "Chi vuole affittare la sala usa un link a parte: lo trovi in “Condividi la tua pagina”, nella scheda “Affitto sala”. Sceglie un’ora dopo la chiusura e lascia i suoi dati: tu ricevi una notifica e l’ora si blocca.", M + "Condividi la tua pagina"]] }] });
    return {
      start: [["cli", "Aggiungi gli iscritti", "Solo loro potranno prenotare", "g2"], ["cal", "Prepara le lezioni", "Corsi, posti e orari", "g1"], ["link", "Condividi il link agli iscritti", "Prenotano da soli", "g1"]],
      can: [
        ["cli", "Gestire iscritti e abbonamenti", "Solo chi ha l’abbonamento valido può prenotare", "g2"],
        ["cal", "Far prenotare le lezioni da soli", "Gli iscritti scelgono da link o QR", "g1"]
      ],
      tiers: tiers
    };
  }

  function buildGuide(b) {
    var d = guideFor(b), open = {}, term = "", full = true; /* niente percorso iniziale in 3 passi: la guida si apre subito completa */
    if (d.tiers[0] && d.tiers[0].topics[0]) open[d.tiers[0].topics[0].id] = true;
    guide = mk("div", "mnLayer");
    guide.id = "mnGuide"; guide.hidden = true;
    guide.setAttribute("role", "dialog"); guide.setAttribute("aria-modal", "true"); guide.setAttribute("aria-labelledby", "mnGuideT");
    guide.innerHTML =
      '<div class="mnGuide"><div class="mnGuideIn">' +
      '<div class="mnGH"><button type="button" class="mnBack" id="mnGuideBack" aria-label="Indietro">' + I.back + '</button><h2 id="mnGuideT" class="mnSr">Guida</h2><p class="mnGSub">Dalle cose essenziali a quelle di approfondimento: segui i numeri.</p></div>' +
      '<label class="mnSearch">' + I.search + '<input type="search" id="mnGuideQ" placeholder="Cerca, per esempio “ferie”" aria-label="Cerca nella guida" autocomplete="off"></label>' +
      '<div id="mnGBody"></div>' +
      '<button type="button" class="mnHelp" id="mnHelp">' + I.chat + '<span class="mnT"><b>Non trovi la risposta?</b><small>Scrivici, ti rispondiamo noi</small></span>' + I.chev + "</button>" +
      "</div></div>";
    document.body.appendChild(guide);
    var body = guide.querySelector("#mnGBody");

    function qa(q, tag) {
      return '<div class="mnQa">' + (tag ? '<span class="mnTag">' + tag + "</span>" : "") + "<h4>" + q[0] + "</h4><p>" + q[1] + "</p>" + (q[2] ? '<span class="mnPath">' + q[2] + "</span>" : "") + "</div>";
    }
    function render() {
      var s = term.trim().toLowerCase(), h = "";
      if (s) {
        var n = 0, r = "";
        d.tiers.forEach(function (t) { t.topics.forEach(function (x) { x.q.forEach(function (q) {
          if ((q[0] + " " + q[1]).toLowerCase().indexOf(s) >= 0) { n++; r += qa(q, x.n); }
        }); }); });
        h = n ? '<div class="mnRes">' + r + "</div>" : '<p class="mnEmpty">Nessun risultato. Prova con un’altra parola o scrivici.</p>';
      } else {
        if (d.start && !full) {
          h += '<div class="mnStart"><b>Parti da qui: 3 passi</b><ol>';
          d.start.forEach(function (c, i) {
            h += '<li><button type="button" class="mnK' + (i + 1) + '" data-go="' + c[3] + '" data-full="1"><span class="mnNum">' + (i + 1) + '</span><span class="mnCt">' + c[1] + "<small>" + c[2] + "</small></span>" + I.chev + "</button></li>";
          });
          h += '</ol></div><button type="button" class="mnAll" data-all="1">Mostra tutta la guida</button>';
          body.innerHTML = h; return;
        }
        h += '<div class="mnCan"><b>Cosa puoi fare con Prenolia</b><ul>';
        d.can.forEach(function (c, i) {
          h += '<li><button type="button" class="mnK' + (i % 6 + 1) + '" data-go="' + c[3] + '"><span class="mnCi">' + gi(c[0], 20) + '</span><span class="mnCt"><span class="mnCtt">' + c[1] + "</span><small>" + c[2] + "</small></span></button></li>";
        });
        h += "</ul></div>";
        d.tiers.forEach(function (t, ti) {
          var kc = "mnK" + ({ "Essenziale": 1, "Ogni giorno": 2, "Quando ti serve": 3, "Per approfondire": 4 }[t.k] || (ti % 4 + 1));
          h += '<div class="mnTier ' + kc + '"><div class="mnTh"><span class="mnNum">' + (ti + 1) + '</span><span class="mnThT"><span class="mnTk">' + t.k + "</span><small>" + t.s + '</small></span></div><div class="mnTopics">';
          t.topics.forEach(function (x) {
            var o = !!open[x.id];
            h += '<div class="mnTp' + (o ? " open" : "") + '" id="mnTp-' + x.id + '"><button type="button" data-tp="' + x.id + '" aria-expanded="' + (o ? "true" : "false") + '"><span class="mnCi">' + gi(x.ic) + '</span><span class="mnTt">' + x.n + "<small>" + x.d + '</small></span><span class="mnCv">' + I.down2 + "</span></button>";
            if (o) { h += '<div class="mnQs">'; x.q.forEach(function (q) { h += qa(q); }); h += "</div>"; }
            h += "</div>";
          });
          h += "</div></div>";
        });
      }
      body.innerHTML = h;
    }
    body.addEventListener("click", function (ev) {
      var tp = ev.target.closest("[data-tp]"), go = ev.target.closest("[data-go]"), al = ev.target.closest("[data-all]");
      if (al) { full = true; ls("s", FULLK, "1"); render(); return; }
      if (go && go.getAttribute("data-full")) { full = true; ls("s", FULLK, "1"); }
      if (tp) { var k = tp.getAttribute("data-tp"); open[k] = !open[k]; render(); return; }
      if (go) {
        var id = go.getAttribute("data-go"); open[id] = true; render();
        var e = $("mnTp-" + id); if (e && e.scrollIntoView) e.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    guide.querySelector("#mnGuideQ").addEventListener("input", function () { term = this.value; render(); });
    guide.querySelector("#mnGuideBack").addEventListener("click", closeGuide);
    guide.querySelector("#mnHelp").addEventListener("click", function () {
      closeGuide();
      var o = $("menuTabOther"); if (o) o.click();
      setTimeout(function () { if (window.liaSettingsOpen) window.liaSettingsOpen("help"); }, 80);
    });
    render();
  }

  function guideTop() {
    if (!guide) return;
    var h = document.querySelector(".mainTop"), t = 0;
    try { window.scrollTo(0, 0); } catch (e) {}
    if (h) { var r = h.getBoundingClientRect(); t = Math.round(r.bottom); if (t <= 0) t = Math.round(h.offsetHeight || 0); t = Math.max(0, t); }
    guide.style.top = t + "px";
  }
  window.addEventListener("resize", function () { if (guide && !guide.hidden) guideTop(); });
  function openGuide() {
    ls("s", NEWK, "1");
    var nw = document.querySelector("#menuTabGuide .mnNew"); if (nw) nw.hidden = true;
    load().then(function (b) {
      b = b || { name: "", plan: "", gym: false, classes: true, personal: true, rental: false, links: [] };
      if (!guide) buildGuide(b);
      lastFocus = document.activeElement;
      guide.hidden = false; guideTop(); markGuide(true);
      var sc = guide.querySelector(".mnGuide"); if (sc) sc.scrollTop = 0;
      var bk = $("mnGuideBack"); if (bk) bk.focus();
    });
  }
  var guidePrev = [];
  function markGuide(on) {
    var g = $("menuTabGuide"), menu = $("burgerMenu");
    document.body.classList.toggle("mnGOn", !!on);
    if (on) {
      guidePrev = [];
      if (menu) menu.querySelectorAll('[aria-current="true"]').forEach(function (x) { if (x !== g) { guidePrev.push(x); x.setAttribute("aria-current", "false"); } });
      if (g) g.setAttribute("aria-current", "true");
    } else {
      if (g) g.setAttribute("aria-current", "false");
      guidePrev.forEach(function (x) { if (!menu || !menu.querySelector('[aria-current="true"]')) x.setAttribute("aria-current", "true"); });
      guidePrev = [];
    }
  }
  function closeGuide() {
    if (!guide || guide.hidden) return;
    guide.hidden = true; markGuide(false);
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }


  /* ---------- Impostazioni: riga di scorciatoie ---------- */
  function mountSc() {
    var nav = document.querySelector("#panelOther .stMenu"); if (!nav) return;
    var gym = !!nav.querySelector("[data-gx]");
    var defs = gym
      ? [["cal", "Corsi", '[data-gx="corsi"]'], ["card", "Abbonamenti", '[data-gx="abb"]'], ["clock", "Orari", '[data-gx="orari"]'], ["sun", "Ferie", '[data-gx="chiusure"]'], ["tag", "Piano", '[data-st="subscription"]']]
      : [["tag", "Servizi", '[data-st="services"]'], ["clock", "Orari", '[data-st="hours"]'], ["sun", "Ferie", '[data-st="blocks"]'], ["cli", "Collaboratori", '[data-st="staff"]'], ["card", "Abbonamento", '[data-st="subscription"]']];
    var colors = gym ? [1, 2, 5, 3, 4] : [2, 5, 1, 3, 4], h = "", n = 0;
    defs.forEach(function (d, i) {
      var r = nav.querySelector(d[2]); if (!r || r.style.display === "none") return;
      n++;
      h += '<button type="button" class="mnChip mnK' + colors[i] + '" data-sel=\'' + d[2].replace(/'/g, "") + '\'><span class="mnCi">' + gi(d[0], 19) + "</span>" + d[1] + "</button>";
    });
    var old = nav.querySelector(".mnSc"); if (old) old.remove();
    if (!n) return;
    var box = mk("div", "mnSc", '<span class="mnScL">Vai subito a</span><div class="mnScR">' + h + "</div>");
    box.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-sel]"); if (!b) return;
      var t = nav.querySelector(b.getAttribute("data-sel")); if (t) t.click();
    });
    nav.insertBefore(box, nav.firstChild);
  }
  document.addEventListener("lia:section", function (e) { if (e.detail === "other") { setTimeout(mountSc, 60); setTimeout(mountSc, 600); } });

  /* ---------- avvio ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (guide && !guide.hidden) closeGuide(); else if (sheet && !sheet.hidden) closeSheet();
  });
  function init() {
    try {
      if (!buildMenu()) return;
      var cc = readCache();
      if (cc) { biz = cc; paintMenu(); }
      else {
        var c0 = $("mnShareCard"), mb = document.querySelector(".mainBiz"), nm0 = $("mnBizName");
        if (c0) c0.hidden = false;
        if (nm0 && mb) { var t0 = String(mb.childNodes[0] ? mb.childNodes[0].textContent : mb.textContent).trim(); if (t0) nm0.textContent = t0; }
      }
      load().then(function (b) { if (b) writeCache(b); paintMenu(); });
    } catch (e) { document.body.classList.remove("mnOn"); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
