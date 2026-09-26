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
    makeOccurrence("repeats", makeFamily("repeat", 1), 7),
    makeOccurrence("repeated", makeFamily("repeat", 1), 15),
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

test("knowledge UI distinguishes sample estimates, exact checked results and progress", () => {
  const panel = source("src/components/KnowledgeTestPanel.tsx");
  for (const label of [
    "Quick sample (10)",
    "Larger sample (20)",
    "Full check",
    "Sample estimate",
    "Exact checked result",
    "Known",
    "Not known",
    "Unfamiliar families",
    "Unfamiliar token rate",
  ])
    assert.match(panel, new RegExp(label.replace(/[()]/g, "\\$&")));
  assert.match(panel, /coverage\.complete \? \(/);
  assert.match(panel, /eligible resolved families and their eligible tokens only/);
  assert.match(panel, /Vocabulary coverage is not the same as[\s\S]*reading comprehension/);
});

test("knowledge check has a visible entry immediately after Text summary", () => {
  const check = source("src/screens/CheckTextScreen.tsx");
  const summary = check.indexOf("Text summary");
  const entry = check.indexOf("Check word knowledge", summary);
  const preteach = check.indexOf("<PreteachPanel", summary);
  assert.ok(summary >= 0 && entry > summary && preteach > entry);
  assert.doesNotMatch(check, /title="Knowledge check"/);
});

test("Not known words have one-click Teaching List action with a session-only source", () => {
  const panel = source("src/components/KnowledgeTestPanel.tsx");
  const service = source("src/services/teachingListService.ts");
  const list = source("src/screens/TeachingListScreen.tsx");
  assert.match(panel, /Add marked word to Teaching list/);
  assert.match(panel, /Learner\/teacher marked as Not known/);
  assert.match(service, /sessionSources/);
  assert.doesNotMatch(service, /writeDocument\([^)]*sessionSources/);
  assert.match(list, /Source this session:/);
});

test("pre-teach suggestions remain deterministic, excluded and visibly reasoned", () => {
  const technical = makeFamily("technical", 3500, { awl: 1 });
  const results = [
    makeOccurrence("The", makeFamily("the", 1), 0),
    makeOccurrence("technical", technical, 4),
    { ...makeOccurrence("blocked", technical, 20), status: "BLOCKED" as const, owners: [] },
    {
      ...makeOccurrence("ambiguous", technical, 30),
      status: "AMBIGUOUS" as const,
      bestOwnerCount: 2,
      owners: [technical, makeFamily("other", 4000)],
    },
  ];
  const suggestions = generatePreteachSuggestions("The technical blocked ambiguous", results, "P4");
  assert.equal(suggestions.length, 1);
  assert.ok((suggestions[0]?.reasons.length ?? 0) > 0);
  const preteach = source("src/services/preteachService.ts");
  assert.doesNotMatch(preteach, /aiFilter|DeepSeek|LLM|fetch\(/i);
});

test("pre-teach UI separates direct marks from registered system reasons", () => {
  const panel = source("src/components/PreteachPanel.tsx");
  assert.match(panel, /Learner\/teacher marked as Not known/);
  assert.match(panel, /System-suggested words with registered reasons/);
  assert.match(panel, /No LLM selects, orders or explains them/);
  assert.match(
    panel,
    /Earliest observed.*sampled textbook evidence[\s\S]*not a[\s\S]*prescribed teaching year/,
  );
});
