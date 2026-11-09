import test from "node:test";
import assert from "node:assert/strict";
import {joinOcrWrappedLines} from "../src/services/ocr/ocrTextLayout";

test("photo-edge line wraps become one readable paragraph, with the next paragraph retained",()=>{
 const photo="The GWR, aware that the new\nline would\nfinally enable them to run\ntrains into the heart\nof the City, invested almost\n£250,000 in the project.\n\nThe work began in 1860.";
 assert.equal(joinOcrWrappedLines(photo),"The GWR, aware that the new line would finally enable them to run trains into the heart of the City, invested almost £250,000 in the project.\n\nThe work began in 1860.");
});
test("lists and colon headings remain distinct while wrapped item continuations are joined",()=>{
 const photo="Instructions:\n1. Read the\nfirst paragraph.\n2. Find the railway\non the map.\n\n• Discuss the\nresult.\n• Compare answers.";
 assert.equal(joinOcrWrappedLines(photo),"Instructions:\n1. Read the first paragraph.\n2. Find the railway on the map.\n\n• Discuss the result.\n• Compare answers.");
});
test("false OCR paragraph gaps within an unfinished sentence join, while sentence and heading gaps remain",()=>{
 assert.equal(joinOcrWrappedLines("Workers checked the bridges while engineers\n\nchecked the tunnels.\n\nTeachers read the text."),"Workers checked the bridges while engineers checked the tunnels.\n\nTeachers read the text.");
 assert.equal(joinOcrWrappedLines("Instructions:\n\nread the text."),"Instructions:\n\nread the text.");
});
test("joining never guesses spelling or removes printed hyphens, symbols, case or punctuation",()=>{
 for(const source of ["A well-\nknown story.","environ-\nment","GWR\n£250,000 – 1860.\n\nDon't guess.","  Cells\r\nhave walls.  "]){
  const result=joinOcrWrappedLines(source);
  assert.equal(result.replace(/\s/g,""),source.replace(/\s/g,""));
 }
 assert.equal(joinOcrWrappedLines("well-\nknown"),"well-known");
 assert.equal(joinOcrWrappedLines("environ-\nment"),"environ-ment");
});
test("empty output and unwrapped English retain their content without adding sentence or family rules",()=>{
 assert.equal(joinOcrWrappedLines(" \n\n "),"");
 assert.equal(joinOcrWrappedLines("Each cell has a wall."),"Each cell has a wall.");
 assert.equal(joinOcrWrappedLines("The colour is grey.\n\nThe program runs."),"The colour is grey.\n\nThe program runs.");
});
test("unfinished comma clauses continue across a false OCR gap before an amount, while real paragraphs and numbered tasks remain",()=>{
 for(const amount of ["£ 1m","£1m","$250,000","€500","¥200","250,000 pounds"]){
  const raw=`Eventually, over a five-year period,\n\n${amount} was raised.\n\nThe work continued.`;
  const result=joinOcrWrappedLines(raw);
  assert.equal(result,`Eventually, over a five-year period, ${amount} was raised.\n\nThe work continued.`);
  assert.equal(result.replace(/\s/g,""),raw.replace(/\s/g,""));
 }
 assert.equal(joinOcrWrappedLines("The project ended.\n\n£1m was saved."),"The project ended.\n\n£1m was saved.");
 assert.equal(joinOcrWrappedLines("Read carefully,\n\n1. Find the route.\n2. Compare answers."),"Read carefully,\n\n1. Find the route.\n2. Compare answers.");
});
