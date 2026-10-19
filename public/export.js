/* public/export.js  (Prenolia: Impostazioni › "I tuoi dati")
   Il titolare sceglie cosa esportare, il periodo e il formato (Excel, PDF o CSV) e riceve UN solo file, mai uno ZIP.
   Sostituisce il vecchio pulsante "Scarica i miei dati". Se qualcosa non va, il vecchio pulsante resta com'era. */
(function () {
  "use strict";
  var token = "";
  try { token = (new URLSearchParams(location.search).get("t") || "").trim(); } catch (e) {}
  if (!token) return;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, "."); }

  var FORMATS = [
    { id: "xlsx", name: "Excel", ext: ".XLSX", rec: true, desc: "Un solo file, un foglio per ogni tipo di dato. Si apre anche con Numbers e Fogli Google." },
    { id: "pdf", name: "PDF", ext: ".PDF", desc: "Ordinato e pronto da leggere, stampare o archiviare." },
    { id: "csv", name: "CSV", ext: ".CSV", desc: "Per altri programmi. Contiene una sola tabella: scegline una sopra." }
  ];
  var NAMES = { xlsx: "Excel", pdf: "PDF", csv: "CSV" };
  var ICON_CHECK = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
  var ICON_DOWN = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M5 20h14"/></svg>';
  var ICON_SHARE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3"/><path d="M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 002 2h14a2 2 0 002-2v-7"/></svg>';
  var ICON_LOCK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 118 0v3"/></svg>';

  var root = null, meta = null, loading = false, loadedAt = 0, busy = false, ready = null;
  var S = { sel: {}, fmt: "xlsx", per: "all", from: "", to: "" };

  function selIds() { return (meta ? meta.sections : []).filter(function (s) { return S.sel[s.id]; }).map(function (s) { return s.id; }); }
  function usesPeriod() { return (meta ? meta.sections : []).some(function (s) { return S.sel[s.id] && s.period; }); }
  function periodRows() { return (meta ? meta.sections : []).reduce(function (n, s) { return n + (S.sel[s.id] && s.period ? s.count : 0); }, 0); }
  function range() {
    var r = { from: "", to: "" };
    if (!usesPeriod()) return r;
    if (S.per === "year") { var d = new Date(); d.setFullYear(d.getFullYear() - 1); r.from = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
    else if (S.per === "custom") { r.from = S.from; r.to = S.to; }
    return r;
  }

  function summary() {
    var ids = selIds(), n = ids.length;
    if (!n) return "Scegli almeno un dato da esportare";
    if (S.fmt === "csv") return "Un file CSV · " + meta.sections.filter(function (s) { return s.id === ids[0]; })[0].name;
    return (n === meta.sections.length ? "Tutto" : n + (n === 1 ? " dato" : " dati")) + " · un solo file " + NAMES[S.fmt];
  }

  function render() {
    if (!root) return;
    if (ready) { renderReady(); return; }
    if (!meta) {
      root.innerHTML = '<p class="xpIntro">' + (loading ? "Carico i tuoi dati…" : "Non riusciamo a leggere i tuoi dati in questo momento.") + "</p>" +
        (loading ? "" : '<button type="button" class="xpGhost" data-a="retry">Riprova</button>');
      return;
    }
    var csv = S.fmt === "csv", ids = selIds(), allOn = ids.length === meta.sections.length;
    var h = '<p class="xpIntro">Scegli cosa esportare e in quale formato. Ricevi sempre un solo file, pronto da aprire.</p>';

    h += '<div class="xpBlock"><div class="xpHead"><span class="xpKick">1 · Cosa esporti</span>' + (csv ? "" : '<button type="button" class="xpLink" data-a="all">' + (allOn ? "Deseleziona tutto" : "Seleziona tutto") + "</button>") + "</div><div class=\"xpList\">";
    meta.sections.forEach(function (s) {
      var on = !!S.sel[s.id];
      h += '<button type="button" class="xpRow' + (on ? " on" : "") + '" data-a="sec" data-id="' + esc(s.id) + '" aria-pressed="' + on + '">' +
        '<span class="xpBox' + (csv ? " round" : "") + '">' + (on ? (csv ? '<i class="xpDot"></i>' : ICON_CHECK) : "") + "</span>" +
        '<span class="xpTx"><b>' + esc(s.name) + "</b><small>" + esc(s.desc) + '</small></span><span class="xpCount">' + num(s.count) + "</span></button>";
    });
    h += "</div></div>";

    if (usesPeriod()) {
      h += '<div class="xpBlock"><div class="xpHead"><span class="xpKick">2 · Periodo</span></div><div class="xpSeg" role="group" aria-label="Periodo">';
      [["all", "Tutto lo storico"], ["year", "Ultimo anno"], ["custom", "Scegli date"]].forEach(function (p) {
        h += '<button type="button" data-a="per" data-id="' + p[0] + '" aria-pressed="' + (S.per === p[0]) + '">' + p[1] + "</button>";
      });
      h += "</div>";
      if (S.per === "custom") h += '<div class="xpDates"><label>Dal<input type="date" id="xpFrom" value="' + esc(S.from) + '"></label><label>Al<input type="date" id="xpTo" value="' + esc(S.to) + '"></label></div>';
      h += '<p class="xpNote">Vale per le date degli appuntamenti e delle prenotazioni. Clienti, iscritti, servizi e orari escono sempre per intero.</p></div>';
    }

    h += '<div class="xpBlock"><div class="xpHead"><span class="xpKick">' + (usesPeriod() ? "3" : "2") + " · Formato</span></div><div class=\"xpList\">";
    FORMATS.forEach(function (f) {
      var on = S.fmt === f.id;
      h += '<button type="button" class="xpFmt' + (on ? " on" : "") + '" data-a="fmt" data-id="' + f.id + '" aria-pressed="' + on + '"><span class="xpExt">' + f.ext + '</span><span class="xpTx"><b>' + f.name + (f.rec ? '<em>Consigliato</em>' : "") + "</b><small>" + f.desc + '</small></span><span class="xpRadio">' + (on ? '<i class="xpDot"></i>' : "") + "</span></button>";
    });
    h += "</div>";
    if (S.fmt === "pdf" && periodRows() > 1500) h += '<p class="xpWarn">Con tanti dati il PDF diventa molto lungo (circa ' + num(Math.round(periodRows() / 18)) + ' pagine solo per le prenotazioni). Per avere tutto in modo comodo, meglio Excel.</p>';
    if (S.fmt === "pdf") h += '<p class="xpNote">Il PDF è pensato per essere letto: alcune colonne poco utili restano fuori. Excel e CSV le contengono tutte.</p>';
    h += "</div>";

    h += '<p class="xpPriv">' + ICON_LOCK + "<span>Il file contiene i dati personali dei tuoi " + (meta.type === "gym" ? "iscritti" : "clienti") + ": conservalo con cura.</span></p>";
    h += '<div class="xpFoot"><p class="xpSum" id="xpSum">' + esc(summary()) + '</p><button type="button" class="xpGo" data-a="go"' + (ids.length && !busy ? "" : " disabled") + ">" + ICON_DOWN + "<span>" + (busy ? "Preparo il file…" : "Scarica " + NAMES[S.fmt]) + '</span></button><p class="xpMsg" id="xpMsg" role="status"></p></div>';
    root.innerHTML = h;
  }

  function msg(t, err) { var m = $("xpMsg"); if (m) { m.textContent = t || ""; m.className = "xpMsg" + (err ? " err" : ""); } }

  function renderReady() {
    var r = ready, kb = r.blob.size < 1024 * 1024 ? Math.max(1, Math.round(r.blob.size / 1024)) + " KB" : (r.blob.size / 1048576).toFixed(1).replace(".", ",") + " MB";
    var canShare = false;
    try { canShare = !!(navigator.canShare && navigator.share && navigator.canShare({ files: [r.file] })); } catch (e) {}
    root.innerHTML = '<div class="xpDone"><div class="xpTick">' + ICON_CHECK.replace('width="14" height="14"', 'width="34" height="34"') + '</div><h3>Il tuo file è pronto</h3>' +
      '<p class="xpIntro">' + (canShare ? "Salvalo in File o mandalo dove vuoi." : "Tocca il pulsante per salvarlo sul tuo dispositivo.") + "</p>" +
      '<div class="xpFile"><span class="xpExt">.' + esc(r.ext.toUpperCase()) + '</span><span class="xpTx"><b class="xpName">' + esc(r.name) + "</b><small>" + kb + "</small></span></div>" +
      (canShare ? '<button type="button" class="xpGo" data-a="share">' + ICON_SHARE + "<span>Salva o condividi</span></button>" : '<a class="xpGo" id="xpDl" href="' + r.url + '" download="' + esc(r.name) + '">' + ICON_DOWN + "<span>Scarica il file</span></a>") +
      (canShare ? '<a class="xpGhost" href="' + r.url + '" download="' + esc(r.name) + '">Scarica sul dispositivo</a>' : "") +
      '<button type="button" class="xpGhost" data-a="again">Scarica in un altro formato</button></div>';
  }

  function download() {
    var ids = selIds(); if (!ids.length || busy) return;
    var r = range(), url = location.pathname + "?t=" + encodeURIComponent(token) + "&export=1&fmt=" + S.fmt + "&s=" + encodeURIComponent(ids.join(","));
    if (r.from) url += "&from=" + r.from; if (r.to) url += "&to=" + r.to;
    if (r.from && r.to && r.from > r.to) { msg("La data “Dal” è dopo la data “Al”.", true); return; }
    busy = true; render();
    fetch(url, { cache: "no-store" }).then(function (res) {
      if (!res.ok) return res.json().catch(function () { return {}; }).then(function (j) { throw new Error(j.error || "Non siamo riusciti a preparare il file. Riprova tra poco."); });
      var cd = res.headers.get("Content-Disposition") || "", m = cd.match(/filename="([^"]+)"/);
      return res.blob().then(function (bl) { return { blob: bl, name: m ? m[1] : "prenolia-dati." + S.fmt }; });
    }).then(function (o) {
      var ext = o.name.split(".").pop(), file = null;
      try { file = new File([o.blob], o.name, { type: o.blob.type }); } catch (e) {}
      if (ready && ready.url) try { URL.revokeObjectURL(ready.url); } catch (e) {}
      ready = { blob: o.blob, file: file, name: o.name, ext: ext, url: URL.createObjectURL(o.blob) };
      busy = false; render();
    }).catch(function (e) { busy = false; render(); msg(e.message || "Non siamo riusciti a preparare il file.", true); });
  }

  function onClick(ev) {
    var b = ev.target.closest && ev.target.closest("[data-a]"); if (!b || !root.contains(b)) return;
    var a = b.getAttribute("data-a"), id = b.getAttribute("data-id");
    if (a === "retry") { load(true); return; }
    if (a === "again") { ready = null; render(); return; }
    if (a === "share") {
      if (ready && ready.file) navigator.share({ files: [ready.file], title: ready.name }).catch(function () {});
      return;
    }
    if (a === "go") { download(); return; }
    if (!meta) return;
    if (a === "sec") {
      if (S.fmt === "csv") { meta.sections.forEach(function (s) { S.sel[s.id] = s.id === id; }); }
      else S.sel[id] = !S.sel[id];
    } else if (a === "all") {
      var v = selIds().length !== meta.sections.length; meta.sections.forEach(function (s) { S.sel[s.id] = v; });
    } else if (a === "per") S.per = id;
    else if (a === "fmt") {
      S.fmt = id;
      if (id === "csv") { var first = selIds()[0] || meta.sections[0].id; meta.sections.forEach(function (s) { S.sel[s.id] = s.id === first; }); }
    }
    render();
  }
  function onInput(ev) {
    if (ev.target.id === "xpFrom") S.from = ev.target.value; else if (ev.target.id === "xpTo") S.to = ev.target.value;
  }

  function load(force) {
    if (loading) return;
    if (meta && !force && Date.now() - loadedAt < 60000) return;
    loading = true; if (!meta) render();
    fetch(location.pathname + "?t=" + encodeURIComponent(token) + "&export=1&meta=1", { cache: "no-store" })
      .then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "errore"); return d; }); })
      .then(function (d) {
        var first = !meta;
        meta = d; loadedAt = Date.now();
        if (first) d.sections.forEach(function (s) { S.sel[s.id] = true; });
      })
      .catch(function () { if (!meta) meta = null; })
      .then(function () { loading = false; if (!ready) render(); });
  }

  function init() {
    var card = $("expCard"); if (!card || card.getAttribute("data-xp")) return;
    card.setAttribute("data-xp", "1"); card.classList.remove("stCard"); card.classList.add("xpWrap");
    root = card; root.innerHTML = "";
    root.addEventListener("click", onClick); root.addEventListener("input", onInput); root.addEventListener("change", onInput);
    document.body.classList.add("xpOn");
    render();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { if (es[0] && es[0].isIntersecting) load(); }).observe(card);
    } else load();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
