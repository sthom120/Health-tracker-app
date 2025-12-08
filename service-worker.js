// service-worker.js

const CACHE_NAME = "health-tracker-v2"; // bump version to bust old cache

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./track.html",
  "./view.html",
  "./pin-lock.html",
  "./style.css",
  "./main.js",
  "./pin-lock.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Install event
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  console.log("Service Worker installed (v2).");
});

// Activate event
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  console.log("Service Worker activated (v2).");
});

// Fetch event – cache-first
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
