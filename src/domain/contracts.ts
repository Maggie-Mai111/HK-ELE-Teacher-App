export type ResolutionStatus =
  | "RESOLVED"
  | "AMBIGUOUS"
  | "BLOCKED"
  | "UNMATCHED"
  | "FULL_DATABASE_CHECK_UNAVAILABLE"
  | "UNSUPPORTED"
  | "REGISTERED_GRAMMATICAL_RELATION";

export type TokenStatus = "SUPPORTED_TOKEN" | "UNSUPPORTED_TOKEN";

export interface DataCounts {
  totalFamilies: number;
  forms: number;
  ranked: number;
  unranked: number;
  candidate: number;
  inclusiveReference: number;
  referenceOnly: number;
}

export interface SourcePackageIdentity {
  role: string;
  packageId: string;
  path: string;
  sha256: string;
}

export interface DataFileInventoryItem {
  path: string;
  role: string;
  byteSize: number;
  sha256: string;
  compressionFormat: "gzip" | "none";
}

export interface CompatibilityRules {
  compatibleSchemaMajor: number;
  incompatibleSchemaAction: "REFUSE_LOAD";
  stableFamilyKey: "baseword_key";
  stableFormKey: "form_key";
  generalUnavailableMeaning: "SOURCE_COMPONENT_UNAVAILABLE_NOT_ZERO";
  ordinaryDataUpdateChanges: "dataVersion";
  incompatibleStructureUpdateChanges: "schemaVersion";
}

export interface DataManifest {
  schemaVersion: string;
  dataVersion: string;
  minimumAppVersion: string;
  releaseDate: string;
  sourcePackages: SourcePackageIdentity[];
  counts: DataCounts;
  files: DataFileInventoryItem[];
  compatibilityRules: CompatibilityRules;
}

export interface TokenOccurrence {
  occurrenceId: string;
  tokenStatus: TokenStatus;
  surface: string;
  normalizedToken: string | null;
  normalizationRuleIds: string[];
  startOffset: number;
  endOffset: number;
  occurrenceOrder: number;
  failureReason: string | null;
}

export interface SeparatorEvent {
  separatorId: string;
  surface: string;
  codePoint: string;
  startOffset: number;
  endOffset: number;
  processingRuleId: string;
}

export interface TokenScan {
  occurrences: TokenOccurrence[];
  separatorEvents: SeparatorEvent[];
}

export interface IdentityException {
  teacherDisplay: string;
  currentClassification: string;
}

export interface GrammaticalRelationComponent {
  textForm: string;
  basewordKey: string;
  displayFamily: string;
}

export interface GrammaticalRelationAlternative {
  components: GrammaticalRelationComponent[];
}

export interface RegisteredGrammaticalRelation {
  normalizedSurface: string;
  sourceExpansion: string;
  alternatives: GrammaticalRelationAlternative[];
  teacherStatus: "Registered grammatical relation";
  rankedFamilyAssignment: false;
}

export interface SearchOwner {
  basewordKey: string;
  displayFamily: string;
  displayBlocked: boolean;
  matchPriority: number;
  matchClasses: string[];
  matchedForms: string[];
}

export interface IdentityLookupRecord {
  normalizedQuery: string;
  owners: SearchOwner[];
}

export interface IdentityResult {
  status: Exclude<ResolutionStatus, "UNSUPPORTED">;
  submittedQuery: string;
  normalizedQuery: string;
  bestPriority: number | null;
  bestOwnerCount: number;
  owners: SearchOwner[];
  alternatives: SearchOwner[];
  identityException: IdentityException | null;
  grammaticalRelation?: RegisteredGrammaticalRelation | null;
}

export interface CpbSightWord {
  rank: number;
  word: string;
  sourceRow: number;
  sourceFileName: string;
  sourceSha256: string;
  extractedOn: string;
  matchKey: string;
}
