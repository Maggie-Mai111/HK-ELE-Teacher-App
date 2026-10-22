import assert from "node:assert/strict";
import test from "node:test";
import { evidenceTokenValues } from "../src/services/evidenceTokens";
test("evidence labels keep whole subject names, root variants and gloss phrases without pairing them", () => {
  assert.deepEqual(
    evidenceTokenValues(
      "English Grammar and Writing; Health; Science; Social Studies and History",
      "subject",
    ),
    ["English Grammar and Writing", "Health", "Science", "Social Studies and History"],
  );
  assert.deepEqual(evidenceTokenValues("string / strict", "root"), ["string", "strict"]);
  assert.deepEqual(evidenceTokenValues("tight, upright, stiff", "meaning"), [
    "tight",
    "upright",
    "stiff",
  ]);
  assert.deepEqual(evidenceTokenValues('carry (bring, take), "go, move"', "meaning"), [
    "carry (bring, take)",
    '"go, move"',
  ]);
  assert.deepEqual(
    evidenceTokenValues('"not to know, to be unacquainted; mistake, misunderstand', "meaning"),
    ['"not to know, to be unacquainted; mistake, misunderstand'],
  );
  assert.deepEqual(evidenceTokenValues(0, "subject"), []);
});
