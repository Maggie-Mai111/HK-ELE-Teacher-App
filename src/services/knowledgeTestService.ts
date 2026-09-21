import type { FamilyRecord, ResolvedOccurrence } from "../domain/hkele";

export interface KnowledgeFamily {
  basewordKey: string;
  displayFamily: string;
  actualForm: string;
  context: string;
  tokenCount: number;
  family: FamilyRecord;
}

export type KnowledgeResponses = Record<string, boolean | undefined>;

export function collectEligibleFamilies(results: ResolvedOccurrence[]): KnowledgeFamily[] {
  const grouped = new Map<string, KnowledgeFamily>();
  for (const result of results) {
    if (result.status !== "RESOLVED" || result.owners.length !== 1) continue;
    const owner = result.owners[0];
    if (!owner || owner.blocked || owner.display_blocked === true || owner.display_blocked === 1) {
      continue;
    }
    const existing = grouped.get(owner.baseword_key);
    if (existing) {
      existing.tokenCount += 1;
    } else {
      grouped.set(owner.baseword_key, {
        basewordKey: owner.baseword_key,
        displayFamily: owner.display_family,
        actualForm: result.surface,
        context: result.context,
        tokenCount: 1,
        family: owner,
      });
    }
  }
  return [...grouped.values()];
}

function seedNumber(seed: string | number): number {
  if (typeof seed === "number") return seed >>> 0;
  let value = 2166136261;
  for (const char of seed) {
    value ^= char.codePointAt(0) ?? 0;
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function randomGenerator(seed: string | number): () => number {
  let value = seedNumber(seed);
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededKnowledgeSample(
  families: KnowledgeFamily[],
  size: 10 | 20,
  seed: string | number,
): KnowledgeFamily[] {
  const values = [...families];
  const random = randomGenerator(seed);
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [values[index], values[target]] = [values[target]!, values[index]!];
  }
  return values.slice(0, Math.min(size, values.length));
}

export interface CoverageResult {
  answeredFamilies: number;
  totalFamilies: number;
  knownFamilies: number;
  familyKnownPercent: number | null;
  tokenCoveragePercent: number | null;
  complete: boolean;
}

export function calculateCoverage(
  families: KnowledgeFamily[],
  responses: KnowledgeResponses,
): CoverageResult {
  const answered = families.filter((family) => responses[family.basewordKey] !== undefined);
  const known = answered.filter((family) => responses[family.basewordKey] === true);
  const complete = families.length > 0 && answered.length === families.length;
  const answeredTokens = answered.reduce((sum, family) => sum + family.tokenCount, 0);
  const knownTokens = known.reduce((sum, family) => sum + family.tokenCount, 0);
  return {
    answeredFamilies: answered.length,
    totalFamilies: families.length,
    knownFamilies: known.length,
    familyKnownPercent: complete ? (known.length / families.length) * 100 : null,
    tokenCoveragePercent: complete && answeredTokens ? (knownTokens / answeredTokens) * 100 : null,
    complete,
  };
}

export function tokenCoverageGuidance(percent: number): string {
  if (percent === 100) {
    return "Complete lexical coverage in this check; comprehension still depends on the reader, text and task.";
  }
  if (percent >= 98) return "Commonly associated with more independent comprehension.";
  if (percent >= 94) return "May support comprehension with assistance.";
  if (percent < 90) return "Likely requires substantial support.";
  return "Between the broad support bands; interpret with the reader, text and task in mind.";
}
