import assert from "node:assert/strict";
import test from "node:test";
import type { FormRecord } from "../src/domain/hkele.js";
import { groupPreteachSuggestions, preteachEvidence } from "../src/services/preteachPresentation.js";
import { generatePreteachSuggestions, markedOtherOccurrences } from "../src/services/preteachService.js";
import { makeFamily, makeOccurrence } from "./support/phase3-fixtures.js";

test("no frequency boundary, list label or later textbook record independently selects a teaching word",()=>{
 const family=makeFamily("test",1001,{matched_form_evidence:{awl:1,msvl:"Science",first_seen_hk_textbooks:"P6"} as FormRecord});
 for(const rank of [1,1000,1001,9000,null])assert.deepEqual(generatePreteachSuggestions("",[makeOccurrence("test",{...family,current_hk_frequency_rank:rank},0)],"P1"),[]);
});
test("marked examples keep actual spelling and context, grouping only true family identities",()=>{
 const family=makeFamily("cell",1132), a=makeOccurrence("cells",family,0),b=makeOccurrence("cell",family,6),c=makeOccurrence("cells",family,11);
 const marks={[a.occurrenceId]:true,[b.occurrenceId]:false,[c.occurrenceId]:false};
 const entries=generatePreteachSuggestions("",[a,b,c],null,Infinity,{judgements:marks});
 assert.deepEqual(entries.map(e=>[e.actualForm,e.occurrence?.occurrenceId]),[["cell",b.occurrenceId],["cells",c.occurrenceId]]);
 assert.equal(groupPreteachSuggestions(entries).length,1);
 assert.equal(preteachEvidence(entries[0]!).primary,"You marked this use May need explaining");
 assert.ok(!preteachEvidence(entries[1]!).extra.some(reason=>reason.includes("outside")));
});
test("facts are explicit optional filters, with no automatic difficulty order",()=>{
 const f=makeFamily("book",50),late={...f,matched_form_evidence:{first_seen_hk_textbooks:"P5"} as FormRecord};
 const a=makeOccurrence("book",f,0),b=makeOccurrence("booked",late,5);
 assert.deepEqual(generatePreteachSuggestions("",[a,b],"P4",Infinity,{filter:"later"}).map(e=>e.actualForm),["booked"]);
 assert.deepEqual(generatePreteachSuggestions("",[a,b],"P6",Infinity,{filter:"later"}),[]);
 assert.equal(generatePreteachSuggestions("",[a,b],null,Infinity,{filter:"all"}).length,2);
 assert.deepEqual(generatePreteachSuggestions("",[a,b],null,Infinity,{filter:"academic"}),[]);
 assert.equal(generatePreteachSuggestions("",[a,{...a,occurrenceId:"again",occurrenceOrder:99}],null,Infinity,{filter:"repeated"})[0]?.occurrences,2);
});
test("a teacher can flag a compound, unresolved spelling or ambiguous use without inventing family ownership",()=>{
 const base=makeOccurrence("classroom",makeFamily("none",null),0);
 for(const status of ["REGISTERED_EXPRESSION","UNMATCHED","AMBIGUOUS"] as const){
  const item={...base,status,owners:[]};
  assert.deepEqual(markedOtherOccurrences([item],{[item.occurrenceId]:false}),[item]);
  assert.deepEqual(generatePreteachSuggestions("",[item],null,Infinity,{judgements:{[item.occurrenceId]:false}}),[]);
 }
});
