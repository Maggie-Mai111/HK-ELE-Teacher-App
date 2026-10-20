import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { DataManifest } from "../src/domain/contracts";
import { assertCompatibleManifest, schemaMajor } from "../src/domain/manifest";

const manifestPath = join(process.cwd(), "data", "current-manifest.json");

test("current manifest accepts the compatible App and frozen controls", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as DataManifest;
  assert.doesNotThrow(() => assertCompatibleManifest(manifest, "0.5.0"));
  assert.equal(manifest.counts.candidate, 2871);
  assert.equal(manifest.counts.inclusiveReference, 2871);
  assert.equal(manifest.counts.totalFamilies, 163906);
  assert.equal(manifest.counts.forms, 319961);
});

test("incompatible schema major fails closed", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as DataManifest;
  const incompatible = { ...manifest, schemaVersion: "2.0.0" };
  assert.throws(() => assertCompatibleManifest(incompatible, "0.5.0"), /Refusing to load/);
});

test("invalid schema versions are rejected", () => {
  assert.throws(() => schemaMajor("current"), /Invalid schemaVersion/);
});
