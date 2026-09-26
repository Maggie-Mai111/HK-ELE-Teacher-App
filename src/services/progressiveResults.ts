import type { FormRecord, ResolvedOccurrence } from "../domain/hkele";
import { textResultStatusLabel } from "./textResultPresentation";

export const PROGRESSIVE_BATCH_SIZE = 20;
export const OCCURRENCE_BATCH_SIZE = 25;

export interface OccurrenceGroup {
  key: string;
  form: string;
  family: string;
  status: string;
  count: number;
}

export function nextBatchSize(current: number, total: number, step: number): number {
  return Math.min(total, current + step);
}

export function visibleForms(forms: FormRecord[], count: number): FormRecord[] {
  return forms.slice(0, count);
}

export function groupOccurrences(items: ResolvedOccurrence[]): OccurrenceGroup[] {
  const groups = new Map<string, OccurrenceGroup>();
  for (const item of items) {
    const family =
      item.status === "RESOLVED" && item.owners.length === 1
        ? (item.owners[0]?.display_family ?? "No family")
        : "No single family";
    const status = textResultStatusLabel(item);
    const key = `${item.normalizedToken ?? item.surface.normalize("NFKC").toLowerCase()}\u0000${family}\u0000${status}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { key, form: item.surface, family, status, count: 1 });
  }
  return [...groups.values()].sort(
    (left, right) => right.count - left.count || left.form.localeCompare(right.form),
  );
}
