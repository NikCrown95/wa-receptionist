// Service worker di Prenolia: serve solo per le notifiche push e per far riconoscere l'app come installabile.
// Non salva pagine in cache: la dashboard si apre sempre aggiornata.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function () { /* tutto passa dalla rete */ });

self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  var title = d.title || "Prenolia";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
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
      if (c.url.indexOf("/api/agenda") !== -1 && "focus" in c) return c.focus();
    }
    return self.clients.openWindow(url);
  }));
});
