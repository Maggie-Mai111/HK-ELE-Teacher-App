import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { StaticShardRepository } from "../src/data/StaticShardRepository";
import { CompoundRepository } from "../src/data/CompoundRepository";
import { HybridRepository } from "../src/data/HybridRepository";
import { scan } from "../src/services/tokenizer";
import { searchSelectedForm } from "../src/services/lessonSelectionPresentation";
import type { SupplementaryExpression } from "../src/domain/supplementaryExpressions";
import { compoundDisplayParts } from "../src/services/compoundPresentation";
import { COMPOUND_RELEASE } from "../src/services/compoundData";
import { textResultFilterCategory } from "../src/services/textResultPresentation";
import {
  familySearchFormSummary,
  loadFamilySearchGroups,
  sortWordForms,
} from "../src/services/wordFamilySearch";
import { makeFamily, makeOccurrence } from "./support/phase3-fixtures";

test("unsupported text is not presented as a family choice; real ambiguities remain reviewable", () => {
  const family = makeFamily("use", 1);
  const occurrence = makeOccurrence("环保", family, 0);
  assert.equal(
    textResultFilterCategory({ ...occurrence, status: "UNSUPPORTED", owners: [] }),
    "unmatched",
  );
  assert.equal(
    textResultFilterCategory({ ...occurrence, status: "UNMATCHED", owners: [] }),
    "unmatched",
  );
  assert.equal(
    textResultFilterCategory({
      ...occurrence,
      status: "AMBIGUOUS",
      owners: [family, makeFamily("other", 2)],
    }),
    "review",
  );
});

test("family-label searches do not invent an accepted spelling or promise an absent pinned row", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const path = new URL(String(input), "https://fixture.invalid").pathname.replace(
      /^\/hkele-data\//,
      "",
    );
    return new Response(new Uint8Array(readFileSync(`public/hkele-data/${path}`)));
  };
  try {
    const repository = new StaticShardRepository("https://fixture.invalid/hkele-data");
    const match = await repository.searchSurface("aberr");
    assert.deepEqual(match.owners[0]?.matched_forms, []);
    assert.ok(match.owners[0]?.match_classes.includes("FAMILY_LABEL_ONLY"));
    assert.equal(searchSelectedForm(match.owners[0]!, match), undefined);
    const groups = await loadFamilySearchGroups(repository, match.owners);
    assert.equal(groups[0]?.forms.length, 4);
    assert.ok(!groups[0]?.forms.some((form) => form.normalized_form === "aberr"));
    assert.equal(familySearchFormSummary(groups, "aberr"), "4 related word forms");
    const expression: SupplementaryExpression = JSON.parse(
      gunzipSync(
        readFileSync(`public/assets/compounds/${COMPOUND_RELEASE.expressionVersion}/o.json.gz`),
      ).toString(),
    ).oxygen;
    expression.normalizedExpression = "aberr"; expression.displayExpression = "aberr";
    const compoundRepository = new CompoundRepository(
      new HybridRepository(repository, repository),
      async (word) => (word.toLowerCase() === "aberr" ? expression : null),
    );
    const text = "Aberr is useful.";
    assert.equal((await repository.resolveOccurrences(text, scan(text).occurrences))[0]?.status, "UNMATCHED");
    const resolved = await compoundRepository.resolveOccurrences(text, scan(text).occurrences);
    assert.equal(resolved[0]?.status, "REGISTERED_EXPRESSION");
    assert.deepEqual(resolved[0]?.owners, []);
    assert.equal(resolved[0]?.expression?.normalizedExpression, "aberr");
    const normal = await repository.searchSurface("stressed");
    const normalGroups = await loadFamilySearchGroups(repository, normal.owners);
    assert.equal(
      familySearchFormSummary(normalGroups, "stressed"),
      "51 word forms · Your search stays first. Sort changes the other forms.",
    );
    for (const sort of ["frequency-desc", "az", "za"] as const)
      assert.equal(
        sortWordForms(normalGroups[0]!.forms, "stressed", normalGroups[0]!.frequencies, sort)[0]!
          .form.form,
        "stressed",
      );
  } finally {
    globalThis.fetch = previous;
  }
});

test("unowned and self-referential compound parts stay out of teaching display without rewriting records", () => {
  const record = (word: string): SupplementaryExpression =>
    JSON.parse(
      gunzipSync(
        readFileSync(
          `public/assets/compounds/${COMPOUND_RELEASE.expressionVersion}/${word[0]}.json.gz`,
        ),
      ).toString(),
    )[word];
  const photo = record("photosynthesis"),
    oxygen = record("oxygen"),
    classmates = record("classmates");
  const before = JSON.stringify([photo, oxygen, classmates]);
  assert.equal(photo.parts?.[0]?.form, "synthsis");
  assert.deepEqual(compoundDisplayParts(photo), []);
  assert.deepEqual(compoundDisplayParts(oxygen), []);
  assert.deepEqual(
    compoundDisplayParts(classmates).map((part) => part.form),
    ["class", "mate"],
  );
  assert.equal(JSON.stringify([photo, oxygen, classmates]), before);
});
