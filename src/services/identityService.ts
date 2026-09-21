import type { IdentityException, IdentityResult, SearchOwner } from "../domain/contracts";
import type { HkeleDataSource } from "../data/DataSource";
import { registeredGrammaticalRelation } from "./grammaticalRelationService";

const SPECIAL_SURFACES: Readonly<Record<string, { key: string; display: string }>> = Object.freeze({
  i: { key: "trial:pronoun:i", display: "I" },
  us: { key: "trial:pronoun:us", display: "us" },
});

export function normalizeIdentityQuery(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

export function normalizeApostrophes(value: string): string {
  return normalizeIdentityQuery(value).replace(/[’‘ʼ＇]/g, "'");
}

function exceptionResult(
  submittedQuery: string,
  normalizedQuery: string,
  teacherDisplay: string,
  currentClassification: string,
): IdentityResult {
  const identityException: IdentityException = { teacherDisplay, currentClassification };
  return {
    status: "BLOCKED",
    submittedQuery,
    normalizedQuery,
    bestPriority: null,
    bestOwnerCount: 0,
    owners: [],
    alternatives: [],
    identityException,
  };
}

export class IdentityService {
  constructor(private readonly source: HkeleDataSource) {}

  async search(submittedQuery: string): Promise<IdentityResult> {
    const normalizedQuery = normalizeIdentityQuery(submittedQuery);
    const empty = {
      submittedQuery,
      normalizedQuery,
      bestPriority: null,
      bestOwnerCount: 0,
      owners: [] as SearchOwner[],
      alternatives: [] as SearchOwner[],
      identityException: null,
    };
    if (!normalizedQuery) return { status: "UNMATCHED", ...empty };

    const grammaticalRelation = registeredGrammaticalRelation(submittedQuery);
    if (grammaticalRelation) {
      return {
        status: "REGISTERED_GRAMMATICAL_RELATION",
        ...empty,
        grammaticalRelation,
      };
    }

    if (submittedQuery === "US") {
      return exceptionResult(
        submittedQuery,
        normalizedQuery,
        "US requires contextual classification and is not counted as the pronoun us.",
        "COUNTRY_ABBREVIATION_OR_OTHER_CONTEXT_REQUIRED",
      );
    }
    if (normalizedQuery === "does") {
      return exceptionResult(
        submittedQuery,
        normalizedQuery,
        "does requires contextual classification and is retained for review here.",
        "CONTEXT_REQUIRED_DO_VERB_OR_DOE_PLURAL",
      );
    }

    const special = SPECIAL_SURFACES[normalizedQuery];
    if (special) {
      const owner: SearchOwner = {
        basewordKey: special.key,
        displayFamily: special.display,
        displayBlocked: false,
        matchPriority: 0,
        matchClasses: ["FINAL_CANDIDATE_SURFACE_ONLY"],
        matchedForms: [submittedQuery],
      };
      return {
        status: "RESOLVED",
        ...empty,
        bestPriority: 0,
        bestOwnerCount: 1,
        owners: [owner],
      };
    }

    const record = await this.source.lookupIdentity(normalizedQuery);
    if (!record || record.owners.length === 0) return { status: "UNMATCHED", ...empty };
    const bestPriority = Math.min(...record.owners.map((owner) => owner.matchPriority));
    const owners = record.owners.filter((owner) => owner.matchPriority === bestPriority);
    const alternatives = record.owners.filter((owner) => owner.matchPriority !== bestPriority);
    const allowed = owners.filter((owner) => !owner.displayBlocked);
    return {
      status: allowed.length === 0 ? "BLOCKED" : allowed.length > 1 ? "AMBIGUOUS" : "RESOLVED",
      submittedQuery,
      normalizedQuery,
      bestPriority,
      bestOwnerCount: allowed.length,
      owners,
      alternatives,
      identityException: null,
    };
  }
}
