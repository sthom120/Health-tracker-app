// service-worker.js

/* ============================================================
   Personal Health Tracker – Service Worker (dev-friendly)
   ============================================================
   Strategy:
   - HTML: network-first (so changes show up quickly)
   - CSS/JS/Images: stale-while-revalidate (fast + updates in background)

   NOTE TO SELF:
   If you make changes and want to force-refresh caches,
   bump CACHE_VERSION (e.g., v4).
   ============================================================ */

const CACHE_VERSION = "v3";
const CACHE_NAME = `health-tracker-${CACHE_VERSION}`;

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./track.html",
  "./view.html",
  "./pin-lock.html",

  "./style.css",

  // JS modules (new structure)
  "./js/index.js",
  "./js/track.js",
  "./js/view.js",
  "./js/storage.js",
  "./js/charts.js",
  "./js/exportImport.js",

  // PIN screen script
  "./pin-lock.js",

  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// ---------- Install ----------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );

  // Activate updated SW sooner (especially helpful after version bumps)
  self.skipWaiting();
});

// ---------- Activate ----------
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );

  // Take control of any open pages immediately
  self.clients.claim();
});

// ---------- Fetch helpers ----------
async function networkFirst(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((fresh) => {
      caches.open(CACHE_NAME).then((cache) => cache.put(request, fresh.clone()));
      return fresh;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || Response.error();
}

// ---------- Fetch ----------
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only cache GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // HTML: network-first (best for development + content updates)
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets: stale-while-revalidate
  const isAsset =
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font";

  if (isAsset) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // Default: network-first
  event.respondWith(networkFirst(request));
});

// ---------- Optional: allow pages to tell SW to skip waiting ----------
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
