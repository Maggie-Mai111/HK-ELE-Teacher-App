import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import test from 'node:test';
import {StaticShardRepository} from '../src/data/StaticShardRepository';
import {textResultFilterCategory} from '../src/services/textResultPresentation';
import {makeFamily,makeOccurrence} from './support/phase3-fixtures';
test('text list filters require the exact familiar form, while retaining the full family match',()=>{
 const owner=makeFamily('able',10);const base=makeOccurrence('ablest',owner,0);
 const other={...base,owners:[{...owner,matched_form_evidence:{form:'ablest',coverage_member:0}}]} as unknown as typeof base;
 assert.equal(textResultFilterCategory(other),'other');
 assert.equal(textResultFilterCategory({...other,owners:[{...other.owners[0]!,matched_form_evidence:{...other.owners[0]!.matched_form_evidence!,coverage_member:1}}]}),'candidate');
 assert.equal(textResultFilterCategory({...other,owners:[{...other.owners[0]!,candidate_member:0,matched_form_evidence:{...other.owners[0]!.matched_form_evidence!,coverage_member:1}}]}),'other');
});
test('real current ablest is covered as an accepted member even without a familiarity flag',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async input=>new Response(new Uint8Array(readFileSync(join(process.cwd(),'public/hkele-data',new URL(String(input),'https://fixture.invalid').pathname.replace(/^\/hkele-data\//,'')))));
 try {const repo=new StaticShardRepository('https://fixture.invalid/hkele-data');const r=await repo.searchSurface('ablest');assert.equal(r.owners.length,1);assert.equal(r.owners[0]!.baseword_key,'able');assert.equal(r.owners[0]!.matched_form_evidence?.coverage_member,1);assert.equal(r.owners[0]!.matched_form_evidence?.familiar_member,0);const item=makeOccurrence('ablest',r.owners[0]!,0);assert.equal(textResultFilterCategory(item),'candidate');assert.equal((await repo.getFamily('able')).forms.some(f=>f.form==='ablest'),true);} finally {globalThis.fetch=original;}
});
