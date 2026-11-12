/**
 * KinSprout 2.0 - Service Worker
 * Offline-First PWA Cache & Background Sync Engine
 */

const SHELL_CACHE_NAME = 'kinsprout-shell-v2';
const OCR_CACHE_NAME = 'kinsprout-ocr-v2';

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './css/input-controls.css',
  './css/deep-dive.css',
  './js/growth-engine.js',
  './js/sibling-comparison.js',
  './js/charts.js',
  './js/photo-import.js',
  './js/sync-manager.js',
  './js/input-controls.js',
  './js/deep-dive.js',
  './js/app.js',
  './vendor/qrcode/qrcode.js',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

/**
 * Install event: Pre-cache app shell assets safely
 * Uses Promise.allSettled so missing/in-progress assets never abort PWA installation
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        SHELL_ASSETS.map(async (assetUrl) => {
          try {
            const response = await fetch(assetUrl, { cache: 'no-cache' });
            if (response && (response.ok || response.type === 'opaque')) {
              await cache.put(assetUrl, response);
            }
          } catch (e) {
            // Non-critical asset load failure during staging; continue
          }
        })
      );
    })
  );
});

/**
 * Activate event: Clean up legacy caches and claim clients immediately
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== SHELL_CACHE_NAME && key !== OCR_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * Fetch event:
 * 1. STRICT BYPASS for API, ntfy.sh, Cloudflare Workers, and non-GET requests.
 * 2. On-demand cache for /vendor/tesseract/ assets in kinsprout-ocr-v2.
 * 3. Stale-while-revalidate / cache-first for local static assets.
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') {
    return;
  }

  const url = new URL(req.url);

  // STRICT BYPASS: Never intercept or cache cross-origin requests, API sync requests, or cloud relay traffic
  if (
    url.origin !== self.location.origin ||
    url.pathname.includes('/api/') ||
    url.hostname.includes('ntfy.sh') ||
    url.hostname.includes('workers.dev') ||
    url.pathname.endsWith('/stream') ||
    req.headers.get('Accept') === 'text/event-stream'
  ) {
    return;
  }

  // Tier 2: OCR Assets (/vendor/tesseract/) -> Cache-First On-Demand in OCR_CACHE_NAME
  if (url.pathname.includes('/vendor/tesseract/')) {
    event.respondWith(
      caches.open(OCR_CACHE_NAME).then(async (ocrCache) => {
        const cached = await ocrCache.match(req);
        if (cached) return cached;
        try {
          const networkRes = await fetch(req);
          if (networkRes && (networkRes.ok || networkRes.type === 'opaque')) {
            ocrCache.put(req, networkRes.clone());
          }
          return networkRes;
        } catch (err) {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // Tier 1: App Shell & Static Assets -> Cache-First with Background Revalidation
  event.respondWith(
    caches.open(SHELL_CACHE_NAME).then(async (shellCache) => {
      const cached = await shellCache.match(req);

      const fetchPromise = fetch(req).then((networkRes) => {
        if (networkRes && networkRes.ok) {
          shellCache.put(req, networkRes.clone());
        }
        return networkRes;
      }).catch(() => null);

      if (cached) {
        // Revalidate in background
        event.waitUntil(fetchPromise);
        return cached;
      }

      // If not in cache, wait for network
      const networkRes = await fetchPromise;
      if (networkRes) return networkRes;

      // Fallback to index.html for navigation requests
      if (req.mode === 'navigate') {
        const indexCached = await shellCache.match('./index.html') || await shellCache.match('./');
        if (indexCached) return indexCached;
      }

      return Response.error();
    })
  );
});
