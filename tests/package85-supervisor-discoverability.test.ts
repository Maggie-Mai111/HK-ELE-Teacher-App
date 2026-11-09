import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  calculateCoverage,
  collectEligibleFamilies,
  seededKnowledgeSample,
} from "../src/services/knowledgeTestService.js";
import { generatePreteachSuggestions } from "../src/services/preteachService.js";
import { makeFamily, makeOccurrence } from "./support/phase3-fixtures.js";

const source = (path: string) => readFileSync(path, "utf8");

test("known and unfamiliar family percentages are exact complements", () => {
  const families = ["one", "two", "three", "four"].map(
    (key, index) =>
      collectEligibleFamilies([makeOccurrence(key, makeFamily(key, index + 1), index)])[0]!,
  );
  const result = calculateCoverage(families, {
    one: true,
    two: true,
    three: true,
    four: false,
  });
  assert.equal(result.familyKnownPercent, 75);
  assert.equal(result.familyUnfamiliarPercent, 25);
  assert.equal((result.familyKnownPercent ?? 0) + (result.familyUnfamiliarPercent ?? 0), 100);
});

test("known token coverage and unfamiliar token rate are complementary and token weighted", () => {
  const repeated = collectEligibleFamilies([
    makeOccurrence("repeat", makeFamily("repeat", 1), 0),
    makeOccurrence("Repeat", makeFamily("repeat", 1), 7),
    makeOccurrence("repeat", makeFamily("repeat", 1), 15),
  ])[0]!;
  const once = collectEligibleFamilies([makeOccurrence("once", makeFamily("once", 2), 24)])[0]!;
  const result = calculateCoverage([repeated, once], { repeat: true, once: false });
  assert.equal(result.knownTokens, 3);
  assert.equal(result.unfamiliarTokens, 1);
  assert.equal(result.tokenCoveragePercent, 75);
  assert.equal(result.unfamiliarTokenRatePercent, 25);
  assert.equal((result.tokenCoveragePercent ?? 0) + (result.unfamiliarTokenRatePercent ?? 0), 100);
});

test("incomplete answers expose progress only and no final percentages", () => {
  const families = ["one", "two"].map(
    (key, index) =>
      collectEligibleFamilies([makeOccurrence(key, makeFamily(key, index + 1), index)])[0]!,
  );
  const result = calculateCoverage(families, { one: true });
  assert.equal(result.complete, false);
  assert.equal(result.answeredFamilies, 1);
  assert.equal(result.familyKnownPercent, null);
  assert.equal(result.familyUnfamiliarPercent, null);
  assert.equal(result.tokenCoveragePercent, null);
  assert.equal(result.unfamiliarTokenRatePercent, null);
});

test("ineligible unresolved, ambiguous, blocked, unsupported and unavailable items stay out", () => {
  const eligible = makeFamily("eligible", 1);
  const other = makeFamily("other", 2);
  const base = makeOccurrence("eligible", eligible, 0);
  const values = collectEligibleFamilies([
    base,
    {
      ...base,
      occurrenceId: "amb",
      status: "AMBIGUOUS",
      bestOwnerCount: 2,
      owners: [eligible, other],
    },
    { ...base, occurrenceId: "blocked", status: "BLOCKED", owners: [] },
    {
      ...base,
      occurrenceId: "unsupported",
      status: "UNSUPPORTED",
      owners: [],
      tokenStatus: "UNSUPPORTED_TOKEN",
    },
    { ...base, occurrenceId: "unmatched", status: "UNMATCHED", owners: [] },
    { ...base, occurrenceId: "unavailable", status: "FULL_DATABASE_CHECK_UNAVAILABLE", owners: [] },
  ]);
  assert.equal(values.length, 1);
  assert.equal(values[0]?.tokenCount, 1);
});

test("empty and fewer-than-ten checks retain safe denominators", () => {
  const empty = calculateCoverage([], {});
  assert.equal(empty.complete, false);
  assert.equal(empty.totalFamilies, 0);
  assert.equal(empty.familyKnownPercent, null);
  const families = ["one", "two", "three"].map(
    (key, index) =>
      collectEligibleFamilies([makeOccurrence(key, makeFamily(key, index + 1), index)])[0]!,
  );
  assert.equal(seededKnowledgeSample(families, 10, "small").length, 3);
});

test("all Known and all Not known produce bounded complementary extremes", () => {
  const families = ["one", "two"].map(
    (key, index) =>
      collectEligibleFamilies([makeOccurrence(key, makeFamily(key, index + 1), index)])[0]!,
  );
  const allKnown = calculateCoverage(families, { one: true, two: true });
  const noneKnown = calculateCoverage(families, { one: false, two: false });
  assert.deepEqual(
    [
      allKnown.familyKnownPercent,
      allKnown.familyUnfamiliarPercent,
      allKnown.tokenCoveragePercent,
      allKnown.unfamiliarTokenRatePercent,
    ],
    [100, 0, 100, 0],
  );
  assert.deepEqual(
    [
      noneKnown.familyKnownPercent,
      noneKnown.familyUnfamiliarPercent,
      noneKnown.tokenCoveragePercent,
      noneKnown.unfamiliarTokenRatePercent,
    ],
    [0, 100, 0, 100],
  );
});

test("knowledge UI reports only answers to the examples shown, without extrapolated percentages",()=>{
 const panel=source("src/components/KnowledgeTestPanel.tsx");
 for(const text of ["Quick check (10)","More words (20)","All matched families","Known:","May need explaining:","not a score for the whole text or class"] )assert.ok(panel.includes(text));
 assert.doesNotMatch(panel,/tokenCoveragePercent|unfamiliarTokenRatePercent|familyKnownPercent/);
 assert.match(panel,/Mark the remaining words/);
});

test("knowledge check remains optional after the reader and pre-teach suggestions", () => {
  const check = source("src/screens/CheckTextScreen.tsx");
  const summary = check.indexOf('accessibilityLabel="Checked text"');
  const entry = check.indexOf("Check word familiarity", summary);
  const preteach = check.indexOf("<PreteachPanel", summary);
  assert.ok(summary >= 0 && preteach > summary && entry > preteach);
  assert.doesNotMatch(check, /title="Knowledge check"/);
});

test("Not known words have one-click Teaching List action with a session-only source", () => {
  const panel = source("src/components/KnowledgeTestPanel.tsx");
  const service = source("src/services/teachingListService.ts");
  const list = source("src/screens/TeachingListScreen.tsx");
  assert.match(panel, /Add to selected words/);
  assert.match(panel, /Chosen from word check/);
  assert.match(service, /sessionSources/);
  assert.doesNotMatch(service, /writeDocument\([^)]*sessionSources/);
  assert.doesNotMatch(list, /Source this session:/);
});

test("teacher marks select explanation uses without AI judgement or invented ownership",()=>{
 const a=makeOccurrence("technical",makeFamily("technical",3500),4);
 assert.equal(generatePreteachSuggestions("",[a],"P4").length,0);
 assert.equal(generatePreteachSuggestions("",[a],"P4",Infinity,{judgements:{[a.occurrenceId]:false}}).length,1);
 assert.doesNotMatch(source("src/services/preteachService.ts"),/aiFilter|DeepSeek|LLM|fetch\(/i);
});

test("explanation panel separates teacher marks from optional factual filters",()=>{
 const panel=source("src/components/PreteachPanel.tsx");
 for(const value of ["Words to explain","Browse words by records","onOpenWord","preteachEvidence","slice(0, limit)"])assert.ok(panel.includes(value));
 assert.doesNotMatch(panel,/Suggested when|rank of 1,001/);
});
