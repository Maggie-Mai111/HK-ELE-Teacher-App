import type { FamilyRecord, ResolvedOccurrence } from "../domain/hkele";
import type { TeachingFocus, TeachingListItem } from "../domain/teachingList";

export interface LessonSelection {
  family: FamilyRecord;
  selectedForms: string[];
  sourceLabel?: string;
}

export const LESSON_FOCUS_OPTIONS: Array<{ value: TeachingFocus; label: string }> = [
  { value: "", label: "Not decided" },
  { value: "focus", label: "Teach in depth" },
  { value: "mention", label: "Briefly introduce" },
];

export function lessonFocusLabel(value?: TeachingFocus): string {
  return LESSON_FOCUS_OPTIONS.find((option) => option.value === value)?.label ?? "Not decided";
}

// Store selected words and neutral source labels, never the pasted passage or knowledge responses.
export function lessonChoicesFromResults(results: ResolvedOccurrence[]): LessonSelection[] {
  const choices = new Map<string, LessonSelection>();
  for (const item of results) {
    if (item.status !== "RESOLVED" || item.owners.length !== 1) continue;
    const family = item.owners[0];
    if (!family || family.blocked || family.display_blocked) continue;
    const form = item.surface.trim();
    if (!form) continue;
    const existing = choices.get(family.baseword_key);
    if (existing) {
      if (!existing.selectedForms.includes(form)) existing.selectedForms.push(form);
    } else {
      choices.set(family.baseword_key, {
        family,
        selectedForms: [form],
        sourceLabel: "Check a text",
      });
    }
  }
  return [...choices.values()];
}

export function mergeLessonSelections(
  items: TeachingListItem[],
  selections: LessonSelection[],
  create: (family: FamilyRecord, order: number, form?: string) => TeachingListItem,
): { items: TeachingListItem[]; added: number; formsAdded: number } {
  const next = items.map((item) => ({ ...item, selectedForms: [...item.selectedForms] }));
  let added = 0;
  let formsAdded = 0;
  for (const selection of selections) {
    if (selection.family.blocked || selection.family.display_blocked) continue;
    const forms = [...new Set(selection.selectedForms.map((form) => form.trim()).filter(Boolean))];
    if (!forms.length) continue;
    let item = next.find((value) => value.basewordKey === selection.family.baseword_key);
    if (!item) {
      item = create(selection.family, next.length, forms[0]);
      item.selectedForms = [];
      next.push(item);
      added += 1;
    }
    for (const form of forms) {
      if (!item.selectedForms.includes(form)) {
        item.selectedForms.push(form);
        formsAdded += 1;
      }
    }
    if (selection.sourceLabel) {
      item.sourceLabels = [...new Set([...(item.sourceLabels ?? []), selection.sourceLabel])];
    }
  }
  return { items: next, added, formsAdded };
}
