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
  markedCount?: number;
  occurrence?: ResolvedOccurrence;
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

export type ReviewFilter = "marked" | "academic" | "later" | "repeated" | "all";

// Records are optional browsing filters. Only the teacher's marks select words for explanation.
export function generatePreteachSuggestions(
  _text: string,
  results: ResolvedOccurrence[],
  classLevel: ClassLevel | null = null,
  limit = Number.POSITIVE_INFINITY,
  options: { judgements?: Readonly<Record<string, boolean>>; filter?: ReviewFilter } = {},
): PreteachSuggestion[] {
  const filter = options.filter ?? "marked";
  const grouped = new Map<string, { family: FamilyRecord; results: ResolvedOccurrence[] }>();
  for (const result of results) {
    if (result.status !== "RESOLVED" || result.owners.length !== 1) continue;
    const owner = result.owners[0];
    if (!owner || owner.blocked || hasFlag(owner.display_blocked)) continue;
    const key = `${owner.baseword_key}\u0000${normalizeCpbSurface(result.surface)}`;
    const item = grouped.get(key) ?? { family: owner, results: [] };
    item.results.push(result); grouped.set(key, item);
  }
  const entries: PreteachSuggestion[] = [];
  for (const [selectionKey, group] of grouped) {
    const marked = group.results.filter(item => options.judgements?.[item.occurrenceId] === false);
    const occurrence = marked[0] ?? group.results[0]!;
    const evidence = occurrence.owners[0]?.matched_form_evidence;
    const firstSeen = recordedLevel(evidence?.first_seen_hk_textbooks ?? null);
    const laterThanClass = !!classLevel && firstSeen !== null && firstSeen > levelOrder[classLevel];
    const subject = evidence?.msvl != null && evidence.msvl !== "" && evidence.msvl !== 0;
    if (filter === "marked" && !marked.length) continue;
    if (filter === "academic" && !hasFlag(evidence?.awl) && !subject) continue;
    if (filter === "later" && !laterThanClass) continue;
    if (filter === "repeated" && group.results.length < 2) continue;
    const reasons: string[] = [];
    if (marked.length) reasons.push("You marked this use May need explaining");
    if (evidence?.first_seen_hk_textbooks) reasons.push(`Textbooks: ${evidence.first_seen_hk_textbooks}${laterThanClass ? ` · after ${classLevel}` : ""}`);
    if (hasFlag(evidence?.awl)) reasons.push("Listed in AWL");
    if (subject) reasons.push(`MSVL: ${evidence!.msvl}`);
    if (group.family.current_hk_frequency_rank !== null) reasons.push(`HK family rank: ${group.family.current_hk_frequency_rank.toLocaleString("en")}`);
    if (evidence && (evidence.root || evidence.prefix || evidence.suffix)) reasons.push("Word parts available");
    entries.push({ basewordKey: group.family.baseword_key, displayFamily: group.family.display_family,
      actualForm: occurrence.surface, occurrences: group.results.length, family: group.family,
      selectionKey, reasons, laterThanClass, marked: marked.length > 0,
      markedCount: marked.length, occurrence, firstOrder: occurrence.occurrenceOrder });
  }
  return entries.sort((a,b) => filter === "marked" ? a.firstOrder-b.firstOrder : b.occurrences-a.occurrences || a.firstOrder-b.firstOrder).slice(0,limit);
}

export function markedOtherOccurrences(results: ResolvedOccurrence[], judgements: Readonly<Record<string, boolean>>) {
  return results.filter(item => judgements[item.occurrenceId] === false && /[A-Za-z]/.test(item.surface)
    && !(item.status === "RESOLVED" && item.owners.length === 1 && !item.owners[0]?.blocked && !hasFlag(item.owners[0]?.display_blocked)));
}
