// Debris Surge — Service Worker
// FIX v341: este archivo reemplaza al SW que antes se generaba con un Blob
// (los navegadores no permiten registrar Service Workers desde blob: URLs —
// solo desde un archivo .js real del mismo origen). Antes también tenía la
// URL de GitHub Pages hardcodeada (BASE="https://nyxarion-ctrl.github.io/..."),
// lo que rompía la caché si se probaba en localhost o se cambiaba de dominio.
// Ahora usa rutas relativas y compara por origen, así funciona igual en
// localhost, GitHub Pages, o cualquier otro dominio donde se suba el juego.
const CACHE_NAME = "debris-surge-v2.90";
const ASSETS = ['./', './index.html'];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Solo cachear peticiones del MISMO ORIGEN que el SW (sustituye al chequeo
  // de "startsWith('https://nyxarion-ctrl.github.io')" que antes rompía todo
  // fuera de ese dominio exacto, incluyendo localhost durante pruebas).
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.ok) {
        const c = r.clone();
        caches.open(CACHE_NAME).then(ca => ca.put(e.request, c)).catch(() => {});
      }
      return r;
    }).catch(() => caches.match(e.request).then(c => c || new Response("Offline", { status: 503 })))
  );
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});
