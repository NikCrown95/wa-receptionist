// api/chat.js  (Lia v5: canale "chat sul sito")
// Un solo file: serve la pagina della chat e riceve i messaggi.
// Link per i clienti: https://TUO-SITO.vercel.app/api/chat?b=SLUG_DELL_ATTIVITA

const { handleMessage, getBusiness } = require("../lib/lia.js");

const PAGE = "<!doctype html>\n<html lang=\"it\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n<meta name=\"robots\" content=\"noindex\">\n<title>Prenota</title>\n<link href=\"https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap\" rel=\"stylesheet\">\n<style>\n:root{\n  --bg:#F6F5F1; --surface:#FFFFFF; --border:#DAD8CF; --text:#141513; --muted:#5B605A;\n  --accent:#6D4AE0; --on-accent:#FFFFFF; --bubble-me:#6D4AE0;\n  box-sizing:border-box;\n  padding-top:env(safe-area-inset-top,0px);\n}\n@media (prefers-color-scheme: dark){\n  :root{\n    --bg:#0E0F12; --surface:#17181D; --border:#2A2C34; --text:#F1F0EA; --muted:#A5A8B3;\n    --accent:#A78BFA; --on-accent:#0E0F12; --bubble-me:#A78BFA;\n  }\n}\nhtml{scroll-padding-top:env(safe-area-inset-top,0px);}\n*{box-sizing:border-box;}\nbody{margin:0;background:var(--bg);color:var(--text);font-family:'DM Sans',system-ui,-apple-system,'Segoe UI',sans-serif;font-size:16px;line-height:1.45;}\nh1{font-family:'Bricolage Grotesque','DM Sans',system-ui,sans-serif;margin:2px 0 0;font-size:24px;line-height:1.15;font-weight:700;letter-spacing:-0.01em;}\n.app{max-width:640px;margin:0 auto;min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;}\n.top{padding:18px 20px 14px;border-bottom:1px solid var(--border);}\n.brand{font-size:14px;font-weight:600;color:var(--accent);}\n.sub{font-size:14px;color:var(--muted);}\nmain{flex:1;padding:18px 20px;display:flex;flex-direction:column;gap:10px;}\n.b{max-width:82%;padding:10px 14px;border-radius:18px;white-space:pre-wrap;overflow-wrap:anywhere;}\n.b.ai{align-self:flex-start;background:var(--surface);border:1px solid var(--border);border-bottom-left-radius:6px;}\n.b.me{align-self:flex-end;background:var(--bubble-me);color:var(--on-accent);border-bottom-right-radius:6px;}\n.b.typing{color:var(--muted);}\n.bar{position:sticky;bottom:0;display:flex;gap:8px;padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px));background:var(--bg);border-top:1px solid var(--border);}\n.bar input{flex:1;min-height:48px;padding:0 16px;border-radius:24px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:inherit;font-size:16px;}\n.bar button{min-width:76px;min-height:48px;padding:0 18px;border:none;border-radius:24px;background:var(--accent);color:var(--on-accent);font-family:inherit;font-size:16px;font-weight:600;cursor:pointer;}\n.bar button:disabled{opacity:0.5;cursor:default;}\n.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);}\n.err{margin:24px 20px;padding:18px;border-radius:16px;border:1px solid var(--accent);}\ninput:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px;}\n</style>\n</head>\n<body>\n<div class=\"app\">\n  <header class=\"top\">\n    <div class=\"brand\">Lia</div>\n    <h1 id=\"biz\">&nbsp;</h1>\n    <div class=\"sub\">Segretaria virtuale · prenota qui</div>\n  </header>\n  <main id=\"msgs\" aria-live=\"polite\"></main>\n  <form class=\"bar\" id=\"form\" autocomplete=\"off\">\n    <label class=\"sr\" for=\"text\">Scrivi un messaggio</label>\n    <input id=\"text\" type=\"text\" maxlength=\"600\" placeholder=\"Scrivi un messaggio…\" enterkeyhint=\"send\">\n    <button type=\"submit\" id=\"send\">Invia</button>\n  </form>\n</div>\n<script>\n(function(){\n  var params = new URLSearchParams(location.search);\n  var slug = (params.get('b') || '').toLowerCase();\n  var msgsEl = document.getElementById('msgs');\n  var form = document.getElementById('form');\n  var input = document.getElementById('text');\n  var sendBtn = document.getElementById('send');\n  var bizEl = document.getElementById('biz');\n  var KEY = 'lia_chat_' + slug;\n  var state = { sid: null, msgs: [] };\n  var busy = false;\n\n  function uuid(){\n    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();\n    var h = '0123456789abcdef', s = '';\n    for (var i = 0; i < 36; i++){\n      if (i === 8 || i === 13 || i === 18 || i === 23) s += '-';\n      else s += h.charAt(Math.floor(Math.random() * 16));\n    }\n    return s;\n  }\n  function load(){\n    try {\n      var raw = localStorage.getItem(KEY);\n      if (raw){ var o = JSON.parse(raw); if (o && o.sid){ state = o; } }\n    } catch (e) {}\n    if (!state.sid) state.sid = uuid();\n  }\n  function save(){\n    try { state.msgs = state.msgs.slice(-40); localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}\n  }\n  function bubble(role, text, extra){\n    var d = document.createElement('div');\n    d.className = 'b ' + role + (extra ? ' ' + extra : '');\n    d.textContent = text;\n    msgsEl.appendChild(d);\n    window.scrollTo(0, document.body.scrollHeight);\n    return d;\n  }\n  function add(role, text){\n    state.msgs.push({r: role, t: text});\n    save();\n    return bubble(role, text);\n  }\n  function fail(text){\n    document.querySelector('.bar').hidden = true;\n    var d = document.createElement('div');\n    d.className = 'err';\n    d.textContent = text;\n    msgsEl.appendChild(d);\n  }\n\n  function start(){\n    load();\n    if (!slug){ fail('Manca il codice dell\\'attività nel link.'); return; }\n    fetch('/api/chat?b=' + encodeURIComponent(slug) + '&info=1').then(function(r){\n      return r.json().then(function(d){ return {ok: r.ok, data: d}; });\n    }).then(function(res){\n      if (!res.ok){ fail('Questo link non è valido. Controlla il QR o il link che hai usato.'); return; }\n      bizEl.textContent = res.data.name;\n      document.title = 'Prenota da ' + res.data.name;\n      if (!state.msgs.length){\n        add('ai', 'Ciao! Sono la segretaria virtuale di ' + res.data.name + '. Come posso aiutarti?');\n      } else {\n        state.msgs.forEach(function(m){ bubble(m.r, m.t); });\n      }\n    }).catch(function(){ fail('Non riesco a collegarmi. Riprova tra poco.'); });\n  }\n\n  form.addEventListener('submit', function(ev){\n    ev.preventDefault();\n    var text = input.value.trim();\n    if (!text || busy) return;\n    busy = true; sendBtn.disabled = true;\n    input.value = '';\n    add('me', text);\n    var typing = bubble('ai', 'Sto scrivendo…', 'typing');\n    fetch('/api/chat', {\n      method: 'POST',\n      headers: {'Content-Type': 'application/json'},\n      body: JSON.stringify({b: slug, s: state.sid, text: text})\n    }).then(function(r){\n      return r.json().then(function(d){ return {ok: r.ok, data: d}; });\n    }).then(function(res){\n      msgsEl.removeChild(typing);\n      if (!res.ok || !res.data.reply){ bubble('ai', 'Scusa, ho avuto un problema. Riprova tra un attimo.'); }\n      else { add('ai', res.data.reply); }\n    }).catch(function(){\n      msgsEl.removeChild(typing);\n      bubble('ai', 'Non riesco a collegarmi. Riprova tra poco.');\n    }).then(function(){\n      busy = false; sendBtn.disabled = false; input.focus();\n    });\n  });\n\n  start();\n})();\n</script>\n</body>\n</html>\n";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const q = req.query || {};

  try {
    // Messaggio del cliente
    if (req.method === "POST") {
      const body = req.body || {};
      const slug = String(body.b || "");
      const sid = String(body.s || "");
      const text = String(body.text || "").trim().slice(0, 600);
      if (!/^[a-z0-9-]{1,60}$/.test(slug) || !/^[0-9a-f-]{36}$/.test(sid) || !text) {
        return res.status(400).json({ error: "Richiesta non valida" });
      }
      const out = await handleMessage({ channel: "web", contactId: "web:" + sid, phone: null, slug: slug, text: text });
      return res.status(200).json({ reply: out.reply || "" });
    }

    // Nome dell'attività (per il titolo della pagina)
    if (q.info === "1") {
      const slug = String(q.b || "");
      if (!/^[a-z0-9-]{1,60}$/.test(slug)) return res.status(404).json({ error: "Link non valido" });
      const biz = await getBusiness(slug);
      if (!biz) return res.status(404).json({ error: "Link non valido" });
      return res.status(200).json({ name: biz.name });
    }

    // La pagina
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(PAGE);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Errore" });
  }
};
