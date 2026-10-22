import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { StaticShardRepository } from "../src/data/StaticShardRepository";
import { HybridRepository } from "../src/data/HybridRepository";
import type { FormRecord, HkeleRepository } from "../src/domain/hkele";
import {
  loadFamilySearchGroups,
  sortWordForms,
  wordFormFrequency,
} from "../src/services/wordFamilySearch";

const dataResponse = (url: string) =>
  new Response(
    new Uint8Array(
      readFileSync(
        join(
          process.cwd(),
          "public/hkele-data",
          new URL(url, "https://fixture.invalid").pathname.replace(/^\/hkele-data\//, ""),
        ),
      ),
    ),
  );
test("specific query stays first for every sort; missing frequencies remain null and last", () => {
  const forms = ["use", "reusable", "unknown", "reuse", "zero"].map(
    (form) => ({ form, normalized_form: form }) as FormRecord,
  );
  const counts = { use: [100, 100], reusable: [null, 1], reuse: [5, 5], zero: [0, 0] } as const;
  const records = Object.fromEntries(
    Object.entries(counts).map(([key, value]) => [key, [...value]]),
  ) as Record<string, [number | null, number | null]>;
  assert.deepEqual(
    sortWordForms(forms, "REUSABLE", records).map((row) => row.form.form),
    ["reusable", "use", "reuse", "zero", "unknown"],
  );
  assert.deepEqual(
    sortWordForms(forms, "reusable", records, "frequency-asc").map((row) => row.form.form),
    ["reusable", "zero", "reuse", "use", "unknown"],
  );
  assert.equal(sortWordForms(forms, "reusable", records, "az")[0]?.form.form, "reusable");
  assert.equal(sortWordForms(forms, "reusable", records, "za")[0]?.form.form, "reusable");
  assert.equal(wordFormFrequency([null, null]), null);
  assert.equal(wordFormFrequency([0, null]), 0);
  assert.equal(forms[0]?.form, "use");
});
test("real A search lists all related forms with the exact query, genuine form counts and separate grades", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => dataResponse(String(input));
  try {
    const repository = new StaticShardRepository("https://fixture.invalid/hkele-data");
    const match = await repository.searchSurface("reusable");
    const groups = await loadFamilySearchGroups(repository, match.owners);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]!.forms.length, 79);
    const rows = sortWordForms(groups[0]!.forms, "reusable", groups[0]!.frequencies);
    assert.equal(rows[0]!.form.form, "reusable");
    assert.equal(rows[1]!.form.form, "use");
    assert.equal(rows[1]!.frequency, 39997);
    assert.equal(rows[2]!.form.form, "used");
    const be = await repository.getFamily("be");
    assert.equal(
      be.forms.find((f) => f.form === "be")?.external_level_reference,
      "Kindergarten–Grade 1",
    );
    assert.equal(
      be.forms.find((f) => f.form === "beingness")?.external_level_reference,
      "Grades 10–11",
    );
  } finally {
    globalThis.fetch = original;
  }
});
test("ambiguous search retains both registered families and every accepted form", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => dataResponse(String(input));
  try {
    const repository = new StaticShardRepository("https://fixture.invalid/hkele-data");
    const result = await repository.searchSurface("coinciding");
    const groups = await loadFamilySearchGroups(repository, result.owners);
    assert.deepEqual(
      groups.map((g) => g.family.baseword_key),
      ["coincide", "incide"],
    );
    assert.deepEqual(
      groups.map((g) => g.forms.length),
      [8, 17],
    );
    for (const group of groups)
      assert.equal(
        sortWordForms(group.forms, "coinciding", group.frequencies)[0]?.form.form,
        "coinciding",
      );
  } finally {
    globalThis.fetch = original;
  }
});
test("frequency shard failure retries; installed generations never fall back to another frequency view", async () => {
  const original = globalThis.fetch;
  let fail = true;
  globalThis.fetch = async (input) =>
    String(input).includes("/word-frequency/") && fail
      ? ((fail = false), new Response("temporary", { status: 503 }))
      : dataResponse(String(input));
  try {
    const primary = new StaticShardRepository(
      "https://fixture.invalid/hkele-data",
      "installed-full",
    );
    const hybrid = new HybridRepository(primary, {} as HkeleRepository);
    await assert.rejects(hybrid.getWordFormFrequencies("use"), /503/);
    assert.equal(wordFormFrequency((await hybrid.getWordFormFrequencies("use")).use), 39997);
    assert.equal(hybrid.getDataMode(), "installed-full");
  } finally {
    globalThis.fetch = original;
  }
});
test("old offline or missing frequency resources keep accepted forms available without zero filling", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) =>
    String(input).includes("/word-frequency/")
      ? new Response("not in old offline package", { status: 404 })
      : dataResponse(String(input));
  try {
    const repository = new StaticShardRepository(
      "https://fixture.invalid/hkele-data",
      "installed-full",
    );
    const owners = (await repository.searchSurface("reusable")).owners;
    const groups = await loadFamilySearchGroups(repository, owners);
    assert.equal(groups[0]!.frequencyUnavailable, true);
    assert.equal(groups[0]!.forms.length, 79);
    assert.ok(
      sortWordForms(groups[0]!.forms, "reusable", groups[0]!.frequencies).every(
        (row) => row.frequency === null,
      ),
    );
  } finally {
    globalThis.fetch = original;
  }
});
