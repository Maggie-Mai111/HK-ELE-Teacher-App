import approvals from "../../config/offlineDataReleases.json";
import { APP_VERSION } from "../../config/release";
import {
  installOfflinePackage,
  validateOfflineManifest,
  type OfflineFile,
  type OfflineManager,
  type OfflineManifest,
  type OfflineStatus,
  type OfflineStore,
} from "./offlineContract";
import {
  browserOfflineSupported,
  OFFLINE_BASE,
  readOfflineState,
  selectionComplete,
  writeOfflineState,
} from "./offlineStorage.web";

async function hash(bytes: Uint8Array): Promise<string> {
  const result = await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes).buffer);
  return [...new Uint8Array(result)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
async function readNetwork(path: string, signal?: AbortSignal): Promise<Uint8Array> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(cancel, 45_000);
  try {
    const response = await fetch(OFFLINE_BASE + path, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok || response.redirected || new URL(response.url).origin !== location.origin)
      throw new Error("Connect to the internet and try the download again.");
    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error("Connect to the internet and try again.");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
export async function verifyApprovedPackage(value: unknown): Promise<OfflineManifest> {
  const m = validateOfflineManifest(value, APP_VERSION);
  const approved = (
    approvals as Record<
      string,
      { dataInventorySha256: string; sourceManifestSha256: string; counts: unknown }
    >
  )[m.dataVersion];
  const data = m.files
    .filter((f) => f.path.startsWith("hkele-data/"))
    .map((f) => [f.path, f.byteSize, f.sha256.toLowerCase()])
    .sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1));
  const digest = await hash(new TextEncoder().encode(JSON.stringify(data)));
  if (
    !approved ||
    digest !== m.dataInventorySha256 ||
    digest !== approved.dataInventorySha256 ||
    m.sourceManifestSha256.toLowerCase() !== approved.sourceManifestSha256 ||
    Object.entries(m.counts).some(
      ([key, value]) => value !== (approved.counts as Record<string, unknown>)[key],
    )
  )
    throw new Error("This wordlist has not been approved for this App version.");
  const identity = await hash(
    new TextEncoder().encode(
      JSON.stringify(m.files.map((f) => [f.path, f.byteSize, f.sha256.toLowerCase()])),
    ),
  );
  if (identity !== m.releaseId) throw new Error("The offline package description is incomplete.");
  return m;
}
async function status(): Promise<OfflineStatus> {
  const supported = browserOfflineSupported();
  if (!supported)
    return {
      supported: false,
      ready: false,
      activeVersion: null,
      releaseId: null,
      previousVersion: null,
      bytes: 0,
      persistent: false,
    };
  const state = await readOfflineState();
  return {
    supported,
    ready: await selectionComplete(state.active),
    activeVersion: state.active?.manifest.dataVersion ?? null,
    releaseId: state.active?.manifest.releaseId ?? null,
    previousVersion: state.previous?.manifest.dataVersion ?? null,
    bytes: state.active?.manifest.byteCount ?? 0,
    persistent: (await navigator.storage?.persisted?.()) ?? false,
  };
}
function contentType(path: string): string {
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".wasm")) return "application/wasm";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".gz")) return "application/gzip";
  if (path.endsWith(".webmanifest")) return "application/manifest+json";
  return "application/octet-stream";
}
async function exclusive<T>(work: () => Promise<T>): Promise<T> {
  if (!browserOfflineSupported())
    throw new Error("Use a recent Safari, Chrome or Edge browser to prepare offline data.");
  return navigator.locks.request(
    "hkele-offline-install-v1",
    { ifAvailable: true },
    async (lock) => {
      if (!lock) throw new Error("A download is already running in another HK-ELE window.");
      return work();
    },
  );
}

async function cleanUnusedDownloads(): Promise<void> {
  const state = await readOfflineState();
  const keep = new Set([state.active?.cacheName, state.previous?.cacheName]);
  const held = (await navigator.locks.query()).held ?? [];
  for (const name of await caches.keys()) {
    if (
      name.startsWith("hkele-offline-package-") &&
      !keep.has(name) &&
      !held.some((lock) => lock.name === `hkele-offline-reader:${name}`)
    )
      await caches.delete(name);
  }
}

export const offlineManager: OfflineManager = {
  getStatus: status,
  async check() {
    return verifyApprovedPackage(
      JSON.parse(new TextDecoder().decode(await readNetwork("offline-package.json"))),
    );
  },
  async install(progress, signal) {
    return exclusive(async () => {
      await cleanUnusedDownloads();
      const ready = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Reopen HK-ELE while online, then try again.")),
            15_000,
          ),
        ),
      ]);
      if (!ready.active) throw new Error("Reopen HK-ELE while online, then try again.");
      const manifest = await verifyApprovedPackage(
        JSON.parse(new TextDecoder().decode(await readNetwork("offline-package.json", signal))),
      );
      const previous = await readOfflineState();
      const estimate = await navigator.storage?.estimate?.();
      if (
        estimate?.quota &&
        estimate.quota - (estimate.usage ?? 0) < manifest.byteCount + 10_000_000
      )
        throw new Error(
          "There is not enough free space. Free some space on this device and retry.",
        );
      // Ask during the user's download action; denial does not block offline use.
      await navigator.storage?.persist?.().catch(() => false);
      const cacheName = `hkele-offline-package-${manifest.releaseId.slice(0, 16)}-${crypto.randomUUID().replaceAll("-", "")}`;
      let staged: Cache;
      const store: OfflineStore = {
        async begin() {
          staged = await caches.open(cacheName);
        },
        async write(file, bytes) {
          await staged.put(
            OFFLINE_BASE + file.path,
            new Response(Uint8Array.from(bytes).buffer, {
              headers: { "Content-Type": contentType(file.path) },
            }),
          );
        },
        async commit(m) {
          const selected = { cacheName, manifest: m };
          if (!(await selectionComplete(selected)))
            throw new Error("The offline download could not be saved completely.");
          await writeOfflineState({ active: selected, previous: previous.active });
        },
        async abort() {
          await caches.delete(cacheName);
        },
      };
      const read = async (file: OfflineFile, downloadSignal: AbortSignal) => {
        // Reuse a verified previous download, but re-check its bytes before storing.
        for (const selection of [previous.active, previous.previous])
          if (selection) {
            const old = selection.manifest.files.find(
              (f) => f.path === file.path && f.sha256 === file.sha256,
            );
            if (old) {
              const response = await (
                await caches.open(selection.cacheName)
              ).match(OFFLINE_BASE + file.path);
              if (response) return new Uint8Array(await response.arrayBuffer());
            }
          }
        return readNetwork(file.path, downloadSignal);
      };
      await installOfflinePackage(manifest, read, hash, store, progress, signal);
      await cleanUnusedDownloads().catch(() => undefined);
      // Keep the active, rollback and any versions in use by other tabs. No lesson storage is touched.
      return status();
    });
  },
  async rollback() {
    await exclusive(async () => {
      const state = await readOfflineState();
      if (!(await selectionComplete(state.previous)))
        throw new Error(
          "The previous offline version is unavailable. Download the wordlist again.",
        );
      await writeOfflineState({ active: state.previous, previous: state.active });
    });
  },
  reopen() {
    window.location.reload();
  },
};
