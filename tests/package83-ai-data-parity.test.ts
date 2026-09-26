import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { HybridRepository } from "../src/data/HybridRepository.js";
import type { FamilyRecord, FormRecord, HkeleRepository } from "../src/domain/hkele.js";
import { executeAiFilter } from "../src/services/aiFilterExecutor.js";
import { deriveAiFilterFamilies } from "../src/services/aiFilterFamilyProjection.js";

interface CompactTable {
  fields: string[];
  rows: unknown[][];
}

const release = join(process.cwd(), "data", "releases", "2026-09-14-package67-v1");
const publicData = join(process.cwd(), "public", "hkele-data");

async function readGzipJson<T>(path: string): Promise<T> {
  return JSON.parse(gunzipSync(await readFile(path)).toString("utf8")) as T;
}

function inflate<T>(fields: string[], row: unknown[]): T {
  return Object.fromEntries(fields.map((field, index) => [field, row[index]])) as T;
}

async function loadAuthoritativeProjection(): Promise<FamilyRecord[]> {
  const familyTable = await readGzipJson<CompactTable>(
    join(release, "reference", "families.json.gz"),
  );
  const formTable = await readGzipJson<CompactTable>(join(release, "reference", "forms.json.gz"));
  const families = familyTable.rows.map((row) => inflate<FamilyRecord>(familyTable.fields, row));
  const forms = formTable.rows.map((row) => {
    const source = inflate<Record<string, unknown>>(formTable.fields, row);
    return {
      ...source,
      form_key: (source.form_key as string | null) ?? null,
      baseword_key: String(source.baseword_key),
      form: String(source.form),
      normalized_form: String(source.normalized_form),
      first_seen_hk_textbooks: (source.first_seen_hk_textbooks as string | null) ?? null,
      external_level_reference:
        (source.external_level_reference_teacher_display as string | null) ??
        (source.external_level_reference as string | null) ??
        null,
      academic_subject_evidence: (source.academic_subject_evidence as string | null) ?? null,
      awl: (source.awl as number | boolean | null) ?? null,
      msvl: (source.msvl as string | number | null) ?? null,
      root:
        (source.root_teacher_display_unified as string | null) ??
        (source.root as string | null) ??
        null,
      root_meaning:
        (source.root_meaning_teacher_display as string | null) ??
        (source.root_meaning as string | null) ??
        null,
      prefix: (source.prefix as string | null) ?? null,
      suffix: (source.suffix as string | null) ?? null,
    } satisfies FormRecord;
  });
  return deriveAiFilterFamilies(families, forms);
}

async function loadOnlineBrowseProjection(): Promise<FamilyRecord[]> {
  const manifest = await readGzipJson<{
    browse_fields: string[];
    browse: { broader: { overall: { chunk_count: number } } };
  }>(join(publicData, "manifest.json.gz"));
  const rows: FamilyRecord[] = [];
  for (let index = 0; index < manifest.browse.broader.overall.chunk_count; index += 1) {
    const chunk = await readGzipJson<unknown[][]>(
      join(publicData, "browse", "broader", "overall", `${String(index).padStart(4, "0")}.json.gz`),
    );
    rows.push(...chunk.map((row) => inflate<FamilyRecord>(manifest.browse_fields, row)));
  }
  return rows;
}

function stubRepository(families: FamilyRecord[], mode: "remote-full" | "bundled-reference") {
  return {
    getDataMode: () => mode,
    aiFilterFamilies: async () => families,
    browse: async () => {
      throw new Error("unused");
    },
    getFamily: async () => {
      throw new Error("unused");
    },
    searchSurface: async () => {
      throw new Error("unused");
    },
    resolveOccurrences: async () => {
      throw new Error("unused");
    },
  } satisfies HkeleRepository;
}

test("online and offline AI use the same authoritative form-enriched 3,430-family projection", async () => {
  const [authoritative, onlineBrowse] = await Promise.all([
    loadAuthoritativeProjection(),
    loadOnlineBrowseProjection(),
  ]);
  assert.equal(authoritative.filter((family) => Boolean(family.candidate_member)).length, 3185);
  assert.equal(authoritative.filter((family) => Boolean(family.reference_member)).length, 3430);

  const rootFilter = {
    scope: "inclusive_reference",
    root: "act",
    limit: 25,
    sort: "overall",
  } as const;
  const offline = executeAiFilter(
    { families: authoritative, cpbFamilyKeys: new Set() },
    rootFilter,
  );
  const oldOnline = executeAiFilter(
    { families: onlineBrowse, cpbFamilyKeys: new Set() },
    rootFilter,
  );
  assert.equal(oldOnline.matchedBeforeLimit, 6);
  assert.equal(offline.matchedBeforeLimit, 7);
  assert.ok(offline.families.some((family) => family.baseword_key === "age"));

  const onlineRepository = new HybridRepository(
    stubRepository(onlineBrowse, "remote-full"),
    stubRepository(authoritative, "bundled-reference"),
  );
  const online = executeAiFilter(
    { families: await onlineRepository.aiFilterFamilies(), cpbFamilyKeys: new Set() },
    rootFilter,
  );
  assert.equal(online.matchedBeforeLimit, 7);
  assert.deepEqual(
    online.families.map((family) => family.baseword_key),
    offline.families.map((family) => family.baseword_key),
  );
});

test("shared executor still applies prefix, suffix, grade, ranks, HK band, AWL, MSVL and CPB 100", () => {
  const matching = {
    baseword_key: "matching",
    display_family: "matching",
    overall_frequency_order: 150,
    overall_frequency_value: null,
    set_membership: "Candidate",
    current_hk_frequency_rank: 800,
    current_hk_frequency_band: "HK Top 1k",
    textbook_first_seen_level: "P4",
    external_level_reference_display: null,
    candidate_member: 1,
    reference_member: 1,
    display_blocked: 0,
    awl: 1,
    msvl: "Science",
    earlier_hk: 0,
    general_evidence_status: "AVAILABLE_UNCHANGED",
    browse_prefix: "re",
    browse_suffix: "tion",
  } satisfies FamilyRecord;
  const result = executeAiFilter(
    { families: [matching], cpbFamilyKeys: new Set([matching.baseword_key]) },
    {
      scope: "candidate",
      prefix: "re",
      suffix: "tion",
      earliestObservedFrom: "P4",
      earliestObservedTo: "P4",
      overallRankMin: 100,
      overallRankMax: 500,
      hkRankMin: 1,
      hkRankMax: 1000,
      hkBands: ["HK Top 1k"],
      awl: true,
      msvl: true,
      msvlSubjects: ["Science"],
      cpb100: true,
      limit: 25,
      sort: "overall",
    },
  );
  assert.deepEqual(
    result.families.map((family) => family.baseword_key),
    ["matching"],
  );
});
