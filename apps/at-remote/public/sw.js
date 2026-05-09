self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("at-remote-v1").then((cache) => cache.addAll(["/", "/icon.svg", "/manifest.webmanifest"]))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
