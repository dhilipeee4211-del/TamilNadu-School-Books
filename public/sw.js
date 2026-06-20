const CACHE_NAME = 'tn-school-book-cache-v1';
const PDF_CACHE_NAME = 'tn-school-book-pdf-cache-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== PDF_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // If fetching a PDF, apply a Cache-First / Cache-and-Update strategy
  if (url.pathname.endsWith('.pdf') || event.request.url.includes('storage/v1/object/public/books')) {
    event.respondWith(
      caches.open(PDF_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached PDF, but update in the background
            fetch(event.request)
              .then((networkResponse) => {
                if (networkResponse.status === 200) {
                  cache.put(event.request, networkResponse);
                }
              })
              .catch(() => {/* Ignore background sync failures offline */});
            return cachedResponse;
          }

          // Fetch from network and cache it
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            // Return generic offline page or error if offline and uncached
            return new Response('PDF is not cached and you are offline.', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' })
            });
          });
        });
      })
    );
    return;
  }

  // Network-first falling back to cache for other dynamic resources
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache dynamic static assets
        if (
          response.status === 200 &&
          event.request.method === 'GET' &&
          (url.pathname.includes('/_next/') || url.pathname.includes('/static/'))
        ) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If offline and accessing pages
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('You are offline.', {
            status: 503,
            statusText: 'Offline',
            headers: new Headers({ 'Content-Type': 'text/plain' })
          });
        });
      })
  );
});
