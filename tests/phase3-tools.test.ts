import assert from "node:assert/strict";
import test from "node:test";

import type { FormRecord } from "../src/domain/hkele.js";
import { CPB_ITEMS, matchCpb100, normalizeCpbSurface } from "../src/services/cpbService.js";
import { hkFrequencyDisplay, inHkRange, validHkRange } from "../src/services/frequencyService.js";
import {
  calculateCoverage,
  collectEligibleFamilies,
  seededKnowledgeSample,
  tokenCoverageGuidance,
} from "../src/services/knowledgeTestService.js";
import { safeMorphologySegments } from "../src/services/morphologyService.js";
import { generatePreteachSuggestions } from "../src/services/preteachService.js";
import { estimateSyllables, estimateTextComplexity } from "../src/services/readabilityService.js";
import { makeFamily, makeOccurrence } from "./support/phase3-fixtures.js";

test("CPB runtime list is exactly ranks 1-100", () => {
  assert.equal(CPB_ITEMS.length, 100);
  assert.deepEqual(
    CPB_ITEMS.map((item) => item.rank),
    Array.from({ length: 100 }, (_, index) => index + 1),
  );
});

test("CPB matching normalizes case and registered curly apostrophes independently", () => {
  assert.equal(matchCpb100("THE")?.rank, 1);
  assert.equal(matchCpb100("It’s")?.rank, 49);
  assert.equal(matchCpb100("Don’t")?.rank, 68);
  assert.equal(normalizeCpbSurface(" I’m "), "i'm");
  assert.equal(matchCpb100("outside"), null);
});

test("HK frequency bands and custom ranges are rank-based", () => {
  assert.equal(hkFrequencyDisplay(1).band, "top-1k");
  assert.equal(hkFrequencyDisplay(1000).band, "top-1k");
  assert.equal(hkFrequencyDisplay(1001).band, "next-1k");
  assert.equal(hkFrequencyDisplay(2001).band, "later");
  assert.equal(hkFrequencyDisplay(null).band, "unranked");
  assert.equal(validHkRange(500, 2000), true);
  assert.equal(validHkRange(2000, 500), false);
  assert.equal(inHkRange(1500, 500, 2000), true);
  assert.equal(inHkRange(null, 1, 500), false);
});

test("knowledge-test eligibility groups exact resolved family tokens only", () => {
  const drive = makeFamily("drive", 394);
  const values = collectEligibleFamilies([
    makeOccurrence("Drive", drive, 0),
    makeOccurrence("drives", drive, 6),
    { ...makeOccurrence("US", drive, 14), status: "BLOCKED", owners: [] },
  ]);
  assert.equal(values.length, 1);
  assert.equal(values[0]?.basewordKey, "drive");
  assert.equal(values[0]?.tokenCount, 2);
  assert.equal(values[0]?.actualForm, "Drive");
});

test("knowledge samples are deterministic for an injectable seed", () => {
  const values = Array.from({ length: 25 }, (_, index) => {
    const family = makeFamily(`family-${index}`, index + 1);
    return collectEligibleFamilies([makeOccurrence(`word${index}`, family, index)])[0]!;
  });
  const first = seededKnowledgeSample(values, 10, "fixed-seed").map((item) => item.basewordKey);
  const second = seededKnowledgeSample(values, 10, "fixed-seed").map((item) => item.basewordKey);
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, 10);
});

test("sample coverage stays unavailable until every sampled family is answered", () => {
  const one = collectEligibleFamilies([makeOccurrence("one", makeFamily("one", 1), 0)])[0]!;
  const two = collectEligibleFamilies([
    makeOccurrence("two", makeFamily("two", 2), 4),
    makeOccurrence("two", makeFamily("two", 2), 8),
  ])[0]!;
  assert.equal(calculateCoverage([one, two], { one: true }).complete, false);
  const complete = calculateCoverage([one, two], { one: true, two: false });
  assert.equal(complete.familyKnownPercent, 50);
  assert.equal(complete.familyUnfamiliarPercent, 50);
  assert.equal(complete.knownFamilies, 1);
  assert.equal(complete.unfamiliarFamilies, 1);
  assert.ok(Math.abs((complete.tokenCoveragePercent ?? 0) - 100 / 3) < 1e-10);
  assert.ok(Math.abs((complete.unfamiliarTokenRatePercent ?? 0) - 200 / 3) < 1e-10);
  assert.equal(
    (complete.tokenCoveragePercent ?? 0) + (complete.unfamiliarTokenRatePercent ?? 0),
    100,
  );
  assert.match(tokenCoverageGuidance(85), /substantial support/);
  assert.match(tokenCoverageGuidance(100), /Complete lexical coverage/);
});

test("text complexity enforces its minimum and returns named formula values", () => {
  assert.equal(estimateTextComplexity("A short text.", ["A", "short", "text"]).status, "TOO_SHORT");
  const words = Array.from({ length: 30 }, () => "simple");
  const value = estimateTextComplexity(`${words.join(" ")}.`, words);
  assert.equal(value.status, "READY");
  assert.equal(value.words, 30);
  assert.equal(value.sentences, 1);
  assert.equal(estimateSyllables("simple"), 2);
  assert.ok(Number.isFinite(value.fleschReadingEase));
  assert.ok(Number.isFinite(value.fleschKincaidGrade));
});

test("safe morphology highlights only exact registered concatenation", () => {
  const form: FormRecord = {
    form_key: "f:driver",
    baseword_key: "drive",
    form: "driver",
    normalized_form: "driver",
    first_seen_hk_textbooks: null,
    external_level_reference: null,
    academic_subject_evidence: null,
    awl: null,
    msvl: null,
    root: "drive",
    root_meaning: null,
    prefix: null,
    suffix: "r",
  };
  assert.deepEqual(safeMorphologySegments(form), [
    { kind: "root", text: "drive" },
    { kind: "suffix", text: "r" },
  ]);
  assert.equal(
    safeMorphologySegments({ ...form, form: "driving", normalized_form: "driving", suffix: "ing" }),
    null,
  );
  assert.equal(safeMorphologySegments({ ...form, prefix: "re · over" }), null);
});

test("teacher chooses explanation uses; record browsing preserves exact evidence and no inferred ownership",()=>{
 const f=makeFamily("technical",3500,{matched_form_evidence:{awl:1,first_seen_hk_textbooks:"S1"} as FormRecord});
 const a=makeOccurrence("technical",f,0),b=makeOccurrence("technical",f,10);
 const ambiguous={...makeOccurrence("unclear",f,30),status:"AMBIGUOUS" as const,owners:[f,makeFamily("other",50)]};
 const items=[a,b,ambiguous];
 assert.deepEqual(generatePreteachSuggestions("",items,"P4"),[]);
 const entries=generatePreteachSuggestions("",items,"P4",Infinity,{filter:"all"});
 assert.equal(entries.length,1);assert.equal(entries[0]!.occurrences,2);
 assert.ok(entries[0]!.reasons.includes("Listed in AWL"));
 assert.ok(entries[0]!.reasons.includes("Textbooks: S1 · after P4"));
});
