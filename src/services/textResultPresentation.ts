import type { ResolvedOccurrence } from "../domain/hkele";

export type TextResultKind =
  | "ordinary-family"
  | "compound-family"
  | "grammatical-relation"
  | "full-check-unavailable"
  | "unmatched"
  | "review";

export interface UnmatchedWordSummary {
  normalizedForm: string;
  displayForm: string;
  count: number;
  explanation: string;
}

export type PendingFullCheckSummary = Omit<UnmatchedWordSummary, "explanation">;
export interface ContextReviewSummary {
  key: string;
  displayForm: string;
  count: number;
  explanation: string;
}

export function groupContextReviews(results: ResolvedOccurrence[]): ContextReviewSummary[] {
  const grouped = new Map<string, ContextReviewSummary>();
  for (const item of results) {
    if (textResultKind(item) !== "review") continue;
    const key = `${item.normalizedToken ?? item.surface.toLowerCase()}:${item.status}`;
    const existing = grouped.get(key);
    if (existing) existing.count += 1;
    else
      grouped.set(key, {
        key,
        displayForm: item.surface,
        count: 1,
        explanation:
          item.status === "AMBIGUOUS"
            ? "Choose the family that fits this sentence."
            : "Check the spelling or use in this sentence.",
      });
  }
  return [...grouped.values()];
}

export function textResultsAreCurrent(text: string, checkedText: string | null): boolean {
  return checkedText !== null && text === checkedText;
}

export function isCompoundMatch(item: ResolvedOccurrence): boolean {
  return item.owners.some((owner) =>
    owner.match_classes.some((matchClass) => matchClass.toUpperCase().includes("COMPOUND")),
  );
}

export function textResultKind(item: ResolvedOccurrence): TextResultKind {
  if (item.status === "REGISTERED_GRAMMATICAL_RELATION") return "grammatical-relation";
  if (item.status === "FULL_DATABASE_CHECK_UNAVAILABLE") return "full-check-unavailable";
  if (item.status === "UNMATCHED") return "unmatched";
  if (item.status !== "RESOLVED" || item.owners.length !== 1) return "review";
  return isCompoundMatch(item) ? "compound-family" : "ordinary-family";
}

export function textResultStatusLabel(item: ResolvedOccurrence): string {
  const kind = textResultKind(item);
  if (kind === "grammatical-relation") return "Short form";
  if (kind === "compound-family") return "Compound";
  if (kind === "ordinary-family") return "Matched";
  if (kind === "full-check-unavailable") return "Check online";
  if (kind === "unmatched") return "No entry";
  if (item.status === "AMBIGUOUS") return "Choose a family";
  if (item.status === "BLOCKED") return "Check spelling or use";
  return "No entry";
}

export function groupPendingFullDatabaseChecks(
  results: ResolvedOccurrence[],
): PendingFullCheckSummary[] {
  const grouped = new Map<string, PendingFullCheckSummary>();
  for (const item of results) {
    if (item.status !== "FULL_DATABASE_CHECK_UNAVAILABLE") continue;
    const normalizedForm = item.normalizedToken ?? item.surface.normalize("NFKC").toLowerCase();
    const existing = grouped.get(normalizedForm);
    if (existing) existing.count += 1;
    else grouped.set(normalizedForm, { normalizedForm, displayForm: item.surface, count: 1 });
  }
  return [...grouped.values()].sort((left, right) =>
    left.displayForm.localeCompare(right.displayForm),
  );
}

export function textFormAndFamily(item: ResolvedOccurrence): {
  textForm: string;
  family: string | null;
} {
  return {
    textForm: item.surface,
    family:
      item.status === "RESOLVED" && item.owners.length === 1
        ? (item.owners[0]?.display_family ?? null)
        : null,
  };
}

export function groupUnmatchedWords(results: ResolvedOccurrence[]): UnmatchedWordSummary[] {
  const grouped = new Map<string, UnmatchedWordSummary>();
  for (const item of results) {
    if (textResultKind(item) !== "unmatched") continue;
    const normalizedForm = item.normalizedToken ?? item.surface.normalize("NFKC").toLowerCase();
    const existing = grouped.get(normalizedForm);
    if (existing) {
      existing.count += 1;
    } else {
      grouped.set(normalizedForm, {
        normalizedForm,
        displayForm: item.surface,
        count: 1,
        explanation: "No entry found in the wordlist.",
      });
    }
  }
  return [...grouped.values()].sort((left, right) =>
    left.displayForm.localeCompare(right.displayForm),
  );
}
