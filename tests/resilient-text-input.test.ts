import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import test from "node:test";
import { scan, scanTeacherText, TokenizerError } from "../src/services/tokenizer.js";
import { textReaderSegments } from "../src/services/textReaderService.js";
import { groupContextReviews } from "../src/services/textResultPresentation.js";
import { StaticShardRepository } from "../src/data/StaticShardRepository.js";
import { CompoundRepository } from "../src/data/CompoundRepository.js";
import type { ResolvedOccurrence } from "../src/domain/hkele.js";

const separators = [
  "•",
  "，",
  "。",
  "：",
  "；",
  "（",
  "）",
  "！",
  "？",
  "🙂",
  "👩‍🏫",
  "️",
  "\u200b",
  "\ufeff",
  "\u202f",
  "\u2028",
  "\u2029",
  "\u0000",
  "\u000b",
  "\u000c",
  "\u00a0",
  "©",
  "®",
  "™",
  "£",
  "€",
  "√",
  "→",
  "　",
  "–",
  "—",
];
test("teacher passages continue around copied punctuation, bullets, emoji and formatting controls", () => {
  for (const separator of separators) {
    const text = `Cells ${separator} help teachers.`;
    const result = scanTeacherText(text);
    assert.deepEqual(
      result.occurrences.map((item) => item.surface),
      ["Cells", "help", "teachers"],
      separator,
    );
    for (const item of result.occurrences)
      assert.equal(text.slice(item.startOffset, item.endOffset), item.surface);
  }
});
test("unclear whole forms remain visible without matching misleading fragments", () => {
  const text = "cell com\u200bputer can't've café 中文 co\u00adoperate stress";
  const result = scanTeacherText(text).occurrences;
  assert.deepEqual(
    result.filter((item) => item.tokenStatus === "SUPPORTED_TOKEN").map((item) => item.surface),
    ["cell", "stress"],
  );
  assert.deepEqual(
    result.filter((item) => item.tokenStatus === "UNSUPPORTED_TOKEN").map((item) => item.surface),
    ["com\u200bputer", "can't've", "café", "中文", "co\u00adoperate"],
  );
  assert.ok(
    result
      .filter((item) => item.tokenStatus === "UNSUPPORTED_TOKEN")
      .every((item) => item.normalizedToken === null),
  );
});
test("reader reconstruction keeps every original character, surrogate pair and clickable offset", () => {
  const text = "👩‍🏫 • ‘cells’，café\ncom\u200bputer🙂\tstress\r\n中文。";
  const records = scanTeacherText(text).occurrences.map((item) => ({
    ...item,
    status: item.tokenStatus === "SUPPORTED_TOKEN" ? "UNMATCHED" : "UNSUPPORTED",
    owners: [],
    alternatives: [],
    bestOwnerCount: 0,
    identityException: null,
    context: text,
    dataMode: "remote-full",
  })) as ResolvedOccurrence[];
  const parts = textReaderSegments(text, records);
  assert.equal(parts.map((part) => part.text).join(""), text);
  assert.equal(parts.filter((part) => part.occurrence).length, records.length);
  for (const item of records)
    assert.equal(text.slice(item.startOffset, item.endOffset), item.surface);
});
test("normal English, quotes, contractions and possessives retain the original scan output", () => {
  for (const text of [
    "Last month, our school started a project to make the campus greener.",
    "I’m here — don't move.",
    "'report' drives",
    "The ‘teachers’ report’ discusses ‘students’ work’.",
    "Teachers' books and children's work.",
    "US students read; reusable bottles help.",
  ])
    assert.deepEqual(scanTeacherText(text).occurrences, scan(text).occurrences, text);
});
test("the strict legacy contract still rejects its original unsupported input", () => {
  assert.throws(() => scan("cell🙂"), TokenizerError);
  assert.throws(() => scan("can't've"), TokenizerError);
  assert.deepEqual(
    scanTeacherText("cell🙂").occurrences.map((item) => item.surface),
    ["cell"],
  );
});
test("Web and App agree on every partial result, status and original offset", () => {
  const context = vm.createContext({});
  vm.runInContext(readFileSync("tests/fixtures/web-teacher-tokenizer.js.txt", "utf8"), context);
  const web = context.HKELE_TOKENIZER as {
    scanTeacherText: (text: string) => { occurrences: Array<Record<string, unknown>> };
  };
  for (const separator of separators) {
    const text = `‘cells’${separator} reusable com\u200bputer can't've 中文 café 🙂 stress`;
    const app = scanTeacherText(text).occurrences.map((item) => [
      item.surface,
      item.normalizedToken,
      item.tokenStatus,
      item.startOffset,
      item.endOffset,
    ]);
    const browser = web
      .scanTeacherText(text)
      .occurrences.map((item) => [
        item.surface,
        item.normalized_token,
        item.token_status,
        item.start_offset,
        item.end_offset,
      ]);
    assert.equal(JSON.stringify(browser), JSON.stringify(app), separator);
  }
});
test("symbols-only input does not manufacture words; long input is never silently truncated", () => {
  assert.equal(scanTeacherText("• 🙂 ， 123 \u200b \u0000").occurrences.length, 0);
  assert.equal(scanTeacherText("cell ".repeat(500)).occurrences.length, 500);
  assert.throws(() => scanTeacherText("cell ".repeat(501)), /500/);
});
test("the real data resolver checks surrounding words and compounds without querying unclear forms", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const path = new URL(String(input), "https://fixture.invalid").pathname.replace(
      /^\/HK-ELE-Teacher-App\//,
      "/",
    );
    return new Response(new Uint8Array(readFileSync(join(process.cwd(), "public", path.slice(1)))));
  };
  try {
    const repo = new CompoundRepository(
      new StaticShardRepository("https://fixture.invalid/hkele-data"),
    );
    const text =
      "• Cells，use reusable bottles 🙂 classroom. com\u200bputer can't've café 中文 stress.";
    const records = await repo.resolveOccurrences(text, scanTeacherText(text).occurrences);
    assert.equal(records.find((item) => item.surface === "Cells")?.status, "RESOLVED");
    assert.equal(
      records.find((item) => item.surface === "reusable")?.owners[0]?.baseword_key,
      "use",
    );
    assert.equal(
      records.find((item) => item.surface === "classroom")?.status,
      "REGISTERED_EXPRESSION",
    );
    for (const surface of ["com\u200bputer", "can't've", "café", "中文"]) {
      const item = records.find((item) => item.surface === surface)!;
      assert.equal(item.status, "UNSUPPORTED");
      assert.equal(item.owners.length, 0);
    }
    assert.equal(records.find((item) => item.surface === "stress")?.status, "RESOLVED");
    assert.equal(
      textReaderSegments(text, records)
        .map((part) => part.text)
        .join(""),
      text,
    );
    assert.ok(groupContextReviews(records).every((item) => !item.explanation.includes("spelling")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
test("the App paste and OCR insertion converge on the tolerant teacher scanner", () => {
  const source = readFileSync("src/screens/CheckTextScreen.tsx", "utf8");
  assert.match(source, /scanTeacherText\(source\)/);
  assert.match(source, /onApplyText=\{applyPhotoText\}/);
  const body=source.match(/const applyPhotoText = \(value: string\) => \{([\s\S]*?)\n  \};/)?.[1];
  assert.ok(body);
  const received:string[]=[];
  const input="Cells • have walls.\nTeachers’ notes.";
  vm.runInNewContext(`(value=>{${body}})(input)`,{
    input,changeText:(value:string)=>received.push(value),setOcrOpen:()=>{},setOcrReviewing:()=>{},setTimeout:()=>{},
  });
  assert.deepEqual(received,[input]);
  assert.doesNotMatch(source, /Check the spelling and symbols/);
});
