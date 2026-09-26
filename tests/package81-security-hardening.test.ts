import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import {
  AI_FILTER_MAX_CONTROLLED_TEXT_LENGTH,
  AI_FILTER_MAX_EXTERNAL_LEVEL_LENGTH,
  AI_FILTER_MAX_SUMMARY_LENGTH,
  AI_FILTER_MAX_WARNING_LENGTH,
  validateAiFilterResult,
} from "../src/domain/aiFilterSchema.js";
import {
  VERIFIED_AI_QUICK_EXAMPLES,
  VERIFIED_ZERO_RESULT_TEST_QUERY,
} from "../src/domain/verifiedAiExamples.js";
import type { FamilyRecord } from "../src/domain/hkele.js";
import { executeAiFilter } from "../src/services/aiFilterExecutor.js";

interface CompactTable {
  fields: string[];
  rows: unknown[][];
}

function record(table: CompactTable, row: unknown[]): Record<string, unknown> {
  return Object.fromEntries(table.fields.map((field, index) => [field, row[index]]));
}

async function table(name: string): Promise<CompactTable> {
  const path = resolve(process.cwd(), "data/releases/2026-09-14-package67-v1/reference", name);
  return JSON.parse(gunzipSync(await readFile(path)).toString("utf8")) as CompactTable;
}

test("all three public quick examples are deterministic non-zero principal-data queries", async () => {
  const [familiesTable, formsTable] = await Promise.all([
    table("families.json.gz"),
    table("forms.json.gz"),
  ]);
  const formsByFamily = new Map<string, Record<string, unknown>[]>();
  for (const row of formsTable.rows) {
    const form = record(formsTable, row);
    const key = String(form.baseword_key);
    formsByFamily.set(key, [...(formsByFamily.get(key) ?? []), form]);
  }
  const collect = (items: Record<string, unknown>[], fields: string[]): string | null => {
    const values = [
      ...new Set(
        items
          .flatMap((item) =>
            String(fields.map((field) => item[field]).find(Boolean) ?? "").split(/[|;,·/]+/),
          )
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    return values.length ? values.join(" | ") : null;
  };
  const families = familiesTable.rows.map((row) => {
    const source = record(familiesTable, row);
    const forms = formsByFamily.get(String(source.baseword_key)) ?? [];
    return {
      ...source,
      external_level_reference_display:
        source.external_level_reference_teacher_display ??
        source.external_level_reference_display ??
        null,
      browse_root: collect(forms, ["root_teacher_display_unified", "root"]),
      browse_prefix: collect(forms, ["prefix"]),
      browse_suffix: collect(forms, ["suffix"]),
    } as unknown as FamilyRecord;
  });
  const context = { families, cpbFamilyKeys: new Set<string>() };
  const grade = executeAiFilter(context, {
    scope: "candidate",
    earliestObservedTo: "P2",
    limit: 10,
    sort: "overall",
  });
  const hkBand = executeAiFilter(context, {
    scope: "inclusive_reference",
    hkBands: ["HK Top 1k"],
    limit: 10,
    sort: "hk",
  });
  const root = executeAiFilter(context, {
    scope: "inclusive_reference",
    root: "act",
    limit: 100,
    sort: "overall",
  });
  assert.deepEqual(
    [grade.matchedBeforeLimit, hkBand.matchedBeforeLimit, root.matchedBeforeLimit],
    VERIFIED_AI_QUICK_EXAMPLES.map((item) => item.verifiedMatchCount),
  );
  assert.ok(VERIFIED_AI_QUICK_EXAMPLES.every((item) => item.verifiedMatchCount > 0));
  const zero = executeAiFilter(context, {
    scope: "candidate",
    root: "not-registered",
    limit: 10,
    sort: "overall",
  });
  assert.equal(zero.matchedBeforeLimit, 0);
  assert.match(VERIFIED_ZERO_RESULT_TEST_QUERY, /not-registered/);
});

test("worst legal ready JSON fixture fits the 384-token output budget without relaxing validation", () => {
  const fixture = validateAiFilterResult({
    status: "ready",
    summary: "s".repeat(AI_FILTER_MAX_SUMMARY_LENGTH),
    filters: {
      scope: "inclusive_reference",
      earliestObservedFrom: "P1",
      earliestObservedTo: "S3",
      overallRankMin: 1,
      overallRankMax: 163570,
      hkRankMin: 1,
      hkRankMax: 163570,
      hkBands: ["HK Top 1k", "HK Top 2k", "HK Top 3k", "HK Top 5k", "HK Top 10k"],
      prefix: "p".repeat(AI_FILTER_MAX_CONTROLLED_TEXT_LENGTH),
      suffix: "s".repeat(AI_FILTER_MAX_CONTROLLED_TEXT_LENGTH),
      root: "r".repeat(AI_FILTER_MAX_CONTROLLED_TEXT_LENGTH),
      awl: true,
      msvl: true,
      msvlSubjects: [
        "English Grammar and Writing",
        "Health",
        "Mathematics",
        "Science",
        "Social Studies and History",
      ],
      externalLevels: [
        "a".repeat(AI_FILTER_MAX_EXTERNAL_LEVEL_LENGTH),
        "b".repeat(AI_FILTER_MAX_EXTERNAL_LEVEL_LENGTH),
        "c".repeat(AI_FILTER_MAX_EXTERNAL_LEVEL_LENGTH),
      ],
      cpb100: true,
      limit: 100,
      sort: "overall",
    },
    clarifyingQuestion: null,
    warnings: ["w".repeat(AI_FILTER_MAX_WARNING_LENGTH), "x".repeat(AI_FILTER_MAX_WARNING_LENGTH)],
  });
  const serialized = JSON.stringify(fixture);
  assert.ok(serialized.length <= 1100, `worst fixture is ${serialized.length} characters`);
  assert.match(
    readFileSync(resolve(process.cwd(), "worker/src/index.ts"), "utf8"),
    /max_tokens:\s*384/,
  );
});

test("Wrangler 4.141.0 centralizes separate session/global limits and adds no paid state service", async () => {
  const packageJson = JSON.parse(
    await readFile(resolve(process.cwd(), "package.json"), "utf8"),
  ) as {
    devDependencies: Record<string, string>;
  };
  assert.equal(packageJson.devDependencies.wrangler, "4.141.0");
  const wranglerJsonc = await readFile(resolve(process.cwd(), "worker/wrangler.jsonc"), "utf8");
  const config = JSON.parse(wranglerJsonc.replace(/,\s*([}\]])/gu, "$1")) as {
    vars: Record<string, string>;
    ratelimits: Array<{ name: string; simple: { limit: number; period: number } }>;
    env: Record<
      string,
      {
        vars: Record<string, string>;
        ratelimits: Array<{ name: string; simple: { limit: number; period: number } }>;
      }
    >;
  };
  const staging = config.env.staging;
  const production = config.env.production;
  assert.ok(staging, "staging environment is required");
  assert.ok(production, "production environment is required");
  for (const target of [config, staging, production]) {
    const session = target.ratelimits.find((item) => item.name === "AI_SESSION_RATE_LIMITER");
    const global = target.ratelimits.find((item) => item.name === "AI_GLOBAL_RATE_LIMITER");
    assert.equal(session?.simple.limit, Number(target.vars.SESSION_RATE_LIMIT_MAX));
    assert.equal(global?.simple.limit, Number(target.vars.GLOBAL_RATE_LIMIT_MAX));
    assert.equal(session?.simple.period, Number(target.vars.RATE_LIMIT_PERIOD_SECONDS));
    assert.equal(global?.simple.period, Number(target.vars.RATE_LIMIT_PERIOD_SECONDS));
  }
  const source = JSON.stringify(config).toLocaleLowerCase();
  for (const forbidden of [
    "kv_namespaces",
    "d1_databases",
    "durable_objects",
    "queues",
    "r2_buckets",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.notEqual(production.vars.ALLOWED_ORIGIN, "*");
});

test("native AI stays disabled while stable native modules remain present", async () => {
  const assistant = await readFile(
    resolve(process.cwd(), "src/components/AiFilterAssistant.tsx"),
    "utf8",
  );
  const nativeGate = await readFile(
    resolve(process.cwd(), "src/components/TurnstileGate.native.tsx"),
    "utf8",
  );
  assert.match(assistant, /Platform\.OS !== "web"/);
  assert.match(nativeGate, /Native AI is not enabled/);
  for (const path of [
    "src/services/ocr/ocrAdapter.native.ts",
    "src/services/dataUpdate/dataUpdateManager.native.ts",
    "src/services/teachingListService.ts",
  ]) {
    assert.ok((await readFile(resolve(process.cwd(), path))).byteLength > 0, path);
  }
});
