import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { StaticShardRepository } from "../src/data/StaticShardRepository";
import { HybridRepository } from "../src/data/HybridRepository";
import type { HkeleRepository } from "../src/domain/hkele";
import { scan } from "../src/services/tokenizer";
import { deriveAiFilterFamilies } from "../src/services/aiFilterFamilyProjection";
import {
  registeredExternalLevel,
  teacherFamilyRecord,
  teacherFormRecord,
  teacherLevelLabel,
  displayedWordEvidence,
  vocabularyListLabel,
} from "../src/services/externalLevelPresentation";
import { makeFamily } from "./support/phase3-fixtures";
import { selectedFormEvidence } from "../src/services/textReaderService";

test("word-card annotations and parts use the selected real form without inheriting the family's union", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input) => dataResponse(String(input));
  try {
    const detail = await new StaticShardRepository("https://fixture.invalid/hkele-data").getFamily(
      "stress",
    );
    const stressed = detail.forms.find((form) => form.form === "stressed")!,
      stressors = detail.forms.find((form) => form.form === "stressors")!;
    assert.notEqual(stressed.msvl, detail.family.msvl);
    assert.equal(selectedFormEvidence(stressed).msvl, stressed.msvl);
    assert.equal(selectedFormEvidence(stressors).awl, false);
    assert.equal(selectedFormEvidence(stressors).suffix, "or");
    assert.equal(selectedFormEvidence(null).msvl, null);
    assert.equal(
      selectedFormEvidence({ ...stressors, phase1c_evidence_withheld_fields: "suffix" }).suffix,
      null,
    );
    assert.equal(
      selectedFormEvidence({ ...stressed, root_meaning_alignment_status: "AMBIGUOUS" }).meaning,
      null,
    );
  } finally {
    globalThis.fetch = original;
  }
});

function dataResponse(url: string): Response {
  const path = new URL(url, "https://fixture.invalid").pathname.replace(/^\/hkele-data\//, "");
  return new Response(new Uint8Array(readFileSync(join(process.cwd(), "public/hkele-data", path))));
}

test("full database includes non-Candidate words and retries failed manifests and shards", async () => {
  const original = globalThis.fetch;
  const failOnce = new Set(["manifest.json.gz", "search/n.json.gz"]);
  globalThis.fetch = async (input) => {
    const url = String(input);
    const failure = [...failOnce].find((path) => url.split("?")[0]!.endsWith(path));
    if (failure) {
      failOnce.delete(failure);
      return new Response("temporarily unavailable", { status: 503 });
    }
    return dataResponse(url);
  };
  try {
    const repository = new StaticShardRepository("https://fixture.invalid/hkele-data");
    await assert.rejects(repository.searchSurface("NASA"), /503/);
    await assert.rejects(repository.searchSurface("NASA"), /503/);
    const result = await repository.searchSurface("NASA");
    assert.equal(result.status, "RESOLVED");
    assert.equal(result.owners[0]?.candidate_member, 0);
    const page = await repository.browse({ scope: "full", sort: "overall", page: 1, pageSize: 25 });
    assert.equal(page.availableItems, 163906);
  } finally {
    globalThis.fetch = original;
  }
});

test("displayed word uses its own grade, including a higher grade and an absent grade", () => {
  const data = JSON.parse(
    gunzipSync(
      readFileSync(
        join(process.cwd(), "data/releases/2026-10-20-a-main-v1/reference/forms.json.gz"),
      ),
    ).toString("utf8"),
  );
  const forms = data.rows.map((row: unknown[]) =>
    Object.fromEntries(data.fields.map((field: string, index: number) => [field, row[index]])),
  );
  const family = {
    ...makeFamily("be", 1),
    display_family: "be",
    external_level_reference_display: "Kindergarten–Grade 1; Grades 10–11",
  };
  const own = forms.filter((form: { baseword_key: string }) => form.baseword_key === "be");
  for (const [word, expected] of [
    ["be", "Kindergarten–Grade 1"],
    ["BEINGNESS", "Grades 10–11"],
    ["beinghood", null],
    ["unregistered-form", null],
  ] as const) {
    const row = displayedWordEvidence(family, own, word);
    assert.equal(row.browse_external_level_reference, expected, word);
    assert.equal(row.external_level_reference_display, family.external_level_reference_display);
  }
});

test("MSVL shows a dash for negative or absent records and preserves subject records", () => {
  for (const value of [0, "0", null, undefined, false, "", "No"]) {
    assert.equal(vocabularyListLabel(value), "—");
  }
  assert.equal(vocabularyListLabel("Science | Mathematics"), "Science | Mathematics");
});

test("one failed shard does not discard full-only text matches and the same check recovers", async () => {
  const original = globalThis.fetch;
  let fail = true;
  globalThis.fetch = async (input) => {
    const url = String(input);
    return fail && url.split("?")[0]!.endsWith("search/p.json.gz")
      ? new Response("unavailable", { status: 503 })
      : dataResponse(url);
  };
  const fallback = {
    getDataMode: () => "bundled-reference",
    browse: async () => {
      throw new Error("unused");
    },
    getFamily: async () => {
      throw new Error("unused");
    },
    resolveOccurrences: async () => {
      throw new Error("unused");
    },
    searchSurface: async (surface: string) => ({
      status: "FULL_DATABASE_CHECK_UNAVAILABLE",
      submittedQuery: surface,
      normalizedQuery: surface,
      bestPriority: null,
      bestOwnerCount: 0,
      owners: [],
      alternatives: [],
      identityException: null,
      dataMode: "bundled-reference",
    }),
  } satisfies HkeleRepository;
  try {
    const repository = new HybridRepository(
      new StaticShardRepository("https://fixture.invalid/hkele-data"),
      fallback,
    );
    const text = "NASA photosynthesis NASA";
    const first = await repository.resolveOccurrences(text, scan(text).occurrences);
    assert.deepEqual(
      first.map((result) => result.status),
      ["RESOLVED", "FULL_DATABASE_CHECK_UNAVAILABLE", "RESOLVED"],
    );
    assert.equal(first[0]?.owners[0]?.candidate_member, 0);
    assert.equal(repository.getDataMode(), "bundled-reference");
    fail = false;
    const second = await repository.resolveOccurrences(text, scan(text).occurrences);
    assert.deepEqual(
      second.map((result) => result.status),
      ["RESOLVED", "UNMATCHED", "RESOLVED"],
    );
    assert.equal(repository.getDataMode(), "remote-full");
  } finally {
    globalThis.fetch = original;
  }
});

test("registered VXGL labels override raw scores in family, form and AI projections", () => {
  const family = {
    ...makeFamily("the", 1),
    external_level_reference_display: "0.1964285714",
    external_level_reference_teacher_display: "Kindergarten–Grade 1",
    browse_external_level_reference: "0.1964285714",
  };
  assert.equal(
    teacherFamilyRecord(family).external_level_reference_display,
    "Kindergarten–Grade 1",
  );
  assert.equal(teacherFamilyRecord(family).browse_external_level_reference, "Kindergarten–Grade 1");
  assert.equal(
    deriveAiFilterFamilies([family], [])[0]?.browse_external_level_reference,
    "Kindergarten–Grade 1",
  );
  for (const raw of ["0.1964285714", "0.1851851852–10.20383956", 5.825, "5.825", "1e-7"]) {
    assert.equal(teacherLevelLabel(raw), null);
  }
  assert.equal(teacherLevelLabel("Grades 5–6"), "Grades 5–6");
  assert.equal(
    registeredExternalLevel({ external_level_reference: "5.825" }, "external_level_reference"),
    null,
  );
});

test("all compact family and form VXGL values use the registered source labels without recalculation", () => {
  for (const kind of ["families", "forms"]) {
    const table = JSON.parse(
      gunzipSync(
        readFileSync(
          join(process.cwd(), `data/releases/2026-10-20-a-main-v1/reference/${kind}.json.gz`),
        ),
      ).toString("utf8"),
    ) as { fields: string[]; rows: unknown[][] };
    let checked = 0;
    for (const row of table.rows) {
      const record = Object.fromEntries(table.fields.map((field, index) => [field, row[index]]));
      const field =
        kind === "families" ? "external_level_reference_display" : "external_level_reference";
      const label = registeredExternalLevel(record, field);
      assert.equal(label, record.external_level_reference_teacher_display ?? null);
      if (label) checked += 1;
      if (kind === "forms") {
        assert.equal(teacherFormRecord(record as never).external_level_reference, label);
      }
    }
    assert.ok(checked > 1000);
  }
});

// Captured from the Web adapter so each product repository tests independently.
test("App matches captured Web grade-label cases", () => {
  const cases = JSON.parse(
    readFileSync(join(process.cwd(), "tests/fixtures/web-external-level-labels.json"), "utf8"),
  );
  for (const item of cases) {
    assert.equal(registeredExternalLevel(item.input, item.field), item.expected);
  }
});
