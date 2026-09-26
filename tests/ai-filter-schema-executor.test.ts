import assert from "node:assert/strict";
import test from "node:test";

import { AiFilterValidationError, validateAiFilterResult } from "../src/domain/aiFilterSchema.js";
import type { FamilyRecord } from "../src/domain/hkele.js";
import { executeAiFilter } from "../src/services/aiFilterExecutor.js";

function family(key: string, rank: number, values: Partial<FamilyRecord> = {}): FamilyRecord {
  return {
    baseword_key: key,
    display_family: key,
    overall_frequency_order: rank,
    overall_frequency_value: null,
    set_membership: rank <= 2 ? "Candidate" : "Reference only",
    current_hk_frequency_rank: rank * 100,
    current_hk_frequency_band: "HK Top 1k",
    textbook_first_seen_level: "P4",
    external_level_reference_display: null,
    candidate_member: rank <= 2 ? 1 : 0,
    reference_member: 1,
    display_blocked: 0,
    awl: 0,
    msvl: null,
    earlier_hk: 0,
    general_evidence_status: "AVAILABLE_UNCHANGED",
    ...values,
  };
}

test("allowlisted schema accepts a bounded ready result", () => {
  const value = validateAiFilterResult({
    status: "ready",
    summary: "10 words first observed by P4",
    filters: {
      scope: "inclusive_reference",
      earliestObservedTo: "P4",
      hkRankMin: 1,
      hkRankMax: 2000,
      suffix: "tion",
      limit: 10,
      sort: "hk",
    },
    clarifyingQuestion: null,
    warnings: [],
  });
  assert.equal(value.filters?.earliestObservedTo, "P4");
  assert.equal(value.filters?.suffix, "tion");
});

test("schema rejects unknown fields, reversed ranges and excessive limits", () => {
  const base = {
    status: "ready",
    summary: "summary",
    clarifyingQuestion: null,
    warnings: [],
  };
  assert.throws(
    () =>
      validateAiFilterResult({
        ...base,
        filters: { scope: "candidate", limit: 10, sort: "overall", sql: "select *" },
      }),
    AiFilterValidationError,
  );
  assert.throws(
    () =>
      validateAiFilterResult({
        ...base,
        filters: { scope: "candidate", hkRankMin: 10, hkRankMax: 1, limit: 10, sort: "hk" },
      }),
    AiFilterValidationError,
  );
  assert.throws(
    () =>
      validateAiFilterResult({
        ...base,
        filters: { scope: "candidate", limit: 101, sort: "overall" },
      }),
    AiFilterValidationError,
  );
});

test("unsupported semantic topics are valid only without executable filters", () => {
  const value = validateAiFilterResult({
    status: "unsupported",
    summary: "Animal compounds are not a registered HK-ELE field.",
    filters: null,
    clarifyingQuestion: null,
    warnings: [],
  });
  assert.equal(value.status, "unsupported");
  assert.throws(
    () =>
      validateAiFilterResult({
        ...value,
        filters: { scope: "candidate", limit: 10, sort: "overall" },
      }),
    AiFilterValidationError,
  );
});

test("deterministic executor applies grade, rank, morphology and subject filters", () => {
  const context = {
    families: [
      family("education", 2, {
        textbook_first_seen_level: "P4",
        browse_suffix: "tion",
        browse_root: "educate",
        msvl: "English Grammar and Writing|Science",
        awl: 1,
      }),
      family("action", 1, { textbook_first_seen_level: "P5", browse_suffix: "tion", awl: 1 }),
      family("early", 3, { textbook_first_seen_level: "P2", browse_suffix: "ly", msvl: "Science" }),
    ],
    cpbFamilyKeys: new Set<string>(),
  };
  const result = executeAiFilter(context, {
    scope: "inclusive_reference",
    earliestObservedTo: "P4",
    hkRankMin: 1,
    hkRankMax: 500,
    suffix: "tion",
    awl: true,
    msvlSubjects: ["Science"],
    limit: 10,
    sort: "hk",
  });
  assert.deepEqual(
    result.families.map((item) => item.baseword_key),
    ["education"],
  );
  assert.equal(result.matchedBeforeLimit, 1);
});

test("executor sorts stably, enforces scope and returns an honest empty result", () => {
  const context = {
    families: [family("beta", 2), family("alpha", 1), family("reference", 3)],
    cpbFamilyKeys: new Set(["alpha"]),
  };
  const cpb = executeAiFilter(context, { scope: "candidate", cpb100: true, limit: 10, sort: "az" });
  assert.deepEqual(
    cpb.families.map((item) => item.baseword_key),
    ["alpha"],
  );
  const empty = executeAiFilter(context, {
    scope: "candidate",
    root: "not-registered",
    limit: 10,
    sort: "overall",
  });
  assert.equal(empty.matchedBeforeLimit, 0);
  assert.deepEqual(empty.families, []);
});
