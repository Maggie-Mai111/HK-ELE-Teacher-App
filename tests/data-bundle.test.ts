import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";

const release = join(process.cwd(), "data", "releases", "2026-09-14-package67-v1");

async function readJson(path: string, gzip = false): Promise<unknown> {
  const bytes = await readFile(join(release, path));
  return JSON.parse((gzip ? gunzipSync(bytes) : bytes).toString("utf8"));
}

test("offline Candidate + Reference package has exact family and form boundaries", async () => {
  const families = (await readJson("reference/families.json.gz", true)) as { rows: unknown[][] };
  const forms = (await readJson("reference/forms.json.gz", true)) as { rows: unknown[][] };
  assert.equal(families.rows.length, 3430);
  assert.equal(forms.rows.length, 64641);
});

test("CPB output contains exactly unique ranks 1-100", async () => {
  const cpb = (await readJson("cpb/cpb-sight-words-100.json")) as {
    items: Array<{ rank: number; word: string; matchKey: string }>;
  };
  assert.equal(cpb.items.length, 100);
  assert.deepEqual(
    cpb.items.map((item) => item.rank),
    Array.from({ length: 100 }, (_, index) => index + 1),
  );
  assert.equal(new Set(cpb.items.map((item) => item.rank)).size, 100);
  assert.ok(cpb.items.every((item) => item.word.length > 0 && item.matchKey.length > 0));
});
