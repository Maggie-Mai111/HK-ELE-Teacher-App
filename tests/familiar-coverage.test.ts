import assert from "node:assert/strict";
import test from "node:test";
import { normalizedAnalysis } from "../src/services/textNormalization.js";
import { makeFamily } from "./support/phase3-fixtures.js";
import type { SurfaceSearchResult } from "../src/domain/hkele.js";
test("a selected family credits only its registered familiar spelling, without losing the other spelling's match", async () => {
 const run = async (familiar: number) => normalizedAnalysis("tha", async () => ({ owners: [{ ...makeFamily("the",1), matched_form_evidence: { coverage_member: familiar } }], alternatives: [] } as unknown as SurfaceSearchResult));
 assert.equal((await run(1)).tokens[0]?.wordListMember,true);
 const other=await run(0);assert.equal(other.tokens[0]?.familyKey,"the");assert.equal(other.tokens[0]?.wordListMember,false);
});
