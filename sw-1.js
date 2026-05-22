// ═══════════════════════════════════════════════════════════════
// SERVICE WORKER — Génération A7 v2.1
// Marjane Tanger 08 — Mohamed TARABET
// ═══════════════════════════════════════════════════════════════

const CACHE_NAME = 'a7-v2.1';
const CACHE_STATIC = 'a7-static-v2.1';
const CACHE_FONTS  = 'a7-fonts-v2.1';

// Fichiers à mettre en cache lors de l'installation
const PRECACHE_URLS = [
  './',
  './index.html',
  'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,800;0,900;1,700&family=Barlow:wght@400;500;600&family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.css',
  'https://cdn.jsdelivr.net/npm/remixicon@3.5.0/fonts/remixicon.woff2'
];

// ─── INSTALL ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installation v2.1');
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => {
        // Mise en cache silencieuse : on ignore les erreurs individuelles
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => console.warn('[SW] Cache miss:', url, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ─────────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activation v2.1');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_STATIC && key !== CACHE_FONTS && key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Suppression ancien cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Ne pas intercepter les extensions de navigateur
  if (url.protocol === 'chrome-extension:' || url.protocol === 'moz-extension:') return;

  // Polices Google Fonts → cache-first (elles ne changent pas)
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(cacheFirst(event.request, CACHE_FONTS));
    return;
  }

  // CDN JS/CSS → stale-while-revalidate
  if (url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(staleWhileRevalidate(event.request, CACHE_STATIC));
    return;
  }

  // Fichiers locaux (app HTML/JS/CSS) → network-first avec fallback cache
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event.request, CACHE_STATIC));
    return;
  }
});

// ─── STRATÉGIES DE CACHE ──────────────────────────────────────

// Cache-first : on sert depuis le cache, sinon on va chercher sur le réseau
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] cacheFirst fetch failed:', request.url);
    return new Response('Hors ligne', { status: 503, statusText: 'Service Unavailable' });
  }
}

// Network-first : réseau en priorité, fallback cache
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Hors ligne — servi depuis cache:', request.url);
      return cached;
    }
    // Fallback : retourner index.html pour les navigations SPA
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html') || await caches.match('./');
      if (fallback) return fallback;
    }
    return new Response('Application hors ligne', { status: 503, statusText: 'Offline' });
  }
}

// Stale-while-revalidate : cache immédiat + MAJ en arrière-plan
async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      caches.open(cacheName).then(cache => cache.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}

// ─── MESSAGES (mise à jour) ────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Mise à jour forcée');
    self.skipWaiting();
  }
});
