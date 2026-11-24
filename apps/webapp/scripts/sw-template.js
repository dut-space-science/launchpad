/* Launchpad service worker. Generated into dist/sw.js at build time (scripts/pwa-plugin.ts): the two placeholders below
   are replaced with a version string and the list of files in the build. */
const VERSION = "__VERSION__";
const PRECACHE = `launchpad-precache-${VERSION}`;
const FILES = __PRECACHE__; // paths relative to this file

const scope = self.registration.scope;
const url = (path) => new URL(path, scope).href;
const INDEX = url("index.html");

self.addEventListener("install", (event) => {
  // No skipWaiting here: a page that is already open keeps the files it was built with until the learner chooses to
  // reload (the page sends SKIP_WAITING), so it never asks for a lazy chunk that has been replaced.
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(url(f), { cache: "reload" })))),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("launchpad-precache-") && key !== PRECACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/** Network first, then the stored copy: for files that change without a new file name (the course database). */
async function networkFirst(request) {
  const cache = await caches.open(PRECACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const target = new URL(request.url);
  if (target.origin !== self.location.origin) return; // YouTube and thumbnails go straight to the network

  // The app is one page with hash routes, so every navigation is the same document.
  if (request.mode === "navigate") {
    event.respondWith(
      caches
        .match(INDEX)
        .then((cached) => cached || fetch(request))
        .catch(() => caches.match(INDEX)),
    );
    return;
  }

  // The course database follows the server so new courses arrive; offline, the stored copy is used.
  if (target.pathname.endsWith("/content.sqlite")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Everything else in the build: stored copy first.
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cached) => cached || fetch(request)),
  );
});
