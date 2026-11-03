import assert from "node:assert/strict";
import test from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import { collectEligibleFamilies, calculateCoverage, knowledgeCheckScope } from "../src/services/knowledgeTestService.js";
import { teachingListToXlsx } from "../src/services/teachingListExport.js";
import type { TeachingListItem } from "../src/domain/teachingList.js";
import { makeFamily, makeOccurrence } from "./support/phase3-fixtures.js";

test("knowledge judgements count only the presented spelling while scope keeps all matched forms", () => {
  const owner = makeFamily("student", 100);
  const text = [makeOccurrence("Students", owner, 0), makeOccurrence("student", owner, 9), makeOccurrence("students", owner, 17)];
  const families = collectEligibleFamilies(text);
  assert.equal(families[0]!.actualFormTokenCount, 2);
  assert.equal(families[0]!.tokenCount, 3);
  assert.equal(knowledgeCheckScope(text).eligibleOccurrences, 3);
  const known = calculateCoverage(families, { student: true });
  assert.equal(known.totalTokens, 2);
  assert.equal(known.knownTokens, 2);
  assert.equal(calculateCoverage(families, { student: false }).unfamiliarTokens, 2);
});

test("teacher Excel preserves selected spelling, lesson notes and grades without internal identity columns", () => {
  const item: TeachingListItem = { basewordKey: "internal-stress-key", displayFamily: "stress", selectedForms: ["stressed"], customOrder: 0, notes: "Explain this meaning", connections: "a stressful lesson", status: "Notice", addedAt: "", updatedAt: "", dataVersion: "internal-data-version", derived: { set_membership: "Candidate", overall_frequency_order: 1005, current_hk_frequency_rank: 1293, current_hk_frequency_band: "HK Top 2k", textbook_first_seen_level: "P5", external_level_reference_display: "Grade 6" } };
  const before = JSON.stringify(item);
  const sheet = strFromU8(unzipSync(teachingListToXlsx([item], "My lesson", true))["xl/worksheets/sheet1.xml"]!);
  for (const text of ["stressed", "My lesson", "Explain this meaning", "P5", "Grade 6", "1293"]) assert.ok(sheet.includes(text), text);
  for (const text of ["Family key", "Data version", "Earlier teaching depth", "Expression ID", "internal-stress-key", "internal-data-version"]) assert.ok(!sheet.includes(text), text);
  assert.equal(JSON.stringify(item), before);
  assert.ok(strFromU8(unzipSync(teachingListToXlsx([item]))["xl/worksheets/sheet1.xml"]!).includes("Family key"));
});
