import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  normalizeAiInterpreterResult,
  validateAiFilterResult,
} from "../src/domain/aiFilterSchema.js";
import { teacherAiScope, teacherAiResult } from "../src/services/teacherAiPresentation.js";
import { describeAiFilterConditions } from "../src/services/aiFilterExecutor.js";

const raw = {
  status: "ready",
  summary: "Root act",
  requestedScope: "core95",
  filters: { scope: "full", root: "act", limit: 25, sort: "overall" },
  clarifyingQuestion: null,
  warnings: [],
};
test("explicit model intent survives review and confirmation for nonliteral list wording", () => {
  const parsed = validateAiFilterResult(raw);
  const scope = teacherAiScope("在百分之九十五的名單中找 act 詞根。", "full", parsed);
  assert.equal(scope, "core95");
  const reviewed = teacherAiResult(parsed, scope);
  assert.equal(teacherAiScope("在百分之九十五的名單中找 act 詞根。", "full", reviewed), "core95");
  assert.equal(describeAiFilterConditions(reviewed.filters!, scope)[0], "Search in: 95% list");
  assert.equal(reviewed.filters!.root, "act");
  assert.equal(
    teacherAiScope("Look through everything", "core95", { requestedScope: "full" }),
    "full",
  );
});
test("no requested scope keeps the current selection and legacy responses remain compatible", () => {
  assert.equal(teacherAiScope("Root act", "core95", { requestedScope: null }), "core95");
  assert.equal(teacherAiScope("Root act", "core", { requestedScope: null }), "core");
  assert.equal(teacherAiScope("95% list", "full"), "core95");
  assert.throws(() => validateAiFilterResult({ ...raw, requestedScope: "new-list" }));
});
test("real-provider omitted defaults and overlong display notes no longer reject valid filters", () => {
  const normalized = validateAiFilterResult(
    normalizeAiInterpreterResult({
      ...raw,
      filters: { root: "act" },
      summary: "A long summary ".repeat(15),
      warnings: ["Only available college-related source category is Grade 12–College."],
    }),
  );
  assert.deepEqual(normalized.filters, { scope: "full", root: "act", limit: 25, sort: "overall" });
  assert.ok(normalized.summary.length <= 100);
  assert.ok(normalized.warnings[0]!.length <= 60);
  assert.equal(normalized.requestedScope, "core95");
});
test("display normalization cannot discard invalid conditions or invent a clarification", () => {
  for (const value of [
    { ...raw, filters: { root: "x".repeat(33) } },
    { ...raw, filters: { sql: "select *" } },
    { ...raw, filters: { earliestObservedTo: "S7" } },
    { ...raw, extra: "not allowed" },
    { ...raw, status: "needs_clarification", filters: null, clarifyingQuestion: null },
  ])
    assert.throws(() => validateAiFilterResult(normalizeAiInterpreterResult(value)));
});
test("out-of-range result counts request an edit instead of silently shrinking the search", () => {
  for (const limit of [0, 200, 1000]) {
    const result = validateAiFilterResult(
      normalizeAiInterpreterResult({ ...raw, filters: { root: "act", limit } }),
    );
    assert.equal(result.status, "needs_clarification");
    assert.equal(result.filters, null);
    assert.match(result.clarifyingQuestion!, /1–100/);
  }
  assert.throws(() =>
    validateAiFilterResult(
      normalizeAiInterpreterResult({ ...raw, filters: { limit: 200, sql: "anything" } }),
    ),
  );
});
test("actual browser contract and App preserve the same reviewed scope and strict fields", () => {
  const ctx: Record<string, unknown> = { module: { exports: {} } };
  runInNewContext(readFileSync("tests/fixtures/web-ai-form-contract.js.txt", "utf8"), ctx);
  const web = (
    ctx.module as {
      exports: {
        validateResult: typeof validateAiFilterResult;
        teacherScope: typeof teacherAiScope;
        teacherResult: typeof teacherAiResult;
        describeConditions: typeof describeAiFilterConditions;
      };
    }
  ).exports;
  const parsed = web.validateResult(raw),
    scope = web.teacherScope("ninety five percent list", "full", parsed);
  assert.equal(scope, "core95");
  assert.equal(
    web.describeConditions(web.teacherResult(parsed, scope).filters!, scope)[0],
    "Scope: 95% list",
  );
  assert.throws(() => web.validateResult({ ...raw, requestedScope: "anything" }));
});
