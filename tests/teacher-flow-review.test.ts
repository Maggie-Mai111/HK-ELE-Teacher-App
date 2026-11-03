import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { FormRecord } from "../src/domain/hkele.js";
import { generatePreteachSuggestions } from "../src/services/preteachService.js";
import { makeFamily, makeOccurrence } from "./support/phase3-fixtures.js";

const source = (path: string) => readFileSync(path, "utf8");

test("a missing HK rank never claims that a word is beyond a frequency boundary", () => {
  const family = makeFamily("technical", null, {
    awl: 1,
    matched_form_evidence: { awl: 1 } as FormRecord,
  });
  const items = [makeOccurrence("technical", family, 0)];
  const suggestion = generatePreteachSuggestions("technical", items, null)[0]!;
  assert.ok(suggestion.reasons.includes("Listed in AWL"));
  assert.ok(suggestion.reasons.every((reason) => !reason.includes("Outside HK")));
  const ranked = makeFamily("ranked", 500, {
    awl: 1,
    matched_form_evidence: { awl: 1 } as FormRecord,
  });
  assert.deepEqual(
    generatePreteachSuggestions("technical ranked", [
      ...items,
      makeOccurrence("ranked", ranked, 10),
    ]).map((item) => item.basewordKey),
    ["technical", "ranked"],
  );
  const noOtherEvidence = makeFamily("unranked", null);
  assert.equal(
    generatePreteachSuggestions("unranked", [makeOccurrence("unranked", noOtherEvidence, 0)], null)
      .length,
    0,
  );
});

test("class-level comparison starts only when the teacher chooses a level", () => {
  const family = makeFamily("example", 500, {
    textbook_first_seen_level: "P1",
    matched_form_evidence: { first_seen_hk_textbooks: "P5" } as FormRecord,
  });
  const items = [makeOccurrence("example", family, 0)];
  assert.equal(generatePreteachSuggestions("example", items).length, 0);
  assert.deepEqual(generatePreteachSuggestions("example", items, "P4")[0]?.reasons, [
    "Textbooks: P5 · after P4",
    "Appears 1 time",
    "HK family rank: 500",
  ]);
  assert.equal(generatePreteachSuggestions("example", items, "P6").length, 0);
  const panel = source("src/components/PreteachPanel.tsx");
  assert.match(panel, /useState<ClassLevel \| null>\(null\)/);
  assert.match(panel, /Class level \(optional\)/);
});

test("pre-teaching grade reasons use the chosen form's evidence before family evidence", () => {
  const form = {
    first_seen_hk_textbooks: "P5",
    root: null,
    prefix: null,
    suffix: null,
  } as FormRecord;
  const family = {
    ...makeFamily("use", 100, { textbook_first_seen_level: "P1" }),
    matched_form_evidence: form,
  };
  const items = [makeOccurrence("reusable", family, 0)];
  assert.deepEqual(generatePreteachSuggestions("reusable", items, "P4")[0]?.reasons, [
    "Textbooks: P5 · after P4",
    "Appears 1 time",
    "HK family rank: 100",
  ]);
  const missing = { ...family, matched_form_evidence: { ...form, first_seen_hk_textbooks: null } };
  assert.equal(
    generatePreteachSuggestions("reusable", [makeOccurrence("reusable", missing, 0)], "P4").length,
    0,
  );
});

test("editing hides a mounted checked result so cancelling retains current lesson work", () => {
  const check = source("src/screens/CheckTextScreen.tsx");
  assert.match(check, /style=\{showResults \? styles.resultContent : styles.hiddenResults\}/);
  assert.match(check, /accessibilityElementsHidden=\{!showResults\}/);
  assert.match(check, /checkedText !== null && results.length > 0 \? \(/);
  assert.doesNotMatch(check, /setResults\(\[\]\)/);
  assert.match(check, /teaching.activeLessonId/);
});

test("clicked context accompanies exact word detail without changing feedback fields", () => {
  const check = source("src/screens/CheckTextScreen.tsx");
  assert.match(check, /context: item.context/);
  const detail = source("src/screens/WordDetailScreen.tsx");
  assert.match(detail, /textEvidence\.context/);
  assert.match(detail, /In your text/);
  const app = source("App.tsx");
  assert.match(app, /← Back to text/);
  assert.match(app, /← Back to selected words/);
  assert.doesNotMatch(source("src/services/feedbackService.ts"), /textEvidence|checkedText/);
});

test("navigation prioritises passage checking and carries the number of selected forms", () => {
  const nav = source("src/components/NavigationBar.tsx");
  assert.ok(nav.indexOf('route: "check"') < nav.indexOf('route: "browse"'));
  assert.match(nav, /lessonWordCount/);
  assert.match(source("App.tsx"), /sum \+ item.selectedForms.length/);
});

test("Web checked, pressed, expanded and selected states are explicit as well as native states", () => {
  for (const [path, prop] of [
    ["src/components/LessonWordPicker.tsx", "aria-checked"],
    ["src/components/ChoiceChip.tsx", "aria-pressed"],
    ["src/components/ProgressiveDisclosure.tsx", "aria-expanded"],
    ["src/components/AppMenu.tsx", "aria-expanded"],
    ["src/components/AiFilterAssistant.tsx", "aria-expanded"],
    ["src/components/NavigationBar.tsx", "aria-selected"],
    ["src/components/PreteachPanel.tsx", "aria-expanded"],
    ["src/screens/TeachingListScreen.tsx", "aria-expanded"],
  ]) {
    const value = source(path!);
    assert.match(value, new RegExp(`${prop}=`));
    assert.match(value, /accessibilityState=/);
  }
});
