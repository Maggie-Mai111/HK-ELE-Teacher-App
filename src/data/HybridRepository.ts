import type { TokenOccurrence } from "../domain/contracts";
import type {
  BrowsePage,
  BrowseRequest,
  FamilyDetail,
  HkeleRepository,
  ResolvedOccurrence,
  SurfaceSearchResult,
  DataMode,
  FamilyRecord,
  BrowseScope,
} from "../domain/hkele";
import { CPB_ITEMS } from "../services/cpbService";

export class HybridRepository implements HkeleRepository {
  private mode: DataMode;

  constructor(
    private readonly staticSource: HkeleRepository,
    private readonly bundledSource: HkeleRepository,
  ) {
    this.mode = staticSource.getDataMode();
  }

  getDataMode(): DataMode {
    return this.mode;
  }

  private async withFallback<T>(primary: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try {
      const value = await primary();
      this.mode = this.staticSource.getDataMode();
      return value;
    } catch {
      const value = await fallback();
      this.mode = "bundled-reference";
      return value;
    }
  }

  browse(request: BrowseRequest): Promise<BrowsePage> {
    if (request.scope === "full") {
      return this.staticSource
        .browse(request)
        .then((value) => {
          this.mode = this.staticSource.getDataMode();
          return value;
        })
        .catch(() => {
          this.mode = "bundled-reference";
          throw new Error(
            "The full database is currently unavailable. The saved Core list remains available.",
          );
        });
    }
    return this.withFallback(
      () => this.staticSource.browse(request),
      () => this.bundledSource.browse(request),
    );
  }

  async aiFilterFamilies(scope: BrowseScope = "broader"): Promise<FamilyRecord[]> {
    const primary = this.staticSource.aiFilterFamilies;
    const fallback = this.bundledSource.aiFilterFamilies;
    if (scope === "full") {
      if (!primary) throw new Error("Full-database AI filter data is unavailable.");
      // Full searches must never silently shrink to the compact cache.
      return primary.call(this.staticSource, "full");
    }
    if (!fallback) return Promise.reject(new Error("AI filter data is unavailable."));
    try {
      // Core searches can use the authoritative form-enriched local cache.
      return await fallback.call(this.bundledSource);
    } catch {
      if (!primary) throw new Error("AI filter data is unavailable.");
      return primary.call(this.staticSource);
    }
  }

  async aiFilterCpbFamilyKeys(scope: BrowseScope = "broader"): Promise<ReadonlySet<string>> {
    if (scope === "full" && this.staticSource.aiFilterCpbFamilyKeys) {
      return this.staticSource.aiFilterCpbFamilyKeys("full");
    }
    const results = await Promise.all(
      CPB_ITEMS.map((item) => this.bundledSource.searchSurface(item.word)),
    );
    return new Set(
      results.flatMap((result) =>
        result.status === "RESOLVED" || result.status === "AMBIGUOUS"
          ? result.owners.filter((owner) => !owner.blocked).map((owner) => owner.baseword_key)
          : [],
      ),
    );
  }

  getFamily(basewordKey: string): Promise<FamilyDetail> {
    return this.withFallback(
      () => this.staticSource.getFamily(basewordKey),
      () => this.bundledSource.getFamily(basewordKey),
    );
  }

  searchSurface(surface: string): Promise<SurfaceSearchResult> {
    return this.withFallback(
      () => this.staticSource.searchSurface(surface),
      () => this.bundledSource.searchSurface(surface),
    );
  }

  async resolveOccurrences(
    text: string,
    occurrences: TokenOccurrence[],
  ): Promise<ResolvedOccurrence[]> {
    // A failed letter shard must not discard successful full-database matches
    // from other shards. Fall back only for the affected surfaces.
    const searches = new Map<string, Promise<SurfaceSearchResult>>();
    for (const occurrence of occurrences) {
      if (occurrence.tokenStatus === "SUPPORTED_TOKEN" && !searches.has(occurrence.surface)) {
        searches.set(occurrence.surface, this.searchSurface(occurrence.surface));
      }
    }
    const results = await Promise.all(
      occurrences.map(async (occurrence): Promise<ResolvedOccurrence> => {
        const start = Math.max(0, occurrence.startOffset - 36);
        const end = Math.min(text.length, occurrence.endOffset + 36);
        const context = `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
        const result = await searches.get(occurrence.surface);
        return {
          ...occurrence,
          status: result?.status ?? "UNSUPPORTED",
          bestOwnerCount: result?.bestOwnerCount ?? 0,
          owners: result?.owners ?? [],
          alternatives: result?.alternatives ?? [],
          identityException: result?.identityException ?? null,
          grammaticalRelation: result?.grammaticalRelation ?? null,
          context,
          dataMode: result?.dataMode ?? this.staticSource.getDataMode(),
        };
      }),
    );
    this.mode = results.some((result) => result.dataMode === "bundled-reference")
      ? "bundled-reference"
      : this.staticSource.getDataMode();
    return results;
  }
}
