import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("primary navigation and teacher-facing AI labels match the approved wording", () => {
  const navigation = readFileSync("src/components/NavigationBar.tsx", "utf8");
  assert.match(navigation, /Find words/);
  assert.match(navigation, /Check a text/);
  assert.match(navigation, /Teaching list/);
  assert.doesNotMatch(navigation, /route: "data", label: "Data"/);

  const assistant = readFileSync("src/components/AiFilterAssistant.tsx", "utf8");
  for (const label of [
    "Find words with AI",
    "Review suggested filters",
    "Show matching words",
    "Edit request",
  ])
    assert.match(assistant, new RegExp(label));
});

test("About remains accessible from the menu and retains version, source, licence and privacy information", () => {
  const menu = readFileSync("src/components/AppMenu.tsx", "utf8");
  const data = readFileSync("src/screens/DataVersionScreen.tsx", "utf8");
  assert.match(menu, /About HK-ELE/);
  assert.match(data, /Data version/);
  assert.match(data, /Sources and licences/);
  assert.match(data, /Privacy at a glance/);
  assert.ok(readFileSync("DATA_PROVENANCE.md", "utf8").length > 0);
});

test("Browse has one result surface, More filters, bulk add and responsive mobile cards", () => {
  const browse = readFileSync("src/screens/BrowseScreen.tsx", "utf8");
  assert.match(browse, /More filters/);
  assert.match(browse, /Add shown words to Teaching list/);
  assert.match(browse, /teaching\.addMany/);
  assert.match(browse, /viewport\.width >= 760/);
  assert.equal((browse.match(/<WebFamilyTable/g) ?? []).length, 1);
});

test("full word information is the default while explicit saved column choices remain on the same key", () => {
  const table = readFileSync("src/components/WebFamilyTable.tsx", "utf8");
  assert.match(table, /hkele-phase1v-columns-v1/);
  assert.match(table, /columns\.map\(\(\[key\]\) => \[key, true\]\)/);
  assert.match(table, /Full word information/);
  assert.match(table, /Choose columns/);
  assert.doesNotMatch(table, /teacherColumns|initialView/);
  assert.match(table, /localStorage\.setItem\(STORAGE_KEY, JSON\.stringify\(next\)\)/);
});
