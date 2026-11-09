import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {StaticShardRepository} from "../src/data/StaticShardRepository";
import {HybridRepository} from "../src/data/HybridRepository";
import {CompoundRepository} from "../src/data/CompoundRepository";
import {teacherUseResult} from "../src/services/teacherUsePolicy";
import {scan} from "../src/services/tokenizer";

async function withData(run:(repo:StaticShardRepository)=>Promise<void>){
 const previous=globalThis.fetch;
 globalThis.fetch=async input=>new Response(new Uint8Array(readFileSync("public/hkele-data/"+String(input).split("/hkele-data/")[1]!.split("?")[0])));
 try{await run(new StaticShardRepository("https://fixture.invalid/hkele-data"));}finally{globalThis.fetch=previous;}
}
const keys=(result:{owners:Array<{baseword_key:string}>})=>result.owners.map(o=>o.baseword_key).sort();

test("ordinary has/a/wall use current accepted relations; their other records remain available",async()=>withData(async repo=>{
 for(const [word,key]of [["has","have"],["a","a"],["wall","wall"]]){
  const r=await repo.searchSurface(word!);assert.equal(r.status,"RESOLVED");assert.deepEqual(keys(r),[key]);
  assert.ok(r.alternatives.some(o=>o.match_classes.includes("SECONDARY_RECORDED_READING")));
  assert.ok((await repo.getFamily(key!)).forms.some(f=>f.normalized_form===word));
 }
 const text="Each cell has a wall.";const rows=await repo.resolveOccurrences(text,scan(text).occurrences);
 for(const [word,key]of [["has","have"],["a","a"],["wall","wall"]])assert.deepEqual(keys(rows.find(r=>r.surface===word)!),[key]);
}));

test("context is applied per occurrence, without leaking quote/noun/letter decisions through the query cache",async()=>withData(async repo=>{
 const text='He has a wall. The has were mentioned. The letter a is printed. "wall" is quoted. Wall, I disagree.';
 const rows=await repo.resolveOccurrences(text,scan(text).occurrences);
 for(const word of ["has","a","wall"]){const matches=rows.filter(r=>r.surface===word);assert.equal(matches[0]!.status,"RESOLVED");assert.equal(matches[1]!.status,"AMBIGUOUS");}
 assert.equal(rows.find(r=>r.surface==="Wall")!.status,"AMBIGUOUS");
}));

test("common homographs, scientific meanings, abbreviations and standard variants are not pruned as rare spellings",async()=>withData(async repo=>{
 for(const word of ["saw","does","in"])assert.equal((await repo.searchSurface(word)).status,"AMBIGUOUS",word);
 for(const word of ["cell","programme","theatre","media"]){const r=await repo.searchSurface(word);assert.ok(r.owners.length);assert.ok(!r.alternatives.some(o=>o.match_classes.includes("SECONDARY_RECORDED_READING")),word);}
}));

test("hybrid and expression/normalization layers use the same contextual family without research-position overrides",async()=>withData(async repo=>{
 const wrapped=new CompoundRepository(new HybridRepository(repo,repo),async()=>null);
 const text='It has a wall. The letter a is printed.';const rows=await wrapped.resolveOccurrences(text,scan(text).occurrences);
 for(const word of ["has","a","wall"]){const row=rows.find(r=>r.surface===word)!;assert.equal(row.status,"RESOLVED");assert.equal(row.normalizedAnalysis?.tokens[0]?.familyKey,keys(row)[0]);}
 const letter=rows.filter(r=>r.surface==="a")[1]!;assert.equal(letter.status,"AMBIGUOUS");assert.equal(letter.normalizedAnalysis?.tokens[0]?.familyKey,null);
}));

test("priority projection is reversible, idempotent and does not mutate cached owners or revive limited-only candidates",async()=>withData(async repo=>{
 const r=await repo.searchSurface("has"),snapshot=JSON.stringify(r);
 const repeated=teacherUseResult(r);assert.deepEqual(repeated,r);
 const restored=teacherUseResult(r,{text:"the has were",start:4,end:7});assert.ok(restored.owners.some(o=>o.baseword_key==="ha"));
 assert.ok(restored.owners.every(o=>r.owners.some(x=>x.baseword_key===o.baseword_key)||r.alternatives.some(x=>x.baseword_key===o.baseword_key&&x.match_classes.includes("SECONDARY_RECORDED_READING"))));
 assert.equal(JSON.stringify(r),snapshot);assert.deepEqual(teacherUseResult(restored),r);
}));
