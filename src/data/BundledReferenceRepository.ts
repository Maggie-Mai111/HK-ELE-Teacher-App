import { Asset } from "expo-asset";
import { gunzipSync, strFromU8 } from "fflate";

import type { TokenOccurrence } from "../domain/contracts";
import { hasFlag } from "../domain/hkele";
import type {
  BrowsePage,
  BrowseRequest,
  FamilyDetail,
  FamilyRecord,
  FormRecord,
  HkeleRepository,
  ResolvedOccurrence,
  SearchFamilyOwner,
  SurfaceSearchResult,
} from "../domain/hkele";
import { BUNDLED_DATA_ASSETS } from "./bundledAssets";
import { inflateRecord } from "./gzipJson";
import { registeredGrammaticalRelation } from "../services/grammaticalRelationService";

interface CompactTable {
  fields: string[];
  rows: unknown[][];
}

const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();

async function loadAssetTable(moduleReference: unknown): Promise<CompactTable> {
  const asset = Asset.fromModule(moduleReference as number);
  await asset.downloadAsync();
  const response = await fetch(asset.localUri ?? asset.uri);
  if (!response.ok) throw new Error(`Bundled data unavailable (${response.status})`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return JSON.parse(strFromU8(gunzipSync(bytes))) as CompactTable;
}

function normalizeFamily(value: Record<string, unknown>): FamilyRecord {
  return {
    ...value,
    baseword_key: String(value.baseword_key),
    display_family: String(value.display_family),
    overall_frequency_order: (value.overall_frequency_order as number | null) ?? null,
    overall_frequency_value: (value.overall_frequency_value as number | null) ?? null,
    set_membership: (value.set_membership as string | null) ?? null,
    current_hk_frequency_rank: (value.current_hk_frequency_rank as number | null) ?? null,
    current_hk_frequency_band: (value.current_hk_frequency_band as string | null) ?? null,
    textbook_first_seen_level: (value.textbook_first_seen_level as string | null) ?? null,
    external_level_reference_display:
      (value.external_level_reference_teacher_display as string | null) ??
      (value.external_level_reference_display as string | null) ??
      null,
    candidate_member: (value.candidate_member as number | boolean) ?? false,
    reference_member: (value.reference_member as number | boolean) ?? false,
    display_blocked: (value.display_blocked as number | boolean) ?? false,
    awl: (value.awl as number | boolean | null) ?? null,
    msvl: (value.msvl as string | number | null) ?? null,
    earlier_hk: (value.earlier_hk as number | boolean | null) ?? null,
    general_evidence_status: (value.general_evidence_status as string | null) ?? null,
  };
}

function normalizeForm(value: Record<string, unknown>): FormRecord {
  return {
    ...value,
    form_key: (value.form_key as string | null) ?? null,
    baseword_key: String(value.baseword_key),
    form: String(value.form),
    normalized_form: String(value.normalized_form),
    first_seen_hk_textbooks: (value.first_seen_hk_textbooks as string | null) ?? null,
    external_level_reference:
      (value.external_level_reference_teacher_display as string | null) ??
      (value.external_level_reference as string | null) ??
      null,
    academic_subject_evidence: (value.academic_subject_evidence as string | null) ?? null,
    awl: (value.awl as number | boolean | null) ?? null,
    msvl: (value.msvl as string | number | null) ?? null,
    root:
      (value.root_teacher_display_unified as string | null) ??
      (value.root as string | null) ??
      null,
    root_meaning:
      (value.root_meaning_teacher_display as string | null) ??
      (value.root_meaning as string | null) ??
      null,
    prefix: (value.prefix as string | null) ?? null,
    suffix: (value.suffix as string | null) ?? null,
  };
}

function contextFor(text: string, occurrence: TokenOccurrence, radius = 36): string {
  const start = Math.max(0, occurrence.startOffset - radius);
  const end = Math.min(text.length, occurrence.endOffset + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export class BundledReferenceRepository implements HkeleRepository {
  private familiesPromise: Promise<FamilyRecord[]> | null = null;
  private formsPromise: Promise<FormRecord[]> | null = null;
  private routesPromise: Promise<CompactTable> | null = null;

  getDataMode(): "bundled-reference" {
    return "bundled-reference";
  }

  private async families(): Promise<FamilyRecord[]> {
    this.familiesPromise ??= loadAssetTable(BUNDLED_DATA_ASSETS.families).then((table) =>
      table.rows.map((row) =>
        normalizeFamily(inflateRecord<Record<string, unknown>>(table.fields, row)),
      ),
    );
    return this.familiesPromise;
  }

  private async forms(): Promise<FormRecord[]> {
    this.formsPromise ??= loadAssetTable(BUNDLED_DATA_ASSETS.forms).then((table) =>
      table.rows.map((row) =>
        normalizeForm(inflateRecord<Record<string, unknown>>(table.fields, row)),
      ),
    );
    return this.formsPromise;
  }

  private routes(): Promise<CompactTable> {
    this.routesPromise ??= loadAssetTable(BUNDLED_DATA_ASSETS.searchRoutes);
    return this.routesPromise;
  }

  async browse(request: BrowseRequest): Promise<BrowsePage> {
    if (request.scope === "full") {
      throw new Error("Full database requires the registered static-shard connection.");
    }
    const source = (await this.families()).filter((family) =>
      request.scope === "core"
        ? hasFlag(family.candidate_member)
        : hasFlag(family.reference_member),
    );
    source.sort((left, right) => {
      if (request.sort === "az") return left.display_family.localeCompare(right.display_family);
      const field = request.sort === "hk" ? "current_hk_frequency_rank" : "overall_frequency_order";
      return (
        ((left[field] as number | null) ?? Number.MAX_SAFE_INTEGER) -
          ((right[field] as number | null) ?? Number.MAX_SAFE_INTEGER) ||
        left.baseword_key.localeCompare(right.baseword_key)
      );
    });
    const start = (request.page - 1) * request.pageSize;
    return {
      ...request,
      totalItems: source.length,
      availableItems: source.length,
      families: source.slice(start, start + request.pageSize),
      sourceMode: "bundled-reference",
    };
  }

  async aiFilterFamilies(): Promise<FamilyRecord[]> {
    const [families, forms] = await Promise.all([this.families(), this.forms()]);
    const byFamily = new Map<string, FormRecord[]>();
    for (const form of forms)
      byFamily.set(form.baseword_key, [...(byFamily.get(form.baseword_key) ?? []), form]);
    const collect = (items: FormRecord[], field: keyof FormRecord): string | null => {
      const values = [
        ...new Set(
          items
            .flatMap((item) => String(item[field] ?? "").split(/[|;,·/]+/))
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ];
      return values.length ? values.join(" | ") : null;
    };
    return families.map((family) => {
      const familyForms = byFamily.get(family.baseword_key) ?? [];
      return {
        ...family,
        browse_external_level_reference:
          family.external_level_reference_display ??
          collect(familyForms, "external_level_reference"),
        browse_root: collect(familyForms, "root"),
        browse_root_meaning: collect(familyForms, "root_meaning"),
        browse_prefix: collect(familyForms, "prefix"),
        browse_suffix: collect(familyForms, "suffix"),
      };
    });
  }

  async getFamily(basewordKey: string): Promise<FamilyDetail> {
    const normalized = normalize(basewordKey);
    const family = (await this.families()).find((item) => item.baseword_key === normalized);
    if (!family) throw new Error("This family is not in the bundled Candidate + Reference data.");
    const forms = (await this.forms()).filter((item) => item.baseword_key === normalized);
    return { family, forms };
  }

  private blocked(
    submittedQuery: string,
    normalizedQuery: string,
    teacherDisplay: string,
    currentClassification: string,
  ): SurfaceSearchResult {
    return {
      status: "BLOCKED",
      submittedQuery,
      normalizedQuery,
      bestPriority: null,
      bestOwnerCount: 0,
      owners: [],
      alternatives: [],
      identityException: { teacherDisplay, currentClassification },
      dataMode: "bundled-reference",
    };
  }

  async searchSurface(submittedQuery: string): Promise<SurfaceSearchResult> {
    const normalizedQuery = normalize(submittedQuery);
    const empty = {
      submittedQuery,
      normalizedQuery,
      bestPriority: null,
      bestOwnerCount: 0,
      owners: [] as SearchFamilyOwner[],
      alternatives: [] as SearchFamilyOwner[],
      identityException: null,
      dataMode: "bundled-reference" as const,
    };
    if (!normalizedQuery) return { status: "UNMATCHED", ...empty };
    const grammaticalRelation = registeredGrammaticalRelation(submittedQuery);
    if (grammaticalRelation) {
      return {
        status: "REGISTERED_GRAMMATICAL_RELATION",
        ...empty,
        grammaticalRelation,
      };
    }
    if (submittedQuery === "US") {
      return this.blocked(
        submittedQuery,
        normalizedQuery,
        "US requires contextual classification and is not counted as the pronoun us.",
        "COUNTRY_ABBREVIATION_OR_OTHER_CONTEXT_REQUIRED",
      );
    }
    if (normalizedQuery === "does") {
      return this.blocked(
        submittedQuery,
        normalizedQuery,
        "does requires contextual classification and is retained for review here.",
        "CONTEXT_REQUIRED_DO_VERB_OR_DOE_PLURAL",
      );
    }
    const familyByKey = new Map(
      (await this.families()).map((family) => [family.baseword_key, family]),
    );
    const specialKey =
      normalizedQuery === "i"
        ? "trial:pronoun:i"
        : normalizedQuery === "us"
          ? "trial:pronoun:us"
          : null;
    if (specialKey) {
      const family = familyByKey.get(specialKey);
      if (family) {
        return {
          status: "RESOLVED",
          ...empty,
          bestPriority: 0,
          bestOwnerCount: 1,
          owners: [
            {
              ...family,
              blocked: false,
              match_classes: ["FINAL_CANDIDATE_SURFACE_ONLY"],
              matched_forms: [submittedQuery],
            },
          ],
        };
      }
    }
    const routes = await this.routes();
    const records = routes.rows
      .map((row) => inflateRecord<Record<string, unknown>>(routes.fields, row))
      .filter((row) => row.normalized_query === normalizedQuery);
    if (records.length === 0) {
      return { status: "FULL_DATABASE_CHECK_UNAVAILABLE", ...empty };
    }
    const priorities = records.map((row) => Number(row.match_priority));
    const bestPriority = Math.min(...priorities);
    const toOwners = (selected: Record<string, unknown>[]): SearchFamilyOwner[] => {
      const grouped = new Map<string, Record<string, unknown>[]>();
      for (const row of selected) {
        const key = String(row.baseword_key);
        grouped.set(key, [...(grouped.get(key) ?? []), row]);
      }
      return [...grouped].flatMap(([key, rows]) => {
        const family = familyByKey.get(key);
        if (!family) return [];
        return [
          {
            ...family,
            blocked: hasFlag(family.display_blocked),
            match_classes: [...new Set(rows.map((row) => String(row.match_class)))],
            matched_forms: [
              ...new Set(rows.map((row) => String(row.matched_form ?? "")).filter(Boolean)),
            ],
          },
        ];
      });
    };
    const bestRecords = records.filter((row) => Number(row.match_priority) === bestPriority);
    const missingBestOwner = bestRecords.some((row) => !familyByKey.has(String(row.baseword_key)));
    if (missingBestOwner) {
      return { status: "FULL_DATABASE_CHECK_UNAVAILABLE", ...empty };
    }
    const owners = toOwners(bestRecords);
    const alternatives = toOwners(
      records.filter((row) => Number(row.match_priority) !== bestPriority),
    );
    const allowed = owners.filter((owner) => !owner.blocked);
    return {
      status: allowed.length === 0 ? "BLOCKED" : allowed.length > 1 ? "AMBIGUOUS" : "RESOLVED",
      submittedQuery,
      normalizedQuery,
      bestPriority,
      bestOwnerCount: allowed.length,
      owners,
      alternatives,
      identityException: null,
      dataMode: "bundled-reference",
    };
  }

  async resolveOccurrences(
    text: string,
    occurrences: TokenOccurrence[],
  ): Promise<ResolvedOccurrence[]> {
    const cache = new Map<string, Promise<SurfaceSearchResult>>();
    for (const occurrence of occurrences) {
      if (occurrence.tokenStatus === "SUPPORTED_TOKEN" && !cache.has(occurrence.surface)) {
        cache.set(occurrence.surface, this.searchSurface(occurrence.surface));
      }
    }
    await Promise.all(cache.values());
    return Promise.all(
      occurrences.map(async (occurrence) => {
        if (occurrence.tokenStatus === "UNSUPPORTED_TOKEN") {
          return {
            ...occurrence,
            status: "UNSUPPORTED",
            bestOwnerCount: 0,
            owners: [],
            alternatives: [],
            identityException: null,
            context: contextFor(text, occurrence),
            dataMode: "bundled-reference",
          };
        }
        const result = await cache.get(occurrence.surface);
        if (!result) throw new Error("Occurrence search result is missing");
        return {
          ...occurrence,
          status: result.status,
          bestOwnerCount: result.bestOwnerCount,
          owners: result.owners,
          alternatives: result.alternatives,
          identityException: result.identityException,
          grammaticalRelation: result.grammaticalRelation ?? null,
          context: contextFor(text, occurrence),
          dataMode: result.dataMode,
        };
      }),
    );
  }
}
