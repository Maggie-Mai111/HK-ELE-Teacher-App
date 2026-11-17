import assert from "node:assert/strict";
import test from "node:test";
import { unzipSync, strFromU8 } from "fflate";
import { reviewSelections, selectedWordsText } from "../src/services/selectedWordsCopy";
import { teacherUseKeys } from "../src/services/teacherUsePolicy";
import { removeOcrMarginNumbers, type OcrPageBlock } from "../src/services/ocr/ocrMarginNumbers";
import { teachingListToXlsx } from "../src/services/teachingListExport";
import type { TeachingListItem } from "../src/domain/teachingList";

test("they has a normal default without suppressing explicit historical review or true ambiguity", () => {
  assert.deepEqual(teacherUseKeys("They", ["it", "they"], {text:"They can read.",start:0,end:4}), ["they"]);
  assert.deepEqual(teacherUseKeys("they", ["it", "they"]), ["they"]);
  assert.deepEqual(teacherUseKeys("they", ["it", "they"], {text:'"they" is quoted.',start:1,end:5}), ["it", "they"]);
  assert.deepEqual(teacherUseKeys("felt", ["feel", "felt"]), ["feel", "felt"]);
});

test("passage copying preserves exact selected forms and notes but excludes other texts and identities", () => {
  const items = [{basewordKey:"stress",selectedForms:["stress", "stressed"],notes:"Keep this note"},
    {basewordKey:"another",selectedForms:["stressed"],notes:"Different identity"},
    {basewordKey:"build",selectedForms:["build"],notes:"Earlier text"}];
  const before = JSON.stringify(items);
  const view = reviewSelections(items, [{familyKey:"stress",form:"Stressed"}]);
  assert.equal(selectedWordsText(view,true).text, "stressed\nNote: Keep this note");
  assert.deepEqual(reviewSelections(items, []), []);
  assert.equal(JSON.stringify(items), before);
  assert.equal(selectedWordsText(reviewSelections([{baseword_key:"stress",selected_forms:["stressed"]}], [{familyKey:"stress",form:"stressed"}])).text,"stressed");
});

function line(text:string, parts:Array<[string,number,number]>, y:number) {
  return {text,bbox:{x0:parts[0]![1],y0:y,x1:600,y1:y+20},words:parts.map(([word,x0,x1])=>({text:word,bbox:{x0,y0:y,x1,y1:y+20}}))};
}
test("OCR removes repeated gutter numbers, including a detached misread, and preserves body numbers", () => {
  const lines = [line("energy-efficient technologies",[["energy-efficient",60,200],["technologies",210,340]],0),
    line("15)",[["15)",0,20]],30),
    line("to make their schools green",[["to",60,80],["make",90,140],["their",150,190],["schools",200,280],["green",290,340]],30),
    line("15 wind energy in batteries",[["15",0,20],["wind",60,110],["energy",120,180],["in",190,210],["batteries",220,300]],90),
    line("In 2026 they raised £250,000.",[["In",60,80],["2026",90,135],["they",145,190],["raised",200,260],["£250,000.",270,370]],120)];
  const raw=lines.map(item=>item.text).join("\n");
  const blocks:OcrPageBlock[]=[{paragraphs:[{lines}]}];
  const result=removeOcrMarginNumbers(raw,blocks);
  assert.doesNotMatch(result,/15\)/);
  assert.match(result,/\nwind energy/);
  assert.match(result,/2026 they raised £250,000/);
  assert.equal(removeOcrMarginNumbers("5 apples and 10 oranges",null),"5 apples and 10 oranges");
});

test("OCR preserves numbered questions and standalone ordinary numbers without gutter evidence", () => {
  const lines=[line("5) Read the text.",[["5)",0,20],["Read",60,100],["the",110,140],["text.",150,190]],0),
    line("10) Write your answer.",[["10)",0,20],["Write",60,100],["your",110,150],["answer.",160,220]],40)];
  const raw=lines.map(item=>item.text).join("\n");
  assert.equal(removeOcrMarginNumbers(raw,[{paragraphs:[{lines}]}]),raw);
});

test("teacher-facing saved-word Excel excludes old planning and internal columns, keeping entered notes", () => {
  const item={basewordKey:"stress",displayFamily:"stress",selectedForms:["stressed"],notes:"Keep note",connections:"",teachingFocus:"focus",status:"Notice",customOrder:0,derived:{},dataVersion:"current"} as TeachingListItem;
  const before=JSON.stringify(item);
  const sheet=strFromU8(unzipSync(teachingListToXlsx([item],"Old lesson",true))["xl/worksheets/sheet1.xml"]!);
  assert.match(sheet,/Keep note/);
  assert.match(sheet,/First seen in HK textbooks/);
  assert.doesNotMatch(sheet,/Teaching plan|Not decided|Teach in depth|Old lesson|Selection note|Added from|Family key|Data version/);
  assert.equal(JSON.stringify(item),before);
});
