export type BrowseResultMode = "browse" | "search" | "ai";

export interface BrowseResultState {
  mode: BrowseResultMode;
  searchActive: boolean;
  aiActive: boolean;
}

export function browseResultState(mode: BrowseResultMode): BrowseResultState {
  return {
    mode,
    searchActive: mode === "search",
    aiActive: mode === "ai",
  };
}
