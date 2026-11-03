import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import vm from "node:vm";
import test from "node:test";
import {
  aiEvidenceForms,
  loadAiFormEvidence,
  type AiFormEvidence,
} from "../src/services/aiFormEvidence.js";
import { filterAiWordEvidence, matchesAiWord } from "../src/services/aiFormFilter.js";
import { generatePreteachSuggestions } from "../src/services/preteachService.js";
import { groupOccurrences } from "../src/services/progressiveResults.js";
import { hkFrequencyDisplay } from "../src/services/frequencyService.js";
import { CPB_ITEMS } from "../src/services/cpbService.js";
import type { FamilyRecord, FormRecord, SearchFamilyOwner } from "../src/domain/hkele.js";
import { makeFamily, makeOccurrence } from "./support/phase3-fixtures.js";

const document = JSON.parse(
  gunzipSync(readFileSync("public/assets/ai-form-evidence/20261103-wordlist2658-v1.json.gz")).toString(),
) as AiFormEvidence;
const projection = JSON.parse(
  gunzipSync(readFileSync("public/hkele-data/ai_full_projection.json.gz")).toString(),
) as { fields: string[]; rows: unknown[][] };
const families = projection.rows.map(
  (row) =>
    Object.fromEntries(
      projection.fields.map((field, i) => [field, row[i]]),
    ) as unknown as FamilyRecord,
);
const byKey = new Map(families.map((f) => [f.baseword_key, f]));
const context = { families, cpbFamilyKeys: new Set<string>() };
test("the App verifies AI form evidence, retries a damaged download, and refuses a different wordlist version", async () => {
  const originalFetch = globalThis.fetch;
  let corrupt = true;
  globalThis.fetch = async (url) => {
    assert.equal(String(url), "/HK-ELE-Teacher-App/assets/ai-form-evidence/20261103-wordlist2658-v1.json.gz");
    const bytes = new Uint8Array(
      readFileSync("public/assets/ai-form-evidence/20261103-wordlist2658-v1.json.gz"),
    );
    if (corrupt) {
      bytes[bytes.length - 1]! ^= 1;
      corrupt = false;
    }
    return new Response(bytes);
  };
  try {
    await assert.rejects(loadAiFormEvidence("other-version"), /current wordlist/);
    await assert.rejects(loadAiFormEvidence("2026-11-03-a2658-finite-family-closure-v1"), /changed/);
    const loaded = await loadAiFormEvidence("2026-11-03-a2658-finite-family-closure-v1");
    assert.equal(loaded.formCount, 328253);
    assert.ok(aiEvidenceForms(loaded, "agent").some((form) => form.form === "agency"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
function occurrence(key: string, word: string, offset = 0) {
  const form = aiEvidenceForms(document, key).find((f) => f.form === word.toLowerCase())!;
  assert.ok(form, word);
  return makeOccurrence(
    word,
    {
      ...byKey.get(key)!,
      blocked: false,
      match_classes: ["EXACT_FORM"],
      matched_forms: [word],
      matched_form_evidence: form,
    } as SearchFamilyOwner,
    offset,
  );
}

test("pre-teaching uses each actual form rather than family AWL/MSVL or the first family form", () => {
  const stressors = generatePreteachSuggestions("", [occurrence("stress", "stressors")])[0]!;
  assert.ok(!stressors.reasons.includes("Listed in AWL"));
  assert.ok(stressors.reasons.includes("MSVL: Health"));
  const reusable = occurrence("book", "booked"),
    used = occurrence("book", "book", 10);
  for (const items of [
    [used, reusable],
    [reusable, used],
  ]) {
    const suggestions = generatePreteachSuggestions("", items, "P4");
    assert.deepEqual(
      suggestions.map((x) => x.actualForm),
      ["booked"],
    );
    assert.ok(suggestions[0]!.reasons.includes("Textbooks: P5 · after P4"));
    assert.ok(!suggestions[0]!.reasons.some((x) => x.startsWith("MSVL:")));
  }
  assert.equal(generatePreteachSuggestions("", [reusable], "P6").length, 0);
});

test("capitalisation preserves ordinary matched words and counts; Known/Not known apply to the shown form", () => {
  const items = [
    occurrence("cell", "Cells"),
    occurrence("cell", "cells", 10),
    occurrence("cell", "cell", 20),
  ];
  const generated = generatePreteachSuggestions("", items);
  assert.equal(generated.find((x) => x.actualForm === "Cells")!.occurrences, 2);
  const known = generatePreteachSuggestions("", items, null, Infinity, {
    knownForms: new Set(["cells"]),
  });
  assert.ok(!known.some((x) => x.actualForm.toLowerCase() === "cells"));
  assert.ok(known.some((x) => x.actualForm === "cell"));
  const common = makeOccurrence("the", makeFamily("the", 1), 0);
  assert.equal(generatePreteachSuggestions("", [common]).length, 0);
  assert.equal(
    generatePreteachSuggestions("", [common], null, Infinity, {
      notKnownForms: new Set(["the"]),
    })[0]!.marked,
    true,
  );
});

test("the evidence queue sorts by class comparison, appearances and position, without reason-count scores or an eight-word cap", () => {
  const items = Array.from({ length: 12 }, (_, i) =>
    makeOccurrence(`review${String.fromCharCode(97 + i)}`, makeFamily(`review${i}`, 3000), i * 10),
  );
  assert.equal(generatePreteachSuggestions("", items).length, 12);
  assert.equal(generatePreteachSuggestions("", items, null, 4).length, 4);
  const rare = occurrence("stress", "stressed", 0),
    repeat = occurrence("cell", "cells", 20);
  const result = generatePreteachSuggestions("", [
    rare,
    repeat,
    { ...repeat, occurrenceId: "again", occurrenceOrder: 30 },
  ]);
  assert.equal(result[0]!.actualForm, "cells");
  const reasonsBefore = result[0]!.reasons.length;
  assert.ok(reasonsBefore > 0);
});

test("AI root act verifies actual forms: age/aged are excluded, agency keeps its frozen family", () => {
  const result = filterAiWordEvidence(
    { families: [byKey.get("agent")!], cpbFamilyKeys: new Set() },
    { scope: "full", root: "act", sort: "overall", limit: 100 },
    (key) => aiEvidenceForms(document, key),
  );
  assert.deepEqual(
    result.families.map((f) => f.ai_match_form).sort(),
    aiEvidenceForms(document, "agent").filter((f) => matchesAiWord(f, {scope: "full", root: "act", sort: "overall", limit: 100})).map((f) => f.form).sort(),
  );
  assert.equal(result.families[0]!.baseword_key, "agent");
  assert.equal(
    (result.families[0]!.ai_source_family as FamilyRecord).textbook_first_seen_level,
    null,
  );
  assert.equal(result.families[0]!.textbook_first_seen_level, null);
  const full = filterAiWordEvidence(
    context,
    { scope: "full", root: "act", sort: "az", limit: 100 },
    (key) => aiEvidenceForms(document, key),
  );
  assert.ok(full.matchedBeforeLimit > 100);
  assert.equal(full.families.length, 100);
  for (const row of full.families)
    assert.ok(
      String(row.browse_root)
        .split(/[|/]+/)
        .map((s) => s.trim())
        .includes("act"),
    );
});

test("word-level AI conditions must co-occur on one form; missing annotations are not negative membership", () => {
  const first = aiEvidenceForms(document, "use").find((f) => f.form === "used")!;
  const later = aiEvidenceForms(document, "use").find((f) => f.form === "reusable")!;
  assert.equal(
    matchesAiWord(first, {
      scope: "full",
      root: "use",
      earliestObservedFrom: "P5",
      sort: "overall",
      limit: 20,
    }),
    false,
  );
  const fixture = [
    { ...first, root: "act", first_seen_hk_textbooks: "P5" },
    { ...later, root: "age", first_seen_hk_textbooks: "P1" },
  ] as FormRecord[];
  const result = filterAiWordEvidence(
    { families: [byKey.get("use")!], cpbFamilyKeys: new Set() },
    { scope: "full", root: "act", earliestObservedTo: "P2", sort: "overall", limit: 20 },
    () => fixture,
  );
  assert.equal(result.matchedBeforeLimit, 0);
  assert.equal(
    matchesAiWord(
      { ...first, awl: null },
      { scope: "full", awl: false, sort: "overall", limit: 20 },
    ),
    false,
  );
});

test("Web and App use identical form matching, limits and ordering on the actual frozen index", () => {
  const sandbox = vm.createContext({});
  vm.runInContext(readFileSync("tests/fixtures/web-ai-form-contract.js.txt", "utf8"), sandbox);
  vm.runInContext(readFileSync("tests/fixtures/web-ai-form-filter.js.txt", "utf8"), sandbox);
  const web = sandbox.HKELE_AI_WORD_FILTER as {
    apply: (
      families: FamilyRecord[],
      filters: unknown,
      doc: AiFormEvidence,
      common: Set<string>,
    ) => { families: FamilyRecord[]; matchedBeforeLimit: number };
  };
  for (const filter of [
    { scope: "full", root: "act", sort: "overall", limit: 20 },
    { scope: "candidate", root: "act", earliestObservedTo: "P4", sort: "az", limit: 20 },
    { scope: "full", msvlSubjects: ["Science"], awl: true, sort: "hk", limit: 10 },
    { scope: "full", cpb100: true, sort: "az", limit: 100 },
  ]) {
    const app = filterAiWordEvidence(context, filter, (key) => aiEvidenceForms(document, key));
    const browser = web.apply(
      families,
      filter,
      document,
      new Set(CPB_ITEMS.map((item) => item.matchKey)),
    );
    assert.equal(browser.matchedBeforeLimit, app.matchedBeforeLimit);
    assert.equal(
      JSON.stringify(browser.families.map((f) => f.ai_match_key)),
      JSON.stringify(app.families.map((f) => f.ai_match_key)),
    );
  }
});

test("grouped text results honour first occurrence and family alphabetic order; highlight labels name their real bands", () => {
  const alpha = makeOccurrence("alpha", makeFamily("alpha", 1), 50),
    zeta = makeOccurrence("zeta", makeFamily("zeta", 1), 0);
  const items = [zeta, { ...zeta, occurrenceId: "z2" }, alpha];
  assert.deepEqual(
    groupOccurrences(items, "family").map((x) => x.form),
    ["alpha", "zeta"],
  );
  assert.deepEqual(
    groupOccurrences(items, "occurrence").map((x) => x.form),
    ["zeta", "alpha"],
  );
  assert.equal(hkFrequencyDisplay(1001).label, "HK family ranks 1,001–2,000");
  assert.equal(hkFrequencyDisplay(2000).band, "next-1k");
  assert.equal(hkFrequencyDisplay(2001).band, "later");
  assert.match(
    readFileSync("src/screens/CheckTextScreen.tsx", "utf8"),
    /label="CPB100 sight words"/,
  );
});

test("CPB is annotation only; repetition orders eligible words and explicit familiarity wins", () => {
  const make = (word: string, rank: number, level: string | null = null, awl = 0, order = 0) => makeOccurrence(word, {
    ...makeFamily(word, rank), blocked: false,
    matched_form_evidence: { form: word, first_seen_hk_textbooks: level, awl, msvl: null },
  } as unknown as SearchFamilyOwner, order);
  const our = make("our", 50, "P5");
  assert.equal(generatePreteachSuggestions("", [our], "P1").length, 1);
  assert.equal(generatePreteachSuggestions("", [our], "P6").length, 0);
  const repeated = [make("the", 1), make("the", 1, null, 0, 1)];
  assert.equal(generatePreteachSuggestions("", repeated).length, 0);
  const other = [make("frequent", 50), make("frequent", 50, null, 0, 1)];
  assert.equal(generatePreteachSuggestions("", other).length, 0);
  assert.equal(generatePreteachSuggestions("", repeated, null, Infinity, {notKnownForms: new Set(["the"])}).length, 1);
  assert.equal(generatePreteachSuggestions("", [our], "P1", Infinity, {knownForms: new Set(["our"])}).length, 0);
  assert.equal(generatePreteachSuggestions("", [make("the", 1, null, 1)]).length, 1);
  const a = make("alpha", 2000), b = make("beta", 3000, null, 0, 10);
  assert.equal(generatePreteachSuggestions("", [a,b,{...b,occurrenceId: "again",occurrenceOrder:20}])[0]!.actualForm, "beta");
});
