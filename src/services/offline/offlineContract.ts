import {
  assertSafeRelativePath,
  validateUpdateManifest,
  type UpdateCounts,
} from "../dataUpdate/updateContract";

export interface OfflineFile {
  path: string;
  byteSize: number;
  sha256: string;
}
export interface OfflineManifest {
  schemaVersion: "hkele-offline/1";
  releaseId: string;
  dataVersion: string;
  appVersion: string;
  dataApiVersion: string;
  sourceManifestSha256: string;
  dataInventorySha256: string;
  counts: UpdateCounts;
  byteCount: number;
  files: OfflineFile[];
}
export interface OfflineSelection {
  cacheName: string;
  manifest: OfflineManifest;
}
export interface OfflineState {
  active: OfflineSelection | null;
  previous: OfflineSelection | null;
}
export interface OfflineProgress {
  completed: number;
  total: number;
  bytes: number;
  totalBytes: number;
}
export interface OfflineStatus {
  supported: boolean;
  ready: boolean;
  activeVersion: string | null;
  releaseId: string | null;
  previousVersion: string | null;
  bytes: number;
  persistent: boolean;
}
export interface OfflineManager {
  getStatus(): Promise<OfflineStatus>;
  check(): Promise<OfflineManifest>;
  install(progress: (value: OfflineProgress) => void, signal: AbortSignal): Promise<OfflineStatus>;
  rollback(): Promise<void>;
  reopen(): void;
}
export interface OfflineStore {
  begin(): Promise<void>;
  write(file: OfflineFile, bytes: Uint8Array): Promise<void>;
  commit(manifest: OfflineManifest): Promise<void>;
  abort(): Promise<void>;
}

export function validateOfflineManifest(value: unknown, appVersion: string): OfflineManifest {
  if (!value || typeof value !== "object") throw new Error("Invalid offline package.");
  const m = value as OfflineManifest;
  if (
    m.schemaVersion !== "hkele-offline/1" ||
    m.appVersion !== appVersion ||
    !/^[a-f0-9]{64}$/.test(m.releaseId) ||
    !/^[a-f0-9]{64}$/.test(m.dataInventorySha256)
  )
    throw new Error("This offline package needs a compatible App version.");
  if (!Array.isArray(m.files) || m.files.length < 1 || m.files.length > 2500)
    throw new Error("Invalid offline inventory.");
  const paths = new Set<string>();
  for (const f of m.files) {
    assertSafeRelativePath(f.path);
    if (
      /[?#%:]/.test(f.path) ||
      paths.has(f.path) ||
      !Number.isSafeInteger(f.byteSize) ||
      f.byteSize < 0 ||
      !/^[a-f0-9]{64}$/i.test(f.sha256)
    )
      throw new Error("Invalid offline file.");
    if (!(
      f.path.startsWith("hkele-data/") ||
      f.path.startsWith("ocr/") ||
      f.path.startsWith("assets/") ||
      f.path.startsWith("_expo/") ||
      [
        "index.html",
        "manifest.webmanifest",
        "favicon.ico",
        "pwa-icon-192.png",
        "pwa-icon-512.png",
      ].includes(f.path)
    ))
      throw new Error("Unexpected offline file.");
    paths.add(f.path);
  }
  const dataFiles = m.files
    .filter((f) => f.path.startsWith("hkele-data/"))
    .map((f) => ({ ...f, path: f.path.slice(11) }));
  validateUpdateManifest(
    {
      schemaVersion: "1.0.0",
      dataVersion: m.dataVersion,
      minimumAppVersion: appVersion,
      releaseDate: "2026-09-14",
      dataApiVersion: m.dataApiVersion,
      dataBaseUrl: "./",
      fileCount: dataFiles.length,
      byteCount: dataFiles.reduce((n, f) => n + f.byteSize, 0),
      sourceManifestSha256: m.sourceManifestSha256,
      counts: m.counts,
      files: dataFiles,
    },
    appVersion,
  );
  for (const required of [
    "index.html",
    "hkele-data/manifest.json.gz",
    "hkele-data/ai_full_projection.json.gz",
    "ocr/tesseract.min.js",
    "ocr/worker.min.js",
    "ocr/lang/eng.traineddata.gz",
  ])
    if (!paths.has(required)) throw new Error("Incomplete offline package.");
  if (m.byteCount !== m.files.reduce((n, f) => n + f.byteSize, 0) || m.byteCount > 200_000_000)
    throw new Error("Invalid offline package size.");
  return m;
}

// The active pointer changes only after every byte has been checked and stored.
export async function installOfflinePackage(
  manifest: OfflineManifest,
  read: (file: OfflineFile, signal: AbortSignal) => Promise<Uint8Array>,
  sha256: (bytes: Uint8Array) => Promise<string>,
  store: OfflineStore,
  progress: (value: OfflineProgress) => void,
  signal: AbortSignal,
): Promise<void> {
  const checkAbort = () => {
    if (signal.aborted) throw new DOMException("Download cancelled.", "AbortError");
  };
  checkAbort();
  await store.begin();
  let completed = 0,
    bytes = 0,
    cursor = 0;
  let failed: unknown = null;
  progress({ completed, total: manifest.files.length, bytes, totalBytes: manifest.byteCount });
  const worker = async () => {
    while (!failed) {
      checkAbort();
      const file = manifest.files[cursor++];
      if (!file) return;
      try {
        const content = await read(file, signal);
        checkAbort();
        if (
          content.byteLength !== file.byteSize ||
          (await sha256(content)).toLowerCase() !== file.sha256.toLowerCase()
        )
          throw new Error("A downloaded file did not pass its check. Please retry.");
        await store.write(file, content);
        completed++;
        bytes += content.byteLength;
        progress({
          completed,
          total: manifest.files.length,
          bytes,
          totalBytes: manifest.byteCount,
        });
      } catch (error) {
        failed = error;
        throw error;
      }
    }
  };
  try {
    const results = await Promise.allSettled(Array.from({ length: 4 }, worker));
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") throw rejected.reason;
    checkAbort();
    if (completed !== manifest.files.length) throw new Error("The offline download is incomplete.");
    await store.commit(manifest);
  } catch (error) {
    await store.abort();
    throw error;
  }
}
