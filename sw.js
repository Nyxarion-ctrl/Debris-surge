// Debris Surge — Service Worker
// FIX v341: este archivo reemplaza al SW que antes se generaba con un Blob
// (los navegadores no permiten registrar Service Workers desde blob: URLs —
// solo desde un archivo .js real del mismo origen). Antes también tenía la
// URL de GitHub Pages hardcodeada (BASE="https://nyxarion-ctrl.github.io/..."),
// lo que rompía la caché si se probaba en localhost o se cambiaba de dominio.
// Ahora usa rutas relativas y compara por origen, así funciona igual en
// localhost, GitHub Pages, o cualquier otro dominio donde se suba el juego.
// FIX v2: estrategia de fetch cambiada de network-first a stale-while-revalidate
// (ver abajo) — antes el SW cacheaba todo pero nunca lo usaba para responder
// más rápido en partidas siguientes, solo como respaldo offline. Se bumpea el
// nombre de cache para forzar un precache limpio bajo la nueva estrategia.
const CACHE_NAME = "debris-surge-v2.91";
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
  // FIX v2: stale-while-revalidate — antes era network-first, así que el SW
  // guardaba todo en cache pero SIEMPRE esperaba la red antes de responder,
  // sin ninguna mejora real de velocidad en partidas siguientes (solo servía
  // como respaldo offline). Ahora, si hay una copia en cache, se responde con
  // ella al instante (carga casi inmediata) y la actualización de red corre
  // en paralelo en segundo plano (via waitUntil) para que la PRÓXIMA carga
  // ya tenga la versión más nueva. Si no hay nada en cache todavía (primera
  // visita), se espera la red como antes.
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(r => {
        if (r && r.ok) {
          const c = r.clone();
          caches.open(CACHE_NAME).then(ca => ca.put(e.request, c)).catch(() => {});
        }
        return r;
      }).catch(() => undefined);
      if (cached) {
        e.waitUntil(networkFetch);
        return cached;
      }
      return networkFetch.then(r => r || new Response("Offline", { status: 503 }));
    })
  );
});

self.addEventListener("message", e => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});
