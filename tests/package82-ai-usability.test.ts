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
    "Overall family rank",
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

test("zero result reports confirmed conditions and remains clearable in the Browse UI", () => {
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
  assert.match(browse, /matching words[\s\S]*showing\s+first/);
  assert.match(browse, /label="Clear results"/);
  assert.match(browse, /label="Edit AI request"/);
  assert.match(browse, /label="Browse and sort words"/);
  assert.match(browse, /No words match all your filters/);
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

function assertAutoStagingPolicy(workflow: string) {
  const push = workflow.match(/^  push:\r?\n((?:[ \t]{4,}.*\r?\n)+)/m);
  assert.ok(push, "push trigger is required");
  assert.deepEqual(push[1]!.split(/\r?\n/).map(line => line.trim()).filter(Boolean), ["branches:", "- main"]);
  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.match(workflow, /^  build:\s*\n    if: github\.ref == 'refs\/heads\/main'\s*$/m);
  assert.doesNotMatch(workflow, /^  (?:pull_request|pull_request_target):/m);
  for (const line of [
    "EXPO_PUBLIC_HKELE_ENVIRONMENT: staging",
    "EXPO_PUBLIC_HKELE_AI_FILTER_URL: ${{ vars.HKELE_STAGING_AI_FILTER_URL }}",
    "EXPO_PUBLIC_HKELE_TURNSTILE_SITE_KEY: ${{ vars.HKELE_STAGING_TURNSTILE_SITE_KEY }}",
    "EXPO_PUBLIC_HKELE_RELEASE_CHANNEL: web-staging",
  ]) assert.ok(workflow.includes(line), line);
  assert.doesNotMatch(workflow, /inputs\.environment|HKELE_PRODUCTION_/);
  const required = ["pnpm install --frozen-lockfile", "pnpm run validate:public", "pnpm run typecheck", "pnpm run lint", "pnpm run build:web", "pnpm run validate:pwa", "pnpm test", "uses: actions/upload-pages-artifact"];
  let previous = -1;
  for (const step of required) {
    const index = workflow.indexOf(step);
    assert.ok(index > previous, `required ordered step: ${step}`);previous = index;
  }
  assert.match(workflow, /needs: build/);
  assert.match(workflow, /uses: actions\/deploy-pages@v4/);
}

test("Pages deploys main pushes automatically to staging and preserves build-before-test-before-upload", () => {
  const workflow = readFileSync(".github/workflows/deploy-pages.yml", "utf8");
  assertAutoStagingPolicy(workflow);
  // Ensure this check rejects regressions instead of accepting any rewritten workflow.
  for (const invalid of [
    workflow.replace("  push:", "  push_disabled:"),
    workflow.replace("- main", "- feature"),
    workflow.replace("- main", "- main\n      - feature"),
    workflow.replace("    if: github.ref == 'refs/heads/main'", "    if: true"),
    workflow.replace("EXPO_PUBLIC_HKELE_ENVIRONMENT: staging", "EXPO_PUBLIC_HKELE_ENVIRONMENT: production"),
    workflow.replace("HKELE_STAGING_AI_FILTER_URL", "HKELE_PRODUCTION_AI_FILTER_URL"),
    workflow.replace("run: pnpm test", "run: echo skipped"),
  ]) assert.throws(() => assertAutoStagingPolicy(invalid));
});
