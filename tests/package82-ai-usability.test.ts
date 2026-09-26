import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { validateAiFilterResult } from "../src/domain/aiFilterSchema.js";
import type { FamilyRecord } from "../src/domain/hkele.js";
import { describeAiFilterConditions, executeAiFilter } from "../src/services/aiFilterExecutor.js";

const base = { clarifyingQuestion: null, warnings: [] as string[] };
const usabilityCases = [
  [
    "Grade",
    "Find Candidate words first observed by P3",
    { scope: "candidate", earliestObservedTo: "P3", limit: 25, sort: "overall" },
  ],
  [
    "Overall rank",
    "Show overall ranks 100 to 500",
    {
      scope: "inclusive_reference",
      overallRankMin: 100,
      overallRankMax: 500,
      limit: 25,
      sort: "overall",
    },
  ],
  [
    "HK rank",
    "Find HK ranks 1 to 800",
    { scope: "inclusive_reference", hkRankMin: 1, hkRankMax: 800, limit: 25, sort: "hk" },
  ],
  [
    "HK band",
    "Show HK Top 2k words",
    { scope: "inclusive_reference", hkBands: ["HK Top 2k"], limit: 25, sort: "hk" },
  ],
  [
    "Prefix",
    "Find registered prefix re",
    { scope: "inclusive_reference", prefix: "re", limit: 25, sort: "overall" },
  ],
  [
    "Suffix",
    "Find registered suffix tion",
    { scope: "inclusive_reference", suffix: "tion", limit: 25, sort: "overall" },
  ],
  [
    "Root",
    "Find registered root act",
    { scope: "inclusive_reference", root: "act", limit: 25, sort: "overall" },
  ],
  [
    "AWL",
    "Show AWL Candidate words",
    { scope: "candidate", awl: true, limit: 25, sort: "overall" },
  ],
  [
    "MSVL",
    "Show MSVL words",
    { scope: "inclusive_reference", msvl: true, limit: 25, sort: "overall" },
  ],
  [
    "MSVL subject",
    "Show MSVL Science words",
    { scope: "inclusive_reference", msvlSubjects: ["Science"], limit: 25, sort: "overall" },
  ],
  [
    "CPB 100",
    "Show CPB 100 words",
    { scope: "inclusive_reference", cpb100: true, limit: 25, sort: "overall" },
  ],
  [
    "Chinese grade",
    "找出最早在小四或以前出现的候选词",
    { scope: "candidate", earliestObservedTo: "P4", limit: 25, sort: "overall" },
  ],
  [
    "Chinese HK rank",
    "找香港排名首一千的候选及参考词",
    { scope: "inclusive_reference", hkRankMin: 1, hkRankMax: 1000, limit: 25, sort: "hk" },
  ],
  [
    "Combined exact",
    "Find 10 Candidate AWL words with suffix tion",
    { scope: "candidate", suffix: "tion", awl: true, limit: 10, sort: "overall" },
  ],
] as const;

test("14 representative teacher requests keep exactly the mocked explicit conditions", () => {
  for (const [label, query, filters] of usabilityCases) {
    const result = validateAiFilterResult({
      ...base,
      status: "ready",
      summary: `${label}: ${query}`.slice(0, 100),
      filters,
    });
    assert.deepEqual(result.filters, filters, label);
    assert.deepEqual(Object.keys(result.filters ?? {}).sort(), Object.keys(filters).sort(), label);
  }
});

test("zero result reports actual conditions and remains undoable in the Browse UI", () => {
  const family = {
    baseword_key: "act",
    display_family: "act",
    overall_frequency_order: 1,
    current_hk_frequency_rank: 1,
    candidate_member: 1,
    reference_member: 1,
    display_blocked: 0,
  } as FamilyRecord;
  const result = executeAiFilter(
    { families: [family], cpbFamilyKeys: new Set<string>() },
    { scope: "candidate", root: "not-registered", limit: 25, sort: "overall" },
  );
  assert.equal(result.matchedBeforeLimit, 0);
  assert.match(describeAiFilterConditions(result.filters).join(" | "), /Root: not-registered/);
  const browse = readFileSync("src/screens/BrowseScreen.tsx", "utf8");
  assert.match(browse, /Actual conditions:/);
  assert.match(browse, /Undo AI filter/);
  assert.match(browse, /no hidden condition was added/);
});

test("two unsupported requests are rejected without executable filters or guessed fields", () => {
  for (const summary of [
    "Animal compounds are not a registered field.",
    "Reranking and SQL are not supported.",
  ]) {
    const result = validateAiFilterResult({
      ...base,
      status: "unsupported",
      summary,
      filters: null,
    });
    assert.equal(result.filters, null);
  }
  const prompt = readFileSync("worker/src/prompt.ts", "utf8");
  assert.match(prompt, /Apply only conditions explicitly requested/);
  assert.match(prompt, /Never infer an extra grade, rank, band, morphology/);
  assert.match(prompt, /must return unsupported/);
});

test("Pages deployment is manual-only and selects controlled staging or production variables", () => {
  const workflow = readFileSync(".github/workflows/deploy-pages.yml", "utf8");
  assert.match(workflow, /^\s*workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s*push:/m);
  assert.match(workflow, /HKELE_STAGING_AI_FILTER_URL/);
  assert.match(workflow, /HKELE_PRODUCTION_AI_FILTER_URL/);
  assert.match(workflow, /HKELE_STAGING_TURNSTILE_SITE_KEY/);
  assert.match(workflow, /HKELE_PRODUCTION_TURNSTILE_SITE_KEY/);
  assert.match(workflow, /options:\s*\n\s*- staging\s*\n\s*- production/);
});
