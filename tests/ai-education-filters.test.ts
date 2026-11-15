import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { validateAiFilterConditions } from "../src/domain/aiFilterSchema.js";
import {
  US_REFERENCE_LABELS,
  canonicalUsReference,
  matchesUsReference,
  describeUsReference,
  hkStageForSchoolYear,
} from "../src/domain/educationFilters.js";
import type { FormRecord } from "../src/domain/hkele.js";
import { matchesAiWord, hasAiWordConditions } from "../src/services/aiFormFilter.js";
import {
  teacherAiScope,
  teacherAiInterpreterQuery,
} from "../src/services/teacherAiPresentation.js";
import { interpretAiFilter } from "../src/services/aiFilterClient.js";
import { handleRequest, type WorkerEnv } from "../worker/src/index.js";
import { SYSTEM_PROMPT } from "../worker/src/prompt.js";

const base = { scope: "full", limit: 100, sort: "overall" } as const;
const parse = (bounds: object) => validateAiFilterConditions({ ...base, ...bounds });

test("US source categories retain all 25 labels, accept aliases and reject invented levels", () => {
  assert.equal(US_REFERENCE_LABELS.length, 25);
  assert.deepEqual(parse({ externalLevels: [...US_REFERENCE_LABELS] }).externalLevels, [
    ...US_REFERENCE_LABELS,
  ]);
  for (const alias of ["College", "university", "大学", "Grade 12-College"])
    assert.equal(canonicalUsReference(alias), "Grade 12–College");
  assert.deepEqual(parse({ externalLevels: ["college", "大学", "Grade 6"] }).externalLevels, [
    "Grade 12–College",
    "Grade 6",
  ]);
  for (const invalid of [
    { externalLevels: ["College 2"] },
    { externalLevels: ["Graduate"] },
    { usGradeFrom: 13 },
    { usGradeFrom: -1 },
    { usGradeTo: 2.5 },
    { usGradeFrom: 10, usGradeTo: 7 },
    { usGradeMatch: "within" },
    { usGradeMatch: "exact", usGradeTo: 10 },
    { usCollege: "yes" },
    { externalLevels: ["Grade 6"], usGradeTo: 10 },
  ])
    assert.throws(() => parse(invalid));
});

test("US overlap, whole-range ceilings and college choices have distinct boundaries", () => {
  assert.deepEqual(
    US_REFERENCE_LABELS.filter((label) =>
      matchesUsReference(label, parse({ usGradeFrom: 10, usGradeTo: 10 })),
    ),
    ["Grades 9–10", "Grade 10", "Grades 10–11"],
  );
  const ceiling = parse({ usGradeTo: 10, usGradeMatch: "within" });
  assert.equal(matchesUsReference("Grades 9–10", ceiling), true);
  assert.equal(matchesUsReference("Grades 10–11", ceiling), false);
  assert.equal(matchesUsReference("Grade 12–College", ceiling), false);
  const floor = parse({ usGradeFrom: 7, usGradeMatch: "within" });
  assert.equal(matchesUsReference("Grades 6–7", floor), false);
  assert.equal(matchesUsReference("Grades 7–8", floor), true);
  assert.equal(matchesUsReference("Grade 12–College", floor), true);
  assert.equal(matchesUsReference(null, floor), false);
  assert.equal(matchesUsReference("—", parse({ usCollege: false })), false);
  assert.deepEqual(
    US_REFERENCE_LABELS.filter((label) => matchesUsReference(label, parse({ usCollege: true }))),
    ["Grade 12–College"],
  );
  assert.deepEqual(
    US_REFERENCE_LABELS.filter((label) =>
      matchesUsReference(label, parse({ usGradeFrom: 0, usGradeTo: 0 })),
    ),
    ["Kindergarten–Grade 1"],
  );
  assert.equal(
    matchesUsReference(
      "Grade 12–College",
      parse({ usGradeTo: 6, usGradeMatch: "within", usCollege: true }),
    ),
    true,
  );
  assert.equal(
    matchesUsReference("Grade 12–College", parse({ usGradeFrom: 12, usCollege: false })),
    false,
  );
  assert.match(describeUsReference(ceiling)!, /US grade reference: no higher than Grade 10/);
  assert.match(describeUsReference(parse({ usCollege: true }))!, /Grade 12–College/);
});

test("HK school-year correspondence never substitutes one evidence source for another", () => {
  assert.deepEqual(
    Array.from({ length: 12 }, (_, i) => hkStageForSchoolYear(i + 1)),
    ["P1", "P2", "P3", "P4", "P5", "P6", "S1", "S2", "S3", "S4", "S5", "S6"],
  );
  assert.equal(hkStageForSchoolYear(13), null);
  const us = parse({ usGradeFrom: 7, usGradeTo: 7 });
  assert.equal(hasAiWordConditions(us), true);
  assert.equal(
    matchesAiWord(
      { first_seen_hk_textbooks: "S1", external_level_reference: null } as FormRecord,
      us,
    ),
    false,
  );
  assert.equal(
    matchesAiWord(
      { first_seen_hk_textbooks: "P2", external_level_reference: "Grades 6–7" } as FormRecord,
      us,
    ),
    true,
  );
  const both = parse({
    earliestObservedFrom: "S1",
    earliestObservedTo: "S1",
    usGradeFrom: 7,
    usGradeTo: 7,
  });
  assert.equal(
    matchesAiWord(
      { first_seen_hk_textbooks: "P2", external_level_reference: "Grades 6–7" } as FormRecord,
      both,
    ),
    false,
  );
  assert.equal(
    matchesAiWord(
      { first_seen_hk_textbooks: "S1", external_level_reference: "Grades 6–7" } as FormRecord,
      both,
    ),
    true,
  );
  assert.equal(
    matchesAiWord(
      {
        lookup_only: true,
        first_seen_hk_textbooks: "S1",
        external_level_reference: "Grades 6–7",
      } as unknown as FormRecord,
      both,
    ),
    false,
  );
});

test("explicit 90/95 list target precedes generic names without rewriting teacher wording", () => {
  for (const query of [
    "Search the HK-ELE Word List 95%",
    "Search the full database 95% list",
    "核心词表95%",
  ])
    assert.equal(teacherAiScope(query), "core95");
  assert.equal(teacherAiScope("Full database 90% list"), "core");
  assert.equal(teacherAiScope("Find words with root act", "core95"), "core95");
  assert.equal(
    teacherAiInterpreterQuery(" Search the full database for HK Grade 10 "),
    "Search the full database for HK Grade 10",
  );
});

test("actual browser contract uses the same US semantics and list priority as App", () => {
  const context: Record<string, unknown> = { module: { exports: {} }, console };
  runInNewContext(readFileSync("tests/fixtures/web-ai-form-contract.js.txt", "utf8"), context);
  const web = (
    context.module as {
      exports: {
        validateConditions: typeof validateAiFilterConditions;
        teacherScope: typeof teacherAiScope;
      };
    }
  ).exports;
  const helper = context.HKELE_EDUCATION_FILTERS as {
    matchesUsReference: typeof matchesUsReference;
  };
  for (const bounds of [
    { usGradeFrom: 10, usGradeTo: 10 },
    { usGradeTo: 10, usGradeMatch: "within" },
    { usCollege: true },
    { externalLevels: ["College"] },
  ]) {
    const app = parse(bounds),
      browser = web.validateConditions({ ...base, ...bounds });
    assert.deepEqual(JSON.parse(JSON.stringify(browser)), app);
    for (const label of [...US_REFERENCE_LABELS, "", null])
      assert.equal(helper.matchesUsReference(label, browser), matchesUsReference(label, app));
  }
  assert.equal(web.teacherScope("Search HK-ELE Word List 95%"), "core95");
});

test("client and real Worker handlers accept US conditions and clarification with a mocked provider", async () => {
  const origin = "https://maggie-mai111.github.io";
  const cases = [
    [
      "Find words with US Grade 10 references",
      { usGradeFrom: 10, usGradeTo: 10, usGradeMatch: "overlap" },
    ],
    ["Find US grade references no higher than Grade 10", { usGradeTo: 10, usGradeMatch: "within" }],
    ["找美国年级参考中大学阶段的词", { usCollege: true }],
    ["HK Grade 10 textbook records", { earliestObservedFrom: "S4", earliestObservedTo: "S4" }],
    ["Find words for Grade 7", null],
  ] as const;
  for (const environment of ["staging", "production"] as const)
    for (const [query, bounds] of cases) {
      const response = bounds
        ? {
            status: "ready",
            summary: "Records matching your request",
            filters: { ...base, ...bounds },
            clarifyingQuestion: null,
            warnings: [],
          }
        : {
            status: "needs_clarification",
            summary: "Choose the grade source",
            filters: null,
            clarifyingQuestion: "Use HK textbook records or the US grade reference?",
            warnings: [],
          };
      const env: WorkerEnv = {
        ENVIRONMENT: environment,
        ALLOWED_ORIGIN: origin,
        TURNSTILE_SECRET_KEY: "mock-only",
        TURNSTILE_EXPECTED_HOSTNAME: "maggie-mai111.github.io",
        TURNSTILE_EXPECTED_ACTION: "ai_filter",
        DEEPSEEK_API_KEY: "mock-only",
        DEEPSEEK_MODEL: "deepseek-flash",
        DEEPSEEK_API_URL: "https://api.deepseek.com/chat/completions",
        AI_SESSION_RATE_LIMITER: { limit: async () => ({ success: true }) },
        AI_GLOBAL_RATE_LIMITER: { limit: async () => ({ success: true }) },
      };
      const upstream: typeof fetch = async (input, init) => {
        if (String(input).includes("siteverify"))
          return Response.json({
            success: true,
            hostname: "maggie-mai111.github.io",
            action: "ai_filter",
          });
        const body = JSON.parse(String(init?.body));
        assert.equal(body.messages[1].content, query);
        assert.match(body.messages[0].content, /US Grade 7/);
        assert.match(body.messages[0].content, /Full database IS supported/);
        assert.doesNotMatch(body.messages[0].content, /full database is not supported/i);
        return Response.json({ choices: [{ message: { content: JSON.stringify(response) } }] });
      };
      const result = await interpretAiFilter(
        { query, locale: "en-HK", surface: "browse" },
        { turnstileToken: "mock-only", anonymousSessionId: "123e4567-e89b-42d3-a456-426614174000" },
        {
          endpoint: "https://worker.example/api/ai/interpret-filter",
          fetchImpl: (input, init) =>
            handleRequest(
              new Request(String(input), {
                ...init,
                headers: { ...Object.fromEntries(new Headers(init?.headers)), origin },
              }),
              env,
              upstream,
            ),
        },
      );
      assert.deepEqual(result, response);
    }
  assert.match(SYSTEM_PROMPT, /25 choices/);
  assert.match(SYSTEM_PROMPT, /S1=7, S4=10, S6=12/);
});
