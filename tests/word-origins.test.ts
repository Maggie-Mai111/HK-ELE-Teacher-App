import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { selectOrigins, type OriginShard } from "../src/services/wordOriginsContract.js";
import release from "../src/config/wordOriginsRelease.json";

function shard(letter: string): OriginShard {
  const name = `${letter}.json.gz`;
  const bytes = readFileSync(`public/hkele-data/word-origins/${release.version}/${name}`);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    (release.files as Record<string, { sha256: string }>)[name]!.sha256,
  );
  return JSON.parse(gunzipSync(bytes).toString()) as OriginShard;
}
test("word origins are exact-form annotations; slot 2 is not relabelled as slot 1", () => {
  const s = shard("s"),
    r = Object.values(s.records).find((r) => r.normalizedForm === "school")!;
  assert.equal(selectOrigins(s, r.familyKey, "school", release.version, release.dataVersion), r);
  assert.equal(r.origins.length, 1);
  assert.equal(r.origins[0]!.slot, 2);
  assert.equal(r.origins[0]!.language, "Greek");
  assert.equal(selectOrigins(s, "wrong", "school", release.version, release.dataVersion), null);
  assert.equal(selectOrigins(s, r.familyKey, "book", release.version, release.dataVersion), null);
  assert.throws(() =>
    selectOrigins(
      { ...s, version: "old" },
      r.familyKey,
      "school",
      release.version,
      release.dataVersion,
    ),
  );
});
test("Greek original forms and meanings remain distinct pairs", () => {
  const s = shard("t"),
    r = Object.values(s.records).find((r) => r.normalizedForm === "telephone")!;
  assert.deepEqual(r.origins, [
    { slot: 1, language: "Greek", form: "τηλε", meaning: "afar" },
    { slot: 2, language: "Greek", form: "φωνη", meaning: "voice, sound" },
  ]);
  assert.throws(() =>
    selectOrigins(
      { ...s, records: { [`${r.familyKey}\ttelephone`]: { ...r, normalizedForm: "other" } } },
      r.familyKey,
      "telephone",
      release.version,
      release.dataVersion,
    ),
  );
});
test("offline inventory includes the entire origins layer with matching integrity", () => {
  const m = JSON.parse(readFileSync("public/hkele-data/update-manifest.json", "utf8")) as {
    files: { path: string; sha256: string }[];
    fileCount: number;
    archive?: { fileCount: number };
  };
  for (const [name, info] of Object.entries(release.files)) {
    assert.equal(
      m.files.find((f) => f.path === `word-origins/${release.version}/${name}`)?.sha256,
      info.sha256,
    );
  }
  assert.equal(m.files.length, m.fileCount);
});
