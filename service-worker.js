/* Tuition Attendance Manager - offline app shell */
const CACHE_NAME = "tuition-attendance-offline-v1";
const APP_SHELL = [
  new URL("./", self.registration.scope).href,
  new URL("./manifest.json", self.registration.scope).href
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Cache the main app page first; manifest is optional for offline startup.
    await cache.add(APP_SHELL[0]);
    try { await cache.add(APP_SHELL[1]); } catch (error) {
      console.warn("Manifest could not be cached:", error);
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("tuition-attendance-") && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Do not intercept Google sign-in, Drive APIs, or any other external service.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      } catch (error) {
        return (await cache.match(request)) ||
          (await cache.match(new URL("./", self.registration.scope).href)) ||
          new Response("<h1>Offline</h1><p>App page is not available offline yet. Open the app once while connected to the internet.</p>", {
            headers: { "Content-Type": "text/html; charset=utf-8" }, status: 200
          });
      }
    })());
    return;
  }

  // Same-origin files: serve cached copy immediately; save successful network copies.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    } catch (error) {
      return new Response("Offline", { status: 503, statusText: "Offline" });
    }
  })());
});
