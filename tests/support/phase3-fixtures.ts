import type {
  FamilyRecord,
  ResolvedOccurrence,
  SearchFamilyOwner,
} from "../../src/domain/hkele.js";

export function makeFamily(
  key: string,
  hkRank: number | null,
  patch: Partial<FamilyRecord> = {},
): SearchFamilyOwner {
  return {
    baseword_key: key,
    display_family: key,
    overall_frequency_order: hkRank,
    overall_frequency_value: null,
    set_membership: "Candidate",
    current_hk_frequency_rank: hkRank,
    current_hk_frequency_band: null,
    textbook_first_seen_level: "P1",
    external_level_reference_display: null,
    candidate_member: 1,
    reference_member: 1,
    display_blocked: 0,
    awl: 0,
    msvl: null,
    earlier_hk: 0,
    general_evidence_status: null,
    blocked: false,
    match_classes: ["EXACT_FORM"],
    matched_forms: [key],
    ...patch,
  };
}

export function makeOccurrence(
  surface: string,
  family: SearchFamilyOwner,
  offset: number,
): ResolvedOccurrence {
  return {
    occurrenceId: `occ-${offset}`,
    tokenStatus: "SUPPORTED_TOKEN",
    surface,
    normalizedToken: surface.toLocaleLowerCase(),
    normalizationRuleIds: ["ASCII_CASEFOLD_LOWER"],
    startOffset: offset,
    endOffset: offset + surface.length,
    occurrenceOrder: offset + 1,
    failureReason: null,
    status: "RESOLVED",
    bestOwnerCount: 1,
    owners: [family],
    alternatives: [],
    identityException: null,
    context: surface,
  };
}
