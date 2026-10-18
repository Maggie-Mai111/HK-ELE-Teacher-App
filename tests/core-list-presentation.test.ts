import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";

import { familySetLabel, type FamilyRecord } from "../src/domain/hkele.js";
import type { TeachingListItem } from "../src/domain/teachingList.js";
import {
  teacherAiResult,
  teacherAiScope,
  teacherAiInterpreterQuery,
} from "../src/services/teacherAiPresentation.js";
import { inTeacherWordScope, teacherWordListLabel } from "../src/services/wordListPresentation.js";
import {
  teachingListToCsv,
  teachingListToMarkdown,
  teachingListToXlsx,
} from "../src/services/teachingListExport.js";

test("teacher membership unifies Reference-only and other records without mutating data", () => {
  for (const [membership, member, label] of [
    ["Candidate", 1, "Core list"],
    ["Reference only", 0, "Full database"],
    ["Other ranked database", 0, "Full database"],
    ["Unranked database", 0, "Full database"],
  ] as const) {
    const record = { set_membership: membership, candidate_member: member } as FamilyRecord;
    const before = JSON.stringify(record);
    assert.equal(familySetLabel(record), label);
    assert.equal(teacherWordListLabel(membership), label);
    assert.equal(JSON.stringify(record), before);
  }
  assert.equal(teacherWordListLabel(null), "Not recorded");
});

test("the unchanged Package67 saved data contains 3185 Core families and 245 additional records", () => {
  const packed = JSON.parse(
    gunzipSync(
      readFileSync("data/releases/2026-09-14-package67-v1/reference/families.json.gz"),
    ).toString(),
  ) as { fields: string[]; rows: unknown[][] };
  const families = packed.rows.map(
    (row) =>
      Object.fromEntries(
        packed.fields.map((field, index) => [field, row[index]]),
      ) as unknown as FamilyRecord,
  );
  assert.equal(families.filter((family) => inTeacherWordScope(family, "core")).length, 3185);
  assert.equal(families.filter((family) => inTeacherWordScope(family, "full")).length, 3430);
  const fabric = families.find((family) => family.baseword_key === "fabric")!;
  assert.equal(familySetLabel(fabric), "Full database");
  assert.equal(inTeacherWordScope(fabric, "core"), false);
  assert.equal(inTeacherWordScope(fabric, "full"), true);
});

test("old saved teaching lists export teacher labels while preserving raw membership and notes", () => {
  const item = {
    basewordKey: "fabric",
    displayFamily: "fabric",
    selectedForms: ["fabric"],
    status: "Practise",
    notes: "Reference to lesson 3",
    connections: "textiles",
    customOrder: 0,
    addedAt: "",
    updatedAt: "",
    dataVersion: "Package67",
    derived: {
      set_membership: "Reference only",
      overall_frequency_order: 3186,
      current_hk_frequency_rank: 3000,
      current_hk_frequency_band: "HK Top 3k",
      textbook_first_seen_level: "P6",
      external_level_reference_display: "Grade 6",
    },
  } as TeachingListItem;
  const before = JSON.stringify(item);
  for (const text of [
    teachingListToCsv([item]),
    teachingListToMarkdown([item]),
    strFromU8(unzipSync(teachingListToXlsx([item]))["xl/worksheets/sheet1.xml"]!),
  ]) {
    assert.match(text, /Full database/);
    assert.doesNotMatch(text, /Reference only/);
    assert.match(text, /Reference to lesson 3/);
    assert.match(text, /Practise/);
  }
  assert.equal(JSON.stringify(item), before);
});

test("reviewed AI filters default to Full and accept Core without changing other conditions", () => {
  const raw = {
    status: "ready" as const,
    summary: "Candidate and Reference families",
    filters: {
      scope: "inclusive_reference" as const,
      root: "act",
      limit: 20,
      sort: "overall" as const,
    },
    clarifyingQuestion: null,
    warnings: [],
  };
  const result = teacherAiResult(raw);
  assert.equal(result.filters?.scope, "full");
  assert.equal(result.filters?.root, "act");
  assert.equal(result.filters?.limit, 20);
  assert.match(result.summary, /Full database/);
  assert.doesNotMatch(result.summary, /Candidate|Reference/);
  assert.equal(raw.filters.scope, "inclusive_reference");
  assert.equal(teacherAiResult(raw, "core").filters?.scope, "candidate");
  assert.equal(teacherAiScope("Find the root act"), "full");
  assert.equal(teacherAiScope("Find Core list words", "full"), "core");
  assert.equal(teacherAiScope("Search the full database", "core"), "full");
  assert.equal(
    teacherAiInterpreterQuery("Find 10 Core list words with root act"),
    "Find 10 Candidate words with root act",
  );
  assert.equal(
    teacherAiInterpreterQuery("Search the full database for root act"),
    "Search the database for root act",
  );
  assert.equal(
    teacherAiResult({
      status: "unsupported",
      summary: "Not supported",
      filters: null,
      clarifyingQuestion: null,
      warnings: [],
    }).filters,
    null,
  );
});
