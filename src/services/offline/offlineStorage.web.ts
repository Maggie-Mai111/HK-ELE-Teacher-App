import {
  validateOfflineManifest,
  type OfflineSelection,
  type OfflineState,
} from "./offlineContract";

export const OFFLINE_BASE = "/HK-ELE-Teacher-App/";
export const STATE_CACHE = "hkele-offline-state-v1";
export const STATE_PATH = `${OFFLINE_BASE}__offline_state__`;
export const EMPTY_STATE: OfflineState = { active: null, previous: null };
export const browserOfflineSupported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  "caches" in window &&
  !!globalThis.crypto?.subtle &&
  !!navigator.locks &&
  "serviceWorker" in navigator;
export async function readOfflineState(): Promise<OfflineState> {
  if (typeof window === "undefined" || !("caches" in window)) return EMPTY_STATE;
  const raw = await (await caches.open(STATE_CACHE)).match(STATE_PATH);
  if (!raw) return EMPTY_STATE;
  const state = (await raw.json()) as OfflineState;
  for (const selection of [state.active, state.previous])
    if (selection) {
      if (!/^hkele-offline-package-[a-z0-9-]+$/.test(selection.cacheName))
        throw new Error("Offline data needs to be downloaded again.");
      // Retain an older compatible offline generation after an App update.
      // Network packages are separately checked against the running App version.
      validateOfflineManifest(selection.manifest, selection.manifest.appVersion);
    }
  return state;
}
export async function writeOfflineState(state: OfflineState): Promise<void> {
  await (
    await caches.open(STATE_CACHE)
  ).put(
    STATE_PATH,
    new Response(JSON.stringify(state), { headers: { "Content-Type": "application/json" } }),
  );
}
export async function selectionComplete(selection: OfflineSelection | null): Promise<boolean> {
  if (!selection || !(await caches.has(selection.cacheName))) return false;
  const urls = new Set(
    (await (await caches.open(selection.cacheName)).keys()).map(
      (request) => new URL(request.url).pathname,
    ),
  );
  return selection.manifest.files.every((file) => urls.has(OFFLINE_BASE + file.path));
}

// A running tab keeps one data version. Installing/rolling back takes effect on reopen.
let sessionSelection: Promise<OfflineSelection | null> | null = null;
let installedSession = false;
function selectSession(): Promise<OfflineSelection | null> {
  sessionSelection ??= readOfflineState().then(async (state) => {
    if (!state.active) return null;
    const selection = state.active;
    if (navigator.locks)
      await new Promise<void>((resolve, reject) => {
        // The browser releases this shared lock when the tab closes. A downloader
        // can prune old generations without breaking another tab's pinned data.
        void navigator.locks
          .request(`hkele-offline-reader:${selection.cacheName}`, { mode: "shared" }, () => {
            resolve();
            return new Promise<void>(() => {});
          })
          .catch(reject);
      });
    installedSession = true;
    return selection;
  });
  return sessionSelection;
}
export function offlineSessionIsInstalled(): boolean {
  return installedSession;
}
export async function readInstalledData(url: string): Promise<Response | null> {
  if (typeof window === "undefined") return null;
  const target = new URL(url, window.location.href);
  if (
    target.origin !== window.location.origin ||
    !target.pathname.startsWith(`${OFFLINE_BASE}hkele-data/`)
  )
    return null;
  const selection = await selectSession();
  if (!selection) return null;
  const cached = await (
    await caches.open(selection.cacheName)
  ).match(target.origin + target.pathname);
  if (!cached)
    throw new Error("Some offline data is missing. Open Offline use to download it again.");
  const file = selection.manifest.files.find(
    (file) => OFFLINE_BASE + file.path === target.pathname,
  );
  const bytes = new Uint8Array(await cached.clone().arrayBuffer());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const actual = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join(
    "",
  );
  if (!file || bytes.length !== file.byteSize || actual !== file.sha256.toLowerCase())
    throw new Error("Some offline data needs downloading again. Your saved lessons are kept.");
  return cached;
}
