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
  if (kind === "grammatical-relation") return "Registered grammatical relation";
  if (kind === "compound-family") return "Compound match";
  if (kind === "ordinary-family") return "Ordinary family match";
  if (kind === "full-check-unavailable") return "Full database check unavailable";
  if (kind === "unmatched") return "Unmatched — review";
  if (item.status === "AMBIGUOUS") return "More than one owner — review";
  if (item.status === "BLOCKED") return "Context review required";
  return "Unsupported token — review";
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
        explanation:
          "No current HK-ELE family owner is registered. Review this form without guessing a family, rank or teaching value.",
      });
    }
  }
  return [...grouped.values()].sort((left, right) =>
    left.displayForm.localeCompare(right.displayForm),
  );
}
