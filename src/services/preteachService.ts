import type { FamilyRecord, ResolvedOccurrence } from "../domain/hkele";
import { hasFlag } from "../domain/hkele";
import { normalizeCpbSurface } from "./cpbService";

export type ClassLevel = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "S1" | "S2" | "S3";

export interface PreteachSuggestion {
  basewordKey: string;
  displayFamily: string;
  actualForm: string;
  occurrences: number;
  reasons: string[];
  family: FamilyRecord;
  selectionKey: string;
  firstOrder: number;
  laterThanClass: boolean;
  marked?: boolean;
}

const levelOrder: Record<ClassLevel, number> = {
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
  P5: 5,
  P6: 6,
  S1: 7,
  S2: 8,
  S3: 9,
};

function recordedLevel(value: string | null): number | null {
  if (!value) return null;
  const match = value.toUpperCase().match(/\b([PS][1-6])\b/);
  return match?.[1] && match[1] in levelOrder ? levelOrder[match[1] as ClassLevel] : null;
}

export function generatePreteachSuggestions(
  _text: string,
  results: ResolvedOccurrence[],
  classLevel: ClassLevel | null = null,
  limit = Number.POSITIVE_INFINITY,
  options: {
    knownForms?: ReadonlySet<string>;
    notKnownForms?: ReadonlySet<string>;
  } = {},
): PreteachSuggestion[] {
  const grouped = new Map<string, { family: FamilyRecord; results: ResolvedOccurrence[] }>();
  for (const result of results) {
    if (result.status !== "RESOLVED" || result.owners.length !== 1) continue;
    const owner = result.owners[0];
    if (!owner || owner.blocked || hasFlag(owner.display_blocked)) continue;
    const word = normalizeCpbSurface(result.surface);
    if (options.knownForms?.has(word)) continue;
    const key = `${owner.baseword_key}\u0000${word}`;
    const existing = grouped.get(key) ?? { family: owner, results: [] };
    existing.results.push(result);
    grouped.set(key, existing);
  }

  const suggestions: PreteachSuggestion[] = [];
  for (const [selectionKey, item] of grouped) {
    const rank = item.family.current_hk_frequency_rank;
    const occurrence = item.results[0]!;
    const evidence = occurrence.owners[0]?.matched_form_evidence;
    const word = normalizeCpbSurface(occurrence.surface);
    const marked = options.notKnownForms?.has(word) ?? false;
    const firstSeen = recordedLevel(evidence?.first_seen_hk_textbooks ?? null);
    const laterThanClass = !!classLevel && firstSeen !== null && firstSeen > levelOrder[classLevel];
    const subject =
      evidence?.msvl !== null &&
      evidence?.msvl !== undefined &&
      evidence.msvl !== "" &&
      evidence.msvl !== 0;
    // These explicit evidence routes determine eligibility; their count is never a score.
    if (
      !marked &&
      !laterThanClass &&
      !hasFlag(evidence?.awl) &&
      !subject &&
      !(rank !== null && rank > 1000)
    )
      continue;
    const reasons: string[] = [];
    if (marked) reasons.push("You marked this word Not known");
    if (laterThanClass)
      reasons.push(`Textbooks: ${evidence?.first_seen_hk_textbooks} · after ${classLevel}`);
    reasons.push(`Appears ${item.results.length} ${item.results.length === 1 ? "time" : "times"}`);
    if (hasFlag(evidence?.awl)) reasons.push("Listed in AWL");
    if (subject) reasons.push(`MSVL: ${evidence!.msvl}`);
    if (rank !== null) reasons.push(`HK family rank: ${rank.toLocaleString("en")}`);
    if (evidence?.first_seen_hk_textbooks && !laterThanClass)
      reasons.push(`Textbooks: ${evidence.first_seen_hk_textbooks}`);
    if (evidence && (evidence.root || evidence.prefix || evidence.suffix))
      reasons.push("Word parts available");
    suggestions.push({
      basewordKey: item.family.baseword_key,
      displayFamily: item.family.display_family,
      actualForm: occurrence.surface,
      occurrences: item.results.length,
      reasons,
      family: item.family,
      selectionKey,
      firstOrder: occurrence.occurrenceOrder,
      laterThanClass,
      marked,
    });
  }
  return suggestions
    .sort(
      (left, right) =>
        Number(right.marked) - Number(left.marked) ||
        Number(right.laterThanClass) - Number(left.laterThanClass) ||
        right.occurrences - left.occurrences ||
        left.firstOrder - right.firstOrder ||
        left.displayFamily.localeCompare(right.displayFamily),
    )
    .slice(0, Math.max(0, limit));
}
