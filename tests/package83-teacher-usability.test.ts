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
  for (const label of ["Find words with AI", "Preview", "Show matching words", "Edit request"])
    assert.match(assistant, new RegExp(label));
});

test("About remains accessible from the menu and retains version, source, licence and privacy information", () => {
  const menu = readFileSync("src/components/AppMenu.tsx", "utf8");
  const data = readFileSync("src/screens/DataVersionScreen.tsx", "utf8");
  assert.match(menu, /About &amp; data version/);
  assert.match(data, /Data version/);
  assert.match(data, /Licence and data sources/);
  assert.match(data, /Privacy at a glance/);
  assert.match(data, /DATA_PROVENANCE\.md/);
});

test("Browse has one result surface, More filters, bulk add and responsive mobile cards", () => {
  const browse = readFileSync("src/screens/BrowseScreen.tsx", "utf8");
  assert.match(browse, /More filters/);
  assert.match(browse, /Add shown words to Teaching list/);
  assert.match(browse, /teaching\.addMany/);
  assert.match(browse, /viewport\.width >= 760/);
  assert.equal((browse.match(/<WebFamilyTable/g) ?? []).length, 1);
});

test("new users receive Teacher view while saved Package72 column choices remain on the same key", () => {
  const table = readFileSync("src/components/WebFamilyTable.tsx", "utf8");
  assert.match(table, /hkele-phase1v-columns-v1/);
  assert.match(table, /localStorage\.getItem\(STORAGE_KEY\) \? "detailed" : "teacher"/);
  assert.match(table, /Teacher view/);
  assert.match(table, /Detailed view/);
  assert.match(table, /15 shown/);
});
