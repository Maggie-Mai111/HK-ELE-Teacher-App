import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { StaticShardRepository } from "../src/data/StaticShardRepository";
import type { HkeleRepository } from "../src/domain/hkele";
import type { TeachingListItem } from "../src/domain/teachingList";
import { prepareTeachingExportItems } from "../src/services/teachingExportEvidence";
import { teachingListToCsv, teachingListToMarkdown, teachingListToXlsx } from "../src/services/teachingListExport";

function savedItem(): TeachingListItem {
  return {
    basewordKey:"stress",displayFamily:"stress",status:"Notice",teachingFocus:"focus",
    notes:'Target meaning: under pressure, then "explain".',connections:"Compare stress and stressed.",
    selectedForms:["stressed"],customOrder:2,addedAt:"2026-10-29",updatedAt:"2026-10-29",
    sourceLabels:["Check a text"],dataVersion:"2026-11-10-all-members1663-v1",
    derived:{set_membership:"Candidate",overall_frequency_order:1025,current_hk_frequency_rank:1330,
      current_hk_frequency_band:"HK Top 2k",textbook_first_seen_level:"P5",external_level_reference_display:"Grade 6; Grades 6�C7; Grades 8�C9"},
  };
}

async function withData(run:(repository:StaticShardRepository)=>Promise<void>) {
  const prior=globalThis.fetch;
  globalThis.fetch=async(input)=>new Response(new Uint8Array(readFileSync(join(process.cwd(),"public/hkele-data",new URL(String(input)).pathname.replace(/^\/hkele-data\//,"")))));
  try {await run(new StaticShardRepository("https://export-fixture.invalid/hkele-data"));}
  finally {globalThis.fetch=prior;}
}

test("legacy lesson export reads the selected form's grade without rewriting the saved item",async()=>withData(async repository=>{
  const old=savedItem(),before=JSON.stringify(old);
  const [item]=await prepareTeachingExportItems([old],repository);
  assert.equal(item!.derived.external_level_reference_display,"Grade 6");
  assert.equal(item!.derived.textbook_first_seen_level,"P5");
  assert.equal(item!.derived.overall_frequency_order,1025);
  assert.equal(JSON.stringify(old),before);
  assert.deepEqual(item!.selectedForms,old.selectedForms);
  assert.equal(item!.notes,old.notes);assert.equal(item!.customOrder,2);
  const csv=teachingListToCsv([item!],"Teacher QA");
  assert.match(csv,/US grade reference/);assert.match(csv,/P5,Grade 6/);
  assert.doesNotMatch(csv,/�|6–7|8–9/);
  assert.match(csv,/Check a text/);
  assert.equal(teachingListToMarkdown([item!]),teachingListToMarkdown([old]));
  const sheet=strFromU8(unzipSync(teachingListToXlsx([item!]))["xl/worksheets/sheet1.xml"]!);
  assert.match(sheet,/Grade 6/);assert.doesNotMatch(sheet,/�|Grades 6/);
  assert.match(sheet,/autoFilter ref="A1:R2"/);
}));

test("multiple selected forms keep individual grades, textbook levels, spelling and order",async()=>withData(async repository=>{
  const old={...savedItem(),selectedForms:["stressful","stressed","stressors","unregistered-form"]};
  const [item]=await prepareTeachingExportItems([old],repository);
  assert.equal(item!.derived.external_level_reference_display,"stressful: Grades 8–9 | stressed: Grade 6 | stressors: Grades 6–7 | unregistered-form: —");
  assert.equal(item!.derived.textbook_first_seen_level,"stressful: P6 | stressed: P5 | stressors: — | unregistered-form: —");
  assert.equal(item!.dataReviewStatus,"Word form needs review");
  assert.deepEqual(item!.selectedForms,old.selectedForms);
}));

test("retired or uncheckable selections export notes without assigning family aggregate evidence",async()=>{
  const repository={getDataVersion:async()=>savedItem().dataVersion,getFamily:async()=>{throw new Error("offline");}} as unknown as HkeleRepository;
  for (const item of [savedItem(),{...savedItem(),dataReviewStatus:"Saved identity needs review"},{...savedItem(),dataVersion:"old-version"}]) {
    const [copy]=await prepareTeachingExportItems([item],repository);
    assert.equal(copy!.derived.external_level_reference_display,"—");
    assert.equal(copy!.derived.textbook_first_seen_level,"—");
    assert.equal(copy!.notes,item.notes);assert.equal(copy!.dataVersion,item.dataVersion);
    assert.ok(copy!.dataReviewStatus);
  }
  const compound={...savedItem(),recordType:"compound" as const};
  assert.equal((await prepareTeachingExportItems([compound],repository))[0],compound);
});

test("an export refuses a changed data generation instead of combining its evidence",async()=>{
  let n=0;
  const repository={getDataVersion:async()=>++n===1?savedItem().dataVersion:"changed",getFamily:async()=>{throw new Error("offline");}} as unknown as HkeleRepository;
  await assert.rejects(prepareTeachingExportItems([savedItem()],repository),/Wordlist changed/);
});
