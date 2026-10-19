import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  installOfflinePackage,
  validateOfflineManifest,
  type OfflineFile,
  type OfflineManifest,
  type OfflineStore,
} from "../src/services/offline/offlineContract.js";

const hash = async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const bytes = new TextEncoder().encode("verified fixture");
const digest = createHash("sha256").update(bytes).digest("hex");
const manifest = (version = "fixture-v1"): OfflineManifest => ({
  schemaVersion: "hkele-offline/1",
  releaseId: "a".repeat(64),
  dataVersion: version,
  appVersion: "0.4.0",
  dataApiVersion: "hk-ele-github-pages-static/1.0.0",
  sourceManifestSha256: digest,
  dataInventorySha256: digest,
  counts: {
    candidate: 1,
    inclusiveReference: 1,
    referenceOnly: 0,
    totalFamilies: 2,
    forms: 3,
    ranked: 2,
    unranked: 0,
  },
  byteCount: bytes.length * 7,
  files: [
    "index.html",
    "hkele-data/manifest.json.gz",
    "hkele-data/ai_full_projection.json.gz",
    "ocr/tesseract.min.js",
    "ocr/worker.min.js",
    "ocr/lang/eng.traineddata.gz",
    "ocr/core/core.wasm",
  ].map((path) => ({ path, byteSize: bytes.length, sha256: digest })),
});
function storeFixture() {
  let active = "old-release",
    staged = new Map<string, Uint8Array>(),
    aborts = 0;
  const store: OfflineStore = {
    async begin() {
      staged = new Map();
    },
    async write(file, content) {
      staged.set(file.path, content);
    },
    async commit(m) {
      assert.equal(staged.size, m.files.length);
      active = m.dataVersion;
    },
    async abort() {
      staged.clear();
      aborts++;
    },
  };
  return {
    store,
    get active() {
      return active;
    },
    get staged() {
      return staged;
    },
    get aborts() {
      return aborts;
    },
  };
}

test("offline installation activates a complete verified generation only", async () => {
  const target = storeFixture();
  const seen: number[] = [];
  await installOfflinePackage(
    manifest(),
    async () => {
      assert.equal(target.active, "old-release");
      return bytes;
    },
    hash,
    target.store,
    (p) => seen.push(p.completed),
    new AbortController().signal,
  );
  assert.equal(target.active, "fixture-v1");
  assert.equal(target.aborts, 0);
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, 7]);
});
test("failed checksum waits for writers before removing staging; old version survives", async () => {
  const target = storeFixture();
  let writesAfterAbort = 0;
  const write = target.store.write;
  target.store.write = async (f, b) => {
    await Promise.resolve();
    if (target.aborts) writesAfterAbort++;
    await write(f, b);
  };
  await assert.rejects(
    installOfflinePackage(
      manifest(),
      async (file) => (file.path === "index.html" ? new Uint8Array([0]) : bytes),
      hash,
      target.store,
      () => {},
      new AbortController().signal,
    ),
    /check/,
  );
  assert.equal(target.active, "old-release");
  assert.equal(target.aborts, 1);
  assert.equal(target.staged.size, 0);
  assert.equal(writesAfterAbort, 0);
});
test("cancellation never promotes partial data or touches personal lesson storage", async () => {
  const target = storeFixture();
  const controller = new AbortController();
  const lessons = { title: "Cells", forms: ["cell", "reusable"], note: "Keep this note" };
  const before = JSON.stringify(lessons);
  await assert.rejects(
    installOfflinePackage(
      manifest(),
      async () => {
        controller.abort();
        return bytes;
      },
      hash,
      target.store,
      () => {},
      controller.signal,
    ),
    /cancelled/,
  );
  assert.equal(target.active, "old-release");
  assert.equal(target.staged.size, 0);
  assert.equal(JSON.stringify(lessons), before);
});
test("quota/write and commit failure preserve the active generation", async () => {
  for (const stage of ["write", "commit"] as const) {
    const target = storeFixture();
    target.store[stage] = async () => {
      throw new Error("QuotaExceededError");
    };
    await assert.rejects(
      installOfflinePackage(
        manifest(),
        async () => bytes,
        hash,
        target.store,
        () => {},
        new AbortController().signal,
      ),
      /Quota/,
    );
    assert.equal(target.active, "old-release");
    assert.equal(target.aborts, 1);
  }
});
test("offline manifest rejects traversal, duplicate files, missing OCR and incompatible structure", () => {
  validateOfflineManifest(manifest(), "0.4.0");
  for (const path of [
    "../escape",
    "hkele-data/a?x",
    "hkele-data/%2e%2e/b",
    "/absolute",
    "hkele-data/a\\b",
  ]) {
    const m = manifest();
    m.files[0] = { ...m.files[0]!, path };
    assert.throws(() => validateOfflineManifest(m, "0.4.0"));
  }
  const duplicate = manifest();
  duplicate.files.push(duplicate.files[0]!);
  assert.throws(() => validateOfflineManifest(duplicate, "0.4.0"));
  const missing = manifest();
  missing.files = missing.files.filter((f) => !f.path.startsWith("ocr/lang/"));
  assert.throws(() => validateOfflineManifest(missing, "0.4.0"));
  assert.throws(() =>
    validateOfflineManifest({ ...manifest(), schemaVersion: "unknown" }, "0.4.0"),
  );
  assert.throws(() => validateOfflineManifest(manifest(), "0.5.0"));
});
test("actual built package includes full data, OCR and cold-start assets with exact fingerprints", async () => {
  const m = validateOfflineManifest(
    JSON.parse(readFileSync("dist/offline-package.json", "utf8")),
    "0.4.0",
  );
  const approvals = JSON.parse(readFileSync("src/config/offlineDataReleases.json", "utf8"));
  const data = m.files
    .filter((f) => f.path.startsWith("hkele-data/"))
    .map((f) => [f.path, f.byteSize, f.sha256.toLowerCase()])
    .sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1));
  assert.equal(
    await hash(new TextEncoder().encode(JSON.stringify(data))),
    approvals[m.dataVersion].dataInventorySha256,
  );
  assert.equal(m.counts.totalFamilies, 163784);
  assert.equal(m.counts.candidate, 3185);
  for (const file of m.files) {
    const actual = readFileSync("dist/" + file.path);
    assert.equal(actual.length, file.byteSize, file.path);
    assert.equal(await hash(actual), file.sha256, file.path);
  }
  assert.ok(m.files.some((f: OfflineFile) => f.path.includes("learning-classroom-hero")));
  assert.ok(m.files.some((f) => f.path.startsWith("_expo/static/js/web/index-")));
});

function storageFixture() {
  const buckets = new Map<string, Map<string, Response>>();
  const path = (value: string | Request) =>
    new URL(typeof value === "string" ? value : value.url, "https://fixture.test").href;
  const cache = async (name: string) => {
    if (!buckets.has(name)) buckets.set(name, new Map());
    const bucket = buckets.get(name)!;
    return {
      async match(key: string) {
        return bucket.get(path(key))?.clone();
      },
      async put(key: string, response: Response) {
        bucket.set(path(key), response.clone());
      },
      async keys() {
        return [...bucket.keys()].map((url) => new Request(url));
      },
    };
  };
  const exports: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
  runInNewContext(readFileSync(".test-dist/src/services/offline/offlineStorage.web.js", "utf8"), {
    exports,
    require: () => ({ validateOfflineManifest }),
    window: {
      location: {
        href: "https://fixture.test/HK-ELE-Teacher-App/",
        origin: "https://fixture.test",
      },
      caches: {},
    },
    navigator: {
      locks: {
        request: async (_name: string, _options: unknown, callback: () => Promise<void>) =>
          callback(),
      },
    },
    caches: { open: cache, has: async (name: string) => buckets.has(name) },
    URL,
    Response,
    Request,
    Set,
    Promise,
  });
  return { api: exports, buckets, cache };
}
test("a running tab reads one pinned data generation across an update", async () => {
  const fixture = storageFixture();
  const old = { cacheName: "hkele-offline-package-old", manifest: manifest("old") };
  const next = { cacheName: "hkele-offline-package-new", manifest: manifest("new") };
  await (
    await fixture.cache(old.cacheName)
  ).put("/HK-ELE-Teacher-App/hkele-data/manifest.json.gz", new Response("old bytes"));
  await (
    await fixture.cache(next.cacheName)
  ).put("/HK-ELE-Teacher-App/hkele-data/manifest.json.gz", new Response("new bytes"));
  await fixture.api.writeOfflineState!({ active: old, previous: null });
  assert.equal(
    await (
      (await fixture.api.readInstalledData!(
        "/HK-ELE-Teacher-App/hkele-data/manifest.json.gz",
      )) as Response
    ).text(),
    "old bytes",
  );
  await fixture.api.writeOfflineState!({ active: next, previous: old });
  assert.equal(
    await (
      (await fixture.api.readInstalledData!(
        "/HK-ELE-Teacher-App/hkele-data/manifest.json.gz",
      )) as Response
    ).text(),
    "old bytes",
  );
});
test("evicted offline files fail clearly instead of mixing online data into the old version", async () => {
  const fixture = storageFixture();
  const selected = { cacheName: "hkele-offline-package-old", manifest: manifest() };
  await fixture.api.writeOfflineState!({ active: selected, previous: null });
  assert.equal(await fixture.api.selectionComplete!(selected), false);
  await assert.rejects(
    fixture.api.readInstalledData!("/HK-ELE-Teacher-App/hkele-data/manifest.json.gz"),
    /missing/,
  );
});
test("offline readiness checks the complete inventory, not only a saved version label", async () => {
  const fixture = storageFixture();
  const selected = { cacheName: "hkele-offline-package-old", manifest: manifest() };
  const bucket = await fixture.cache(selected.cacheName);
  for (const file of selected.manifest.files)
    await bucket.put("/HK-ELE-Teacher-App/" + file.path, new Response(bytes));
  assert.equal(await fixture.api.selectionComplete!(selected), true);
  fixture.buckets
    .get(selected.cacheName)!
    .delete("https://fixture.test/HK-ELE-Teacher-App/ocr/worker.min.js");
  assert.equal(await fixture.api.selectionComplete!(selected), false);
});
