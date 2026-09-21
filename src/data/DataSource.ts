import type { DataManifest, IdentityLookupRecord } from "../domain/contracts";

export interface FullDatabaseQuery {
  normalizedQuery: string;
  limit: number;
  cursor?: string;
}

export interface FullDatabasePage<TFamily> {
  families: TFamily[];
  nextCursor: string | null;
}

export interface HkeleDataSource<TFamily = unknown> {
  getManifest(): Promise<DataManifest>;
  lookupIdentity(normalizedQuery: string): Promise<IdentityLookupRecord | null>;
  queryFullDatabase(query: FullDatabaseQuery): Promise<FullDatabasePage<TFamily>>;
}

export class TestDataSource implements HkeleDataSource<Record<string, unknown>> {
  constructor(
    private readonly manifest: DataManifest,
    private readonly routes: ReadonlyMap<string, IdentityLookupRecord>,
  ) {}

  async getManifest(): Promise<DataManifest> {
    return this.manifest;
  }

  async lookupIdentity(normalizedQuery: string): Promise<IdentityLookupRecord | null> {
    return this.routes.get(normalizedQuery) ?? null;
  }

  async queryFullDatabase(
    _query: FullDatabaseQuery,
  ): Promise<FullDatabasePage<Record<string, unknown>>> {
    return { families: [], nextCursor: null };
  }
}
