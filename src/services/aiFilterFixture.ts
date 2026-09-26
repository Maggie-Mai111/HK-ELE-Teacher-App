import { validateAiFilterResult, type AiFilterResult } from "../domain/aiFilterSchema";

/**
 * Local browser-acceptance fixture. It is reachable only when the dedicated
 * build-time flag is enabled and never calls the provider or the staging Worker.
 */
export function interpretAiFilterFixture(query: string): AiFilterResult {
  const normalized = query.normalize("NFKC").trim().toLocaleLowerCase();
  if (normalized.includes("sql") || normalized.includes("animal compound")) {
    return validateAiFilterResult({
      status: "unsupported",
      summary: "This request uses a field or operation that is not registered for filtering.",
      filters: null,
      clarifyingQuestion: null,
      warnings: ["No filter was applied."],
    });
  }
  if (normalized.includes("not-registered")) {
    return validateAiFilterResult({
      status: "ready",
      summary: "Candidate families with the registered root not-registered.",
      filters: { scope: "candidate", root: "not-registered", limit: 20, sort: "overall" },
      clarifyingQuestion: null,
      warnings: [],
    });
  }
  if (normalized.includes("root act")) {
    return validateAiFilterResult({
      status: "ready",
      summary: "Candidate and Reference families with the registered root act.",
      filters: { scope: "inclusive_reference", root: "act", limit: 20, sort: "overall" },
      clarifyingQuestion: null,
      warnings: [],
    });
  }
  if (normalized.includes("top 1k")) {
    return validateAiFilterResult({
      status: "ready",
      summary: "Candidate and Reference families in the registered HK Top 1k band.",
      filters: {
        scope: "inclusive_reference",
        hkBands: ["HK Top 1k"],
        limit: 10,
        sort: "hk",
      },
      clarifyingQuestion: null,
      warnings: [],
    });
  }
  return validateAiFilterResult({
    status: "ready",
    summary: "Candidate families first observed by P2 or earlier.",
    filters: {
      scope: "candidate",
      earliestObservedTo: "P2",
      limit: 10,
      sort: "overall",
    },
    clarifyingQuestion: null,
    warnings: [],
  });
}
