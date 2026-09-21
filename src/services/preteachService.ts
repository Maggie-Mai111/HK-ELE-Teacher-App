import type { FamilyRecord, ResolvedOccurrence } from "../domain/hkele";
import { hasFlag } from "../domain/hkele";
import { matchCpb100 } from "./cpbService";

export type ClassLevel = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "S1" | "S2" | "S3";

export interface PreteachSuggestion {
  basewordKey: string;
  displayFamily: string;
  actualForm: string;
  occurrences: number;
  reasons: string[];
  family: FamilyRecord;
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
  classLevel: ClassLevel,
  limit = 8,
): PreteachSuggestion[] {
  const grouped = new Map<
    string,
    { family: FamilyRecord; forms: string[]; results: ResolvedOccurrence[] }
  >();
  for (const result of results) {
    if (result.status !== "RESOLVED" || result.owners.length !== 1 || matchCpb100(result.surface)) {
      continue;
    }
    const owner = result.owners[0];
    if (!owner || owner.blocked || hasFlag(owner.display_blocked)) continue;
    // The registered family data has no authoritative proper-name flag. Exclude all
    // capitalized name-like surfaces from automated suggestions instead of guessing.
    if (/^[A-Z]/.test(result.surface)) continue;
    const existing = grouped.get(owner.baseword_key) ?? { family: owner, forms: [], results: [] };
    existing.forms.push(result.surface);
    existing.results.push(result);
    grouped.set(owner.baseword_key, existing);
  }

  const suggestions: PreteachSuggestion[] = [];
  for (const [basewordKey, item] of grouped) {
    const rank = item.family.current_hk_frequency_rank;
    const reasons: string[] = [];
    if (rank === null || rank > 2000) reasons.push("Outside HK Top 2k");
    else if (rank > 1000) reasons.push("Outside HK Top 1k");
    if (hasFlag(item.family.awl)) reasons.push("AWL evidence");
    if (item.family.msvl !== null && item.family.msvl !== "" && item.family.msvl !== 0) {
      reasons.push("MSVL / subject evidence");
    }
    if (item.results.length >= 2) reasons.push(`Repeated ${item.results.length} times`);
    const evidence = item.results
      .map((result) => result.owners[0]?.matched_form_evidence)
      .find(Boolean);
    if (evidence && (evidence.root || evidence.prefix || evidence.suffix)) {
      reasons.push("Registered morphology available");
    }
    const firstSeen = recordedLevel(item.family.textbook_first_seen_level);
    if (firstSeen !== null && firstSeen > levelOrder[classLevel]) {
      reasons.push(`Earliest observed at ${item.family.textbook_first_seen_level}`);
    }
    if (!hasFlag(item.family.candidate_member) && !hasFlag(item.family.reference_member)) {
      reasons.push("Outside Candidate + Reference");
    }
    if (!reasons.length) continue;
    suggestions.push({
      basewordKey,
      displayFamily: item.family.display_family,
      actualForm: item.forms[0] ?? item.family.display_family,
      occurrences: item.results.length,
      reasons,
      family: item.family,
    });
  }
  return suggestions
    .sort(
      (left, right) =>
        right.reasons.length - left.reasons.length ||
        right.occurrences - left.occurrences ||
        (right.family.current_hk_frequency_rank ?? Number.MAX_SAFE_INTEGER) -
          (left.family.current_hk_frequency_rank ?? Number.MAX_SAFE_INTEGER) ||
        left.displayFamily.localeCompare(right.displayFamily),
    )
    .slice(0, Math.max(0, Math.min(8, limit)));
}
