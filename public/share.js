/* public/share.js  (Prenolia: menu laterale rifinito, "Condividi la tua pagina" e "Guida e domande")
   - nel menu burger: identita' dell'attivita', card per condividere link e QR, voce "Guida e domande";
   - foglio "Condividi la tua pagina" (link, QR, WhatsApp, scarica il QR, locandina);
   - pagina "Guida e domande", diversa per le attivita' con appuntamenti e per le palestre.
   Se qualcosa non va, il menu resta quello di prima (le regole grafiche valgono solo con body.mnOn). */
(function () {
  "use strict";
  var token = "";
  try { token = (new URLSearchParams(location.search).get("t") || "").trim(); } catch (e) {}
  if (!token) return;

  var menu = null, biz = null, loading = null, sheet = null, guide = null, cur = 0, lastFocus = null, msgT = null;
  var NEWK = "lia:guide:seen:" + token;

  function $(id) { return document.getElementById(id); }
  function ls(op, k, v) { try { if (op === "g") return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) {} return null; }
  function mk(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function abs(u) { u = String(u || ""); if (!u) return ""; return u.charAt(0) === "/" ? location.origin + u : u; }
  function slug(s) { return String(s || "qr").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "qr"; }

  var S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
  var I = {
    x: '<svg width="18" height="18" viewBox="0 0 24 24" ' + S + ' stroke-width="2.2"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    copy: '<svg width="16" height="16" viewBox="0 0 24 24" ' + S + ' stroke-width="2.3"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg>',
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
    burger: '<svg width="18" height="18" viewBox="0 0 24 24" ' + S + ' stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
  };

  /* ---------- dati dell'attivita' ---------- */
  function getJson(u) {
    return fetch(u, { cache: "no-store" }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok) throw new Error((d && d.error) || "Errore"); return d; }); });
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
    loading = p.then(function (d) {
      var b = (d && d.business) || {};
      var gym = b.business_type === "palestra";
      var o = b.gym_offers || null;
      var res = { name: b.name || "", plan: planLabel(b.plan_name), gym: gym, classes: !gym || !o || o.classes !== false, personal: !gym || !o || o.personal !== false, rental: false, links: [] };
      var main = String(b.public_link || "");
      if (main) res.links.push({ key: "main", seg: gym ? "Prenotazioni" : "Prenota", url: abs(main) });
      if (!gym) return res;
      return getJson("/api/palestra?t=" + encodeURIComponent(token)).then(function (g) {
        var on = !!(g && g.settings && g.settings.rental && g.settings.rental.on);
        var rl = g && g.business && g.business.rental_link;
        if (on && rl) { res.rental = true; res.links.push({ key: "rent", seg: "Affitto sala", url: abs(rl) }); }
        return res;
      }).catch(function () { return res; });
    }).then(function (res) { biz = res; return res; }).catch(function () { loading = null; biz = null; return null; });
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
    var cal = $("menuTabCal"), other = $("menuTabOther");
    if (!menu || !cal || !other || menu.getAttribute("data-mn")) return false;
    menu.setAttribute("data-mn", "1");

    var head = mk("div", "mnHead",
      '<span class="mnLogo"><img src="/lia-a.png" alt="" draggable="false"></span>' +
      '<span class="mnWho"><span class="mnName" id="mnName">La tua attività</span><span class="mnPlan" id="mnPlan" hidden></span></span>' +
      '<button type="button" class="mnX" aria-label="Chiudi il menu">' + I.x + "</button>");
    head.querySelector(".mnX").addEventListener("click", closeMenu);

    var card = mk("div", "mnShare",
      '<button type="button" class="mnShareTop" data-a="open"><span class="mnShareTxt"><b>Condividi la tua pagina</b><span>Il link e il QR per far prenotare i tuoi clienti.</span></span><span class="mnQrGlyph">' + I.qr + "</span></button>" +
      '<div class="mnShareAct"><button type="button" class="mnBtnA" data-a="copy">' + I.copy + "<span>Copia link</span></button>" +
      '<button type="button" class="mnBtnB" data-a="qr"><span>Mostra il QR</span>' + I.chev + "</button></div>");
    card.id = "mnShareCard"; card.hidden = true;
    card.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-a]"); if (!b || !biz || !biz.links.length) return;
      var a = b.getAttribute("data-a");
      if (a === "copy") copyText(biz.links[0].url, b); else openSheet(0);
    });

    var sep = mk("div", "mnSep");
    var g = mk("button", "", I.help + '<span>Guida e domande</span><span class="mnNew">Nuovo</span>');
    g.type = "button"; g.id = "menuTabGuide"; g.setAttribute("role", "menuitem"); g.setAttribute("aria-current", "false");
    g.querySelector("span:first-of-type").style.flex = "1";
    var nw = g.querySelector(".mnNew"); if (ls("g", NEWK)) nw.hidden = true;
    g.addEventListener("click", function () { closeMenu(); openGuide(); });

    menu.insertBefore(head, menu.firstChild);
    menu.insertBefore(card, cal);
    menu.insertBefore(sep, other);
    menu.insertBefore(g, other);
    document.body.classList.add("mnOn");
    return true;
  }
  function paintMenu() {
    var n = $("mnName"), p = $("mnPlan"), c = $("mnShareCard");
    if (n && biz && biz.name) n.textContent = biz.name;
    if (p) { if (biz && biz.plan) { p.textContent = "Piano " + biz.plan; p.hidden = false; } else p.hidden = true; }
    if (c) c.hidden = !(biz && biz.links.length);
  }

  /* ---------- foglio "Condividi la tua pagina" ---------- */
  function buildSheet() {
    sheet = mk("div", "mnLayer");
    sheet.id = "mnShareSheet"; sheet.hidden = true;
    sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-modal", "true"); sheet.setAttribute("aria-labelledby", "mnShT");
    sheet.innerHTML =
      '<button type="button" class="mnScrim" id="mnShareScrim" aria-label="Chiudi"></button>' +
      '<div class="mnSheet"><div class="mnGrab"></div>' +
      '<div class="mnSH"><div><h2 id="mnShT">Condividi la tua pagina</h2><p class="mnSub" id="mnShSub"></p></div><button type="button" class="mnClose" data-a="close" aria-label="Chiudi">' + I.x + "</button></div>" +
      '<div class="mnSeg" role="group" aria-label="Quale link" hidden></div>' +
      '<div class="mnQrCard"><div class="mnQrBox" id="mnQrBox"></div><div class="mnQrInfo"><b id="mnQrName"></b><span id="mnQrHint"></span></div></div>' +
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
  function openSheet(i) {
    closeMenu();
    load().then(function (b) {
      if (!b || !b.links.length) return;
      if (!sheet) buildSheet();
      cur = Math.min(Number(i) || 0, b.links.length - 1);
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

  /* ---------- guida ---------- */
  function faqsFor(b) {
    var link = b.links.length > 0, out = [];
    var HINT = "Menu in alto a destra › Condividi la tua pagina";
    if (!b.gym) {
      if (link) out.push({ id: "link", q: "Dove trovo il mio link e il QR?", a: "Apri il menu in alto a destra e tocca “Condividi la tua pagina”: trovi il link, il QR e i pulsanti per mandarlo ai clienti.", hint: HINT });
      out.push(
        { id: "prenota", q: "Come prenota un mio cliente?", a: "Apre il tuo link o inquadra il QR, sceglie il servizio, il giorno e l’orario, e lascia nome e telefono. Tu ricevi subito la notifica e l’appuntamento compare in calendario." },
        { id: "ferie", q: "Come blocco ferie o giorni di chiusura?", a: "Apri “Impostazioni” dal menu e poi “Chiusure e ferie”. I giorni che segni non saranno prenotabili dai clienti." },
        { id: "orari", q: "Come cambio servizi, prezzi e orari?", a: "Apri “Impostazioni” dal menu: nelle pagine dei servizi e degli orari modifichi tutto. Le modifiche valgono subito anche sulla pagina dei clienti." },
        { id: "lia", q: "Cosa fa Lia?", a: "Lia è l’assistente che risponde ai clienti e li aiuta a prenotare in chat, anche quando sei occupato o l’attività è chiusa." }
      );
      return { faqs: out, steps: [["Servizi e orari", "orari"], ["Condividi il link", "link"], ["Ricevi le prenotazioni", "prenota"]] };
    }
    var who = b.classes && b.personal ? "le lezioni libere e gli orari del Personal" : (b.classes ? "le lezioni libere e i posti rimasti" : "gli orari liberi per il Personal");
    if (link) out.push({ id: "link", q: "Dove trovo il link per far prenotare gli iscritti?", a: "Apri il menu in alto a destra e tocca “Condividi la tua pagina”: trovi il link e il QR da mandare agli iscritti o da stampare per la palestra.", hint: HINT });
    out.push({ id: "iscritto", q: "Come aggiungo un nuovo iscritto?", a: "Vai in Iscritti e tocca “Nuovo iscritto”. Scrivi nome, cognome e telefono e scegli subito l’abbonamento. Solo chi è in elenco può prenotare." });
    if (link) out.push({ id: "prenota", q: "Come prenota un iscritto?", a: "Apre il link e scrive nome, cognome e telefono. Se corrispondono a un iscritto, vede " + who + " e prenota con un tocco." });
    out.push(
      { id: "blocco", q: "Perché un iscritto non riesce a prenotare?", a: "Controlla tre cose nella sua scheda: abbonamento valido, certificato medico non scaduto e ingressi ancora disponibili. Se manca una di queste, la prenotazione è bloccata." },
      { id: "rinnovo", q: "Come rinnovo un abbonamento?", a: "In Iscritti tocca “Rinnova” accanto al nome. La nuova scadenza si aggiorna subito." },
      { id: "cert", q: "Come registro il certificato medico?", a: "Nella scheda dell’iscritto scrivi quando è stato fatto e quando scade. Ti avvisiamo noi prima della scadenza." }
    );
    if (b.classes) {
      out.push({ id: "lezioni", q: "Come creo o cambio le lezioni?", a: "Dal calendario tocca “Programma”: scegli corso, posti e durata, poi giorni e orari. Le lezioni si ripetono ogni settimana finché non le modifichi." });
      out.push({ id: "disdetta", q: "Come gestisco una disdetta?", a: "L’iscritto ti avvisa entro i termini che hai stabilito. Tu apri la lezione e tocca “Togli” accanto al nome: il posto torna libero." });
    }
    if (b.rental) out.push({ id: "sala", q: "Come funziona l’affitto della sala?", a: "Chi vuole affittare la sala usa un link a parte: lo trovi in “Condividi la tua pagina”, nella scheda “Affitto sala”. Sceglie un’ora dopo la chiusura e lascia i suoi dati: tu ricevi una notifica e l’ora si blocca." });
    var steps = [["Aggiungi gli iscritti", "iscritto"]];
    if (b.classes) steps.push(["Imposta le lezioni", "lezioni"]);
    if (link) steps.push(["Condividi il link", "link"]);
    return { faqs: out, steps: steps };
  }
  function buildGuide(b) {
    var d = faqsFor(b);
    guide = mk("div", "mnLayer");
    guide.id = "mnGuide"; guide.hidden = true;
    guide.setAttribute("role", "dialog"); guide.setAttribute("aria-modal", "true"); guide.setAttribute("aria-labelledby", "mnGuideT");
    var steps = d.steps.map(function (s, i) { return '<button type="button" class="mnStep" data-go="' + s[1] + '"><em>' + (i + 1) + "</em><span>" + s[0] + "</span></button>"; }).join("");
    var faq = d.faqs.map(function (f) {
      return '<div class="mnQ" data-id="' + f.id + '"><button type="button" aria-expanded="false"><span>' + f.q + "</span>" + I.down2 + "</button>" +
        '<div class="mnA" hidden><p style="margin:0">' + f.a + "</p>" + (f.hint ? '<div class="mnHint">' + I.burger + "<span>" + f.hint + "</span></div>" : "") + "</div></div>";
    }).join("");
    guide.innerHTML =
      '<div class="mnGuide"><div class="mnGuideIn">' +
      '<div class="mnGH"><button type="button" class="mnBack" id="mnGuideBack" aria-label="Indietro">' + I.back + '</button><h2 id="mnGuideT">Guida e domande</h2></div>' +
      '<label class="mnSearch">' + I.search + '<input type="search" id="mnGuideQ" placeholder="Cerca una domanda" aria-label="Cerca una domanda" autocomplete="off"></label>' +
      '<div id="mnSteps"><p class="mnKick">Per iniziare</p><div class="mnSteps">' + steps + "</div></div>" +
      '<div class="mnFaq" id="mnFaq">' + faq + "</div>" +
      '<p class="mnEmpty" id="mnEmpty" hidden>Nessuna domanda trovata. Prova con un’altra parola.</p>' +
      '<button type="button" class="mnHelp" id="mnHelp">' + I.chat + '<span class="mnT"><b>Non trovi la risposta?</b><small>Scrivici, ti rispondiamo noi</small></span>' + I.chev + "</button>" +
      "</div></div>";
    document.body.appendChild(guide);

    var qs = guide.querySelectorAll(".mnQ");
    function setOpen(q, on) {
      q.classList.toggle("open", on);
      q.querySelector(":scope > button").setAttribute("aria-expanded", on ? "true" : "false");
      q.querySelector(".mnA").hidden = !on;
    }
    guide.querySelector("#mnFaq").addEventListener("click", function (ev) {
      var btn = ev.target.closest(".mnQ > button"); if (!btn) return;
      var q = btn.parentNode, on = !q.classList.contains("open");
      qs.forEach(function (x) { setOpen(x, false); });
      setOpen(q, on);
    });
    guide.querySelector("#mnSteps").addEventListener("click", function (ev) {
      var s = ev.target.closest("[data-go]"); if (!s) return;
      var q = guide.querySelector('.mnQ[data-id="' + s.getAttribute("data-go") + '"]'); if (!q) return;
      qs.forEach(function (x) { setOpen(x, false); });
      setOpen(q, true);
      if (q.scrollIntoView) q.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    guide.querySelector("#mnGuideQ").addEventListener("input", function () {
      var t = this.value.trim().toLowerCase(), n = 0;
      qs.forEach(function (q) {
        var hit = !t || q.textContent.toLowerCase().indexOf(t) >= 0;
        q.hidden = !hit; if (hit) n++;
      });
      guide.querySelector("#mnSteps").hidden = !!t;
      guide.querySelector("#mnEmpty").hidden = n > 0;
    });
    guide.querySelector("#mnGuideBack").addEventListener("click", closeGuide);
    guide.querySelector("#mnHelp").addEventListener("click", function () {
      closeGuide();
      var o = $("menuTabOther"); if (o) o.click();
      setTimeout(function () { if (window.liaSettingsOpen) window.liaSettingsOpen("help"); }, 80);
    });
    if (qs[0]) setOpen(qs[0], true);
  }
  function openGuide() {
    ls("s", NEWK, "1");
    var nw = document.querySelector("#menuTabGuide .mnNew"); if (nw) nw.hidden = true;
    load().then(function (b) {
      b = b || { name: "", plan: "", gym: false, classes: true, personal: true, rental: false, links: [] };
      if (!guide) buildGuide(b);
      lastFocus = document.activeElement;
      guide.hidden = false;
      var sc = guide.querySelector(".mnGuide"); if (sc) sc.scrollTop = 0;
      var bk = $("mnGuideBack"); if (bk) bk.focus();
    });
  }
  function closeGuide() {
    if (!guide || guide.hidden) return;
    guide.hidden = true;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }

  /* ---------- avvio ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (guide && !guide.hidden) closeGuide(); else if (sheet && !sheet.hidden) closeSheet();
  });
  function init() {
    try {
      if (!buildMenu()) return;
      load().then(paintMenu);
    } catch (e) { document.body.classList.remove("mnOn"); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
