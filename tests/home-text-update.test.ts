import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import manifestJson from "../data/current-manifest.json";
import type { DataManifest } from "../src/domain/contracts";
import { assertCompatibleManifest, APPROVED_DATA_RELEASES } from "../src/domain/manifest";
import {
  lookupSupplementaryExpression,
  type ExpressionDataSource,
} from "../src/domain/supplementaryExpressions";
import { StaticShardRepository } from "../src/data/StaticShardRepository";
import { scan } from "../src/services/tokenizer";
import { knowledgeCheckScope } from "../src/services/knowledgeTestService";
import {
  groupContextReviews,
  groupUnmatchedWords,
  textResultsAreCurrent,
} from "../src/services/textResultPresentation";

const paragraph = `Last month, our school started a project to make the campus greener. At first, many students were not interested because they thought their actions would make little difference. However, our science teacher encouraged us to try.
My classmates and I decided to reduce plastic waste. We brought reusable water bottles, collected used paper, and reminded each other to recycle. After four weeks, we noticed that there was much less rubbish in our classroom.
This experience taught me that protecting the environment does not always require big changes. When everyone makes a small effort, we can achieve something meaningful together.`;

test("the classroom example reproduces 99 tokens, four data gaps and one distinct context check", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://fixture.invalid");
    assert.ok(url.pathname.startsWith("/hkele-data/"));
    return new Response(
      new Uint8Array(readFileSync(join(process.cwd(), "public", url.pathname.slice(1)))),
      { status: 200 },
    );
  };
  try {
    const results = await new StaticShardRepository(
      "https://fixture.invalid/hkele-data",
    ).resolveOccurrences(paragraph, scan(paragraph).occurrences);
    assert.equal(results.length, 99);
    assert.equal(results.filter((item) => item.status === "RESOLVED").length, 94);
    assert.deepEqual(knowledgeCheckScope(results), {
      totalOccurrences: 99,
      eligibleOccurrences: 94,
      excludedOccurrences: 5,
    });
    assert.deepEqual(
      groupUnmatchedWords(results).map((item) => item.displayForm),
      ["classmates", "classroom", "everyone", "something"],
    );
    const context = groupContextReviews(results);
    assert.equal(context.length, 1);
    assert.equal(context[0]?.displayForm, "does");
    assert.match(context[0]?.explanation ?? "", /sentence/);
    assert.equal(
      new Set(results.flatMap((item) => item.owners.map((owner) => owner.baseword_key))).size,
      78,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("results are valid only for the exact checked text", () => {
  assert.equal(textResultsAreCurrent("old text", null), false);
  assert.equal(textResultsAreCurrent("old text", "old text"), true);
  assert.equal(textResultsAreCurrent("changed text", "old text"), false);
  assert.equal(textResultsAreCurrent("old text ", "old text"), false);
});
test("unknown releases and self-declared schema compatibility cannot relax current controls", () => {
  const current = manifestJson as DataManifest;
  assert.throws(
    () => assertCompatibleManifest({ ...current, dataVersion: "unapproved-update" }, "1.0.0"),
    /Unregistered/,
  );
  assert.throws(
    () =>
      assertCompatibleManifest(
        { ...current, counts: { ...current.counts, candidate: 1 } },
        "1.0.0",
      ),
    /Frozen control mismatch/,
  );
  assert.throws(
    () =>
      assertCompatibleManifest(
        {
          ...current,
          schemaVersion: "2.0.0",
          compatibilityRules: { ...current.compatibilityRules, compatibleSchemaMajor: 2 },
        },
        "1.0.0",
      ),
    /Refusing to load/,
  );
});
test("an explicitly registered compatible release can carry new counts without changing screen code", () => {
  const current = manifestJson as DataManifest;
  const fixture = {
    ...current,
    dataVersion: "approved-fixture-only",
    counts: { ...current.counts, candidate: 3184, referenceOnly: 246 },
  };
  const policy = {
    ...APPROVED_DATA_RELEASES,
    releases: { ...APPROVED_DATA_RELEASES.releases, [fixture.dataVersion]: fixture.counts },
  };
  assert.doesNotThrow(() => assertCompatibleManifest(fixture, "1.0.0", policy));
  assert.throws(() => assertCompatibleManifest(fixture, "1.0.0"), /Unregistered/);
});
test("the optional expression layer uses exact registered records and never invents family ownership", async () => {
  assert.deepEqual(await lookupSupplementaryExpression(null, "fixture compound", "data-fixture"), {
    status: "EXPRESSION_LAYER_UNAVAILABLE",
  });
  const source: ExpressionDataSource = {
    descriptor: {
      schemaVersion: "1.0.0",
      productDataVersion: "data-fixture",
      expressionDataVersion: "expression-fixture",
      sourceSha256: "a".repeat(64),
      normalizationPolicyId: "exact-fixture",
      matchingPolicyId: "whole-expression-fixture",
      records: 1,
    },
    lookupExact: async (query) =>
      query === "fixture compound"
        ? {
            expressionId: "compound-1",
            displayExpression: query,
            normalizedExpression: query,
            kind: "COMPOUND",
            sourceVersion: "expression-fixture",
            componentFamilyKeys: null,
            componentMappingStatus: "NOT_PROVIDED",
          }
        : null,
  };
  const result = await lookupSupplementaryExpression(source, "fixture compound", "data-fixture");
  assert.equal(result.status, "MATCHED_EXPRESSION");
  if (result.status === "MATCHED_EXPRESSION")
    assert.equal(result.expression.componentFamilyKeys, null);
  assert.equal(
    (await lookupSupplementaryExpression(source, "fixture compounds", "data-fixture")).status,
    "NO_REGISTERED_EXPRESSION",
  );
  await assert.rejects(
    lookupSupplementaryExpression(source, "fixture compound", "wrong-data"),
    /incompatible/,
  );
});
