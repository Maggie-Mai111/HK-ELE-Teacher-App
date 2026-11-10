import test from "node:test";
import assert from "node:assert/strict";
import { inCoverageFamily, inCoverageForm, passageCoverage } from "../src/services/coverageLists";
import type { ResolvedOccurrence, SearchFamilyOwner } from "../src/domain/hkele";
const owner=(rank:number,member=1):SearchFamilyOwner=>({baseword_key:`f${rank}`,overall_frequency_order:rank,candidate_member:rank<=1663?1:0,matched_form_evidence:{coverage_member:member}} as unknown as SearchFamilyOwner);
const occurrence=(o:SearchFamilyOwner,status="RESOLVED"):ResolvedOccurrence=>({status,owners:[o]} as ResolvedOccurrence);
test("90/95 boundaries are nested and missing, historical or unranked values never become a member",()=>{
  assert.ok(inCoverageFamily(owner(1663),"90"));assert.ok(!inCoverageFamily(owner(1664),"90"));
  assert.ok(inCoverageFamily(owner(2907),"95"));assert.ok(!inCoverageFamily(owner(2908),"95"));
  assert.ok(!inCoverageFamily({...owner(1),overall_frequency_order:null},"95"));
  assert.ok(!inCoverageForm(owner(2000,0),"95"));
});
test("repeated common occurrences stay in both the numerator and original-text denominator",()=>{
  const eight=Array.from({length:8},()=>occurrence(owner(1)));
  assert.deepEqual(passageCoverage(eight,"90"),{total:8,included:8,outside:0,percent:100});
  const mixed=[...eight,occurrence(owner(2000)),occurrence(owner(2000,0)),occurrence(owner(1),"AMBIGUOUS"),{status:"UNMATCHED",owners:[]} as unknown as ResolvedOccurrence];
  assert.equal(passageCoverage(mixed,"90").included,8);assert.equal(passageCoverage(mixed,"95").included,9);
  assert.equal(passageCoverage(mixed,"95").total,12);assert.equal(passageCoverage([],"90").percent,null);
});
