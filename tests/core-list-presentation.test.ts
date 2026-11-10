import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";

import { familySetLabel, type FamilyRecord } from "../src/domain/hkele.js";
import {setWordView} from "../src/services/wordView.js";
import type { TeachingListItem } from "../src/domain/teachingList.js";
import {
  teacherAiResult,
  teacherAiScope,
  teacherAiInterpreterQuery,
} from "../src/services/teacherAiPresentation.js";
import { inTeacherWordScope, teacherWordListLabel } from "../src/services/wordListPresentation.js";
import {
  teachingListToCsv,
  teachingListToMarkdown,
  teachingListToXlsx,
} from "../src/services/teachingListExport.js";

test("teacher membership unifies Reference-only and other records without mutating data", () => {
  for (const [membership, member, label] of [
    ["Candidate", 1, "HK-ELE Word List"],
    ["Reference only", 0, "Full database"],
    ["Other ranked database", 0, "Full database"],
    ["Unranked database", 0, "Full database"],
  ] as const) {
    const record = { set_membership: membership, candidate_member: member } as FamilyRecord;
    const before = JSON.stringify(record);
    assert.equal(familySetLabel(record), member === 1 ? "90% list family" : label);
    assert.equal(teacherWordListLabel(membership), label);
    assert.equal(JSON.stringify(record), before);
  }
  assert.equal(teacherWordListLabel(null), "Not recorded");
});

test("list labels follow the ranking view of the record, including saved full records", () => {
  try {
    for (const [view, limit] of [["all",2907],["familiar",3779]] as const) {
      const record=(rank:number|null)=>({candidate_member:0,overall_frequency_order:rank,...(view==="familiar"?{word_view:view}:{})}) as FamilyRecord;
      setWordView(view==="all"?"familiar":"all");
      assert.equal(familySetLabel(record(limit)),"95% list family");
      assert.equal(familySetLabel(record(limit+1)),"Full database");
      assert.equal(familySetLabel(record(null)),"Full database");
    }
    assert.equal(familySetLabel({candidate_member:0,overall_frequency_order:3300} as FamilyRecord),"Full database");
    assert.equal(familySetLabel({candidate_member:1,overall_frequency_order:1} as FamilyRecord),"90% list family");
  } finally {setWordView("all");}
});

test("every full-database label agrees with the sealed 2907-family list", () => {
  const read=(path:string)=>JSON.parse(gunzipSync(readFileSync(path)).toString());
  const projection=read("public/hkele-data/ai_full_projection.json.gz") as {fields:string[];rows:unknown[][]};
  const config=JSON.parse(readFileSync("src/config/coverageLists.json","utf-8")) as {files:{path:string}[]};
  const index=projection.fields.indexOf("baseword_key");
  const manifest=read("public/hkele-data/manifest.json.gz") as {browse_fields:string[]};
  const list=read("public/hkele-data/"+config.files[0]!.path) as unknown[][];
  const expected=new Set(list.map(row=>row[manifest.browse_fields.indexOf("baseword_key")]));
  assert.equal(expected.size,2907);
  let included=0;
  setWordView("familiar");
  try {for(const row of projection.rows){const f=Object.fromEntries(projection.fields.map((key,i)=>[key,row[i]])) as unknown as FamilyRecord;const label=familySetLabel(f);assert.equal(label!=="Full database",expected.has(row[index]),f.baseword_key);if(label!=="Full database")included++;}}
  finally {setWordView("all");}
  assert.equal(included,2907);
});

test("teacher Excel removes the lesson column while retaining notes, forms and backup data", () => {
  const item={basewordKey:"use",displayFamily:"use",selectedForms:["reusable"],status:"Practise",notes:"Keep the exact form",connections:"use again",customOrder:0,derived:{set_membership:"HK-ELE Word List"}} as TeachingListItem;
  const before=JSON.stringify(item);
  const sheet=(teacher:boolean)=>strFromU8(unzipSync(teachingListToXlsx([item],"Old saved lesson",teacher))["xl/worksheets/sheet1.xml"]!);
  const visible=sheet(true),backup=sheet(false);
  assert.match(visible,/<c r="A1"[^>]*><is><t[^>]*>Order<\/t>/);
  assert.doesNotMatch(visible,/>Lesson<\/t>|Old saved lesson/);
  assert.match(visible,/reusable/);assert.match(visible,/Keep the exact form/);
  assert.match(backup,/>Lesson<\/t>/);assert.match(backup,/Old saved lesson/);
  assert.equal(JSON.stringify(item),before);
});

test("the A-main compact data contains 1663 Core families and four related-owner records", () => {
  const packed = JSON.parse(
    gunzipSync(
      readFileSync("data/releases/2026-11-10-all-members1663-v1/reference/families.json.gz"),
    ).toString(),
  ) as { fields: string[]; rows: unknown[][] };
  const families = packed.rows.map(
    (row) =>
      Object.fromEntries(
        packed.fields.map((field, index) => [field, row[index]]),
      ) as unknown as FamilyRecord,
  );
  assert.equal(families.filter((family) => inTeacherWordScope(family, "core")).length, 1663);
  assert.equal(families.filter((family) => inTeacherWordScope(family, "full")).length, 3577);
  const fabric = families.find((family) => !family.candidate_member)!;
  assert.equal(familySetLabel(fabric), "Full database");
  assert.equal(inTeacherWordScope(fabric, "core"), false);
  assert.equal(inTeacherWordScope(fabric, "full"), true);
});

test("old saved teaching lists export teacher labels while preserving raw membership and notes", () => {
  const item = {
    basewordKey: "fabric",
    displayFamily: "fabric",
    selectedForms: ["fabric"],
    status: "Practise",
    notes: "Reference to lesson 3",
    connections: "textiles",
    customOrder: 0,
    addedAt: "",
    updatedAt: "",
    dataVersion: "Package67",
    derived: {
      set_membership: "Reference only",
      overall_frequency_order: 3186,
      current_hk_frequency_rank: 3000,
      current_hk_frequency_band: "HK Top 3k",
      textbook_first_seen_level: "P6",
      external_level_reference_display: "Grade 6",
    },
  } as TeachingListItem;
  const before = JSON.stringify(item);
  for (const text of [
    teachingListToCsv([item]),
    teachingListToMarkdown([item]),
    strFromU8(unzipSync(teachingListToXlsx([item]))["xl/worksheets/sheet1.xml"]!),
  ]) {
    assert.match(text, /Full database/);
    assert.doesNotMatch(text, /Reference only/);
    assert.match(text, /Reference to lesson 3/);
    assert.match(text, /Practise/);
  }
  assert.equal(JSON.stringify(item), before);
});

test("reviewed AI filters default to Full and accept Core without changing other conditions", () => {
  const raw = {
    status: "ready" as const,
    summary: "Candidate and Reference families",
    filters: {
      scope: "inclusive_reference" as const,
      root: "act",
      limit: 20,
      sort: "overall" as const,
    },
    clarifyingQuestion: null,
    warnings: [],
  };
  const result = teacherAiResult(raw);
  assert.equal(result.filters?.scope, "full");
  assert.equal(result.filters?.root, "act");
  assert.equal(result.filters?.limit, 20);
  assert.match(result.summary, /Full database/);
  assert.doesNotMatch(result.summary, /Candidate|Reference/);
  assert.equal(raw.filters.scope, "inclusive_reference");
  assert.equal(teacherAiResult(raw, "core").filters?.scope, "candidate");
  assert.equal(teacherAiScope("Find the root act"), "full");
  assert.equal(teacherAiScope("Find HK-ELE Word List words", "full"), "core");
  assert.equal(teacherAiScope("Search the full database", "core"), "full");
  assert.equal(
    teacherAiInterpreterQuery("Find 10 HK-ELE Word List words with root act"),
    "Find 10 Candidate words with root act",
  );
  assert.equal(
    teacherAiInterpreterQuery("Search the full database for root act"),
    "Search the database for root act",
  );
  assert.equal(
    teacherAiResult({
      status: "unsupported",
      summary: "Not supported",
      filters: null,
      clarifyingQuestion: null,
      warnings: [],
    }).filters,
    null,
  );
});
