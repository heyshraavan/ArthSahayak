/**
 * ArthSahayak Offline Application Shell Service Worker
 *
 * CACHING STRATEGY:
 * - Versioned caches: SHELL_CACHE for application shell/identity, ASSETS_CACHE for hashed bundles.
 * - Pre-caches core shell assets on install.
 * - Navigation: Network-First with fallback to cached /index.html.
 * - Hashed Assets (/assets/*.js, /assets/*.css): Cache-First with runtime network population.
 * - Static Assets (icons, manifest): Cache-First with network fallback.
 * - API Calls (/finance, /voice, /ocr, /health, cross-origin, non-GET): NEVER cached (network-only).
 * - Activation: Deletes any obsolete cache versions.
 */

const CACHE_VERSION = 'v2';
const SHELL_CACHE = `arthsahayak-shell-${CACHE_VERSION}`;
const ASSETS_CACHE = `arthsahayak-assets-${CACHE_VERSION}`;
const EXPECTED_CACHES = [SHELL_CACHE, ASSETS_CACHE];

const STATIC_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/favicon.svg',
  '/icons.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(STATIC_SHELL_ASSETS))
      .catch((err) => {
        console.warn('Pre-caching static shell assets encountered an error:', err);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !EXPECTED_CACHES.includes(key))
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // 1. Only intercept GET requests. POST/PUT/DELETE requests are never cached.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 2. Ignore cross-origin requests (e.g. backend at different port or external CDNs)
  if (url.origin !== self.location.origin) return;

  // 3. Explicitly ignore backend API routes (financial calculation, voice, OCR, health)
  const isApiRoute =
    url.pathname.startsWith('/finance') ||
    url.pathname.startsWith('/voice') ||
    url.pathname.startsWith('/ocr') ||
    url.pathname.startsWith('/health') ||
    url.pathname.startsWith('/api');

  if (isApiRoute) return;

  // 4. Navigation requests (HTML shell): Network-First with cached /index.html fallback
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // 5. Hashed assets (/assets/*.js, /assets/*.css): Cache-First with runtime network caching
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(ASSETS_CACHE).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 6. Other same-origin static assets (manifest, icons, logo): Cache-First with network fallback
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(SHELL_CACHE).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return networkResponse;
      });
    })
  );
});
