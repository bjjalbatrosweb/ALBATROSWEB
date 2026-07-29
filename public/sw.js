const STATIC_CACHE = 'albatros-static-v2';
const STATIC_ASSETS = ['/', '/manifest.webmanifest', '/milogo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('albatros-') && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith('albatros-'))
              .map((key) => caches.delete(key)),
          ),
        ),
    );
  }
});

async function trimCache(cacheName, maximumEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const excess = keys.length - maximumEntries;

  if (excess > 0) {
    await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/')),
    );
    return;
  }

  if (
    url.pathname.startsWith('/_next/static/') ||
    /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then(async (cache) => {
                await cache.put(request, copy);
                await trimCache(STATIC_CACHE, 80);
              });
            }
            return response;
          }),
      ),
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const destination =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : '/admin/dashboard';
  const destinationUrl = new URL(destination, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ('focus' in client) {
            if ('navigate' in client) {
              client.navigate(destinationUrl);
            }
            return client.focus();
          }
        }

        return self.clients.openWindow
          ? self.clients.openWindow(destinationUrl)
          : undefined;
      }),
  );
});

// Deja preparada la PWA para notificaciones push futuras. La mejora actual
// funciona de forma local y no necesita servidor ni servicios de pago.
self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  event.waitUntil(
    self.registration.showNotification(
      payload.title || 'ALBATROS',
      {
        body: payload.body || 'Tienes una nueva notificación.',
        icon: '/milogo.png',
        badge: '/milogo.png',
        tag: payload.tag || 'albatros-push',
        data: {
          url: payload.url || '/admin/dashboard',
        },
      },
    ),
  );
});
