import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import type { ResolvedOccurrence } from "../src/domain/hkele";
import {
  groupUnmatchedWords,
  textFormAndFamily,
  textResultKind,
  textResultStatusLabel,
} from "../src/services/textResultPresentation.js";

function occurrence(overrides: Partial<ResolvedOccurrence>): ResolvedOccurrence {
  return {
    occurrenceId: "occ-0001",
    tokenStatus: "SUPPORTED_TOKEN",
    surface: "fixture",
    normalizedToken: "fixture",
    normalizationRuleIds: ["ASCII_CASEFOLD_LOWER"],
    startOffset: 0,
    endOffset: 7,
    occurrenceOrder: 1,
    failureReason: null,
    status: "UNMATCHED",
    bestOwnerCount: 0,
    owners: [],
    alternatives: [],
    identityException: null,
    context: "fixture",
    ...overrides,
  };
}

test("genuinely unmatched words are grouped independently without an inferred owner", () => {
  const items = groupUnmatchedWords([
    occurrence({ surface: "quarkish", normalizedToken: "quarkish" }),
    occurrence({ occurrenceId: "occ-0002", surface: "Quarkish", normalizedToken: "quarkish" }),
  ]);
  assert.deepEqual(
    items.map(({ displayForm, count }) => ({ displayForm, count })),
    [{ displayForm: "quarkish", count: 2 }],
  );
  assert.match(items[0]?.explanation ?? "", /without guessing a family, rank or teaching value/);
});

test("text form and HK-ELE family remain separately labelled", () => {
  const item = occurrence({
    surface: "understand",
    normalizedToken: "understand",
    status: "RESOLVED",
    bestOwnerCount: 1,
    owners: [
      {
        baseword_key: "stand",
        display_family: "stand",
        overall_frequency_order: 100,
        overall_frequency_value: 1,
        set_membership: "Candidate",
        current_hk_frequency_rank: 100,
        current_hk_frequency_band: "Top 1000",
        textbook_first_seen_level: null,
        external_level_reference_display: null,
        candidate_member: 1,
        reference_member: 1,
        display_blocked: 0,
        awl: 0,
        msvl: null,
        earlier_hk: 0,
        general_evidence_status: "AVAILABLE",
        blocked: false,
        match_classes: ["EXACT_CURRENT_BAWF_FORM"],
        matched_forms: ["understand"],
      },
    ],
  });
  assert.deepEqual(textFormAndFamily(item), { textForm: "understand", family: "stand" });
  assert.equal(textResultStatusLabel(item), "Ordinary family match");
});

test("compound routes have a distinct teacher status and do not become unmatched", () => {
  const item = occurrence({
    status: "RESOLVED",
    bestOwnerCount: 1,
    owners: [
      {
        baseword_key: "compound-fixture",
        display_family: "compound fixture",
        overall_frequency_order: null,
        overall_frequency_value: null,
        set_membership: null,
        current_hk_frequency_rank: null,
        current_hk_frequency_band: null,
        textbook_first_seen_level: null,
        external_level_reference_display: null,
        candidate_member: 0,
        reference_member: 0,
        display_blocked: 0,
        awl: null,
        msvl: null,
        earlier_hk: null,
        general_evidence_status: null,
        blocked: false,
        match_classes: ["REGISTERED_COMPOUND_RELATION"],
        matched_forms: ["fixture"],
      },
    ],
  });
  assert.equal(textResultKind(item), "compound-family");
  assert.equal(textResultStatusLabel(item), "Compound match");
});

test("teacher UI contains no technical-address prompt or misleading unmatched wording", async () => {
  const files = [
    "src/components/DataUpdatePanel.tsx",
    "src/screens/CheckTextScreen.tsx",
    "src/screens/DataVersionScreen.tsx",
  ];
  const source = (
    await Promise.all(files.map((path) => readFile(resolve(process.cwd(), path), "utf8")))
  ).join("\n");
  for (const forbidden of [
    "internal demonstration",
    "release candidate",
    "manifest URL",
    "localhost",
    ".sqlite",
    "No current match",
  ]) {
    assert.equal(source.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
  }
});

test("native release configuration keeps Web public data outside native exports", async () => {
  const packageJson = JSON.parse(
    await readFile(resolve(process.cwd(), "package.json"), "utf8"),
  ) as {
    scripts: Record<string, string>;
  };
  const exporter = await readFile(resolve(process.cwd(), "scripts/export_platform.mjs"), "utf8");
  const bundled = await readFile(resolve(process.cwd(), "src/data/bundledAssets.ts"), "utf8");
  assert.match(packageJson.scripts["build:android:bundle"] ?? "", /export_platform\.mjs android/);
  assert.match(packageJson.scripts["build:ios:bundle"] ?? "", /export_platform\.mjs ios/);
  assert.match(exporter, /platform === "web" \? "public" : "public-native"/);
  assert.doesNotMatch(bundled, /public[\\/]hkele-data/);
  assert.match(bundled, /reference\/families\.json\.gz/);
  assert.match(bundled, /reference\/forms\.json\.gz/);
  assert.match(bundled, /reference\/search-routes\.json\.gz/);
});

test("rotation, safe-area, keyboard and accessibility release guards are configured", async () => {
  const app = JSON.parse(await readFile(resolve(process.cwd(), "app.json"), "utf8")) as {
    expo: { orientation: string };
  };
  const shell = await readFile(resolve(process.cwd(), "App.tsx"), "utf8");
  const checkText = await readFile(
    resolve(process.cwd(), "src/screens/CheckTextScreen.tsx"),
    "utf8",
  );
  assert.equal(app.expo.orientation, "default");
  assert.match(shell, /SafeAreaView/);
  assert.match(shell, /keyboardShouldPersistTaps="handled"/);
  assert.match(checkText, /accessibilityLabel="Text to check"/);
  assert.match(checkText, /keyboardType="number-pad"/);
});
