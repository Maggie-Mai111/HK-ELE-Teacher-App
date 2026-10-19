import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";
import type { TeachingListDocument, TeachingListItem } from "../src/domain/teachingList.js";
import {
  activeLesson,
  addSavedLesson,
  LESSON_LIBRARY_STORAGE_KEY,
  mergeRefreshedLessonItems,
  migrateLessonLibrary,
  parseLessonLibrary,
  renameActiveLesson,
  replaceLessonItems,
  selectSavedLesson,
} from "../src/services/lessonLibrary.js";
import {
  buildTeachingListExport,
  teachingListToCsv,
  teachingListToMarkdown,
  teachingListToXlsx,
} from "../src/services/teachingListExport.js";

const now = "2026-10-19T04:00:00Z";
function item(key = "use"): TeachingListItem {
  return {
    basewordKey: key,
    displayFamily: key,
    selectedForms: [key === "use" ? "reusable" : key],
    customOrder: 0,
    status: "Master",
    teachingFocus: "focus",
    sourceLabels: ["Check a text"],
    notes: "Archived lesson note",
    connections: "Compare disposable",
    addedAt: "2026-09-14",
    updatedAt: "2026-10-18",
    dataVersion: "Package67",
    derived: {
      set_membership: "Candidate",
      overall_frequency_order: 36,
      current_hk_frequency_rank: 33,
      current_hk_frequency_band: "Top 1k",
      textbook_first_seen_level: "P1",
      external_level_reference_display: "Grade 1",
    },
  };
}
function original(): TeachingListDocument {
  return { schemaVersion: "1.1.0", lessonTitle: "P4 · Original lesson", items: [item()] };
}

test("migration retains every existing teacher field and the original document", () => {
  const old = original(),
    before = JSON.stringify(old);
  const library = migrateLessonLibrary(old, now);
  assert.equal(library.lessons.length, 1);
  assert.deepEqual(activeLesson(library).items, old.items);
  assert.equal(activeLesson(library).title, old.lessonTitle);
  assert.equal(JSON.stringify(old), before);
  assert.deepEqual(parseLessonLibrary(JSON.stringify(library)), library);
});

test("creating and renaming a lesson leaves earlier words, notes and order intact", () => {
  const first = migrateLessonLibrary(original(), now);
  const next = addSavedLesson(first, "  S1 · Science  ", "science", now);
  assert.equal(activeLesson(next).title, "S1 · Science");
  assert.equal(activeLesson(next).items.length, 0);
  const edited = renameActiveLesson(
    replaceLessonItems(next, [{ ...item("cell"), notes: "Current lesson note" }], now),
    "S1 · Cells",
    now,
  );
  assert.equal(activeLesson(edited).title, "S1 · Cells");
  assert.deepEqual(
    activeLesson(selectSavedLesson(edited, first.activeLessonId)).items,
    original().items,
  );
  assert.equal(first.lessons.length, 1);
  assert.equal(activeLesson(addSavedLesson(edited, "", "third", now)).title, "Lesson 3");
});

test("the same family can have independent selected forms and plans in different lessons", () => {
  const first = migrateLessonLibrary(original(), now);
  let next = addSavedLesson(first, "P5 · Reuse", "reuse", now);
  next = replaceLessonItems(
    next,
    [{ ...item(), selectedForms: ["used"], notes: "Different meaning", teachingFocus: "mention" }],
    now,
  );
  const restored = selectSavedLesson(next, first.activeLessonId);
  assert.equal(activeLesson(restored).items[0]?.notes, "Archived lesson note");
  assert.deepEqual(activeLesson(restored).items[0]?.selectedForms, ["reusable"]);
  assert.deepEqual(activeLesson(selectSavedLesson(restored, "reuse")).items[0]?.selectedForms, [
    "used",
  ]);
  assert.throws(() => selectSavedLesson(next, "missing"));
  assert.throws(() => addSavedLesson(next, "duplicate", "reuse", now));
});

test("saved library snapshots preserve active lesson across reload and rapid switches", () => {
  const first = migrateLessonLibrary(original(), now);
  const second = addSavedLesson(first, "Science", "science", now);
  const snapshot = JSON.stringify(second);
  const renamed = renameActiveLesson(
    selectSavedLesson(second, first.activeLessonId),
    "Renamed first lesson",
    now,
  );
  assert.equal(parseLessonLibrary(snapshot).activeLessonId, "science");
  assert.equal(
    activeLesson(parseLessonLibrary(JSON.stringify(renamed))).title,
    "Renamed first lesson",
  );
  assert.equal(activeLesson(parseLessonLibrary(snapshot)).title, "Science");
});

test("corrupt, duplicate and unsupported libraries fail rather than becoming empty lessons", () => {
  const valid = migrateLessonLibrary(original(), now);
  for (const malformed of [
    null,
    {},
    { ...valid, schemaVersion: "9" },
    { ...valid, activeLessonId: "absent" },
    { ...valid, lessons: [] },
    { ...valid, lessons: [valid.lessons[0], valid.lessons[0]] },
    { ...valid, lessons: [{ ...valid.lessons[0], items: [{ ...item(), selectedForms: 42 }] }] },
    { ...valid, lessons: [{ ...valid.lessons[0], items: [item(), item()] }] },
  ])
    assert.throws(() => parseLessonLibrary(JSON.stringify(malformed)));
  assert.throws(() => parseLessonLibrary("not json"));
});

test("a delayed evidence refresh preserves newer personal edits and additions", () => {
  const old = item();
  const current = [
    {
      ...old,
      notes: "Edited while loading",
      selectedForms: ["reusable", "reuse"],
      teachingFocus: "mention" as const,
    },
    item("cell"),
  ];
  const refreshed = [
    {
      ...old,
      notes: "Stale note",
      displayFamily: "use",
      dataVersion: "Future approved version",
      derived: { ...old.derived, current_hk_frequency_rank: 40 },
    },
  ];
  const merged = mergeRefreshedLessonItems(current, refreshed);
  assert.equal(merged[0]?.notes, "Edited while loading");
  assert.deepEqual(merged[0]?.selectedForms, ["reusable", "reuse"]);
  assert.equal(merged[0]?.teachingFocus, "mention");
  assert.equal(merged[0]?.derived.current_hk_frequency_rank, 40);
  assert.equal(merged[1], current[1]);
  assert.equal(current[0]?.derived.current_hk_frequency_rank, 33);
});

test("CSV, Markdown and Excel export only the selected lesson", () => {
  let library = addSavedLesson(migrateLessonLibrary(original(), now), "S1 · Cells", "cells", now);
  library = replaceLessonItems(
    library,
    [{ ...item("cell"), notes: "Teach the biological sense" }],
    now,
  );
  const lesson = activeLesson(library);
  const csv = teachingListToCsv(lesson.items, lesson.title),
    md = teachingListToMarkdown(lesson.items, lesson.title);
  const zip = unzipSync(teachingListToXlsx(lesson.items, lesson.title));
  const xml = Object.values(zip)
    .map((bytes) => strFromU8(bytes))
    .join("\n");
  for (const output of [csv, md, xml]) {
    assert.ok(output.includes("S1 · Cells"));
    assert.ok(output.includes("Teach the biological sense"));
    assert.ok(!output.includes("Archived lesson note"));
    assert.ok(!output.includes("reusable"));
  }
});

test("export filenames identify the lesson and exclude filesystem separators", () => {
  for (const format of ["xlsx", "csv", "md"] as const) {
    const named = buildTeachingListExport([item()], format, "S1: Cells / 課堂?");
    assert.match(named.filename, /S1-Cells-課堂/);
    assert.doesNotMatch(named.filename, /[<>:"/\\|?*\x00-\x1f]/);
    assert.notEqual(named.filename, buildTeachingListExport([item()], format, "P4 Reuse").filename);
  }
});

test("library writes use a new key; legacy keys and session-only answers are not written", () => {
  assert.equal(LESSON_LIBRARY_STORAGE_KEY, "hkele-lessons-v1");
  const service = readFileSync("src/services/teachingListService.ts", "utf8");
  assert.match(service, /getItem\(STORAGE_KEY\)/);
  assert.doesNotMatch(service, /setItem\(STORAGE_KEY/);
  assert.match(service, /setItem\(LESSON_LIBRARY_STORAGE_KEY, raw\)/);
  assert.match(service, /undoState.lessonId !== libraryRef.current\?\.activeLessonId/);
  assert.doesNotMatch(service, /writeDocument\([^)]*(?:sessionSources|checkedText|knowledge)/);
});

test("long passage links reveal the correct section and class responses reset per lesson", () => {
  const screen = readFileSync("src/screens/CheckTextScreen.tsx", "utf8");
  assert.match(screen, /Pre-teaching suggestions ↓/);
  assert.match(screen, /↑ Back to text/);
  assert.match(screen, /results.length > 80/);
  assert.match(screen, /onRevealSection\(suggestionsRef.current\)/);
  assert.match(screen, /onRevealSection\(readerRef.current\)/);
  assert.match(screen, /key=\{teaching.activeLessonId\}/);
  const app = readFileSync("App.tsx", "utf8");
  assert.match(app, /scrollIntoView/);
  assert.match(app, /measureLayout/);
});
