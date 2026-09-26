import type {
  TeachingListDocument,
  TeachingListItem,
  TeachingStatus,
} from "../domain/teachingList";

export function migratePackage72TeachingList(
  raw: string | null,
  dataVersion: string,
  timestamp = new Date().toISOString(),
): TeachingListDocument {
  if (!raw) return { schemaVersion: "1.1.0", items: [] };
  const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
  if (!Array.isArray(parsed)) return { schemaVersion: "1.1.0", items: [] };
  const statuses: TeachingStatus[] = ["Notice", "Practise", "Master"];
  const items = parsed.flatMap((legacy, index): TeachingListItem[] => {
    if (typeof legacy.baseword_key !== "string" || typeof legacy.display_family !== "string")
      return [];
    const status = statuses.includes(legacy.depth as TeachingStatus)
      ? (legacy.depth as TeachingStatus)
      : "Notice";
    const selectedForms = Array.isArray(legacy.selected_forms)
      ? [
          ...new Set(
            legacy.selected_forms
              .filter((form): form is string => typeof form === "string")
              .map((form) => form.trim())
              .filter(Boolean),
          ),
        ]
      : [];
    return [
      {
        basewordKey: legacy.baseword_key,
        displayFamily: legacy.display_family,
        status,
        notes: typeof legacy.notes === "string" ? legacy.notes : "",
        connections: typeof legacy.connections === "string" ? legacy.connections : "",
        selectedForms: selectedForms.length ? selectedForms : [legacy.display_family],
        customOrder: typeof legacy.order === "number" ? Math.max(0, legacy.order - 1) : index,
        addedAt: timestamp,
        updatedAt: timestamp,
        dataVersion,
        derived: {
          set_membership: typeof legacy.set_membership === "string" ? legacy.set_membership : null,
          overall_frequency_order:
            typeof legacy.overall_frequency_order === "number"
              ? legacy.overall_frequency_order
              : null,
          current_hk_frequency_rank:
            typeof legacy.hk_corpus_frequency_rank === "number"
              ? legacy.hk_corpus_frequency_rank
              : null,
          current_hk_frequency_band:
            typeof legacy.hk_corpus_frequency_band === "string"
              ? legacy.hk_corpus_frequency_band
              : null,
          textbook_first_seen_level: null,
          external_level_reference_display: null,
        },
      },
    ];
  });
  return {
    schemaVersion: "1.1.0",
    items: items
      .sort((left, right) => left.customOrder - right.customOrder)
      .map((item, index) => ({ ...item, customOrder: index })),
  };
}
