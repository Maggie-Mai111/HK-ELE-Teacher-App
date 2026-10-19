import type { FamilyRecord, SurfaceSearchResult } from "../domain/hkele";
import type { TeachingListItem } from "../domain/teachingList";

const normalized = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .trim()
    .toLocaleLowerCase();

export function selectedWordCount(items: TeachingListItem[]): number {
  return items.reduce((sum, item) => sum + item.selectedForms.length, 0);
}

export function hasSelectedForm(
  items: TeachingListItem[],
  family: FamilyRecord,
  form = family.display_family,
): boolean {
  return items.some(
    (item) =>
      item.basewordKey === family.baseword_key &&
      item.selectedForms.some((selected) => normalized(selected) === normalized(form)),
  );
}

// Only pass forms returned by the selected database owner, never a guessed stem.
export function searchSelectedForm(
  family: FamilyRecord,
  result: SurfaceSearchResult | null,
): string | undefined {
  const owner = result?.owners.find((item) => item.baseword_key === family.baseword_key);
  if (!owner || owner.blocked || owner.display_blocked) return undefined;
  const forms = [
    ...new Set([
      ...(owner.matched_form_evidence?.form ? [owner.matched_form_evidence.form] : []),
      ...owner.matched_forms,
    ]),
  ];
  const keys = [result!.submittedQuery, result!.normalizedQuery].map(normalized);
  return (
    forms.find((form) => keys.includes(normalized(form))) ??
    (forms.length === 1 ? forms[0] : undefined)
  );
}
