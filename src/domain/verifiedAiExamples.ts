export interface VerifiedAiQuickExample {
  id: "grade" | "hk_band" | "root";
  label: string;
  query: string;
  verifiedMatchCount: number;
  verifiedCoreMatchCount: number;
}

// Same Package67 records: Full database by default, with Core-list counts checked separately.
export const VERIFIED_AI_QUICK_EXAMPLES: readonly VerifiedAiQuickExample[] = Object.freeze([
  {
    id: "grade",
    label: "Grade: by P2",
    query: "Find 10 words first observed by P2 or earlier, sorted by overall rank",
    verifiedMatchCount: 1679,
    verifiedCoreMatchCount: 1213,
  },
  {
    id: "hk_band",
    label: "HK band: Top 1k",
    query: "Find 10 words in HK Top 1k, sorted by HK rank",
    verifiedMatchCount: 1000,
    verifiedCoreMatchCount: 996,
  },
  {
    id: "root",
    label: "Root: act",
    query: "Find words with the registered root act",
    verifiedMatchCount: 69,
    verifiedCoreMatchCount: 7,
  },
]);

export const VERIFIED_ZERO_RESULT_TEST_QUERY = "Find words with the registered root not-registered";
