import assert from "node:assert/strict";
import test from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import type { FamilyRecord, ResolvedOccurrence } from "../src/domain/hkele.js";
import type { TeachingListItem } from "../src/domain/teachingList.js";
import {
  lessonChoicesFromResults,
  lessonFocusLabel,
  mergeLessonSelections,
} from "../src/services/lessonPlanning.js";
import {
  teachingListToCsv,
  teachingListToMarkdown,
  teachingListToXlsx,
} from "../src/services/teachingListExport.js";

const family = { baseword_key: "use", display_family: "use", candidate_member: 1 } as FamilyRecord;
const create = (owner: FamilyRecord, order: number): TeachingListItem => ({
  basewordKey: owner.baseword_key,
  displayFamily: owner.display_family,
  selectedForms: [],
  customOrder: order,
  notes: "",
  connections: "",
  status: "Notice",
  addedAt: "",
  updatedAt: "",
  dataVersion: "Package67",
  derived: {
    set_membership: "Candidate",
    overall_frequency_order: 10,
    current_hk_frequency_rank: 20,
    current_hk_frequency_band: "HK Top 1k",
    textbook_first_seen_level: "P1",
    external_level_reference_display: "Grade 1",
  },
});

test("batch selections keep observed forms and existing teacher decisions without mutating the saved list", () => {
  const item = {
    ...create(family, 0),
    selectedForms: ["used"],
    notes: "Compare reuse",
    connections: "recycle",
    status: "Master" as const,
    teachingFocus: "mention" as const,
  };
  const original = JSON.stringify(item);
  const result = mergeLessonSelections(
    [item],
    [
      { family, selectedForms: ["reusable", "used", "reusable"], sourceLabel: "Check a text" },
      { family, selectedForms: ["reuse"], sourceLabel: "Check a text" },
    ],
    create,
  );
  assert.equal(result.added, 0);
  assert.equal(result.formsAdded, 2);
  assert.deepEqual(result.items[0]?.selectedForms, ["used", "reusable", "reuse"]);
  assert.equal(result.items[0]?.notes, "Compare reuse");
  assert.equal(result.items[0]?.connections, "recycle");
  assert.equal(result.items[0]?.status, "Master");
  assert.equal(result.items[0]?.teachingFocus, "mention");
  assert.deepEqual(result.items[0]?.sourceLabels, ["Check a text"]);
  assert.equal(JSON.stringify(item), original);
});

test("passage choices include unique registered families only and never retain passage context", () => {
  const occurrence = (surface: string, owners: FamilyRecord[], status = "RESOLVED") =>
    ({ surface, owners, status, context: "private source passage" }) as ResolvedOccurrence;
  const result = lessonChoicesFromResults([
    occurrence("reusable", [family]),
    occurrence("reuse", [family]),
    occurrence("reusable", [family]),
    occurrence("missing", [], "UNMATCHED"),
    occurrence("ambiguous", [family, family], "AMBIGUOUS"),
    occurrence("blocked", [{ ...family, blocked: true }]),
  ]);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0]?.selectedForms, ["reusable", "reuse"]);
  assert.equal(JSON.stringify(result).includes("private source passage"), false);
});

test("new selections remain undecided and blocked or empty selections cannot create words", () => {
  const result = mergeLessonSelections(
    [],
    [
      { family, selectedForms: ["reusable"] },
      { family: { ...family, baseword_key: "blocked", blocked: true }, selectedForms: ["blocked"] },
      { family: { ...family, baseword_key: "empty" }, selectedForms: [" "] },
    ],
    create,
  );
  assert.equal(result.items.length, 1);
  assert.equal(lessonFocusLabel(result.items[0]?.teachingFocus), "Not decided");
  assert.equal(result.items[0]?.basewordKey, "use");
});

test("all exports carry lesson title, actual words, plan and legacy notes with escaped teacher text", () => {
  const items = [
    {
      ...create(family, 0),
      selectedForms: ["reusable"],
      teachingFocus: "focus" as const,
      notes: 'Compare <reuse> & "recycle"',
      connections: "Reference to lesson 3",
      status: "Practise" as const,
      sourceLabels: ["Check a text"],
    },
  ];
  const title = "P5 · A greener school & home";
  const csv = teachingListToCsv(items, title),
    md = teachingListToMarkdown(items, title);
  const sheet = strFromU8(unzipSync(teachingListToXlsx(items, title))["xl/worksheets/sheet1.xml"]!);
  for (const content of [csv, md, sheet]) {
    assert.match(content, /P5 · A greener school/);
    assert.match(content, /reusable/);
    assert.match(content, /Teach in depth/);
    assert.match(content, /Reference to lesson 3/);
    assert.match(content, /Practise/);
    assert.match(content, /Check a text/);
  }
  assert.match(sheet, /&lt;reuse&gt; &amp;/);
  assert.doesNotMatch(sheet, /<f>/);
  assert.match(csv, /"Compare <reuse> & ""recycle"""/);
});
