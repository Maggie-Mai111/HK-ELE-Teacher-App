export interface VerifiedAiQuickExample {
  id: "grade" | "hk_band" | "root";
  label: string;
  query: string;
  verifiedMatchCount: number;
}

// Deterministically verified against the registered 3,430-family principal payload.
export const VERIFIED_AI_QUICK_EXAMPLES: readonly VerifiedAiQuickExample[] = Object.freeze([
  {
    id: "grade",
    label: "Grade: by P2",
    query: "Find 10 Candidate words first observed by P2 or earlier, sorted by overall rank",
    verifiedMatchCount: 1213,
  },
  {
    id: "hk_band",
    label: "HK band: Top 1k",
    query: "Find 10 Candidate and Reference words in HK Top 1k, sorted by HK rank",
    verifiedMatchCount: 996,
  },
  {
    id: "root",
    label: "Root: act",
    query: "Find Candidate and Reference words with the registered root act",
    verifiedMatchCount: 7,
  },
]);

export const VERIFIED_ZERO_RESULT_TEST_QUERY =
  "Find Candidate words with the registered root not-registered";
