import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {StaticShardRepository} from "../src/data/StaticShardRepository";
import {scan} from "../src/services/tokenizer";
import {savedIdentityStillApplies} from "../src/services/identityMigration";
import registry from "../src/config/identityMigration.json";
const version="2026-11-08-hk4-familiar1764-v1";
async function withData(run:(repo:StaticShardRepository)=>Promise<void>){const previous=globalThis.fetch;globalThis.fetch=async input=>new Response(new Uint8Array(readFileSync("public/hkele-data/"+String(input).split("/hkele-data/")[1]!.split("?")[0])));try{await run(new StaticShardRepository("https://fixture.invalid/hkele-data"));}finally{globalThis.fetch=previous;}}
test("new opaque identity lookup keeps meaningful case and ordinary spelling stays separate",async()=>withData(async repo=>{
 const key="final20261102:d:Latin-letter-name",r=await repo.getFamily(key);assert.equal(r.family.baseword_key,key);assert.notEqual(r.family.baseword_key,"d");
}));
test("limited-only lookup retains records without silently assigning the classroom token",async()=>withData(async repo=>{
 const shard=JSON.parse(gunzipSync(readFileSync("public/hkele-data/search/a.json.gz")).toString()) as Record<string,[number,unknown[],unknown[]]>;
 const word=Object.keys(shard).find(k=>shard[k]![0]===10)!;assert.ok(word);assert.ok((await repo.searchSurface(word)).owners.length);
 const [result]=await repo.resolveOccurrences(word,scan(word).occurrences);assert.equal(result?.status,"UNMATCHED");assert.equal(result?.owners.length,0);assert.ok(result?.alternatives.length);
 const {textResultStatusLabel}=await import("../src/services/textResultPresentation.js");assert.equal(textResultStatusLabel(result!),"Not matched");
}));
test("every newly uncertain old pair requires review, while an exact retained pair can refresh",()=>{
 const transitions=registry.transitionsBySource["2026-10-29-repaired-main-core2827-v1"];
 let count=0;for(const [key,words] of Object.entries(transitions))for(const word of Object.keys(words)){assert.equal(savedIdentityStillApplies(key,[word],"2026-10-29-repaired-main-core2827-v1",version),false);count++;}
 assert.equal(count,12644);assert.equal(savedIdentityStillApplies("use",["reusable"],"2026-10-29-repaired-main-core2827-v1",version),true);
});

test("structured lexical scopes preserve readable meanings and region limits",async()=>{
 const {recordedUseSummary}=await import("../src/services/lexicalUsePresentation.js");
 assert.equal(recordedUseSummary('Chief-reviewed canonical endpoint and source-token allocation.'),'');
 assert.equal(recordedUseSummary('Existing accepted source identity; prior constraints apply.','limited'),'Special use — check the meaning in your text.');
 assert.equal(recordedUseSummary(JSON.stringify({exact_target_readings:[{glosses:['An identity matrix.']}]})),'An identity matrix.');

 assert.equal(recordedUseSummary(JSON.stringify({defined_scope:{only_exact_source_denotation:"obsolete spelling of party",compatible_canonical_application:["A person."],boundary:"internal relation rule"}})),"obsolete spelling of party A person.");
 assert.equal(recordedUseSummary(JSON.stringify({defined_scope:{exact_meaning:"A local term.",only_region:"Scotland"}})),"A local term. In: Scotland");
});
