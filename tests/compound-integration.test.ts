import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import test from "node:test";
import { CompoundRepository } from "../src/data/CompoundRepository.js";
import { StaticShardRepository } from "../src/data/StaticShardRepository.js";
import {
  lookupCompound,
  COMPOUND_RELEASE,
  canonicalCompoundManifestBytes,
} from "../src/services/compoundData.js";
import {
  createCompoundTeachingItem,
  refreshCompoundTeachingItem,
} from "../src/services/compoundTeaching.js";
import { parseLessonLibrary, migrateLessonLibrary } from "../src/services/lessonLibrary.js";
import {
  teachingListToCsv,
  teachingListToMarkdown,
  teachingListToXlsx,
} from "../src/services/teachingListExport.js";
import { buildFeedbackUrl, feedbackValues } from "../src/services/feedbackService.js";
import { scan } from "../src/services/tokenizer.js";
import { textResultKind, groupUnmatchedWords } from "../src/services/textResultPresentation.js";
import { textWordAction } from "../src/services/textReaderService.js";
import type { SupplementaryExpression } from "../src/domain/supplementaryExpressions.js";
import feedbackConfig from "../src/config/feedbackForms.json";
const fixtureWord = (word: string): SupplementaryExpression =>
  JSON.parse(
    gunzipSync(
      readFileSync(
        `public/assets/compounds/${COMPOUND_RELEASE.expressionVersion}/${word[0]}.json.gz`,
      ),
    ).toString(),
  )[word];
test("compound manifest identity tolerates Git CRLF while retaining content integrity", () => {
  const actual = JSON.parse(
    readFileSync(
      `public/assets/compounds/${COMPOUND_RELEASE.expressionVersion}/manifest.json`,
      "utf8",
    ),
  );
  const lf = JSON.stringify(actual, null, 2) + "\n",
    crlf = lf.replace(/\n/g, "\r\n");
  const digest = (s: Uint8Array | string) => createHash("sha256").update(s).digest("hex");
  assert.equal(digest(canonicalCompoundManifestBytes(new TextEncoder().encode(crlf))), digest(lf));
  assert.notEqual(
    digest(
      canonicalCompoundManifestBytes(new TextEncoder().encode(crlf.replace("57881", "57880"))),
    ),
    digest(lf),
  );
});
const withFiles = async (
  run: (base: StaticShardRepository, repo: CompoundRepository) => Promise<void>,
) => {
  const previous = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const pathname = new URL(String(input), "https://fixture.invalid").pathname;
    assert.ok(pathname.startsWith("/HK-ELE-Teacher-App/"));
    const file = resolve("public", pathname.slice("/HK-ELE-Teacher-App/".length));
    return new Response(new Uint8Array(readFileSync(file)));
  };
  try {
    const base = new StaticShardRepository("/HK-ELE-Teacher-App/hkele-data");
    await run(base, new CompoundRepository(base));
  } finally {
    globalThis.fetch = previous;
  }
};
test("compound repository adds exact records and leaves ordinary family ownership intact", async () =>
  withFiles(async (base, repo) => {
    for (const word of ["classroom", "classmates", "homework", "everyone", "something"]) {
      const found = await repo.searchSurface(word);
      assert.equal(found.status, "REGISTERED_EXPRESSION");
      assert.equal(found.owners.length, 0);
      assert.equal(found.expression?.normalizedExpression, word);
    }
    const normal = await base.searchSurface("coinsured"),
      enhanced = await repo.searchSurface("coinsured");
    assert.equal(normal.status, "RESOLVED");
    assert.ok(normal.owners.some((owner) => owner.baseword_key === "coinsure"));
    assert.deepEqual(enhanced.owners, normal.owners);
    assert.equal(enhanced.status, normal.status);
    assert.ok(enhanced.expression);
    for (const query of ["class-room", "school bus", "classroomzzzz"])
      assert.equal(await lookupCompound(query), null);
    const before = await base.browse({ scope: "core", sort: "overall", page: 1, pageSize: 25 });
    assert.deepEqual(
      await repo.browse({ scope: "core", sort: "overall", page: 1, pageSize: 25 }),
      before,
    );
    assert.equal(before.availableItems, 2871);
  }));
test("passage compounds preserve original tokens and add no duplicate occurrences", async () =>
  withFiles(async (_base, repo) => {
    const text = "Classroom homework football classroom does classroomzzzz.";
    const occurrences = scan(text).occurrences,
      results = await repo.resolveOccurrences(text, occurrences);
    assert.equal(results.length, occurrences.length);
    assert.equal(new Set(results.map((x) => x.occurrenceId)).size, occurrences.length);
    for (const item of results)
      assert.equal(text.slice(item.startOffset, item.endOffset), item.surface);
    const classroom = results.find((x) => x.surface === "Classroom")!;
    assert.equal(textResultKind(classroom), "compound-expression");
    assert.equal(textWordAction(classroom), "compound");
    assert.ok(!groupUnmatchedWords(results).some((x) => x.normalizedForm === "classroom"));
    assert.equal(results.find((x) => x.surface === "does")?.status, "BLOCKED");
    assert.equal(
      results.filter((x) => x.expression?.normalizedExpression === "classroom").length,
      2,
    );
  }));
test("failure of the supplemental layer preserves ordinary search instead of inventing matches", async () =>
  withFiles(async (base) => {
    const failed = new CompoundRepository(base, async () => {
      throw new Error("download failed");
    });
    const result = await failed.searchSurface("school");
    assert.equal(result.status, "RESOLVED");
    assert.equal(result.expressionLayerStatus, "UNAVAILABLE");
    const missing = await failed.searchSurface("classroom");
    assert.equal(missing.status, "UNMATCHED");
    assert.equal(missing.expressionLayerStatus, "UNAVAILABLE");
    await assert.rejects(lookupCompound("classroom", "wrong-data"), /another wordlist/);
  }));
test("compound notes, identity, order and complete record survive reopening and refresh", () => {
  const expression = fixtureWord("classroom"),
    item = {
      ...createCompoundTeachingItem(expression, 2),
      notes: "Target classroom sense",
      connections: "A class activity",
      teachingFocus: "focus" as const,
    };
  const library = migrateLessonLibrary({ schemaVersion: "1.1.0", items: [item] }, "now");
  const opened = parseLessonLibrary(JSON.stringify(library)).lessons[0]!.items[0]!;
  const refreshed = refreshCompoundTeachingItem(opened, expression);
  assert.equal(refreshed.notes, item.notes);
  assert.equal(refreshed.customOrder, 2);
  assert.equal(refreshed.basewordKey, "expression:" + expression.expressionId);
  assert.equal(refreshed.derived.overall_frequency_order, null);
  const unavailable = refreshCompoundTeachingItem(opened, null);
  assert.equal(unavailable.notes, item.notes);
  assert.ok(unavailable.expression);
  assert.match(unavailable.dataReviewStatus!, /kept/);
});
test("CSV, Markdown and XLSX retain compound identity and do not export a fabricated family rank", () => {
  const expression = fixtureWord("classroom"),
    item = { ...createCompoundTeachingItem(expression, 0), notes: "Target meaning" };
  const csv = teachingListToCsv([item], "Science"),
    md = teachingListToMarkdown([item], "Science");
  const sheet = strFromU8(
    unzipSync(teachingListToXlsx([item], "Science"))["xl/worksheets/sheet1.xml"]!,
  );
  for (const text of [csv, md, sheet]) {
    assert.ok(text.includes(expression.expressionId));
    assert.ok(text.includes(expression.sourceVersion));
    assert.ok(text.includes("Target meaning"));
  }
  assert.ok(csv.includes("Expression ID"));
  assert.equal(item.derived.set_membership, null);
  assert.equal(item.derived.current_hk_frequency_rank, null);
});
test("compound ratings use the existing Google form and identify the expression rather than a family", () => {
  const expression = fixtureWord("classroom");
  const context = {
    product: "App/PWA" as const,
    page: "Check a text",
    word: expression.displayExpression,
    expressionId: expression.expressionId,
    expressionVersion: expression.sourceVersion,
  };
  assert.ok(buildFeedbackUrl("rating", context, feedbackConfig));
  const reference = feedbackValues(context, feedbackConfig).reference;
  assert.match(reference, /Record type: Compound/);
  assert.ok(reference.includes(expression.expressionId));
  assert.ok(!reference.includes("Family key:"));
});
