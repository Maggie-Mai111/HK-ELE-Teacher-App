import type { RegisteredGrammaticalRelation, ResolutionStatus, TokenOccurrence } from "./contracts";

export type BrowseScope = "core" | "broader" | "full";
export type BrowseSort = "overall" | "hk" | "az";
export type DataMode = "bundled-reference" | "remote-full" | "installed-full";

export interface FamilyRecord {
  baseword_key: string;
  display_family: string;
  overall_frequency_order: number | null;
  overall_frequency_value: number | null;
  set_membership: string | null;
  current_hk_frequency_rank: number | null;
  current_hk_frequency_band: string | null;
  textbook_first_seen_level: string | null;
  external_level_reference_display: string | null;
  candidate_member: number | boolean;
  reference_member: number | boolean;
  display_blocked: number | boolean;
  awl: number | boolean | null;
  msvl: string | number | null;
  earlier_hk: number | boolean | null;
  general_evidence_status: string | null;
  browse_external_level_reference?: string | null;
  browse_root?: string | null;
  browse_root_meaning?: string | null;
  browse_prefix?: string | null;
  browse_suffix?: string | null;
  [key: string]: unknown;
}

export interface FormRecord {
  form_key: string | null;
  baseword_key: string;
  form: string;
  normalized_form: string;
  first_seen_hk_textbooks: string | null;
  external_level_reference: string | null;
  academic_subject_evidence: string | null;
  awl: number | boolean | null;
  msvl: string | number | null;
  root: string | null;
  root_meaning: string | null;
  prefix: string | null;
  suffix: string | null;
  [key: string]: unknown;
}

export interface FamilyDetail {
  family: FamilyRecord;
  forms: FormRecord[];
}

export interface BrowseRequest {
  scope: BrowseScope;
  sort: BrowseSort;
  page: number;
  pageSize: 10 | 25 | 50 | 100;
}

export interface BrowsePage {
  scope: BrowseScope;
  sort: BrowseSort;
  page: number;
  pageSize: number;
  totalItems: number;
  availableItems: number;
  families: FamilyRecord[];
  sourceMode: DataMode;
}

export interface SearchFamilyOwner extends FamilyRecord {
  blocked: boolean;
  match_classes: string[];
  matched_forms: string[];
  matched_form_evidence?: FormRecord | null;
}

export interface SurfaceSearchResult {
  status: Exclude<ResolutionStatus, "UNSUPPORTED">;
  submittedQuery: string;
  normalizedQuery: string;
  bestPriority: number | null;
  bestOwnerCount: number;
  owners: SearchFamilyOwner[];
  alternatives: SearchFamilyOwner[];
  identityException: {
    teacherDisplay: string;
    currentClassification: string;
  } | null;
  grammaticalRelation?: RegisteredGrammaticalRelation | null;
  dataMode: DataMode;
}

export interface ResolvedOccurrence extends TokenOccurrence {
  status: ResolutionStatus;
  bestOwnerCount: number;
  owners: SearchFamilyOwner[];
  alternatives: SearchFamilyOwner[];
  identityException: SurfaceSearchResult["identityException"];
  grammaticalRelation?: RegisteredGrammaticalRelation | null;
  context: string;
  dataMode?: DataMode;
}

export interface HkeleRepository {
  browse(request: BrowseRequest): Promise<BrowsePage>;
  aiFilterFamilies?(): Promise<FamilyRecord[]>;
  getFamily(basewordKey: string): Promise<FamilyDetail>;
  searchSurface(surface: string): Promise<SurfaceSearchResult>;
  resolveOccurrences(text: string, occurrences: TokenOccurrence[]): Promise<ResolvedOccurrence[]>;
  getDataMode(): DataMode;
}

export const hasFlag = (value: unknown): boolean => value === true || value === 1;

export function familySetLabel(family: FamilyRecord): string {
  if (hasFlag(family.candidate_member)) return "Candidate";
  if (hasFlag(family.reference_member)) return "Reference only";
  return family.overall_frequency_order === null ? "Unranked database" : "Other ranked database";
}
