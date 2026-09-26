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
} from "../domain/hkele";

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
            "The full database is currently unavailable. Candidate + Reference browsing remains available.",
          );
        });
    }
    return this.withFallback(
      () => this.staticSource.browse(request),
      () => this.bundledSource.browse(request),
    );
  }

  aiFilterFamilies(): Promise<FamilyRecord[]> {
    const primary = this.staticSource.aiFilterFamilies;
    const fallback = this.bundledSource.aiFilterFamilies;
    if (!fallback) return Promise.reject(new Error("AI filter data is unavailable."));
    return this.withFallback(
      () =>
        primary
          ? primary.call(this.staticSource)
          : Promise.reject(new Error("No static AI filter index")),
      () => fallback.call(this.bundledSource),
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

  resolveOccurrences(text: string, occurrences: TokenOccurrence[]): Promise<ResolvedOccurrence[]> {
    return this.withFallback(
      () => this.staticSource.resolveOccurrences(text, occurrences),
      () => this.bundledSource.resolveOccurrences(text, occurrences),
    );
  }
}
