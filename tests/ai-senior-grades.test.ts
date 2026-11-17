import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { AI_FILTER_GRADES, validateAiFilterConditions } from "../src/domain/aiFilterSchema.js";
import { interpretAiFilter } from "../src/services/aiFilterClient.js";
import { aiEvidenceForms, type AiFormEvidence } from "../src/services/aiFormEvidence.js";
import { matchesAiWord, filterAiWordEvidence } from "../src/services/aiFormFilter.js";
import { describeAiFilterConditions } from "../src/services/aiFilterExecutor.js";
import { setWordView } from "../src/services/wordView.js";
import type { FamilyRecord, FormRecord } from "../src/domain/hkele.js";
import { handleRequest, type WorkerEnv } from "../worker/src/index.js";

const grades = ["P1", "P2", "P3", "P4", "P5", "P6", "S1", "S2", "S3", "S4", "S5", "S6"];
const common = { scope: "full", limit: 100, sort: "overall" } as const;

test("AI accepts all P1–S6 bounds, preserves inclusive order and rejects invalid stages", () => {
  assert.deepEqual([...AI_FILTER_GRADES], grades);
  for (let start = 0; start < grades.length; start++) {
    for (let end = start; end < grades.length; end++) {
      const conditions = validateAiFilterConditions({
        ...common,
        earliestObservedFrom: grades[start],
        earliestObservedTo: grades[end],
      });
      for (let observed = 0; observed < grades.length; observed++) {
        assert.equal(
          matchesAiWord({ first_seen_hk_textbooks: grades[observed] } as FormRecord, conditions),
          observed >= start && observed <= end,
        );
      }
      assert.equal(
        matchesAiWord({ first_seen_hk_textbooks: null } as FormRecord, conditions),
        false,
      );
    }
  }
  for (const invalid of ["S7", "S0", "Grade 10", "s4"])
    assert.throws(() => validateAiFilterConditions({ ...common, earliestObservedTo: invalid }));
  assert.throws(
    () =>
      validateAiFilterConditions({
        ...common,
        earliestObservedFrom: "S6",
        earliestObservedTo: "S4",
      }),
    /reversed/,
  );
});

test("actual S4, S5 and S6 form records are filtered independently within a family", () => {
  const evidence = JSON.parse(
    gunzipSync(
      readFileSync("public/assets/ai-form-evidence/20261103-wordlist1764-v1.json.gz"),
    ).toString(),
  ) as AiFormEvidence;
  setWordView("all");
  try {
    for (const [key, spelling, stage] of [
      ["cover", "coverage", "S4"],
      ["cover", "uncover", "S5"],
      ["suit", "suitability", "S6"],
    ]) {
      const forms = aiEvidenceForms(evidence, key!);
      assert.equal(forms.find((form) => form.form === spelling)?.first_seen_hk_textbooks, stage);
      const exact = validateAiFilterConditions({
        ...common,
        earliestObservedFrom: stage,
        earliestObservedTo: stage,
      });
      const result = filterAiWordEvidence(
        {
          families: [{ baseword_key: key, display_family: key } as FamilyRecord],
          cpbFamilyKeys: new Set(),
        },
        exact,
        () => forms,
      );
      assert.ok(result.families.some((row) => row.ai_match_form === spelling));
      assert.ok(result.families.every((row) => row.textbook_first_seen_level === stage));
    }
    const exactS4 = validateAiFilterConditions({
      ...common,
      earliestObservedFrom: "S4",
      earliestObservedTo: "S4",
    });
    assert.equal(
      matchesAiWord(
        aiEvidenceForms(evidence, "able").find((form) => form.form === "disability")!,
        exactS4,
      ),
      false,
    );
  } finally {
    setWordView("all");
  }
});

test("actual AI evidence retains navigation-only flags and excludes those forms from textbook filters", () => {
  const evidence = JSON.parse(
    gunzipSync(
      readFileSync("public/assets/ai-form-evidence/20261103-wordlist1764-v1.json.gz"),
    ).toString(),
  ) as AiFormEvidence;
  assert.ok(evidence.fields.includes("lookup_only"));
  setWordView("all");
  const filters = validateAiFilterConditions({
    ...common,
    earliestObservedFrom: "S4",
    earliestObservedTo: "S4",
  });
  let checked = 0;
  for (const key of Object.keys(evidence.families)) {
    for (const form of aiEvidenceForms(evidence, key)) {
      if (form.lookup_only && form.first_seen_hk_textbooks === "S4") {
        assert.equal(matchesAiWord(form, filters), false);
        checked++;
      }
    }
  }
  assert.equal(checked, 21);
});

test("client and both Worker environments retain S4–S6 requests and responses end to end", async () => {
  const cases = [
    ["Find words first seen in S4", { earliestObservedFrom: "S4", earliestObservedTo: "S4" }],
    ["Find words first seen in S5", { earliestObservedFrom: "S5", earliestObservedTo: "S5" }],
    ["Find words first seen in S6", { earliestObservedFrom: "S6", earliestObservedTo: "S6" }],
    [
      "Find words first seen from S4 to S6",
      { earliestObservedFrom: "S4", earliestObservedTo: "S6" },
    ],
    ["Find words first seen by S5", { earliestObservedTo: "S5" }],
    ["找最早在中四至中六教材出现的词", { earliestObservedFrom: "S4", earliestObservedTo: "S6" }],
  ] as const;
  const origin = "https://maggie-mai111.github.io";
  for (const environment of ["staging", "production"] as const) {
    for (const [query, bounds] of cases) {
      const ready = {
        status: "ready",
        summary: "Textbook records matching your request",
        filters: { ...common, ...bounds },
        clarifyingQuestion: null,
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
      let providerCalls = 0;
      const upstream: typeof fetch = async (input, init) => {
        if (String(input).includes("siteverify"))
          return Response.json({
            success: true,
            hostname: "maggie-mai111.github.io",
            action: "ai_filter",
          });
        providerCalls++;
        const body = JSON.parse(String(init?.body));
        assert.equal(body.messages[1].content, query);
        assert.match(body.messages[0].content, /S3 \| S4 \| S5 \| S6/);
        assert.match(body.messages[0].content, /not curriculum, proficiency or difficulty equivalence/);
        return Response.json({ choices: [{ message: { content: JSON.stringify(ready) } }] });
      };
      const result = await interpretAiFilter(
        { query, locale: "en-HK", surface: "browse" },
        {
          turnstileToken: "mock-only",
          anonymousSessionId: "123e4567-e89b-42d3-a456-426614174000",
        },
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
      assert.deepEqual(result.filters, ready.filters);
      assert.equal(providerCalls, 1);
      assert.ok(describeAiFilterConditions(result.filters!).some((text) => /S[456]/.test(text)));
    }
  }
});
