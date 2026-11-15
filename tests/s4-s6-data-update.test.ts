import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {executeAiFilter} from "../src/services/aiFilterExecutor.js";
import {matchesAiWord} from "../src/services/aiFormFilter.js";

test("offline installer no-store requests bypass installed older assets",()=>{
 const handlers:Record<string,(event:unknown)=>void>={};
 const source=readFileSync("public/sw.js","utf8").replace("__PACKAGE85_COMPACT_DATA_ASSETS__","[]").replace("__PACKAGE85_BUILD_ASSETS__","[]");
 runInNewContext(source,{URL,self:{location:{origin:"https://fixture.invalid"},addEventListener:(name:string,fn:(event:unknown)=>void)=>{handlers[name]=fn;}}});
 for(const path of ["assets/ai-form-evidence/current.gz","assets/downloads/current.xlsx","ocr/worker.min.js"]){let intercepted=false;handlers.fetch!({request:{method:"GET",cache:"no-store",url:"https://fixture.invalid/HK-ELE-Teacher-App/"+path},respondWith:()=>{intercepted=true;}});assert.equal(intercepted,false,path);}
});
test("S4 to S6 records obey the existing earlier/later grade filters",()=>{
 for(const level of ["S4","S5","S6"]){
  const family={baseword_key:"fixture",display_family:"fixture",textbook_first_seen_level:level,candidate_member:1,reference_member:1,display_blocked:0} as never;
  const form={first_seen_hk_textbooks:level,lookup_only:0}as never;
  const later={scope:"full",earliestObservedFrom:"S3",limit:10,sort:"overall"}as const;
  const earlier={scope:"full",earliestObservedTo:"S3",limit:10,sort:"overall"}as const;
  assert.equal(executeAiFilter({families:[family],cpbFamilyKeys:new Set()},later).matchedBeforeLimit,1);
  assert.equal(executeAiFilter({families:[family],cpbFamilyKeys:new Set()},earlier).matchedBeforeLimit,0);
  assert.equal(matchesAiWord(form,later),true);assert.equal(matchesAiWord(form,earlier),false);
 }
});
