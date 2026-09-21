import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { HybridRepository } from "../src/data/HybridRepository.js";
import type { TokenOccurrence } from "../src/domain/contracts.js";
import type {
  BrowsePage,
  BrowseRequest,
  DataMode,
  FamilyDetail,
  HkeleRepository,
  ResolvedOccurrence,
  SurfaceSearchResult,
} from "../src/domain/hkele.js";
import {
  groupPendingFullDatabaseChecks,
  groupUnmatchedWords,
  textResultStatusLabel,
} from "../src/services/textResultPresentation.js";

function searchResult(
  status: SurfaceSearchResult["status"],
  dataMode: DataMode,
  surface = "outside",
): SurfaceSearchResult {
  return {
    status,
    submittedQuery: surface,
    normalizedQuery: surface.toLowerCase(),
    bestPriority: null,
    bestOwnerCount: 0,
    owners: [],
    alternatives: [],
    identityException: null,
    dataMode,
  };
}

class FixtureRepository implements HkeleRepository {
  constructor(
    private readonly mode: DataMode,
    private readonly searchValue: SurfaceSearchResult | Error,
  ) {}

  getDataMode(): DataMode {
    return this.mode;
  }

  async browse(request: BrowseRequest): Promise<BrowsePage> {
    if (this.searchValue instanceof Error) throw this.searchValue;
    return {
      ...request,
      totalItems: this.mode === "bundled-reference" ? 3430 : 163784,
      availableItems: this.mode === "bundled-reference" ? 3430 : 163784,
      families: [],
      sourceMode: this.mode,
    };
  }

  async getFamily(): Promise<FamilyDetail> {
    throw new Error("not used");
  }

  async searchSurface(): Promise<SurfaceSearchResult> {
    if (this.searchValue instanceof Error) throw this.searchValue;
    return this.searchValue;
  }

  async resolveOccurrences(
    _text: string,
    occurrences: TokenOccurrence[],
  ): Promise<ResolvedOccurrence[]> {
    const result = await this.searchSurface();
    return occurrences.map((occurrence) => ({
      ...occurrence,
      status: result.status,
      bestOwnerCount: result.bestOwnerCount,
      owners: result.owners,
      alternatives: result.alternatives,
      identityException: result.identityException,
      context: occurrence.surface,
      dataMode: result.dataMode,
    }));
  }
}

function occurrence(status: ResolvedOccurrence["status"]): ResolvedOccurrence {
  return {
    occurrenceId: "occ-1",
    tokenStatus: "SUPPORTED_TOKEN",
    surface: "outside",
    normalizedToken: "outside",
    normalizationRuleIds: ["ASCII_CASEFOLD_LOWER"],
    startOffset: 0,
    endOffset: 7,
    occurrenceOrder: 1,
    failureReason: null,
    status,
    bestOwnerCount: 0,
    owners: [],
    alternatives: [],
    identityException: null,
    context: "outside",
    dataMode: status === "UNMATCHED" ? "remote-full" : "bundled-reference",
  };
}

test("remote-full and installed-full may return genuine unmatched only after a full query", async () => {
  for (const mode of ["remote-full", "installed-full"] as const) {
    const full = new FixtureRepository(mode, searchResult("UNMATCHED", mode));
    const bundled = new FixtureRepository(
      "bundled-reference",
      searchResult("FULL_DATABASE_CHECK_UNAVAILABLE", "bundled-reference"),
    );
    const result = await new HybridRepository(full, bundled).searchSurface("outside");
    assert.equal(result.status, "UNMATCHED");
    assert.equal(result.dataMode, mode);
  }
});

test("failed remote full check falls back without creating a false unmatched result", async () => {
  const remote = new FixtureRepository("remote-full", new Error("offline"));
  const bundled = new FixtureRepository(
    "bundled-reference",
    searchResult("FULL_DATABASE_CHECK_UNAVAILABLE", "bundled-reference"),
  );
  const repository = new HybridRepository(remote, bundled);
  const result = await repository.searchSurface("outside");
  assert.equal(result.status, "FULL_DATABASE_CHECK_UNAVAILABLE");
  assert.equal(repository.getDataMode(), "bundled-reference");
});

test("a bundled match remains usable after the remote connection fails", async () => {
  const remote = new FixtureRepository("remote-full", new Error("offline"));
  const known = searchResult("RESOLVED", "bundled-reference", "teacher");
  known.bestPriority = 1;
  known.bestOwnerCount = 1;
  known.owners = [
    {
      baseword_key: "teach",
      display_family: "teach",
      overall_frequency_order: 100,
      overall_frequency_value: 1,
      set_membership: "Candidate",
      current_hk_frequency_rank: 100,
      current_hk_frequency_band: "Top 1000",
      textbook_first_seen_level: "P1",
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
      matched_forms: ["teacher"],
    },
  ];
  const repository = new HybridRepository(
    remote,
    new FixtureRepository("bundled-reference", known),
  );
  const result = await repository.searchSurface("teacher");
  assert.equal(result.status, "RESOLVED");
  assert.equal(result.owners[0]?.baseword_key, "teach");
  assert.equal(result.dataMode, "bundled-reference");
});

test("pending full checks stay out of the unmatched review list", () => {
  const pending = occurrence("FULL_DATABASE_CHECK_UNAVAILABLE");
  const unmatched = occurrence("UNMATCHED");
  assert.equal(groupPendingFullDatabaseChecks([pending, unmatched]).length, 1);
  assert.equal(groupUnmatchedWords([pending]).length, 0);
  assert.equal(groupUnmatchedWords([unmatched]).length, 1);
  assert.equal(textResultStatusLabel(pending), "Full database check unavailable");
});

test("bundled search tolerates lower-priority owners outside the 3,430-family payload", async () => {
  const source = await readFile(
    resolve(process.cwd(), "src/data/BundledReferenceRepository.ts"),
    "utf8",
  );
  assert.match(source, /flatMap\(\(\[key, rows\]\)/);
  assert.match(source, /missingBestOwner/);
  assert.match(source, /FULL_DATABASE_CHECK_UNAVAILABLE/);
  assert.doesNotMatch(source, /Bundled route owner is missing/);
});

test("GitHub Pages, PWA and EAS profiles preserve the requested deployment boundaries", async () => {
  const [app, eas, webRepository, manifest, serviceWorker, easIgnore, workflow] = await Promise.all(
    [
      readFile(resolve(process.cwd(), "app.json"), "utf8"),
      readFile(resolve(process.cwd(), "eas.json"), "utf8"),
      readFile(resolve(process.cwd(), "src/data/repository.web.ts"), "utf8"),
      readFile(resolve(process.cwd(), "public/manifest.webmanifest"), "utf8"),
      readFile(resolve(process.cwd(), "public/sw.js"), "utf8"),
      readFile(resolve(process.cwd(), ".easignore"), "utf8"),
      readFile(resolve(process.cwd(), ".github/workflows/deploy-pages.yml"), "utf8"),
    ],
  );
  assert.equal(JSON.parse(app).expo.experiments.baseUrl, "/HK-ELE-Teacher-App");
  for (const profile of ["preview", "android-apk", "production"]) {
    assert.ok(JSON.parse(eas).build[profile]);
  }
  assert.match(eas, /EXPECTED_NOT_YET_LIVE/);
  assert.match(webRepository, /\/HK-ELE-Teacher-App\/hkele-data/);
  assert.equal(JSON.parse(manifest).id, "/HK-ELE-Teacher-App/");
  assert.equal(JSON.parse(manifest).start_url, "/HK-ELE-Teacher-App/");
  assert.equal(JSON.parse(manifest).scope, "/HK-ELE-Teacher-App/");
  assert.match(serviceWorker, /url\.pathname\.includes\("\/hkele-data\/"\)/);
  assert.match(easIgnore, /^public\/$/m);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /path: dist/);
});
