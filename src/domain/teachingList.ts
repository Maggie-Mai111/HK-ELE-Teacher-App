import type { FamilyRecord } from "./hkele";

export type TeachingStatus = "Notice" | "Practise" | "Master";
export type TeachingFocus = "focus" | "mention" | "";

export interface TeachingListItem {
  basewordKey: string;
  displayFamily: string;
  status: TeachingStatus;
  teachingFocus?: TeachingFocus;
  sourceLabels?: string[];
  notes: string;
  connections: string;
  selectedForms: string[];
  customOrder: number;
  addedAt: string;
  updatedAt: string;
  dataVersion: string;
  dataReviewStatus?: string | undefined;
  previousEvidence?:
    | { dataVersion: string; displayFamily: string; derived: TeachingListItem["derived"] }
    | undefined;
  derived: Pick<
    FamilyRecord,
    | "set_membership"
    | "overall_frequency_order"
    | "current_hk_frequency_rank"
    | "current_hk_frequency_band"
    | "textbook_first_seen_level"
    | "external_level_reference_display"
  >;
}

export interface TeachingListDocument {
  schemaVersion: "1.1.0";
  lessonTitle?: string;
  items: TeachingListItem[];
}
