import type { FamilyDetail } from "../domain/hkele";
import type { TeachingListItem } from "../domain/teachingList";
import { registeredExternalLevel } from "./externalLevelPresentation";

export function refreshSavedSelection(
  item: TeachingListItem,
  detail: FamilyDetail,
): TeachingListItem {
  const { family, forms } = detail;
  const normalize = (word: string) => word.normalize("NFKC").trim().toLocaleLowerCase();
  const accepted = new Set(forms.map((form) => normalize(form.normalized_form)));
  const pronoun =
    family.baseword_key === "trial:pronoun:i" || family.baseword_key === "trial:pronoun:us";
  const safe = item.selectedForms.every(
    (form) =>
      accepted.has(normalize(form)) ||
      (pronoun && normalize(form) === normalize(family.display_family)),
  );
  if (!safe)
    return {
      ...item,
      dataReviewStatus: "Saved selection kept — please check the word and family.",
    };
  return {
    ...item,
    displayFamily: family.display_family,
    dataVersion:
      typeof family.data_version === "string" ? family.data_version : "2026-09-14-package67-v1",
    derived: {
      set_membership: family.set_membership,
      overall_frequency_order: family.overall_frequency_order,
      current_hk_frequency_rank: family.current_hk_frequency_rank,
      current_hk_frequency_band: family.current_hk_frequency_band,
      textbook_first_seen_level: family.textbook_first_seen_level,
      external_level_reference_display: registeredExternalLevel(
        family,
        "external_level_reference_display",
      ),
    },
    dataReviewStatus: undefined,
    previousEvidence: item.previousEvidence ?? {
      dataVersion: item.dataVersion,
      displayFamily: item.displayFamily,
      derived: item.derived,
    },
  };
}
