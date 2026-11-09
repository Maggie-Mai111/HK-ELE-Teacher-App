export interface VerifiedAiQuickExample {
  id: "grade" | "hk_band" | "root";
  label: string;
  query: string;
  verifiedMatchCount: number;
  verifiedCoreMatchCount: number;
}

// Registered A-main data: Full database by default, with Core-list counts checked separately.
export const VERIFIED_AI_QUICK_EXAMPLES: readonly VerifiedAiQuickExample[] = Object.freeze([
  {
    id: "grade",
    label: "Textbooks: by P2",
    query: "Find 10 words first observed by P2 or earlier, sorted by overall rank",
    verifiedMatchCount: 1027,
    verifiedCoreMatchCount: 461,
  },
  {
    id: "hk_band",
    label: "HK ranks 1–1,000",
    query: "Find 10 words in HK Top 1k, sorted by HK rank",
    verifiedMatchCount: 1000,
    verifiedCoreMatchCount: 1000,
  },
  {
    id: "root",
    label: "Root: act",
    query: "Find words with the root act",
    verifiedMatchCount: 68,
    verifiedCoreMatchCount: 6,
  },
]);

export const VERIFIED_ZERO_RESULT_TEST_QUERY = "Find words with the registered root not-registered";
