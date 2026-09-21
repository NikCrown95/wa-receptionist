// api/agenda.js  (Lia: agenda del titolare)
// Un solo file: serve sia la pagina (HTML) sia i dati (JSON).
// Link di accesso: https://TUO-SITO.vercel.app/api/agenda?t=CODICE_SEGRETO
// Variabili su Vercel: SUPABASE_URL, SUPABASE_SECRET_KEY.

const PAGE = "<!doctype html>\n<html lang=\"it\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<meta name=\"robots\" content=\"noindex\">\n<title>Agenda</title>\n<link href=\"https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap\" rel=\"stylesheet\">\n<style>\n:root{\n  --bg:#F6F5F1; --surface:#FFFFFF; --surface2:#EDEBE4; --border:#DAD8CF;\n  --text:#141513; --muted:#5B605A; --accent:#6D4AE0; --on-accent:#FFFFFF; --danger:#B42318;\n  box-sizing:border-box;\n  padding-top:env(safe-area-inset-top,0px);\n  padding-bottom:env(safe-area-inset-bottom,0px);\n}\n@media (prefers-color-scheme: dark){\n  :root{\n    --bg:#0E0F12; --surface:#17181D; --surface2:#24262E; --border:#2A2C34;\n    --text:#F1F0EA; --muted:#A5A8B3; --accent:#A78BFA; --on-accent:#0E0F12; --danger:#FF8A80;\n  }\n}\nhtml{scroll-padding-top:env(safe-area-inset-top,0px);}\n*{box-sizing:border-box;}\nbody{margin:0;background:var(--bg);color:var(--text);font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.5;}\nh1,h2{font-family:'Bricolage Grotesque','DM Sans',system-ui,sans-serif;margin:0;letter-spacing:-0.01em;}\nbutton{font-family:inherit;font-size:16px;color:inherit;cursor:pointer;}\n.wrap{max-width:640px;margin:0 auto;padding:20px 20px 60px;}\n.head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:20px;}\n.brand{font-size:14px;color:var(--muted);font-weight:500;}\nh1{font-size:30px;line-height:1.1;font-weight:700;margin-top:4px;}\n.refresh{min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--border);background:var(--surface);font-weight:500;}\n.tabs{display:flex;gap:6px;padding:4px;border-radius:14px;background:var(--surface);border:1px solid var(--border);margin-bottom:24px;}\n.tab{flex:1;min-height:44px;border:none;border-radius:10px;background:transparent;color:var(--muted);font-weight:600;}\n.tab[aria-selected=\"true\"]{background:var(--accent);color:var(--on-accent);}\n.day{margin:0 0 10px;font-size:18px;font-weight:700;text-transform:capitalize;}\n.day-block{margin-bottom:26px;}\n.card{border-radius:16px;border:1px solid var(--border);background:var(--surface);padding:16px;margin-bottom:10px;display:flex;flex-direction:column;gap:6px;}\n.time{font-family:'Bricolage Grotesque','DM Sans',sans-serif;font-size:22px;font-weight:700;}\n.who{font-size:17px;font-weight:600;}\n.meta{font-size:15px;color:var(--muted);}\n.meta a{color:var(--accent);text-decoration:none;font-weight:600;}\n.actions{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;}\n.btn{min-height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--border);background:transparent;font-weight:600;}\n.btn.danger{color:var(--danger);border-color:var(--danger);}\n.btn.solid{background:var(--danger);color:var(--bg);border-color:var(--danger);}\n.empty{padding:36px 16px;text-align:center;color:var(--muted);border:1px dashed var(--border);border-radius:16px;}\n.msg{font-size:14px;color:var(--muted);text-align:center;margin-top:8px;min-height:20px;}\n.err{padding:20px;border-radius:16px;border:1px solid var(--danger);color:var(--danger);}\nbutton:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}\n[hidden]{display:none !important;}\n</style>\n</head>\n<body>\n<div class=\"wrap\">\n  <div class=\"head\">\n    <div>\n      <div class=\"brand\">Agenda</div>\n      <h1 id=\"biz\">&nbsp;</h1>\n    </div>\n    <button class=\"refresh\" id=\"refresh\" type=\"button\">Aggiorna</button>\n  </div>\n  <div class=\"tabs\" role=\"tablist\" aria-label=\"Periodo\" id=\"tabs\">\n    <button class=\"tab\" role=\"tab\" data-view=\"oggi\" aria-selected=\"true\">Oggi</button>\n    <button class=\"tab\" role=\"tab\" data-view=\"domani\" aria-selected=\"false\">Domani</button>\n    <button class=\"tab\" role=\"tab\" data-view=\"settimana\" aria-selected=\"false\">Settimana</button>\n  </div>\n  <div id=\"list\" aria-live=\"polite\"></div>\n  <div class=\"msg\" id=\"msg\"></div>\n</div>\n<script>\n(function(){\n  var token = new URLSearchParams(location.search).get('t') || '';\n  var VIEWS = { oggi: {offset: 0, days: 1}, domani: {offset: 1, days: 1}, settimana: {offset: 0, days: 7} };\n  var view = 'oggi';\n  var tz = 'Europe/Rome';\n  var pending = null;\n  var lastData = null;\n  var listEl = document.getElementById('list');\n  var msgEl = document.getElementById('msg');\n  var bizEl = document.getElementById('biz');\n  var tabsEl = document.getElementById('tabs');\n\n  function el(tag, cls, text){\n    var e = document.createElement(tag);\n    if (cls) e.className = cls;\n    if (text != null) e.textContent = text;\n    return e;\n  }\n\n  function fmtTime(iso){\n    return new Intl.DateTimeFormat('it-IT', {hour:'2-digit', minute:'2-digit', timeZone: tz}).format(new Date(iso));\n  }\n  function dayKey(iso){\n    return new Intl.DateTimeFormat('en-CA', {timeZone: tz}).format(new Date(iso));\n  }\n  function dayTitle(iso){\n    return new Intl.DateTimeFormat('it-IT', {weekday:'long', day:'numeric', month:'long', timeZone: tz}).format(new Date(iso));\n  }\n\n  function showError(text){\n    tabsEl.hidden = true;\n    document.getElementById('refresh').hidden = true;\n    listEl.textContent = '';\n    listEl.appendChild(el('div', 'err', text));\n  }\n\n  function render(){\n    listEl.textContent = '';\n    var apps = (lastData && lastData.appointments) || [];\n    if (!apps.length){\n      var label = view === 'oggi' ? 'oggi' : (view === 'domani' ? 'domani' : 'questa settimana');\n      listEl.appendChild(el('div', 'empty', 'Nessun appuntamento ' + label + '.'));\n      return;\n    }\n    var resources = {};\n    apps.forEach(function(a){ if (a.resource) resources[a.resource] = true; });\n    var showResource = Object.keys(resources).length > 1;\n\n    var currentKey = null;\n    var block = null;\n    apps.forEach(function(a){\n      var k = dayKey(a.starts_at);\n      if (k !== currentKey){\n        currentKey = k;\n        block = el('div', 'day-block');\n        block.appendChild(el('h2', 'day', dayTitle(a.starts_at)));\n        listEl.appendChild(block);\n      }\n      var card = el('div', 'card');\n      card.appendChild(el('div', 'time', fmtTime(a.starts_at) + ' – ' + fmtTime(a.ends_at)));\n      card.appendChild(el('div', 'who', a.customer_name));\n      var line = [];\n      if (a.service) line.push(a.service);\n      if (showResource && a.resource) line.push(a.resource);\n      if (line.length) card.appendChild(el('div', 'meta', line.join(' · ')));\n\n      if (a.customer_phone && /^[0-9+ ]{5,20}$/.test(a.customer_phone)){\n        var m = el('div', 'meta');\n        var link = el('a', null, a.customer_phone);\n        link.href = 'tel:' + a.customer_phone.replace(/ /g, '');\n        m.appendChild(link);\n        card.appendChild(m);\n      }\n      if (a.customer_address) card.appendChild(el('div', 'meta', 'Indirizzo: ' + a.customer_address));\n      if (a.notes) card.appendChild(el('div', 'meta', 'Note: ' + a.notes));\n\n      var actions = el('div', 'actions');\n      if (pending === a.id){\n        var yes = el('button', 'btn solid', 'Sì, annulla');\n        yes.type = 'button';\n        yes.addEventListener('click', function(){ cancelAppt(a.id); });\n        var no = el('button', 'btn', 'No, tieni');\n        no.type = 'button';\n        no.addEventListener('click', function(){ pending = null; render(); });\n        actions.appendChild(yes);\n        actions.appendChild(no);\n      } else {\n        var del = el('button', 'btn danger', 'Annulla appuntamento');\n        del.type = 'button';\n        del.addEventListener('click', function(){ pending = a.id; render(); });\n        actions.appendChild(del);\n      }\n      card.appendChild(actions);\n      block.appendChild(card);\n    });\n  }\n\n  function load(){\n    var v = VIEWS[view];\n    var url = '/api/agenda?t=' + encodeURIComponent(token) + '&format=json&offset=' + v.offset + '&days=' + v.days;\n    fetch(url).then(function(r){\n      return r.json().then(function(d){ return {ok: r.ok, status: r.status, data: d}; });\n    }).then(function(res){\n      if (res.status === 404){ showError('Questo link non è valido. Chiedi il link giusto a chi gestisce il servizio.'); return; }\n      if (!res.ok){ msgEl.textContent = 'Non riesco ad aggiornare. Riprova tra poco.'; return; }\n      lastData = res.data;\n      tz = res.data.timezone || tz;\n      bizEl.textContent = res.data.business;\n      document.title = 'Agenda – ' + res.data.business;\n      render();\n      msgEl.textContent = 'Aggiornato alle ' + fmtTime(new Date().toISOString());\n    }).catch(function(){\n      msgEl.textContent = 'Nessuna connessione. Riprova tra poco.';\n    });\n  }\n\n  function cancelAppt(id){\n    msgEl.textContent = 'Annullo…';\n    fetch('/api/agenda?t=' + encodeURIComponent(token), {\n      method: 'POST',\n      headers: {'Content-Type': 'application/json'},\n      body: JSON.stringify({id: id})\n    }).then(function(r){ return r.json().then(function(d){ return {ok: r.ok, data: d}; }); })\n    .then(function(res){\n      pending = null;\n      if (!res.ok){ msgEl.textContent = 'Non sono riuscito ad annullare. Riprova.'; render(); return; }\n      load();\n    }).catch(function(){\n      pending = null;\n      msgEl.textContent = 'Nessuna connessione. Riprova.';\n      render();\n    });\n  }\n\n  var tabs = tabsEl.querySelectorAll('.tab');\n  for (var i = 0; i < tabs.length; i++){\n    tabs[i].addEventListener('click', function(){\n      view = this.getAttribute('data-view');\n      pending = null;\n      for (var j = 0; j < tabs.length; j++){\n        tabs[j].setAttribute('aria-selected', tabs[j] === this ? 'true' : 'false');\n      }\n      load();\n    });\n  }\n  document.getElementById('refresh').addEventListener('click', load);\n  setInterval(function(){ if (!pending) load(); }, 60000);\n  if (!token){ showError('Manca il codice nel link.'); } else { load(); }\n})();\n</script>\n</body>\n</html>\n";

function sbHeaders(extra) {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const h = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) h.Authorization = "Bearer " + key;
  return Object.assign(h, extra || {});
}

async function sb(method, path, body, prefer) {
  const res = await fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, {
    method: method,
    headers: sbHeaders(prefer ? { Prefer: prefer } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = text;
  }
  return { ok: res.ok, status: res.status, data: data };
}

function tzOffsetMs(utcMs, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) - utcMs;
}

function zonedTimeToUtc(dateStr, timeStr, tz) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(guess, tz);
  let utc = guess - off1;
  const off2 = tzOffsetMs(utc, tz);
  if (off2 !== off1) utc = guess - off2;
  return new Date(utc);
}

function todayStr(tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

async function getBusinessByToken(token) {
  if (!/^[a-f0-9]{32,128}$/.test(token)) return null;
  const r = await sb("GET", "businesses?agenda_token=eq." + token + "&active=eq.true&select=id,name,timezone");
  if (!r.ok || !Array.isArray(r.data) || !r.data.length) return null;
  return r.data[0];
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Referrer-Policy", "no-referrer");

  const q = req.query || {};
  const wantsData = req.method === "POST" || q.format === "json";

  // 1) La pagina
  if (!wantsData) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(PAGE);
  }

  try {
    // 2) I dati: serve il codice segreto
    const biz = await getBusinessByToken(String(q.t || ""));
    if (!biz) return res.status(404).json({ error: "Link non valido" });
    const tz = biz.timezone || "Europe/Rome";

    // Annullare un appuntamento
    if (req.method === "POST") {
      const id = String((req.body || {}).id || "");
      if (!/^[0-9a-f-]{36}$/.test(id)) return res.status(400).json({ error: "Richiesta non valida" });
      const r = await sb(
        "PATCH",
        "appointments?id=eq." + id + "&business_id=eq." + biz.id + "&status=eq.confirmed",
        { status: "cancelled" },
        "return=representation"
      );
      if (!r.ok || !Array.isArray(r.data) || !r.data.length) return res.status(404).json({ error: "Appuntamento non trovato" });
      return res.status(200).json({ ok: true });
    }

    // Leggere l'agenda
    const today = todayStr(tz);
    const offset = Math.min(Math.max(parseInt(q.offset || "0", 10) || 0, 0), 60);
    const days = Math.min(Math.max(parseInt(q.days || "1", 10) || 1, 1), 14);
    const date = addDays(today, offset);
    const start = zonedTimeToUtc(date, "00:00", tz);
    const end = zonedTimeToUtc(addDays(date, days), "00:00", tz);

    const r = await sb(
      "GET",
      "appointments?business_id=eq." + biz.id +
        "&status=eq.confirmed" +
        "&starts_at=gte." + encodeURIComponent(start.toISOString()) +
        "&starts_at=lt." + encodeURIComponent(end.toISOString()) +
        "&order=starts_at.asc" +
        "&select=id,starts_at,ends_at,customer_name,customer_phone,customer_address,notes,services(name),resources(name)"
    );
    if (!r.ok || !Array.isArray(r.data)) return res.status(500).json({ error: "Errore nella lettura dell'agenda" });

    return res.status(200).json({
      business: biz.name,
      timezone: tz,
      today: today,
      date: date,
      days: days,
      appointments: r.data.map((a) => ({
        id: a.id,
        starts_at: a.starts_at,
        ends_at: a.ends_at,
        customer_name: a.customer_name,
        customer_phone: a.customer_phone,
        customer_address: a.customer_address,
        notes: a.notes,
        service: a.services ? a.services.name : null,
        resource: a.resources ? a.resources.name : null,
      })),
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Errore" });
  }
};
