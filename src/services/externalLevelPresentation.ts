import type { FamilyRecord, FormRecord } from "../domain/hkele";

/** Source-provided grade labels only: never round a raw VXGL score into a grade. */
export function teacherLevelLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.trim();
  if (!label || /^[\d.\s,;|+\-–—eE]+$/.test(label)) return null;
  return label;
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
