const CACHE_VERSION = "albatros-static-v4";
const SAFE_SHELL = ["/offline.html", "/manifest.webmanifest"];

try {
  importScripts(
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js",
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js",
  );

  firebase.initializeApp({
    apiKey: "AIzaSyCvwaqwP5gVostBRCzNhLzHJrkMbqDoYuw",
    authDomain: "albatros-5de2d.firebaseapp.com",
    projectId: "albatros-5de2d",
    storageBucket: "albatros-5de2d.firebasestorage.app",
    messagingSenderId: "893648271452",
    appId: "1:893648271452:web:4a7f6cbb7d9c70fa960e99",
  });

  firebase.messaging().onBackgroundMessage((payload) => {
    const data = payload.data || {};
    return self.registration.showNotification(data.title || "ALBATROS", {
      body: data.body || "Tienes una nueva notificación.",
      icon: "/milogo.png",
      badge: "/milogo.png",
      lang: "es-MX",
      tag: data.tag || "albatros-notification",
      data: { url: data.url || "/mi-academia" },
    });
  });
} catch (error) {
  console.error("No se pudo inicializar Firebase Messaging:", error);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(SAFE_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("albatros-") && key !== CACHE_VERSION,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || "/mi-academia",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => client.url === targetUrl);
        if (existing) return existing.focus();
        return self.clients.openWindow(targetUrl);
      }),
  );
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response.ok && response.type === "basic") {
      void cache.put(request, response.clone());
    }
    return response;
  });
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }
  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|avif|ico)$/i.test(url.pathname)
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
