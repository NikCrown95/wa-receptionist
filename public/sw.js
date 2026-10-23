// Service worker di Prenolia: serve solo per le notifiche push e per far riconoscere l'app come installabile.
// Non salva pagine in cache: la dashboard si apre sempre aggiornata.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
// Tutto passa dalla rete (la dashboard e' sempre aggiornata). Solo se manca la connessione si mostra una pagina semplice.
var OFFLINE = '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prenolia</title></head>'
  + '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a1a20;color:#e8f1f3;font-family:system-ui,sans-serif;text-align:center;padding:24px">'
  + '<div><img src="/icons/icon-192.png" width="72" height="72" alt="" style="border-radius:18px"><h1 style="font-size:1.25rem;margin:18px 0 8px">Sei offline</h1>'
  + '<p style="margin:0 0 20px;opacity:.75;line-height:1.45">Controlla la connessione e riprova.</p>'
  + '<button onclick="location.reload()" style="font:inherit;font-weight:700;padding:12px 22px;border:0;border-radius:12px;background:#338594;color:#fff">Riprova</button></div></body></html>';
self.addEventListener("fetch", function (e) {
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(function () {
    return new Response(OFFLINE, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }));
});

self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  var title = d.title || "Prenolia";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    tag: d.tag || "prenolia",
    data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (url.indexOf("/admin/") === 0) {
        if (c.url.indexOf("/admin/") !== -1 && "focus" in c) return c.focus().then(function (w) { return w && "navigate" in w ? w.navigate(url) : w; });
      } else if (c.url.indexOf("/api/agenda") !== -1 && "focus" in c) return c.focus();
    }
    return self.clients.openWindow(url);
  }));
});
