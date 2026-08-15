// Service Worker for Offline Support
// Enables offline-first experience with caching strategies

const CACHE_VERSION = 'v1';
const CACHE_NAMES = {
  STATIC: `transcend-static-${CACHE_VERSION}`,
  DYNAMIC: `transcend-dynamic-${CACHE_VERSION}`,
  API: `transcend-api-${CACHE_VERSION}`,
  IMAGES: `transcend-images-${CACHE_VERSION}`
};

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAMES.STATIC).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).catch((err) => {
      console.warn('[SW] Static asset caching failed:', err);
    })
  );

  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!Object.values(CACHE_NAMES).includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  self.clients.claim();
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests and non-HTTP(S)
  if (url.origin !== location.origin) {
    return;
  }

  // API requests - network first, fallback to cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, CACHE_NAMES.API));
    return;
  }

  // Image requests - cache first, fallback to network
  if (request.destination === 'image') {
    event.respondWith(cacheFirst(request, CACHE_NAMES.IMAGES));
    return;
  }

  // HTML requests - network first
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request, CACHE_NAMES.DYNAMIC));
    return;
  }

  // CSS, JS, and other assets - cache first
  if (request.destination === 'style' || request.destination === 'script') {
    event.respondWith(cacheFirst(request, CACHE_NAMES.STATIC));
    return;
  }

  // Default - network first
  event.respondWith(networkFirst(request, CACHE_NAMES.DYNAMIC));
});

/**
 * Network first strategy
 * Try network, fallback to cache, fallback to offline page
 */
async function networkFirst(request, cacheName) {
  try {
    // Try network
    const response = await fetch(request);

    // Cache successful responses
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Network failed, try cache
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // No cache, return offline page or error
    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Cache first strategy
 * Try cache, fallback to network
 */
async function cacheFirst(request, cacheName) {
  // Try cache first
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    // Not in cache, try network
    const response = await fetch(request);

    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Network failed
    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * Stale while revalidate strategy
 * Return cached, update in background
 */
async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response && response.status === 200) {
      const cache = caches.open(cacheName);
      cache.then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => {
    return new Response('Offline - Content not available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  });

  return cached || fetchPromise;
}

// Handle messages from clients
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHES':
      event.waitUntil(
        caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          );
        })
      );
      break;

    case 'CACHE_URLS':
      event.waitUntil(
        caches.open(CACHE_NAMES.DYNAMIC).then((cache) => {
          return cache.addAll(payload.urls);
        })
      );
      break;

    case 'GET_CACHE_SIZE':
      event.waitUntil(
        (async () => {
          let size = 0;
          const cacheNames = await caches.keys();
          for (const name of cacheNames) {
            const cache = await caches.open(name);
            const keys = await cache.keys();
            for (const request of keys) {
              const response = await cache.match(request);
              if (response) {
                const blob = await response.blob();
                size += blob.size;
              }
            }
          }
          event.ports[0].postMessage({ size });
        })()
      );
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Handle background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-operations') {
    event.waitUntil(
      fetch('/api/sync/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }).then((response) => {
        if (response.ok) {
          console.log('[SW] Background sync completed');
        }
      }).catch((err) => {
        console.error('[SW] Background sync failed:', err);
        throw err;
      })
    );
  }
});

// Periodic background sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'sync-periodic') {
      event.waitUntil(
        fetch('/api/sync/check', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }).catch((err) => {
          console.log('[SW] Periodic sync unavailable (offline)');
        })
      );
    }
  });
}

console.log('[SW] Service worker loaded');
