/**
 * service-worker.js — Offline caching for Ramadhan Tracker
 *
 * Strategy: Cache-First with network fallback.
 * All core assets are pre-cached on install.
 */

const CACHE_NAME = 'ramadhan-tracker-v5';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './app.js',
  './storage.js',
  './checklist.csv',
  './manifest.json',
  './icon.svg',
  './style.css',
  './vue.esm-browser.js',
];

/* ── Install: pre-cache all assets ───────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

/* ── Activate: remove old cache versions ─────────────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/* ── Fetch: serve from cache, fall back to network ───────────────── */
self.addEventListener('fetch', (event) => {
  // Only handle GET requests for same-origin or cached CDN assets
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cache successful same-origin responses
        if (
          response.ok &&
          event.request.url.startsWith(self.location.origin)
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    }),
  );
});
