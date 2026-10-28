import assert from "node:assert/strict";
import test from "node:test";
import {
  countReadabilitySentences,
  estimateSyllables,
  estimateTextComplexity,
} from "../src/services/readabilityService.js";

test("readability handles independently counted classroom and inflected word examples", () => {
  const examples: Array<[string, number]> = [
    ["wanted", 2],
    ["needed", 2],
    ["waited", 2],
    ["visited", 3],
    ["created", 3],
    ["walked", 1],
    ["stressed", 1],
    ["played", 1],
    ["enjoyed", 2],
    ["agreed", 2],
    ["studied", 2],
    ["finished", 2],
    ["boxes", 2],
    ["classes", 2],
    ["changes", 2],
    ["makes", 1],
    ["likes", 1],
    ["studies", 2],
    ["bottles", 2],
    ["simple", 2],
    ["table", 2],
    ["smile", 1],
    ["whole", 1],
    ["reusable", 4],
    ["science", 2],
    ["scientific", 4],
    ["biology", 4],
    ["environment", 4],
    ["business", 2],
    ["classmates", 2],
    ["classroom", 2],
    ["homework", 2],
    ["meaningful", 3],
    ["people", 2],
    ["everyone", 3],
    ["beautiful", 3],
    ["doesn’t", 2],
    ["mother-in-law", 4],
    ["", 0],
    ["123", 0],
  ];
  for (const [word, expected] of examples) assert.equal(estimateSyllables(word), expected, word);
});

test("readability sentence counts distinguish stops from abbreviations, decimals and addresses", () => {
  const examples: Array<[string, number]> = [
    ["Dr. Lee wanted 3.5 litres. Ms. Chan agreed!", 2],
    ["J. Smith studies cells. They are small.", 2],
    ["We study U.S. textbooks. They have diagrams.", 2],
    ["She works in the U.S. We study in Hong Kong.", 2],
    ["Bring tools, e.g. a ruler, and paper. Then begin.", 2],
    ["Bring paper, pens, etc. Then begin.", 2],
    ["See Fig. 2 on p. 5. Read the text.", 2],
    ["Visit https://example.org/science. Ask the teacher.", 2],
    ["Write to teacher@example.org. We will reply.", 2],
    ["“Is this a cell?” she asked. “Yes!”", 3],
    ["Our school\nuses less paper. We recycle.", 2],
    ["A paragraph without punctuation\n\nAnother paragraph without punctuation", 2],
    ["1. Read the passage. 2. Choose a word.", 2],
    ["... !!!", 0],
  ];
  for (const [text, expected] of examples)
    assert.equal(countReadabilitySentences(text), expected, text);
});

test("readability formulas reproduce a hand-counted 30-word three-sentence passage", () => {
  const sentence = "The cat sat on the mat and ate its fish.";
  const text = Array(3).fill(sentence).join(" ");
  const words = text.match(/[A-Za-z]+/g)!;
  const result = estimateTextComplexity(text, words);
  assert.equal(result.words, 30);
  assert.equal(result.sentences, 3);
  assert.equal(result.syllables, 30);
  assert.ok(Math.abs(result.fleschReadingEase! - 112.085) < 1e-9);
  assert.ok(Math.abs(result.fleschKincaidGrade! - 0.11) < 1e-9);
  // Scores are not clamped to an invented range or converted to a Hong Kong grade.
  assert.ok(result.fleschReadingEase! > 100);
});

test("readability retains the existing short-passage boundary without fabricating scores", () => {
  const words = Array<string>(29).fill("cat");
  const result = estimateTextComplexity(words.join(" "), words);
  assert.equal(result.status, "TOO_SHORT");
  assert.equal(result.fleschReadingEase, null);
  assert.equal(result.fleschKincaidGrade, null);
  words.push("cat");
  assert.equal(estimateTextComplexity(words.join(" "), words).status, "READY");
});
