import assert from "node:assert/strict";
import test from "node:test";

import { strFromU8, unzipSync } from "fflate";

import type { TeachingListItem } from "../src/domain/teachingList.js";
import {
  teachingListToCsv,
  teachingListToMarkdown,
  teachingListToXlsx,
} from "../src/services/teachingListExport.js";

const items: TeachingListItem[] = [
  {
    basewordKey: "analyse",
    displayFamily: "analyse",
    status: "Practise",
    notes: 'Use a comma, then "compare".',
    connections: "analysis\nanalyser",
    customOrder: 0,
    addedAt: "2026-09-21T00:00:00.000Z",
    updatedAt: "2026-09-21T00:00:00.000Z",
    dataVersion: "2026-09-14-package67-v1",
    derived: {
      set_membership: "Candidate",
      overall_frequency_order: 42,
      current_hk_frequency_rank: 31,
      current_hk_frequency_band: "High",
      textbook_first_seen_level: "P4",
      external_level_reference_display: "B1",
    },
  },
];

test("CSV export preserves stable keys and quotes teacher text", () => {
  const csv = teachingListToCsv(items);
  assert.match(csv, /Family key,Family,Status/);
  assert.match(csv, /analyse,analyse,Practise/);
  assert.match(csv, /"Use a comma, then ""compare""\."/);
  assert.match(csv, /"analysis\r?\nanalyser"/);
});

test("Markdown export contains teacher fields and escapes the table", () => {
  const markdown = teachingListToMarkdown([{ ...items[0]!, notes: "contrast | compare" }]);
  assert.match(markdown, /^# HK-ELE Teaching List/m);
  assert.match(markdown, /contrast \\| compare/);
  assert.match(markdown, /Practise/);
});

test("Excel export is a valid OOXML package with filter and frozen header", () => {
  const workbook = unzipSync(teachingListToXlsx(items));
  assert.ok(workbook["[Content_Types].xml"]);
  assert.ok(workbook["xl/workbook.xml"]);
  assert.ok(workbook["xl/styles.xml"]);
  const sheet = strFromU8(workbook["xl/worksheets/sheet1.xml"]!);
  assert.match(sheet, /state="frozen"/);
  assert.match(sheet, /autoFilter ref="A1:M2"/);
  assert.match(sheet, /analyse/);
  assert.match(strFromU8(workbook["xl/styles.xml"]!), /FF176B45/);
});
