import type { TokenOccurrence } from "../domain/contracts";
import type {
  HkeleRepository,
  BrowseRequest,
  BrowseScope,
  SurfaceSearchResult,
  ResolvedOccurrence,
} from "../domain/hkele";
import { COMPOUND_RELEASE, lookupCompound } from "../services/compoundData";
import type { SupplementaryExpression } from "../domain/supplementaryExpressions";

export class CompoundRepository implements HkeleRepository {
  constructor(
    private readonly base: HkeleRepository,
    private readonly lookup: (
      word: string,
      version: string,
    ) => Promise<SupplementaryExpression | null> = lookupCompound,
  ) {}
  getDataVersion() {
    return this.base.getDataVersion?.() ?? Promise.resolve(COMPOUND_RELEASE.dataVersion);
  }
  getDataMode() {
    return this.base.getDataMode();
  }
  browse(request: BrowseRequest) {
    return this.base.browse(request);
  }
  getFamily(key: string) {
    return this.base.getFamily(key);
  }
  getWordFormFrequencies(key: string) {
    if (!this.base.getWordFormFrequencies) throw new Error("Word frequencies need updating.");
    return this.base.getWordFormFrequencies(key);
  }
  aiFilterFamilies(scope?: BrowseScope) {
    if (!this.base.aiFilterFamilies) throw new Error("AI word data need updating.");
    return this.base.aiFilterFamilies(scope);
  }
  aiFilterCpbFamilyKeys(scope?: BrowseScope) {
    if (!this.base.aiFilterCpbFamilyKeys) throw new Error("AI word data need updating.");
    return this.base.aiFilterCpbFamilyKeys(scope);
  }
  private async attach<T extends SurfaceSearchResult | ResolvedOccurrence>(
    result: T,
    word: string,
  ): Promise<T> {
    try {
      const expression = await this.lookup(word, await this.getDataVersion());
      return {
        ...result,
        expression,
        expressionLayerStatus: "READY",
        status:
          expression &&
          (result.status === "UNMATCHED" || result.status === "FULL_DATABASE_CHECK_UNAVAILABLE")
            ? "REGISTERED_EXPRESSION"
            : result.status,
      };
    } catch {
      return { ...result, expression: null, expressionLayerStatus: "UNAVAILABLE" };
    }
  }
  async searchSurface(word: string) {
    return this.attach(await this.base.searchSurface(word), word);
  }
  async resolveOccurrences(text: string, tokens: TokenOccurrence[]): Promise<ResolvedOccurrence[]> {
    const results = await this.base.resolveOccurrences(text, tokens);
    return Promise.all(
      results.map((item) =>
        item.tokenStatus === "SUPPORTED_TOKEN" ? this.attach(item, item.surface) : item,
      ),
    );
  }
}
