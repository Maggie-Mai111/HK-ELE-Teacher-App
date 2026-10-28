import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { describeAiFilterConditions, executeAiFilter } from "../src/services/aiFilterExecutor.js";

test("teacher-facing AI descriptions preserve numeric filters while labelling the actual evidence", () => {
  for (const [sort, label] of [
    ["overall", "Overall frequency"],
    ["hk", "HK frequency"],
    ["az", "A–Z"],
  ] as const) {
    const filters = {
      scope: "full" as const,
      sort,
      limit: 20,
      earliestObservedTo: "P4" as const,
      externalLevels: ["Grade 6"],
      cpb100: false,
    };
    const conditions = describeAiFilterConditions(filters).join(" · ");
    assert.ok(conditions.includes(`Sort: ${label}`));
    assert.ok(conditions.includes("First seen in HK textbooks: P4 or earlier"));
    assert.ok(conditions.includes("US grade reference: Grade 6"));
    assert.ok(conditions.includes("Common words: no"));
    assert.doesNotMatch(conditions, /Sort: (?:overall|hk|az)\b|External level:|CPB 100:/);
    assert.deepEqual(
      executeAiFilter({ families: [], cpbFamilyKeys: new Set() }, filters).filters,
      filters,
    );
  }
});

test("secondary word-form Add retains the originating lesson workflow", () => {
  const source = readFileSync("src/screens/WordDetailScreen.tsx", "utf8");
  assert.match(source, /teaching\.add\(family, form\.form, sourceLabel\)/);
  assert.match(source, /<FormTier[\s\S]*?sourceLabel=\{sourceLabel\}/);
});
