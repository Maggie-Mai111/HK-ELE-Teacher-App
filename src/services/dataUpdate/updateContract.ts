import { schemaMajor } from "../../domain/manifest";

export interface UpdateFile {
  path: string;
  byteSize: number;
  sha256: string;
}

export interface UpdateCounts {
  candidate: number;
  inclusiveReference: number;
  referenceOnly: number;
  totalFamilies: number;
  forms: number;
  ranked: number;
  unranked: number;
}

export interface UpdateArchive {
  path: string;
  format: "zip-store";
  byteSize: number;
  sha256: string;
  fileCount: number;
}

export interface DataUpdateManifest {
  schemaVersion: string;
  dataVersion: string;
  minimumAppVersion: string;
  releaseDate: string;
  dataApiVersion: string;
  dataBaseUrl: string;
  fileCount: number;
  byteCount: number;
  sourceManifestSha256: string;
  archive?: UpdateArchive;
  counts: UpdateCounts;
  files: UpdateFile[];
}

export interface UpdatePreview {
  manifest: DataUpdateManifest;
  manifestUrl: string;
  assetBaseUrl: string;
}

export interface UpdateProgress {
  completedFiles: number;
  totalFiles: number;
  downloadedBytes: number;
  totalBytes: number;
  currentPath: string;
}

export interface UpdateStoreStatus {
  activeVersion: string | null;
  previousVersion: string | null;
  hasRollback: boolean;
}

export interface DataUpdateManager {
  readonly supported: boolean;
  getStatus(): Promise<UpdateStoreStatus>;
  check(manifestUrl: string): Promise<UpdatePreview>;
  install(
    manifestUrl: string,
    onProgress?: (progress: UpdateProgress) => void,
  ): Promise<UpdateStoreStatus>;
  rollback(): Promise<UpdateStoreStatus>;
}

export interface UpdateTransport {
  readManifest(url: string): Promise<unknown>;
  readFile(url: string): Promise<Uint8Array>;
}

export interface StagedUpdateStore {
  begin(manifest: DataUpdateManifest): Promise<void>;
  write(path: string, bytes: Uint8Array): Promise<void>;
  commit(manifest: DataUpdateManifest): Promise<void>;
  abort(): Promise<void>;
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string) =>
    value.split(".").map((part) => Number(part.replace(/\D.*$/, "")) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return Math.sign(delta);
  }
  return 0;
}

export function assertSafeUpdateUrl(value: string): URL {
  const url = new URL(value);
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("Data updates require HTTPS, except for an explicit loopback test URL.");
  }
  return url;
}

export function assertSafeRelativePath(path: string): void {
  if (
    !path ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\\") ||
    path.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe update path: ${path}`);
  }
}

export function shouldRestoreInterruptedActive(
  activeExists: boolean,
  previousExists: boolean,
  recordedActiveVersion: string | null,
): boolean {
  return !activeExists && previousExists && recordedActiveVersion !== null;
}

export function validateUpdateManifest(value: unknown, appVersion: string): DataUpdateManifest {
  if (!value || typeof value !== "object") throw new Error("Update manifest is not an object.");
  const manifest = value as DataUpdateManifest;
  if (schemaMajor(manifest.schemaVersion) !== 1) {
    throw new Error("Incompatible update-manifest schema. Refusing the update.");
  }
  if (!/^hk-ele-github-pages-static\/1\./.test(manifest.dataApiVersion)) {
    throw new Error("Incompatible static-data API. Refusing the update.");
  }
  if (compareVersions(appVersion, manifest.minimumAppVersion) < 0) {
    throw new Error(
      `App ${appVersion} is older than required ${manifest.minimumAppVersion}. Refusing the update.`,
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(manifest.releaseDate) || !manifest.dataVersion?.trim()) {
    throw new Error("Update version or release date is invalid.");
  }
  if (!Array.isArray(manifest.files) || manifest.files.length !== manifest.fileCount) {
    throw new Error("Update file count does not match the manifest inventory.");
  }
  if (manifest.fileCount < 1 || manifest.fileCount > 2000) {
    throw new Error("Update file count is outside the accepted safety bound.");
  }
  const paths = new Set<string>();
  let bytes = 0;
  for (const file of manifest.files) {
    assertSafeRelativePath(file.path);
    if (paths.has(file.path)) throw new Error(`Duplicate update path: ${file.path}`);
    paths.add(file.path);
    if (!Number.isSafeInteger(file.byteSize) || file.byteSize < 0) {
      throw new Error(`Invalid byte size for ${file.path}`);
    }
    if (!/^[A-Fa-f0-9]{64}$/.test(file.sha256)) {
      throw new Error(`Invalid SHA-256 for ${file.path}`);
    }
    bytes += file.byteSize;
  }
  if (bytes !== manifest.byteCount || manifest.byteCount > 100_000_000) {
    throw new Error("Update byte total is invalid or exceeds the 100 MB safety bound.");
  }
  if (!paths.has("manifest.json.gz")) {
    throw new Error("The static data manifest is missing from the update inventory.");
  }
  if (manifest.archive) {
    assertSafeRelativePath(manifest.archive.path);
    if (
      manifest.archive.format !== "zip-store" ||
      manifest.archive.fileCount !== manifest.fileCount ||
      !Number.isSafeInteger(manifest.archive.byteSize) ||
      manifest.archive.byteSize < 1 ||
      manifest.archive.byteSize > 100_000_000 ||
      !/^[A-Fa-f0-9]{64}$/.test(manifest.archive.sha256)
    ) {
      throw new Error("The bulk data-package description is invalid.");
    }
  }
  const counts = manifest.counts;
  const allCounts = Object.values(counts);
  if (allCounts.some((count) => !Number.isSafeInteger(count) || count < 0)) {
    throw new Error("Update population counts are invalid.");
  }
  if (
    counts.ranked + counts.unranked !== counts.totalFamilies ||
    counts.candidate > counts.inclusiveReference ||
    counts.inclusiveReference > counts.totalFamilies ||
    counts.referenceOnly !== counts.inclusiveReference - counts.candidate
  ) {
    throw new Error("Update population relationships are inconsistent.");
  }
  if (!/^[A-Fa-f0-9]{64}$/.test(manifest.sourceManifestSha256)) {
    throw new Error("The source manifest SHA-256 is invalid.");
  }
  return manifest;
}

export function resolveAssetBaseUrl(manifestUrl: string, dataBaseUrl: string): string {
  const base = new URL(dataBaseUrl || ".", assertSafeUpdateUrl(manifestUrl));
  assertSafeUpdateUrl(base.toString());
  return base.toString().replace(/\/?$/, "/");
}

function uint16(view: DataView, offset: number): number {
  if (offset < 0 || offset + 2 > view.byteLength) throw new Error("Stored ZIP is truncated.");
  return view.getUint16(offset, true);
}

function uint32(view: DataView, offset: number): number {
  if (offset < 0 || offset + 4 > view.byteLength) throw new Error("Stored ZIP is truncated.");
  return view.getUint32(offset, true);
}

export function extractVerifiedZipStoreEntries(
  archiveBytes: Uint8Array,
  expectedFiles: UpdateFile[],
): Map<string, Uint8Array> {
  const view = new DataView(archiveBytes.buffer, archiveBytes.byteOffset, archiveBytes.byteLength);
  const firstEocdOffset = Math.max(0, archiveBytes.byteLength - 65_557);
  let eocdOffset = -1;
  for (let offset = archiveBytes.byteLength - 22; offset >= firstEocdOffset; offset -= 1) {
    if (uint32(view, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Stored ZIP end record is missing.");
  if (uint16(view, eocdOffset + 4) !== 0 || uint16(view, eocdOffset + 6) !== 0) {
    throw new Error("Multi-disk ZIP packages are not accepted.");
  }
  const entryCount = uint16(view, eocdOffset + 10);
  const centralSize = uint32(view, eocdOffset + 12);
  const centralOffset = uint32(view, eocdOffset + 16);
  const commentLength = uint16(view, eocdOffset + 20);
  if (
    entryCount !== expectedFiles.length ||
    eocdOffset + 22 + commentLength !== archiveBytes.byteLength ||
    centralOffset + centralSize !== eocdOffset
  ) {
    throw new Error("Stored ZIP inventory or directory bounds are invalid.");
  }

  const expected = new Map(expectedFiles.map((file) => [file.path, file]));
  const entries = new Map<string, Uint8Array>();
  const decoder = new TextDecoder();
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (uint32(view, cursor) !== 0x02014b50) throw new Error("Stored ZIP directory is invalid.");
    const flags = uint16(view, cursor + 8);
    const method = uint16(view, cursor + 10);
    const compressedSize = uint32(view, cursor + 20);
    const uncompressedSize = uint32(view, cursor + 24);
    const nameLength = uint16(view, cursor + 28);
    const extraLength = uint16(view, cursor + 30);
    const entryCommentLength = uint16(view, cursor + 32);
    const localOffset = uint32(view, cursor + 42);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > eocdOffset) throw new Error("Stored ZIP filename is truncated.");
    const path = decoder.decode(archiveBytes.subarray(nameStart, nameEnd));
    assertSafeRelativePath(path);
    const file = expected.get(path);
    if (
      !file ||
      entries.has(path) ||
      flags & 0x0001 ||
      method !== 0 ||
      compressedSize !== uncompressedSize ||
      uncompressedSize !== file.byteSize
    ) {
      throw new Error(`Unsafe or unexpected stored ZIP entry: ${path}`);
    }
    if (uint32(view, localOffset) !== 0x04034b50 || uint16(view, localOffset + 8) !== 0) {
      throw new Error(`Invalid local ZIP entry: ${path}`);
    }
    const localNameLength = uint16(view, localOffset + 26);
    const localExtraLength = uint16(view, localOffset + 28);
    const localNameStart = localOffset + 30;
    const localNameEnd = localNameStart + localNameLength;
    if (decoder.decode(archiveBytes.subarray(localNameStart, localNameEnd)) !== path) {
      throw new Error(`ZIP entry names disagree: ${path}`);
    }
    const dataStart = localNameEnd + localExtraLength;
    const dataEnd = dataStart + uncompressedSize;
    if (dataEnd > centralOffset) throw new Error(`Stored ZIP entry is truncated: ${path}`);
    entries.set(path, archiveBytes.subarray(dataStart, dataEnd));
    cursor = nameEnd + extraLength + entryCommentLength;
  }
  if (entries.size !== expected.size || cursor !== eocdOffset) {
    throw new Error("Stored ZIP inventory is incomplete or contains trailing entries.");
  }
  return entries;
}

export async function installVerifiedUpdate(
  preview: UpdatePreview,
  transport: UpdateTransport,
  store: StagedUpdateStore,
  sha256Hex: (bytes: Uint8Array) => Promise<string>,
  onProgress?: (progress: UpdateProgress) => void,
): Promise<void> {
  const { manifest, assetBaseUrl } = preview;
  await store.begin(manifest);
  let downloadedBytes = 0;
  try {
    let archivedEntries: Map<string, Uint8Array> | null = null;
    if (manifest.archive) {
      const archiveBytes = await transport.readFile(
        new URL(manifest.archive.path, assetBaseUrl).toString(),
      );
      if (archiveBytes.byteLength !== manifest.archive.byteSize) {
        throw new Error("The downloaded data-package size does not match its release description.");
      }
      const archiveHash = (await sha256Hex(archiveBytes)).toUpperCase();
      if (archiveHash !== manifest.archive.sha256.toUpperCase()) {
        throw new Error("The downloaded data-package SHA-256 does not match.");
      }
      archivedEntries = extractVerifiedZipStoreEntries(archiveBytes, manifest.files);
    }
    for (let index = 0; index < manifest.files.length; index += 1) {
      const file = manifest.files[index]!;
      const bytes =
        archivedEntries?.get(file.path) ??
        (await transport.readFile(new URL(file.path, assetBaseUrl).toString()));
      if (bytes.byteLength !== file.byteSize) {
        throw new Error(
          `Byte-size mismatch for ${file.path}: ${bytes.byteLength} != ${file.byteSize}`,
        );
      }
      const actualHash = (await sha256Hex(bytes)).toUpperCase();
      if (actualHash !== file.sha256.toUpperCase()) {
        throw new Error(`SHA-256 mismatch for ${file.path}. The active data was not changed.`);
      }
      await store.write(file.path, bytes);
      downloadedBytes += bytes.byteLength;
      onProgress?.({
        completedFiles: index + 1,
        totalFiles: manifest.fileCount,
        downloadedBytes,
        totalBytes: manifest.byteCount,
        currentPath: file.path,
      });
    }
    await store.commit(manifest);
  } catch (reason) {
    await store.abort();
    throw reason;
  }
}

export async function checkUpdateManifest(
  manifestUrl: string,
  appVersion: string,
  transport: UpdateTransport,
): Promise<UpdatePreview> {
  const safeManifestUrl = assertSafeUpdateUrl(manifestUrl).toString();
  const manifest = validateUpdateManifest(
    await transport.readManifest(safeManifestUrl),
    appVersion,
  );
  return {
    manifest,
    manifestUrl: safeManifestUrl,
    assetBaseUrl: resolveAssetBaseUrl(safeManifestUrl, manifest.dataBaseUrl),
  };
}
