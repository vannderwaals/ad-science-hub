/* AD Science Hub offline helper.
   Pages: network first (so every published update shows straight away), cached copy when offline.
   Images, icons, fonts: served from cache, refreshed in the background.
   Videos (.mp4): never cached (too big for students' phones) and always streamed. */
const VERSION = "v1";
const SHELL = "adsh-shell-" + VERSION;
const RUNTIME = "adsh-runtime-" + VERSION;
const PRECACHE = [
  "/",
  "/index.html",
  "/sims/moments/",
  "/sims/laser-heist/",
  "/sims/pressure-lab/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/videos/plant-parts-1.jpg",
  "/videos/plant-parts-2.jpg",
  "/videos/plant-parts-3.jpg",
  "/videos/plant-parts-4.jpg",
  "/videos/plant-parts-5.jpg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("adsh-") && k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Videos: always straight from the network (supports seeking)
  if (url.pathname.endsWith(".mp4") || req.headers.has("range")) return;

  // Pages: network first, fall back to the cached copy when offline
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && url.origin === location.origin) {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Same-site files and Google Fonts: cache, refreshed in the background
  const sameSite = url.origin === location.origin;
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!sameSite && !fonts) return;
  e.respondWith(
    caches.match(req).then((cached) => {
      const fresh = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});
