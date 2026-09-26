const CACHE_PREFIX = "hkele-teacher-app-shell-";
const CACHE_NAME = `${CACHE_PREFIX}__PACKAGE84_CACHE_VERSION__`;
const BASE_PATH = "/HK-ELE-Teacher-App/";
const COMPACT_DATA_ASSETS = __PACKAGE84_COMPACT_DATA_ASSETS__;
const BUILD_ASSETS = __PACKAGE84_BUILD_ASSETS__;
const APP_SHELL = [
  BASE_PATH,
  `${BASE_PATH}manifest.webmanifest`,
  `${BASE_PATH}favicon.ico`,
  `${BASE_PATH}pwa-icon-192.png`,
  `${BASE_PATH}pwa-icon-512.png`,
  ...BUILD_ASSETS,
  ...COMPACT_DATA_ASSETS,
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(BASE_PATH) ||
    url.pathname.includes("/hkele-data/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            void caches.open(CACHE_NAME).then((cache) => cache.put(BASE_PATH, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(BASE_PATH)),
    );
    return;
  }

  if (
    APP_SHELL.includes(url.pathname) ||
    ["script", "style", "image", "font"].includes(request.destination)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
            }
            return response;
          }),
      ),
    );
  }
});
