import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { selectedWordsText,copyPlainText } from "../src/services/selectedWordsCopy.js";

test("copy preserves explicit forms, saved order and unrelated records without family substitution",()=>{
  const items=[{customOrder:2,selectedForms:["classroom"],notes:""},{customOrder:0,selectedForms:["reusable","reusability"],notes:"Teach reusability."},{customOrder:1,selectedForms:[],notes:"Keep this saved note."}];
  const before=JSON.stringify(items),result=selectedWordsText(items);
  assert.deepEqual(result,{text:"reusable\nreusability\nclassroom",count:3,skipped:1});assert.equal(JSON.stringify(items),before);
  assert.deepEqual(selectedWordsText([{notes:"An old note"}]),{text:"",count:0,skipped:1});
});
test("copy with notes retains homonym notes and literal spelling without engineering fields",()=>{
  const items=[{selectedForms:["cell"],notes:"Biological sense.",connections:"A living cell"},{selectedForms:["cell"],notes:"A spreadsheet cell."},{selectedForms:["US","us","café","teacher's"],notes:""}];
  const result=selectedWordsText(items,true);assert.equal(result.count,6);
  assert.equal(result.text,"cell\nNote: Biological sense.\nRelated/example: A living cell\n\ncell\nNote: A spreadsheet cell.\n\nUS, us, café, teacher's");
  assert.doesNotMatch(result.text,/Family|rank|version|baseword|schema/);
  assert.match(selectedWordsText([{selectedForms:["reusable"],teachingFocus:"focus"}],true).text,/Teaching focus: Teach in depth/);
});
test("copy uses the supplied text exactly, never clears an empty clipboard and tolerates denial",async()=>{
  const written:string[]=[];assert.equal(await copyPlainText("reusable\nclassroom",async text=>{written.push(text);}),true);
  assert.equal(await copyPlainText("",async text=>{written.push(text);}),false);assert.deepEqual(written,["reusable\nclassroom"]);
  assert.equal(await copyPlainText("reusable",async()=>{throw new Error("NotAllowedError");}),false);
});
test("selected-word UI provides direct copying, a selectable fallback and Excel without format management",()=>{
  const screen=readFileSync("src/screens/TeachingListScreen.tsx","utf8"),actions=readFileSync("src/components/CopySelectedWords.tsx","utf8");
  assert.match(screen,/title="Selected words"/);assert.match(screen,/<LessonLibraryControls/);assert.doesNotMatch(screen,/Lesson name|title="Saved lists"/);assert.match(screen,/label="Download Excel"/);assert.doesNotMatch(screen,/More formats|label="CSV"|label="Markdown"/);
  assert.match(actions,/Text to copy/);assert.match(actions,/readOnly selectTextOnFocus/);
  for(const file of ["PreteachPanel","LessonWordPicker"])assert.match(readFileSync(`src/components/${file}.tsx`,"utf8"),/<CopySelectedWords/);
});
