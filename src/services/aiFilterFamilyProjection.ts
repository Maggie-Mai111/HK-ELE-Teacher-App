import type { FamilyRecord, FormRecord } from "../domain/hkele";

function collectRegisteredValues(items: FormRecord[], field: keyof FormRecord): string | null {
  const values = [
    ...new Set(
      items
        .flatMap((item) => String(item[field] ?? "").split(/[|;,·/]+/))
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  return values.length ? values.join(" | ") : null;
}

/**
 * Builds the deterministic Candidate + Reference filter projection from the
 * registered family payload and its authoritative form evidence. This is a
 * product-derived view only; it never changes membership, rank, or research data.
 */
export function deriveAiFilterFamilies(
  families: FamilyRecord[],
  forms: FormRecord[],
): FamilyRecord[] {
  const byFamily = new Map<string, FormRecord[]>();
  for (const form of forms) {
    byFamily.set(form.baseword_key, [...(byFamily.get(form.baseword_key) ?? []), form]);
  }
  return families.map((family) => {
    const familyForms = byFamily.get(family.baseword_key) ?? [];
    return {
      ...family,
      browse_external_level_reference:
        family.external_level_reference_display ??
        collectRegisteredValues(familyForms, "external_level_reference"),
      browse_root: collectRegisteredValues(familyForms, "root"),
      browse_root_meaning: collectRegisteredValues(familyForms, "root_meaning"),
      browse_prefix: collectRegisteredValues(familyForms, "prefix"),
      browse_suffix: collectRegisteredValues(familyForms, "suffix"),
    };
  });
}
