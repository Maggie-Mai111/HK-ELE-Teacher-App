import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { StaticShardRepository } from "../src/data/StaticShardRepository.js";
import type { FamilyRecord, ResolvedOccurrence, SurfaceSearchResult } from "../src/domain/hkele.js";
import type { TeachingListItem } from "../src/domain/teachingList.js";
import {
  hasSelectedForm,
  searchSelectedForm,
  selectedWordCount,
} from "../src/services/lessonSelectionPresentation.js";
import { mergeLessonSelections } from "../src/services/lessonPlanning.js";
import { generatePreteachSuggestions } from "../src/services/preteachService.js";
import { scan } from "../src/services/tokenizer.js";
import { makeFamily, makeOccurrence } from "./support/phase3-fixtures.js";

type WebOccurrence = Record<string, unknown>;
const webContext: Record<string, unknown> = {};
// Captured Web contracts are test fixtures; this repository builds independently.
runInNewContext(
  readFileSync("tests/fixtures/web-workflow/text_workspace.js.txt", "utf8"),
  webContext,
);
const web = webContext.HKELE_TEXT_WORKSPACE as {
  segments: (text: string, items: WebOccurrence[]) => Array<{ text: string; item?: WebOccurrence }>;
  suggestions: (
    items: WebOccurrence[],
    common: Set<string>,
    level?: string | null,
  ) => Array<{
    key: string;
    form: string;
    reasons: string[];
  }>;
};
const toWeb = (item: ResolvedOccurrence): WebOccurrence => ({
  surface: item.surface,
  normalized_token: item.normalizedToken,
  status: item.status,
  start_offset: item.startOffset,
  end_offset: item.endOffset,
  owners: item.owners,
});
const create = (family: FamilyRecord, order: number): TeachingListItem => ({
  basewordKey: family.baseword_key,
  displayFamily: family.display_family,
  selectedForms: [],
  notes: "",
  connections: "",
  status: "Notice",
  customOrder: order,
  addedAt: "",
  updatedAt: "",
  dataVersion: "Package67",
  derived: {} as TeachingListItem["derived"],
});

test("real Package67 reusable search retains the actual registered form alongside family use", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://fixture.invalid");
    assert.ok(url.pathname.startsWith("/hkele-data/"));
    return new Response(
      new Uint8Array(readFileSync(join(process.cwd(), "public", url.pathname.slice(1)))),
    );
  };
  try {
    const repo = new StaticShardRepository("https://fixture.invalid/hkele-data");
    const result = await repo.searchSurface("reusable");
    const family = result.owners.find((owner) => owner.baseword_key === "use")!;
    assert.ok(family);
    assert.equal(searchSelectedForm(family, result), "reusable");
    const existing = { ...create(family, 0), selectedForms: ["use"], notes: "Keep this note" };
    assert.equal(hasSelectedForm([existing], family, "reusable"), false);
    const merged = mergeLessonSelections(
      [existing],
      [{ family, selectedForms: [searchSelectedForm(family, result)!] }],
      create,
    );
    assert.deepEqual(merged.items[0]!.selectedForms, ["use", "reusable"]);
    assert.equal(merged.items[0]!.notes, "Keep this note");
    assert.equal(hasSelectedForm(merged.items, family, "Reusable"), true);
    assert.equal(selectedWordCount(merged.items), 2);
    const forms = await repo.getFamily(family.baseword_key);
    assert.ok(forms.forms.some((form) => form.form === "reusable"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("search selection does not manufacture a missing form or select across owners", () => {
  const family = makeFamily("use", 10);
  const owner = { ...family, blocked: false, match_classes: [], matched_forms: ["use", "used"] };
  const result: SurfaceSearchResult = {
    submittedQuery: "unknown",
    normalizedQuery: "unknown",
    owners: [owner],
    status: "RESOLVED",
    bestPriority: 1,
    bestOwnerCount: 1,
    alternatives: [],
    identityException: null,
    dataMode: "remote-full",
  };
  assert.equal(searchSelectedForm(family, result), undefined);
  assert.equal(searchSelectedForm(makeFamily("other", 20), result), undefined);
  assert.equal(searchSelectedForm(family, { ...result, submittedQuery: "USED" }), "used");
  assert.equal(
    searchSelectedForm(family, { ...result, owners: [{ ...owner, blocked: true }] }),
    undefined,
  );
});

test("entry counts measure selected words rather than families", () => {
  const items = [
    { ...create(makeFamily("use", 10), 0), selectedForms: ["reuse", "reusable"] },
    { ...create(makeFamily("plastic", 1000), 1), selectedForms: ["plastic"] },
  ];
  assert.equal(items.length, 2);
  assert.equal(selectedWordCount(items), 3);
  const context: Record<string, unknown> = {};
  runInNewContext(
    readFileSync("tests/fixtures/web-workflow/lesson_contract.js.txt", "utf8"),
    context,
  );
  const contract = context.HKELE_LESSON as { wordCount: (items: unknown[]) => number };
  assert.equal(
    contract.wordCount(items.map((item) => ({ selected_forms: item.selectedForms }))),
    3,
  );
});

test("Web reader reconstructs every original character and makes only verified offsets interactive", () => {
  const text = "‘cell’ & <notes>\ncell.";
  const tokens = scan(text).occurrences.map((item) => ({
    surface: item.surface,
    start_offset: item.startOffset,
    end_offset: item.endOffset,
  }));
  const parts = web.segments(text, tokens);
  assert.equal(parts.map((part) => part.text).join(""), text);
  assert.equal(parts.filter((part) => part.item).length, 3);
  const malformed = [
    { surface: "wrong", start_offset: 1, end_offset: 5 },
    { surface: "cell", start_offset: 2, end_offset: 6 },
    { surface: "outside", start_offset: 90, end_offset: 100 },
  ];
  const safe = web.segments(text, malformed);
  assert.equal(safe.map((part) => part.text).join(""), text);
  assert.equal(safe.filter((part) => part.item).length, 0);
});

test("Web pre-teaching follows App evidence choices, missing-rank handling and explicit class context", () => {
  const records = [
    makeOccurrence("reusable", makeFamily("use", 30), 0),
    makeOccurrence("plastic", makeFamily("plastic", 1500, { msvl: "Science" }), 10),
    makeOccurrence("rare", makeFamily("rare", 8000), 18),
    makeOccurrence("unknown", makeFamily("unknown", null), 23),
    makeOccurrence("later", makeFamily("later", 200, { textbook_first_seen_level: "P5" }), 31),
    makeOccurrence("Name", makeFamily("name", 9000), 37),
  ];
  for (const level of [null, "P4"] as const) {
    const app = generatePreteachSuggestions("", records, level);
    const entries = web.suggestions(records.map(toWeb), new Set(), level);
    assert.equal(
      JSON.stringify(entries.map((item) => item.key)),
      JSON.stringify(app.map((item) => item.basewordKey)),
    );
    assert.ok(!entries.some((item) => item.key === "unknown" || item.key === "name"));
    assert.equal(
      entries.some((item) => item.reasons.includes("Family first seen: P5")),
      level === "P4",
    );
  }
});
