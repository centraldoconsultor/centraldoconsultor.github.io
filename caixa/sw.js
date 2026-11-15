/* Central do Consultor — service worker da Caixa (avisos no celular) v1 */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { corpo: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Central do Consultor", {
    body: d.corpo || "", tag: d.tag || "central", renotify: true,
    icon: "/img/apple-touch-icon.png", badge: "/img/apple-touch-icon.png",
    data: { url: d.url || "/caixa/" }
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var alvo = new URL((e.notification.data && e.notification.data.url) || "/caixa/", self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (lista) {
    for (var i = 0; i < lista.length; i++) { if (lista[i].url.indexOf("/caixa/") >= 0 && "focus" in lista[i]) { lista[i].navigate(alvo).catch(function(){}); return lista[i].focus(); } }
    return self.clients.openWindow(alvo);
  }));
});
