import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import type { FamilyDetail, FamilyRecord, FormRecord } from "../src/domain/hkele";
import type { TeachingListItem } from "../src/domain/teachingList";
import { refreshSavedSelection } from "../src/services/lessonDataRefresh";
import {
  teachingListToCsv,
  teachingListToMarkdown,
  teachingListToXlsx,
} from "../src/services/teachingListExport";
import { unzipSync as unzipArchive, strFromU8 } from "fflate";

const manifest = JSON.parse(
  gunzipSync(readFileSync("public/hkele-data/manifest.json.gz")).toString(),
);
function detail(key: string): FamilyDetail {
  let hash = 2166136261;
  for (const byte of new TextEncoder().encode(key)) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  const bucket = String(hash % manifest.detail_buckets).padStart(3, "0");
  const [family, forms] = JSON.parse(
    gunzipSync(readFileSync(`public/hkele-data/detail/${bucket}.json.gz`)).toString(),
  )[key];
  const inflate = (fields: string[], row: unknown[]) =>
    Object.fromEntries(fields.map((f, i) => [f, row[i]]));
  return {
    family: inflate(manifest.family_fields, family) as FamilyRecord,
    forms: forms.map((row: unknown[]) => inflate(manifest.form_fields, row) as FormRecord),
  };
}
const saved = (key: string, word: string): TeachingListItem => ({
  basewordKey: key,
  displayFamily: key,
  status: "Practise",
  teachingFocus: "focus",
  notes: "A teacher's own note, unchanged",
  connections: "target meaning and example",
  sourceLabels: ["Check a text"],
  selectedForms: [word],
  customOrder: 4,
  addedAt: "2026-10-14",
  updatedAt: "2026-10-20",
  dataVersion: "2026-09-14-package67-v1",
  derived: {
    set_membership: "Candidate",
    overall_frequency_order: 19,
    current_hk_frequency_rank: 20,
    current_hk_frequency_band: "HK Top 1k",
    textbook_first_seen_level: null,
    external_level_reference_display: null,
  },
});
test("A refresh retains the teacher's exact form, plan, order, notes and original evidence snapshot", () => {
  const old = saved("use", "reusable"),
    before = JSON.stringify(old),
    next = refreshSavedSelection(old, detail("use"));
  for (const field of [
    "selectedForms",
    "notes",
    "connections",
    "customOrder",
    "teachingFocus",
    "status",
    "sourceLabels",
    "addedAt",
    "updatedAt",
  ] as const)
    assert.deepEqual(next[field], old[field]);
  assert.equal(next.dataVersion, "2026-10-20-a-main-v1");
  assert.equal(next.derived.overall_frequency_order, detail("use").family.overall_frequency_order);
  assert.equal(next.previousEvidence?.dataVersion, old.dataVersion);
  assert.equal(JSON.stringify(old), before);
});
test("a repaired owner never silently moves an old selection or replaces its frequency snapshot", () => {
  const old = saved("absorpt", "absorption"),
    next = refreshSavedSelection(old, detail("absorpt"));
  assert.equal(next.basewordKey, "absorpt");
  assert.deepEqual(next.selectedForms, ["absorption"]);
  assert.deepEqual(next.derived, old.derived);
  assert.equal(next.dataVersion, old.dataVersion);
  assert.match(next.dataReviewStatus!, /Saved selection kept/);
  assert.ok(detail("absorb").forms.some((form) => form.normalized_form === "absorption"));
  for (const output of [
    teachingListToCsv([next], "My lesson"),
    teachingListToMarkdown([next], "My lesson"),
    strFromU8(unzipArchive(teachingListToXlsx([next], "My lesson"))["xl/worksheets/sheet1.xml"]!),
  ]) {
    assert.match(output, /absorption/);
    assert.match(output, /Saved selection kept/);
    assert.match(output, /target meaning and example/);
  }
});
test("an old family label is not a substitute for a now differently owned recorded form", () => {
  const next = refreshSavedSelection(saved("alterable", "alterable"), detail("alterable"));
  assert.match(next.dataReviewStatus!, /check the word and family/);
});
