import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import test from "node:test";
import { StaticShardRepository } from "../src/data/StaticShardRepository.js";
import { HybridRepository } from "../src/data/HybridRepository.js";
import type { HkeleRepository, FamilyRecord, BrowseScope } from "../src/domain/hkele.js";
import { executeAiFilter, prepareAiFilterContext } from "../src/services/aiFilterExecutor.js";
import { VERIFIED_AI_QUICK_EXAMPLES } from "../src/domain/verifiedAiExamples.js";

const rawProjection = readFileSync("public/hkele-data/ai_full_projection.json.gz");
const projection = JSON.parse(gunzipSync(rawProjection).toString()) as {
  fields: string[];
  rows: unknown[][];
  cpb100FamilyKeys: string[];
};
const families = projection.rows.map(
  (row) =>
    Object.fromEntries(
      projection.fields.map((field, index) => [field, row[index]]),
    ) as unknown as FamilyRecord,
);

test("full AI index covers all 163784 Package67 families with the unchanged 3185 Core members", () => {
  assert.equal(families.length, 163784);
  assert.equal(families.filter((f) => Boolean(f.candidate_member)).length, 3185);
  const context = { families, cpbFamilyKeys: new Set(projection.cpb100FamilyKeys) };
  const filters = [
    { scope: "full", earliestObservedTo: "P2", limit: 10, sort: "overall" },
    { scope: "full", hkBands: ["HK Top 1k"], limit: 10, sort: "hk" },
    { scope: "full", root: "act", limit: 100, sort: "overall" },
  ] as const;
  assert.deepEqual(
    filters.map((f) => executeAiFilter(context, f).matchedBeforeLimit),
    VERIFIED_AI_QUICK_EXAMPLES.map((f) => f.verifiedMatchCount),
  );
  const fullRoot = executeAiFilter(context, filters[2]);
  assert.ok(fullRoot.families.some((f) => !f.candidate_member && !f.reference_member));
  assert.equal(
    executeAiFilter(context, { ...filters[2], scope: "candidate" }).matchedBeforeLimit,
    7,
  );
  const fabric = families.find((f) => f.baseword_key === "fabric")!;
  assert.equal(fabric.candidate_member, 0);
  assert.ok(
    executeAiFilter(context, {
      scope: "full",
      overallRankMin: fabric.overall_frequency_order!,
      overallRankMax: fabric.overall_frequency_order!,
      limit: 10,
      sort: "overall",
    }).families.some((f) => f.baseword_key === "fabric"),
  );
});

test("static full AI loading rejects an incompatible index and permits retry", async () => {
  const original = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async (input) => {
    const rel = String(input).replace("/fixture/", "");
    if (rel === "ai_full_projection.json.gz" && attempts++ === 0) {
      const stale = {
        ...JSON.parse(gunzipSync(rawProjection).toString()),
        sourceResultEntrySha256: "different-release",
      };
      return new Response(new Uint8Array(gzipSync(JSON.stringify(stale))));
    }
    return new Response(new Uint8Array(readFileSync(`public/hkele-data/${rel}`)));
  };
  try {
    const repository = new StaticShardRepository("/fixture");
    await assert.rejects(repository.aiFilterFamilies("full"), /does not match/);
    assert.equal((await repository.aiFilterFamilies("full")).length, 163784);
    assert.equal(attempts, 2);
    assert.ok((await repository.aiFilterCpbFamilyKeys()).size > 0);
  } finally {
    globalThis.fetch = original;
  }
});

function fixtureRepo(load: (scope?: BrowseScope) => Promise<FamilyRecord[]>): HkeleRepository {
  return {
    aiFilterFamilies: load,
    aiFilterCpbFamilyKeys: async () => new Set(),
    getDataMode: () => "remote-full",
    browse: async () => {
      throw new Error("unused");
    },
    getFamily: async () => {
      throw new Error("unused");
    },
    searchSurface: async () => {
      throw new Error("unused");
    },
    resolveOccurrences: async () => [],
  };
}

test("full AI cannot silently fall back to the smaller saved wordlist", async () => {
  let fallbackCalls = 0;
  const full = fixtureRepo(async () => {
    throw new Error("offline");
  });
  const saved = fixtureRepo(async () => {
    fallbackCalls++;
    return families.filter((f) => Boolean(f.reference_member));
  });
  const hybrid = new HybridRepository(full, saved);
  await assert.rejects(hybrid.aiFilterFamilies("full"), /offline/);
  assert.equal(fallbackCalls, 0);
  assert.equal((await hybrid.aiFilterFamilies("core")).length, 3430);
  assert.equal(fallbackCalls, 1);
});

test("AI contexts are isolated by scope and failed full loading is retryable", async () => {
  let fail = true;
  const repository = fixtureRepo(async (scope) => {
    if (scope === "full" && fail) {
      fail = false;
      throw new Error("try again");
    }
    return scope === "core" ? families.slice(0, 1) : families.slice(0, 2);
  });
  assert.equal((await prepareAiFilterContext(repository, "core")).families.length, 1);
  await assert.rejects(prepareAiFilterContext(repository, "full"), /try again/);
  assert.equal((await prepareAiFilterContext(repository, "full")).families.length, 2);
  assert.equal((await prepareAiFilterContext(repository, "core")).families.length, 1);
});
