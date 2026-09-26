import type { TokenOccurrence } from "../domain/contracts";
import type {
  BrowsePage,
  BrowseRequest,
  FamilyDetail,
  FamilyRecord,
  FormRecord,
  HkeleRepository,
  DataMode,
  ResolvedOccurrence,
  SearchFamilyOwner,
  SurfaceSearchResult,
} from "../domain/hkele";
import { inflateRecord, loadGzipJson } from "./gzipJson";
import { registeredGrammaticalRelation } from "../services/grammaticalRelationService";

interface StaticManifest {
  api_version: string;
  chunk_size: number;
  detail_buckets: number;
  browse_fields: string[];
  family_fields: string[];
  form_fields: string[];
  browse: Record<string, Record<string, { total_items: number; available_items: number }>>;
  special_surfaces: Record<string, unknown[]>;
  identity_exceptions: Record<string, { teacher_display: string; current_classification: string }>;
}

type SearchRow = [
  number,
  Array<[unknown[], string[], string[], unknown[] | null]>,
  Array<[unknown[], string[], string[], unknown[] | null]>,
];

const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase();

function contextFor(text: string, occurrence: TokenOccurrence, radius = 36): string {
  const start = Math.max(0, occurrence.startOffset - radius);
  const end = Math.min(text.length, occurrence.endOffset + radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export class StaticShardRepository implements HkeleRepository {
  private readonly cache = new Map<string, Promise<unknown>>();
  private manifestPromise: Promise<StaticManifest> | null = null;

  constructor(
    private readonly baseUrl = "/hkele-data",
    private readonly sourceMode: Exclude<DataMode, "bundled-reference"> = "remote-full",
  ) {}

  getDataMode(): Exclude<DataMode, "bundled-reference"> {
    return this.sourceMode;
  }

  private url(path: string): string {
    return `${this.baseUrl.replace(/\/$/, "")}/${path}`;
  }

  private load<T>(path: string): Promise<T> {
    const existing = this.cache.get(path);
    if (existing) return existing as Promise<T>;
    const request = loadGzipJson<T>(this.url(path));
    this.cache.set(path, request);
    return request;
  }

  private manifest(): Promise<StaticManifest> {
    this.manifestPromise ??= this.load<StaticManifest>("manifest.json.gz");
    return this.manifestPromise;
  }

  async browse(request: BrowseRequest): Promise<BrowsePage> {
    const manifest = await this.manifest();
    const info = manifest.browse[request.scope]?.[request.sort];
    if (!info) throw new Error("Unsupported Browse selection");
    const start = (request.page - 1) * request.pageSize;
    const stop = Math.min(start + request.pageSize, info.available_items);
    const families: FamilyRecord[] = [];
    if (start < stop) {
      const firstChunk = Math.floor(start / manifest.chunk_size);
      const lastChunk = Math.floor((stop - 1) / manifest.chunk_size);
      for (let index = firstChunk; index <= lastChunk; index += 1) {
        const rows = await this.load<unknown[][]>(
          `browse/${request.scope}/${request.sort}/${String(index).padStart(4, "0")}.json.gz`,
        );
        const from = index === firstChunk ? start % manifest.chunk_size : 0;
        const to = index === lastChunk ? ((stop - 1) % manifest.chunk_size) + 1 : rows.length;
        families.push(
          ...rows
            .slice(from, to)
            .map((row) => inflateRecord<FamilyRecord>(manifest.browse_fields, row)),
        );
      }
    }
    return {
      scope: request.scope,
      sort: request.sort,
      page: request.page,
      pageSize: request.pageSize,
      totalItems: info.total_items,
      availableItems: info.available_items,
      families,
      sourceMode: this.sourceMode,
    };
  }

  async aiFilterFamilies(): Promise<FamilyRecord[]> {
    const first = await this.browse({ scope: "broader", sort: "overall", page: 1, pageSize: 100 });
    const pageCount = Math.ceil(first.availableItems / first.pageSize);
    const remaining = await Promise.all(
      Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
        this.browse({ scope: "broader", sort: "overall", page: index + 2, pageSize: 100 }),
      ),
    );
    return [first, ...remaining].flatMap((page) => page.families);
  }

  private fnvBucket(value: string, count: number): number {
    let hash = 2166136261;
    for (const byte of new TextEncoder().encode(value)) {
      hash ^= byte;
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash % count;
  }

  async getFamily(basewordKey: string): Promise<FamilyDetail> {
    const manifest = await this.manifest();
    const normalized = normalize(basewordKey);
    const bucket = String(this.fnvBucket(normalized, manifest.detail_buckets)).padStart(3, "0");
    const values = await this.load<Record<string, [unknown[], unknown[][]]>>(
      `detail/${bucket}.json.gz`,
    );
    const record = values[normalized];
    if (!record) throw new Error("No current family record");
    return {
      family: inflateRecord<FamilyRecord>(manifest.family_fields, record[0]),
      forms: record[1].map((row) => inflateRecord<FormRecord>(manifest.form_fields, row)),
    };
  }

  private searchBucket(value: string): string {
    const first = value.slice(0, 1);
    return /^[a-z0-9]$/.test(first) ? first : "_other";
  }

  private expandOwners(
    manifest: StaticManifest,
    rows: Array<[unknown[], string[], string[], unknown[] | null]> = [],
  ): SearchFamilyOwner[] {
    return rows.map((row) => {
      const family = inflateRecord<FamilyRecord>(manifest.family_fields, row[0]);
      return {
        ...family,
        blocked: family.display_blocked === true || family.display_blocked === 1,
        match_classes: row[1] ?? [],
        matched_forms: row[2] ?? [],
        matched_form_evidence: row[3]
          ? inflateRecord<FormRecord>(manifest.form_fields, row[3])
          : null,
      };
    });
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
      dataMode: this.sourceMode,
    };
  }

  async searchSurface(submittedQuery: string): Promise<SurfaceSearchResult> {
    const manifest = await this.manifest();
    const normalizedQuery = normalize(submittedQuery);
    const empty = {
      submittedQuery,
      normalizedQuery,
      bestPriority: null,
      bestOwnerCount: 0,
      owners: [] as SearchFamilyOwner[],
      alternatives: [] as SearchFamilyOwner[],
      identityException: null,
      dataMode: this.sourceMode,
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
    const special = manifest.special_surfaces[normalizedQuery];
    if (special) {
      const owner = inflateRecord<FamilyRecord>(
        manifest.family_fields,
        special,
      ) as SearchFamilyOwner;
      owner.blocked = false;
      owner.match_classes = ["FINAL_CANDIDATE_SURFACE_ONLY"];
      owner.matched_forms = [submittedQuery];
      return { status: "RESOLVED", ...empty, bestPriority: 0, bestOwnerCount: 1, owners: [owner] };
    }
    const bucket = await this.load<Record<string, SearchRow>>(
      `search/${this.searchBucket(normalizedQuery)}.json.gz`,
    );
    const record = bucket[normalizedQuery];
    if (!record) {
      const exception = manifest.identity_exceptions[normalizedQuery];
      return {
        status: "UNMATCHED",
        ...empty,
        identityException: exception
          ? {
              teacherDisplay: exception.teacher_display,
              currentClassification: exception.current_classification,
            }
          : null,
      };
    }
    const owners = this.expandOwners(manifest, record[1]);
    const alternatives = this.expandOwners(manifest, record[2]);
    const allowed = owners.filter((owner) => !owner.blocked);
    return {
      status: allowed.length === 0 ? "BLOCKED" : allowed.length > 1 ? "AMBIGUOUS" : "RESOLVED",
      submittedQuery,
      normalizedQuery,
      bestPriority: record[0],
      bestOwnerCount: allowed.length,
      owners,
      alternatives,
      identityException: null,
      dataMode: this.sourceMode,
    };
  }

  async resolveOccurrences(
    text: string,
    occurrences: TokenOccurrence[],
  ): Promise<ResolvedOccurrence[]> {
    const unique = new Map<string, Promise<SurfaceSearchResult>>();
    for (const occurrence of occurrences) {
      if (occurrence.tokenStatus === "SUPPORTED_TOKEN") {
        unique.set(occurrence.surface, this.searchSurface(occurrence.surface));
      }
    }
    await Promise.all(unique.values());
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
            dataMode: this.sourceMode,
          };
        }
        const result = await unique.get(occurrence.surface);
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
