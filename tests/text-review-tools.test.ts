import assert from "node:assert/strict";
import test from "node:test";
import { collectEligibleFamilies, calculateCoverage } from "../src/services/knowledgeTestService.js";
import { generatePreteachSuggestions } from "../src/services/preteachService.js";
import { updateWordJudgement, responsesForWords, occurrencesOfWord, textOccurrenceExcerpt, showSelectedWords } from "../src/services/textReviewService.js";
import { makeFamily, makeOccurrence } from "./support/phase3-fixtures.js";

test("clearing one occurrence leaves other same-spelling uses independent",()=>{
 const f=makeFamily("stress",1500),a=makeOccurrence("stress",f,0),b=makeOccurrence("stress",f,7);
 let marks=updateWordJudgement({},a.occurrenceId,true);marks=updateWordJudgement(marks,b.occurrenceId,false);
 assert.deepEqual(generatePreteachSuggestions("",[a,b],null,Infinity,{judgements:marks}).map(e=>e.occurrence?.occurrenceId),[b.occurrenceId]);
 marks=updateWordJudgement(marks,a.occurrenceId,undefined);
 assert.equal(marks[b.occurrenceId],false);assert.equal(marks[a.occurrenceId],undefined);
});

test("inline and optional checks share only the actual sampled occurrence",()=>{
 const family=makeFamily("stress",1500),a=makeOccurrence("stress",family,0),b=makeOccurrence("stress",family,7);
 const active=collectEligibleFamilies([a,b]);
 let marks=updateWordJudgement({},b.occurrenceId,false);
 assert.equal(calculateCoverage(active,responsesForWords(active,marks)).answeredFamilies,0);
 marks=updateWordJudgement(marks,a.occurrenceId,true);
 assert.equal(calculateCoverage(active,responsesForWords(active,marks)).knownFamilies,1);
 assert.equal(marks[b.occurrenceId],false);
});

test("all occurrences preserve order, actual spellings and distinct owner records", () => {
  const first = makeOccurrence("Stress", makeFamily("stress", 1500), 0);
  const other = makeOccurrence("stressed", makeFamily("stress", 1500), 7);
  const last = makeOccurrence("stress", makeFamily("other-use", 99), 16);
  const all = [first, other, last];
  assert.deepEqual(occurrencesOfWord(all, "stress"), [first, last]);
  assert.equal(occurrencesOfWord(all, "stress")[1], last);
  assert.deepEqual(occurrencesOfWord(all, "absent"), []);
});

test("selected-word navigation is conditional but stays available on its own page", () => {
  assert.equal(showSelectedWords(0, false), false);
  assert.equal(showSelectedWords(1, false), true);
  assert.equal(showSelectedWords(0, true), true);
});

test("context highlights the exact occurrence in the unchanged original text", () => {
  const text = "stress causes stress";
  const item = makeOccurrence("stress", makeFamily("stress", 1500), 14);
  const excerpt = textOccurrenceExcerpt(text, item);
  assert.equal(excerpt.before, "stress causes ");
  assert.equal(excerpt.word, "stress");
  assert.equal(excerpt.before + excerpt.word + excerpt.after, text);
  assert.deepEqual(textOccurrenceExcerpt(text, { ...item, surface: "other" }), { before: "", word: "other", after: "" });
});
