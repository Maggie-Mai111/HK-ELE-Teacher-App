import type { FormRecord, HkeleRepository } from "../domain/hkele";
import type { TeachingListItem } from "../domain/teachingList";
import { registeredExternalLevel } from "./externalLevelPresentation";

const normalize = (word: string) =>
  word.normalize("NFKC").trim().replace(/[’‘]/g, "'").toLocaleLowerCase();

/** Build export-only copies. Saved lessons and family-derived evidence are never rewritten. */
export async function prepareTeachingExportItems(
  items: TeachingListItem[],
  repository: HkeleRepository,
): Promise<TeachingListItem[]> {
  const version = await repository.getDataVersion?.();
  const prepared = await Promise.all(
    items.map(async (item) => {
      if (item.recordType === "compound") return item;
      let forms: FormRecord[] = [];
      let review = item.dataReviewStatus;
      if (!review && (!version || item.dataVersion === version)) {
        try {
          const detail = await repository.getFamily(item.basewordKey);
          if (
            detail.family.baseword_key === item.basewordKey &&
            (!version || !detail.family.data_version || detail.family.data_version === version)
          ) {
            forms = detail.forms;
          } else review = "Word details need review";
        } catch {
          // Still let teachers save their words and notes if evidence cannot be loaded.
          review = "Word details not checked";
        }
      } else if (!review) review = "Word details need review";
      const selected = item.selectedForms.map((word) => ({
        word,
        form: forms.find(
          (form) =>
            normalize(form.form) === normalize(word) ||
            normalize(form.normalized_form) === normalize(word),
        ),
      }));
      if (!review && selected.some(({ form }) => !form)) review = "Word form needs review";
      const label = (value: (form: FormRecord) => string | null) =>
        selected
          .map(({ word, form }) => {
            const text = (form && value(form)) || "—";
            return selected.length > 1 ? `${word}: ${text}` : text;
          })
          .join(" | ") || "—";
      return {
        ...item,
        dataReviewStatus: review,
        derived: {
          ...item.derived,
          textbook_first_seen_level: label((form) => form.first_seen_hk_textbooks),
          external_level_reference_display: label((form) =>
            registeredExternalLevel(form, "external_level_reference"),
          ),
        },
      };
    }),
  );
  if (version && (await repository.getDataVersion?.()) !== version)
    throw new Error("Wordlist changed while preparing the export. Please retry.");
  return prepared;
}
