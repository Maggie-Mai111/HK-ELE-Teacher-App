import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import type { FormRecord } from "../src/domain/hkele.js";
import { interpretAiFilterFixture } from "../src/services/aiFilterFixture.js";
import { browseResultState } from "../src/services/browseResultState.js";
import {
  groupOccurrences,
  nextBatchSize,
  OCCURRENCE_BATCH_SIZE,
  PROGRESSIVE_BATCH_SIZE,
  visibleForms,
} from "../src/services/progressiveResults.js";
import { colors } from "../src/theme/tokens.js";
import { makeFamily, makeOccurrence } from "./support/phase3-fixtures.js";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : /\.[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

test("browse, exact-search and AI result states are mutually exclusive", () => {
  for (const mode of ["browse", "search", "ai"] as const) {
    const state = browseResultState(mode);
    assert.equal(Number(state.searchActive) + Number(state.aiActive), mode === "browse" ? 0 : 1);
    assert.equal(state.searchActive, mode === "search");
    assert.equal(state.aiActive, mode === "ai");
  }
  const browse = source("src/screens/BrowseScreen.tsx");
  assert.match(browse, /state\.searchActive[\s\S]*search\?\.owners[\s\S]*state\.aiActive/);
  assert.match(browse, /Clear search/);
  assert.match(browse, /resultMode === "browse"/);
});

test("main screens remain mounted while per-route scroll and detail return are restored", () => {
  const app = source("App.tsx");
  for (const screen of [
    "BrowseScreen",
    "CheckTextScreen",
    "TeachingListScreen",
    "DataVersionScreen",
  ])
    assert.equal((app.match(new RegExp(`<${screen}`, "g")) ?? []).length, 1);
  assert.match(app, /scrollPositions = useRef<Record<AppRoute, number>>/);
  assert.match(app, /const target = detail \? 0 : scrollPositions\.current\[route\]/);
  assert.match(app, /previousRoute: route/);
  assert.match(app, /setRoute\(detail\.previousRoute\)/);
  assert.match(app, /hiddenScreen: \{ display: "none" \}/);
  const check = source("src/screens/CheckTextScreen.tsx");
  assert.doesNotMatch(check, /localStorage|AsyncStorage/);
});

test("new browse results move focus and scroll to a single live summary", () => {
  const browse = source("src/screens/BrowseScreen.tsx");
  assert.match(browse, /scrollIntoView\?\./);
  assert.match(browse, /node\?\.focus\?\./);
  assert.match(browse, /accessibilityLiveRegion="polite"/);
  assert.match(browse, /focusAfterBrowseLoad\.current = true/);
  const check = source("src/screens/CheckTextScreen.tsx");
  assert.match(check, /summaryRef/);
  assert.match(check, /filteredSummaryRef/);
});

test("AI fixture is strict, local-only, includes all conditions and never needs a provider", () => {
  const root = interpretAiFilterFixture(
    "Find Candidate and Reference words with the registered root act",
  );
  assert.equal(root.status, "ready");
  assert.deepEqual(root.filters, {
    scope: "inclusive_reference",
    root: "act",
    limit: 20,
    sort: "overall",
  });
  assert.equal(interpretAiFilterFixture("Run SQL please").status, "unsupported");
  const runtime = source("src/config/runtime.ts");
  assert.match(runtime, /environment === "local"[\s\S]*EXPO_PUBLIC_HKELE_AI_FIXTURE_MODE/);
  const client = source("src/services/aiFilterClient.ts");
  assert.match(client, /fixtureMode\) return interpretAiFilterFixture/);
});

test("AI matched/shown counts and three distinct result actions remain explicit", () => {
  const browse = source("src/screens/BrowseScreen.tsx");
  assert.match(browse, /matchedBeforeLimit[\s\S]*matches · showing first/);
  for (const label of ["Clear results", "Edit AI request", "Adjust manual filters"])
    assert.equal((browse.match(new RegExp(`label="${label}"`, "g")) ?? []).length, 1, label);
  assert.match(browse, /setEditRequestNonce\(\(value\) => value \+ 1\)/);
  assert.match(browse, /onPress=\{showManualFilters\}/);
  assert.match(browse, /setResultMode\("browse"\)/);
  const assistant = source("src/components/AiFilterAssistant.tsx");
  assert.match(assistant, /describeAiFilterConditions/);
  assert.match(assistant, /inputRef\.current\?\.focus/);
});

test("bulk addition reports added/existing/total and all destructive list changes expose Undo", () => {
  const browse = source("src/screens/BrowseScreen.tsx");
  assert.match(browse, /result\.added.*result\.existing.*result\.total/s);
  assert.match(browse, /Undo bulk addition/);
  const service = source("src/services/teachingListService.ts");
  assert.match(service, /Bulk addition to Teaching list/);
  assert.match(service, /Removed family/);
  assert.match(service, /Removed selected form/);
  assert.match(service, /const undo = useCallback/);
  const screen = source("src/screens/TeachingListScreen.tsx");
  assert.match(screen, /Undo last change/);
  assert.match(screen, /teaching\.items\.length > 0 \? \([\s\S]*styles\.exportBox/);
  assert.match(screen, /Your teaching list is empty/);
  assert.match(screen, /Go to Find words/);
});

test("193 forms and 500 occurrences are exposed progressively rather than rendered at once", () => {
  const forms = Array.from({ length: 193 }, (_, index) => ({
    form_key: `form-${index}`,
    baseword_key: "act",
    form: `act-${index}`,
    normalized_form: `act-${index}`,
    first_seen_hk_textbooks: null,
    external_level_reference: null,
    academic_subject_evidence: null,
    awl: 0,
    msvl: null,
    root: "act",
    root_meaning: null,
    prefix: null,
    suffix: null,
  })) satisfies FormRecord[];
  assert.equal(visibleForms(forms, PROGRESSIVE_BATCH_SIZE).length, 20);
  assert.equal(nextBatchSize(180, forms.length, PROGRESSIVE_BATCH_SIZE), 193);

  const family = makeFamily("act", 1);
  const occurrences = Array.from({ length: 500 }, (_, index) =>
    makeOccurrence(index % 2 ? "act" : "acts", family, index),
  );
  const groups = groupOccurrences(occurrences);
  assert.equal(groups.length, 2);
  assert.equal(
    groups.reduce((sum, group) => sum + group.count, 0),
    500,
  );
  assert.equal(OCCURRENCE_BATCH_SIZE, 25);
  const detail = source("src/screens/WordDetailScreen.tsx");
  assert.match(detail, /visibleForms\(forms, limit\)/);
  assert.match(detail, /Show .* more forms/);
  const check = source("src/screens/CheckTextScreen.tsx");
  assert.match(check, /visible\.slice\(0, occurrenceLimit\)/);
  assert.match(check, /groupOccurrences\(visible\)/);
});

test("Web hides OCR while summary-first text results keep advanced evidence collapsed", () => {
  const check = source("src/screens/CheckTextScreen.tsx");
  assert.match(check, /Platform\.OS !== "web" \? <OcrInputPanel/);
  assert.ok(check.indexOf('title="Text complexity"') > check.indexOf("<PreteachPanel"));
  assert.ok(check.indexOf("Check word knowledge") < check.indexOf("<PreteachPanel"));
  for (const title of [
    "Text highlighting",
    "Text complexity",
    "Detailed status and grouped results",
    "All occurrences",
  ])
    assert.match(check, new RegExp(`title="${title}"`));
  const disclosure = source("src/components/ProgressiveDisclosure.tsx");
  assert.match(disclosure, /defaultOpen = false/);
  const about = source("src/screens/DataVersionScreen.tsx");
  assert.match(about, /Web\/PWA uses pasted or typed/);
});

test("typography, touch targets, names, headings and expanded state meet source-level floors", () => {
  for (const path of sourceFiles("src")) {
    const value = source(path);
    assert.doesNotMatch(value, /fontSize:\s*(?:[0-9]|1[0-3])\b/, path);
  }
  for (const path of [
    "src/components/ActionButton.tsx",
    "src/components/AppMenu.tsx",
    "src/components/ChoiceChip.tsx",
    "src/components/NavigationBar.tsx",
    "src/components/ProgressiveDisclosure.tsx",
  ]) {
    const value = source(path);
    assert.match(value, /minHeight:\s*(?:44|48)/, path);
  }
  assert.match(
    source("src/components/ActionButton.tsx"),
    /accessibilityLabel=\{accessibilityLabel \?\? label\}/,
  );
  assert.match(source("src/components/AppMenu.tsx"), /accessibilityState=\{\{ expanded: open \}\}/);
  assert.match(source("src/components/AppMenu.tsx"), /event\.key === "Escape"/);
  assert.match(source("src/components/ProgressiveDisclosure.tsx"), /aria-level=\{2\}/);
  assert.doesNotMatch(source("src/components/AppCard.tsx"), /accessibilityRole="summary"/);
});

test("meaningful foreground and background color pairs meet WCAG AA text contrast", () => {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map(
      (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
    );
    const linear = channels.map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  };
  const contrast = (left: string, right: string) => {
    const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
    return (values[0]! + 0.05) / (values[1]! + 0.05);
  };
  for (const [foreground, background] of [
    [colors.ink, colors.surface],
    [colors.muted, colors.surface],
    [colors.muted, colors.canvas],
    [colors.primary, colors.surface],
    [colors.primary, colors.primarySoft],
    [colors.accent, colors.surface],
    [colors.danger, colors.dangerSoft],
    [colors.cpb, colors.cpbSoft],
    [colors.hkTop, colors.hkTopSoft],
    [colors.hkNext, colors.hkNextSoft],
    [colors.hkLater, colors.hkLaterSoft],
    [colors.custom, colors.customSoft],
  ] as const) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background}`);
  }
});

test("PWA source precaches compact data, versions builds and excludes the full database", () => {
  const sw = source("public/sw.js");
  assert.match(sw, /COMPACT_DATA_ASSETS/);
  assert.match(sw, /BUILD_ASSETS/);
  assert.match(sw, /key\.startsWith\(CACHE_PREFIX\)/);
  assert.match(sw, /url\.pathname\.includes\("\/hkele-data\/"\)/);
  const finalizer = source("scripts/finalize_web_deployment.mjs");
  assert.match(finalizer, /compactAssets\.length !== 3/);
  assert.match(finalizer, /package85-/);
  assert.match(finalizer, /viewport-fit=cover/);
  assert.match(finalizer, /safe-area-inset-bottom/);
});
