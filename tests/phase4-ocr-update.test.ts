import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { zipSync } from "fflate";

import {
  linesToEditableText,
  recognizeToEditableText,
  type OcrAdapter,
} from "../src/services/ocr/OcrContract.js";
import {
  assertSafeRelativePath,
  assertSafeUpdateUrl,
  installVerifiedUpdate,
  resolveAssetBaseUrl,
  shouldRestoreInterruptedActive,
  validateUpdateManifest,
  type DataUpdateManifest,
  type StagedUpdateStore,
} from "../src/services/dataUpdate/updateContract.js";

const encoder = new TextEncoder();
const fileBytes = encoder.encode('{"version":"test"}');
const fileHash = createHash("sha256").update(fileBytes).digest("hex").toUpperCase();

function manifest(overrides: Partial<DataUpdateManifest> = {}): DataUpdateManifest {
  return {
    schemaVersion: "1.0.0",
    dataVersion: "fixture-1",
    minimumAppVersion: "0.1.0",
    releaseDate: "2026-09-21",
    dataApiVersion: "hk-ele-github-pages-static/1.0.0",
    dataBaseUrl: "./data/",
    fileCount: 1,
    byteCount: fileBytes.byteLength,
    sourceManifestSha256: "A".repeat(64),
    counts: {
      candidate: 3_185,
      inclusiveReference: 3_430,
      referenceOnly: 245,
      totalFamilies: 163_784,
      forms: 319_924,
      ranked: 163_570,
      unranked: 214,
    },
    files: [{ path: "manifest.json.gz", byteSize: fileBytes.byteLength, sha256: fileHash }],
    ...overrides,
  };
}

class MemoryStore implements StagedUpdateStore {
  active = new Map<string, Uint8Array>([["old.json", encoder.encode("old")]]);
  staging = new Map<string, Uint8Array>();
  committed = false;
  aborted = false;
  failCommit = false;

  async begin(): Promise<void> {
    this.staging.clear();
    this.aborted = false;
  }

  async write(path: string, bytes: Uint8Array): Promise<void> {
    this.staging.set(path, bytes);
  }

  async commit(): Promise<void> {
    if (this.failCommit) throw new Error("simulated atomic-switch failure");
    this.active = new Map(this.staging);
    this.committed = true;
  }

  async abort(): Promise<void> {
    this.staging.clear();
    this.aborted = true;
  }
}

const sha256Hex = async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

test("OCR lines become editable text without spelling or identity inference", () => {
  assert.equal(linesToEditableText(["  Drives fast  ", "", "US pupils"]), "Drives fast\nUS pupils");
});

test("OCR adapter output is exposed as editable source text only", async () => {
  const adapter: OcrAdapter = {
    provider: "fixture",
    processedOnDevice: true,
    isSupported: () => true,
    recognizeImage: async () => ({
      text: linesToEditableText(["The drives.", "Don't guess."]),
      lineCount: 2,
      provider: "fixture",
      processedOnDevice: true,
    }),
  };
  const result = await recognizeToEditableText(adapter, "file:///fixture.jpg");
  assert.equal(result.text, "The drives.\nDon't guess.");
  assert.equal(result.lineCount, 2);
});

test("unsupported OCR adapter fails closed", async () => {
  const adapter: OcrAdapter = {
    provider: "unavailable",
    processedOnDevice: true,
    isSupported: () => false,
    recognizeImage: async () => ({
      text: "",
      lineCount: 0,
      provider: "unavailable",
      processedOnDevice: true,
    }),
  };
  await assert.rejects(
    () => recognizeToEditableText(adapter, "file:///fixture.jpg"),
    /not supported/,
  );
});

test("update URLs require HTTPS except explicit loopback testing", () => {
  assert.equal(assertSafeUpdateUrl("https://example.org/update.json").protocol, "https:");
  assert.equal(assertSafeUpdateUrl("http://127.0.0.1:19009/update.json").hostname, "127.0.0.1");
  assert.throws(() => assertSafeUpdateUrl("http://example.org/update.json"), /require HTTPS/);
});

test("update paths reject traversal and absolute paths", () => {
  assert.doesNotThrow(() => assertSafeRelativePath("detail/001.json.gz"));
  for (const unsafe of ["../secret", "detail/../secret", "/absolute", "detail\\file"])
    assert.throws(() => assertSafeRelativePath(unsafe), /Unsafe update path/);
});

test("manifest compatibility and frozen population relationships are enforced", () => {
  assert.equal(validateUpdateManifest(manifest(), "0.1.0").fileCount, 1);
  assert.throws(
    () => validateUpdateManifest(manifest({ schemaVersion: "2.0.0" }), "0.1.0"),
    /Incompatible update-manifest schema/,
  );
  assert.throws(
    () => validateUpdateManifest(manifest({ minimumAppVersion: "9.0.0" }), "0.1.0"),
    /older than required/,
  );
});

test("relative update data URL resolves from the verified manifest URL", () => {
  assert.equal(
    resolveAssetBaseUrl("https://example.org/releases/update.json", "./data/"),
    "https://example.org/releases/data/",
  );
});

test("startup recovery distinguishes an interrupted switch from deliberate bundled rollback", () => {
  assert.equal(shouldRestoreInterruptedActive(false, true, "installed-v1"), true);
  assert.equal(shouldRestoreInterruptedActive(false, true, null), false);
  assert.equal(shouldRestoreInterruptedActive(true, true, "installed-v1"), false);
});

test("all files are hash-verified before staged data becomes active", async () => {
  const store = new MemoryStore();
  await installVerifiedUpdate(
    {
      manifest: manifest(),
      manifestUrl: "https://example.org/update.json",
      assetBaseUrl: "https://example.org/data/",
    },
    {
      readManifest: async () => manifest(),
      readFile: async () => fileBytes,
    },
    store,
    sha256Hex,
  );
  assert.equal(store.committed, true);
  assert.equal(
    new TextDecoder().decode(store.active.get("manifest.json.gz")),
    '{"version":"test"}',
  );
});

test("one hashed stored archive is unpacked and each internal file is reverified", async () => {
  const archiveBytes = zipSync({ "manifest.json.gz": fileBytes }, { level: 0 });
  const archiveHash = createHash("sha256").update(archiveBytes).digest("hex").toUpperCase();
  const archivedManifest = manifest({
    archive: {
      path: "hkele-data-fixture.zip",
      format: "zip-store",
      byteSize: archiveBytes.byteLength,
      sha256: archiveHash,
      fileCount: 1,
    },
  });
  const store = new MemoryStore();
  let requests = 0;
  await installVerifiedUpdate(
    {
      manifest: archivedManifest,
      manifestUrl: "https://example.org/update.json",
      assetBaseUrl: "https://example.org/data/",
    },
    {
      readManifest: async () => archivedManifest,
      readFile: async () => {
        requests += 1;
        return archiveBytes;
      },
    },
    store,
    sha256Hex,
  );
  assert.equal(requests, 1);
  assert.equal(store.committed, true);
  assert.equal(
    new TextDecoder().decode(store.active.get("manifest.json.gz")),
    '{"version":"test"}',
  );
});

test("archive hash failure preserves the old active release", async () => {
  const archiveBytes = zipSync({ "manifest.json.gz": fileBytes }, { level: 0 });
  const store = new MemoryStore();
  const archivedManifest = manifest({
    archive: {
      path: "hkele-data-fixture.zip",
      format: "zip-store",
      byteSize: archiveBytes.byteLength,
      sha256: "0".repeat(64),
      fileCount: 1,
    },
  });
  await assert.rejects(
    () =>
      installVerifiedUpdate(
        {
          manifest: archivedManifest,
          manifestUrl: "https://example.org/update.json",
          assetBaseUrl: "https://example.org/data/",
        },
        { readManifest: async () => archivedManifest, readFile: async () => archiveBytes },
        store,
        sha256Hex,
      ),
    /data-package SHA-256/,
  );
  assert.equal(store.aborted, true);
  assert.equal(new TextDecoder().decode(store.active.get("old.json")), "old");
});

test("hash failure aborts staging and preserves active data", async () => {
  const store = new MemoryStore();
  await assert.rejects(
    () =>
      installVerifiedUpdate(
        {
          manifest: manifest({
            files: [
              {
                path: "manifest.json.gz",
                byteSize: fileBytes.byteLength,
                sha256: "0".repeat(64),
              },
            ],
          }),
          manifestUrl: "https://example.org/update.json",
          assetBaseUrl: "https://example.org/data/",
        },
        { readManifest: async () => manifest(), readFile: async () => fileBytes },
        store,
        sha256Hex,
      ),
    /SHA-256 mismatch/,
  );
  assert.equal(store.aborted, true);
  assert.equal(new TextDecoder().decode(store.active.get("old.json")), "old");
});

test("atomic-switch failure aborts staging and preserves active data", async () => {
  const store = new MemoryStore();
  store.failCommit = true;
  await assert.rejects(
    () =>
      installVerifiedUpdate(
        {
          manifest: manifest(),
          manifestUrl: "https://example.org/update.json",
          assetBaseUrl: "https://example.org/data/",
        },
        { readManifest: async () => manifest(), readFile: async () => fileBytes },
        store,
        sha256Hex,
      ),
    /simulated atomic-switch failure/,
  );
  assert.equal(store.aborted, true);
  assert.equal(new TextDecoder().decode(store.active.get("old.json")), "old");
});

test("published update manifest matches the frozen static inventory", async () => {
  const value = JSON.parse(
    await readFile(resolve(process.cwd(), "public/hkele-data/update-manifest.json"), "utf8"),
  ) as DataUpdateManifest;
  const checked = validateUpdateManifest(value, "0.1.0");
  assert.equal(checked.fileCount, 1_192);
  assert.equal(checked.byteCount, 62_969_832);
  assert.equal(
    checked.sourceManifestSha256,
    "95F83B04571153AD1496EE0572B3F2CB21D07E828F5184D96F3F9AFF667AEB05",
  );
  assert.equal(checked.counts.totalFamilies, 163_784);
  assert.equal(checked.counts.forms, 319_924);
  assert.equal(checked.archive?.fileCount, 1_192);
  assert.equal(checked.archive?.format, "zip-store");
  assert.ok((checked.archive?.byteSize ?? 0) > checked.byteCount);
});
