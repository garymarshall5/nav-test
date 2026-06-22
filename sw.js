const CACHE_NAME = 'almanac-cache-v1';

// Core local assets to cache immediately
const PRECACHE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './icon-192x192.png',
    './icon-512x512.png'
];

// Install Event: Pre-cache local assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate Event: Clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch Event: Stale-While-Revalidate for static assets, Network-Only for APIs
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Bypass caching for live weather and marine APIs so they don't get stuck on old data
    if (url.hostname.includes('api.open-meteo.com') || url.hostname.includes('marine-api')) {
        return; 
    }

    // Bypass caching for map tiles to prevent bloating the device storage
    if (url.hostname.includes('cartocdn.com') || url.hostname.includes('openseamap.org')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // Return cached response immediately if available
            if (cachedResponse) {
                // Fetch fresh version in the background to update the cache for next time
                fetch(event.request).then(networkResponse => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, networkResponse.clone());
                        });
                    }
                }).catch(() => { /* Ignore background fetch errors (e.g., offline) */ });
                
                return cachedResponse;
            }

            // If not in cache, fetch from network and cache it
            return fetch(event.request).then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Optional: Return a specific offline fallback page here if navigating
            });
        })
    );
});
