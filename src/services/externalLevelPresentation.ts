import type { FamilyRecord, FormRecord } from "../domain/hkele";

/** Source-provided grade labels only: never round a raw VXGL score into a grade. */
export function teacherLevelLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim();
  if (!label || /^[\d.\s,;|+\-–—eE]+$/.test(label)) return null;
  return label;
}

/** Match the visible word exactly; never substitute a family aggregate or another form. */
export function displayedWordEvidence(
  family: FamilyRecord,
  forms: FormRecord[],
  currentWord = family.display_family,
): FamilyRecord {
  const normalize = (value: string) =>
    value.normalize("NFKC").trim().replace(/[’‘]/g, "'").toLocaleLowerCase();
  const word = normalize(currentWord);
  const form = forms.find(
    (item) => normalize(item.form) === word || normalize(item.normalized_form) === word,
  );
  return {
    ...family,
    browse_display_word: currentWord,
    browse_external_level_reference: form
      ? registeredExternalLevel(form, "external_level_reference")
      : null,
  };
}

/** Negative membership and absent evidence share a dash only in presentation. */
export function vocabularyListLabel(value: unknown): string {
  if (value === null || value === undefined || value === false || value === 0) return "—";
  const text = String(value).trim();
  return !text || /^(0|no|false|null|none)$/i.test(text) ? "—" : text;
}

export function registeredExternalLevel(
  record: Record<string, unknown>,
  field: string,
): string | null {
  return (
    teacherLevelLabel(record.external_level_reference_teacher_display) ??
    teacherLevelLabel(record[field])
  );
}

export function teacherFamilyRecord<T extends FamilyRecord>(family: T): T {
  const label = registeredExternalLevel(family, "external_level_reference_display");
  return {
    ...family,
    data_version: family.data_version ?? "2026-09-14-package67-v1",
    external_level_reference_display: label,
    ...(Object.hasOwn(family, "browse_external_level_reference")
      ? {
          browse_external_level_reference:
            teacherLevelLabel(family.browse_external_level_reference) ?? label,
        }
      : {}),
  };
}

export function teacherFormRecord(form: FormRecord): FormRecord {
  return {
    ...form,
    external_level_reference: registeredExternalLevel(form, "external_level_reference"),
  };
}
