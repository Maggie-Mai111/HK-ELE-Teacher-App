import {getWordView,viewCounts,type WordView} from "./wordView";
import type { FamilyRecord, ResolvedOccurrence, SearchFamilyOwner } from "../domain/hkele";

export type CoverageTarget = "90" | "95";
export const COVERAGE_LISTS = {
  get "90"() {return { label: "90% list", families: viewCounts()["90"] };},
  get "95"() {return { label: "95% list", families: viewCounts()["95"] };},
} as const;

export function inCoverageFamily(family: Pick<FamilyRecord, "overall_frequency_order" | "candidate_member"> | undefined | null, target: CoverageTarget, view: WordView = getWordView()): boolean {
  if (!family) return false;
  if (target === "90") return family.candidate_member === true || family.candidate_member === 1;
  const rank = family.overall_frequency_order;
  return typeof rank === "number" && Number.isInteger(rank) && rank >= 1 && rank <= viewCounts(view)["95"];
}

export function inCoverageForm(owner: SearchFamilyOwner | undefined | null, target: CoverageTarget): boolean {
  return inCoverageFamily(owner, target) && owner?.matched_form_evidence?.coverage_member === 1;
}

export function occurrenceInCoverage(item: ResolvedOccurrence, target: CoverageTarget): boolean {
  return item.status === "RESOLVED" && item.owners.length === 1 && inCoverageForm(item.owners[0], target);
}

/** Original occurrence denominator: no corpus-cleaning, CPB or display-filter exclusions. */
export function passageCoverage(items: ResolvedOccurrence[], target: CoverageTarget) {
  const included = items.filter(item => occurrenceInCoverage(item, target)).length;
  return { total: items.length, included, outside: items.length - included,
    percent: items.length ? 100 * included / items.length : null };
}
