import assert from "node:assert/strict";
import test from "node:test";

import { scan, TOKENIZER_ID, TokenizerError } from "../src/services/tokenizer";

test("tokenizer contract id remains the registered P69 version", () => {
  assert.equal(TOKENIZER_ID, "P69-TEXT-CHECK-PAIRED-QUOTES-1.3.0");
});

test("tokenizer preserves order, offsets, original surface and curly apostrophe normalization", () => {
  const input = "I’m here — don't move.";
  const result = scan(input);
  assert.deepEqual(
    result.occurrences.map((item) => [item.surface, item.normalizedToken, item.startOffset]),
    [
      ["I’m", "i'm", 0],
      ["here", "here", 4],
      ["don't", "don't", 11],
      ["move", "move", 17],
    ],
  );
  assert.equal(result.separatorEvents[0]?.processingRuleId, "U+2014_SAFE_SEPARATOR");
});

test("non-ASCII words are preserved as unsupported tokens", () => {
  const occurrence = scan("café").occurrences[0];
  assert.equal(occurrence?.surface, "café");
  assert.equal(occurrence?.tokenStatus, "UNSUPPORTED_TOKEN");
  assert.equal(occurrence?.normalizedToken, null);
});

test("unregistered symbols fail closed", () => {
  assert.throws(
    () => scan("word🙂"),
    (error: unknown) => {
      assert.ok(error instanceof TokenizerError);
      assert.equal(error.code, "UNREGISTERED_CHARACTER_FAIL_CLOSED");
      return true;
    },
  );
});

test("paired external single quotes are masked without shifting offsets", () => {
  const result = scan("'report' drives");
  assert.deepEqual(
    result.occurrences.map((item) => [item.surface, item.startOffset, item.endOffset]),
    [
      ["report", 1, 7],
      ["drives", 9, 15],
    ],
  );
});
