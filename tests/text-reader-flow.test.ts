import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { FormRecord } from "../src/domain/hkele.js";
import {
  selectedWordForm,
  textReaderSegments,
  textWordAction,
} from "../src/services/textReaderService.js";
import { makeFamily, makeOccurrence } from "./support/phase3-fixtures.js";

test("reader preserves punctuation, repeated words, newlines and UTF-16 offsets", () => {
  const text = "📖 Reuse, reuse!\nA teacher’s text.";
  const first = makeOccurrence("Reuse", makeFamily("use", 1), text.indexOf("Reuse"));
  const second = makeOccurrence("reuse", makeFamily("use", 1), text.indexOf("reuse"));
  const segments = textReaderSegments(text, [second, first]);
  assert.equal(segments.map((part) => part.text).join(""), text);
  assert.deepEqual(
    segments.flatMap((part) => (part.occurrence ? [part.occurrence] : [])),
    [first, second],
  );
  assert.equal(new Set(segments.map((part) => part.key)).size, segments.length);
});

test("stale, overlapping and invalid tokens cannot create misleading word links", () => {
  const family = makeFamily("use", 1);
  const base = makeOccurrence("reuse", family, 0);
  const segments = textReaderSegments("reuse paper", [
    base,
    base,
    { ...base, startOffset: 1 },
    { ...base, startOffset: -1 },
    { ...base, endOffset: 30 },
    { ...base, startOffset: 0.5 },
    makeOccurrence("wrong", family, 6),
  ]);
  assert.equal(segments.map((part) => part.text).join(""), "reuse paper");
  assert.equal(segments.filter((part) => part.occurrence).length, 1);
  assert.deepEqual(
    textReaderSegments("A text.", []).map((part) => part.text),
    ["A text."],
  );
});

test("word actions use actual registered owners and keep unresolved cases separate", () => {
  const family = makeFamily("use", 1);
  const base = makeOccurrence("reuse", family, 0);
  assert.equal(textWordAction(base), "family");
  assert.equal(
    textWordAction({ ...base, owners: [makeFamily("use", 1, { display_blocked: 1 })] }),
    "missing",
  );
  assert.equal(
    textWordAction({ ...base, status: "AMBIGUOUS", owners: [family, makeFamily("other", 2)] }),
    "choices",
  );
  assert.equal(textWordAction({ ...base, status: "BLOCKED" }), "missing");
  assert.equal(textWordAction({ ...base, status: "UNMATCHED", owners: [] }), "missing");
  assert.equal(
    textWordAction({ ...base, status: "FULL_DATABASE_CHECK_UNAVAILABLE", owners: [] }),
    "offline",
  );
  assert.equal(
    textWordAction({ ...base, status: "REGISTERED_GRAMMATICAL_RELATION", owners: [] }),
    "missing",
  );
  assert.equal(
    textWordAction({
      ...base,
      status: "REGISTERED_GRAMMATICAL_RELATION",
      owners: [],
      grammaticalRelation: {
        normalizedSurface: "isn't",
        sourceExpansion: "is not",
        alternatives: [],
        teacherStatus: "Registered grammatical relation",
        rankedFamilyAssignment: false,
      },
    }),
    "grammar",
  );
});

test("selected form matching preserves registered forms without guessing a stem", () => {
  const forms = [
    { form: "reuse", normalized_form: "reuse" },
    { form: "reusable", normalized_form: "reusable" },
    { form: "teacher's", normalized_form: "teacher's" },
  ] as FormRecord[];
  assert.equal(selectedWordForm(forms, "Reusable"), forms[1]);
  assert.equal(selectedWordForm(forms, "teacher’s"), forms[2]);
  assert.equal(selectedWordForm(forms, "reusability"), undefined);
  assert.equal(selectedWordForm(forms), undefined);
});

test("main passage flow starts with reading and pre-teaching, with extra tools on demand", () => {
  const source = readFileSync("src/screens/CheckTextScreen.tsx", "utf8");
  const reader = source.indexOf('accessibilityLabel="Checked text"');
  const suggestions = source.indexOf("<PreteachPanel", reader);
  const knowledge = source.indexOf('title="Check word knowledge"', suggestions);
  const picker = source.indexOf('title="Choose more lesson words"', knowledge);
  const details = source.indexOf('title="More text details"', picker);
  assert.ok(
    reader > 0 &&
      suggestions > reader &&
      knowledge > suggestions &&
      picker > knowledge &&
      details > picker,
  );
  assert.match(source, /useState\(false\)/);
  assert.match(source, /setCheckedText\(source\)/);
  assert.match(source, /sourceRef\.current !== source/);
  assert.match(source, /showResults/);
  assert.doesNotMatch(source, /<UnmatchedWordsPanel|<ContextReviewPanel|<PendingFullCheckPanel/);
  const readerSource = readFileSync("src/components/HighlightedText.tsx", "utf8");
  assert.match(readerSource, /onWordPress\(item\)/);
  assert.match(readerSource, /event.key === "Enter"/);
  assert.match(readerSource, /accessibilityRole="link"/);
  assert.doesNotMatch(readerSource, /Symbols and labels accompany/);
});

test("teacher workflow copy omits internal disclaimers while retaining privacy and result scope", () => {
  const paths = ["CheckTextScreen", "HomeScreen", "TeachingListScreen", "WordDetailScreen"];
  const screenText = paths
    .map((name) => readFileSync(`src/screens/${name}.tsx`, "utf8"))
    .join("\n");
  const knowledge = readFileSync("src/components/KnowledgeTestPanel.tsx", "utf8");
  assert.doesNotMatch(
    screenText + knowledge,
    /An intention for this lesson, not a test|Source this session:|cannot accurately distinguish|Vocabulary coverage is not the same/,
  );
  assert.match(knowledge, /Sample of/);
  assert.match(knowledge, /Answers stay in this session/);
  assert.match(
    readFileSync("src/components/PrivacyPanel.tsx", "utf8"),
    /Click and feature-use records\s+are\s+not currently collected/,
  );
});
