const CACHE_NAME = "tecnobase-shell-v1";
const SHELL = ["./", "./index.html", "./style.css", "./script.js", "./supabase.js", "./push-config.js", "./manifest.webmanifest", "./assets/pwa-192.png", "./assets/pwa-512.png", "./assets/tecnobase-logo.jpeg"];
self.addEventListener("install", event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("tecnobase-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Never cache Supabase/Auth/REST or third-party requests: they may contain private or changing data.
  if (url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response.ok && response.type === "basic") { const copy = response.clone(); caches.open(CACHE_NAME).then(cache => cache.put(request, copy)); }
    return response;
  }).catch(async () => (await caches.match(request)) || (request.mode === "navigate" ? caches.match("./index.html") : Response.error())));
});
self.addEventListener("push", event => {
  let data = {}; try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data?.text() || "Você tem um lembrete TECNOBASE." }; }
  event.waitUntil(self.registration.showNotification(data.title || "Lembrete TECNOBASE", { body: data.body || "Uma tarefa chegou ao horário do lembrete.", icon: "./assets/pwa-192.png", badge: "./assets/pwa-192.png", tag: data.tag || "tecnobase-task", data: { url: data.url || "./" }, requireInteraction: true }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async clients => {
    const match = clients.find(client => client.url.startsWith(self.registration.scope));
    if (match) { match.postMessage({ type: "OPEN_TASKS" }); return match.focus(); }
    const opened = await self.clients.openWindow(target);
    opened?.postMessage({ type: "OPEN_TASKS" });
    return opened;
  }));
});
