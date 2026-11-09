import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import release from "../src/config/fullDatabaseWorkbook.json";
import { verifyWorkbookDownload } from "../src/services/fullDatabaseWorkbookContract.js";

const hash = async (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
test("the full database download is the verified complete workbook", async () => {
  const file = new Uint8Array(readFileSync(`public/${release.assetPath}`));
  await verifyWorkbookDownload(file, release, release.dataVersion, hash);
  assert.deepEqual(release.counts, {wordForms: 329202, fullFamilies: 167780, wordListFamilies: 1764, worksheets: 1});
});
test("download refuses an older data generation, a truncated file and a corrupt file", async () => {
  const file = new Uint8Array([0x50, 0x4b, 3, 4]);
  const fixture = { ...release, byteSize: file.length, sha256: await hash(file) };
  await verifyWorkbookDownload(file, fixture, release.dataVersion, hash);
  await assert.rejects(verifyWorkbookDownload(file, fixture, "older-data", hash));
  await assert.rejects(
    verifyWorkbookDownload(file.slice(0, 3), fixture, release.dataVersion, hash),
  );
  await assert.rejects(
    verifyWorkbookDownload(new Uint8Array([0x50, 0x4b, 3, 5]), fixture, release.dataVersion, hash),
  );
});
test("the full workbook joins explicit offline download but is excluded from first-visit precaching", () => {
  const manifest = JSON.parse(readFileSync("dist/offline-package.json", "utf8")) as {
    files: { path: string; byteSize: number; sha256: string }[];
  };
  const file=manifest.files.find(f=>f.path===release.assetPath);
  assert.equal(file?.byteSize,release.byteSize);assert.equal(file?.sha256,release.sha256);
  const sw = readFileSync("dist/sw.js", "utf8");
  const shell = sw.slice(sw.indexOf("const BUILD_ASSETS"), sw.indexOf("const OFFLINE_STATE_CACHE"));
  assert.ok(!shell.includes(release.assetPath));
  assert.ok(sw.includes("assets/downloads/"));
});
