const CACHE_PREFIX = "hkele-teacher-app-shell-";
const CACHE_NAME = `${CACHE_PREFIX}__PACKAGE85_CACHE_VERSION__`;
const BASE_PATH = "/HK-ELE-Teacher-App/";
const COMPACT_DATA_ASSETS = __PACKAGE85_COMPACT_DATA_ASSETS__;
const BUILD_ASSETS = __PACKAGE85_BUILD_ASSETS__;
const OFFLINE_STATE_CACHE = "hkele-offline-state-v1";
const OFFLINE_STATE_PATH = `${BASE_PATH}__offline_state__`;

async function installedResponse(path) {
  const saved = await (await caches.open(OFFLINE_STATE_CACHE)).match(OFFLINE_STATE_PATH);
  if (!saved) return null;
  const state = await saved.json();
  if (!state.active || !/^hkele-offline-package-[a-z0-9-]+$/.test(state.active.cacheName))
    return null;
  return (await caches.open(state.active.cacheName)).match(path);
}
async function savedAppResponse() {
  try {
    const saved = await installedResponse(`${BASE_PATH}index.html`);
    if (saved) return saved;
  } catch {
    // A missing/invalid download must not hide the cached application shell.
  }
  return caches.match(BASE_PATH);
}
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
        .then(async (response) => {
          // Fetch resolves on HTTP errors. Use a saved App if available; retain
          // the original error response for a first visit with no local copy.
          if (!response.ok) return (await savedAppResponse()) || response;
          const copy = response.clone();
          void caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(BASE_PATH, copy))
            .catch(() => {});
          return response;
        })
        .catch(savedAppResponse),
    );
    return;
  }

  if (url.pathname.startsWith(`${BASE_PATH}ocr/`)) {
    event.respondWith(
      installedResponse(url.origin + url.pathname).then((saved) => saved || fetch(request)),
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
          installedResponse(url.origin + url.pathname)
            .then((saved) => saved || fetch(request))
            .then((response) => {
              if (response.ok) {
                void caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
              }
              return response;
            }),
      ),
    );
  }
});
