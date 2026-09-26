export const AI_FILTER_MAX_QUERY_LENGTH = 300;
export const AI_FILTER_MAX_RESULTS = 100;
export const AI_FILTER_MAX_SUMMARY_LENGTH = 100;
export const AI_FILTER_MAX_WARNING_LENGTH = 60;
export const AI_FILTER_MAX_WARNINGS = 2;
export const AI_FILTER_MAX_CONTROLLED_TEXT_LENGTH = 32;
export const AI_FILTER_MAX_EXTERNAL_LEVELS = 3;
export const AI_FILTER_MAX_EXTERNAL_LEVEL_LENGTH = 32;
export const AI_FILTER_TURNSTILE_ACTION = "ai_filter";
export const AI_FILTER_MAX_TURNSTILE_TOKEN_LENGTH = 2048;

export const AI_FILTER_GRADES = ["P1", "P2", "P3", "P4", "P5", "P6", "S1", "S2", "S3"] as const;
export const AI_FILTER_HK_BANDS = [
  "HK Top 1k",
  "HK Top 2k",
  "HK Top 3k",
  "HK Top 5k",
  "HK Top 10k",
] as const;
export const AI_FILTER_MSVL_SUBJECTS = [
  "English Grammar and Writing",
  "Health",
  "Mathematics",
  "Science",
  "Social Studies and History",
] as const;

export type AiFilterGrade = (typeof AI_FILTER_GRADES)[number];
export type AiFilterHkBand = (typeof AI_FILTER_HK_BANDS)[number];
export type AiFilterMsvlSubject = (typeof AI_FILTER_MSVL_SUBJECTS)[number];
export type AiFilterStatus = "ready" | "needs_clarification" | "unsupported";
export type AiFilterScope = "candidate" | "inclusive_reference";
export type AiFilterSort = "overall" | "hk" | "az";

export interface AiFilterRequest {
  query: string;
  locale: "en-HK" | "zh-HK";
  surface: "browse";
}

export interface AiFilterGatewayRequest extends AiFilterRequest {
  turnstileToken: string;
  anonymousSessionId: string;
}

export interface AiFilterConditions {
  scope: AiFilterScope;
  earliestObservedFrom?: AiFilterGrade;
  earliestObservedTo?: AiFilterGrade;
  overallRankMin?: number;
  overallRankMax?: number;
  hkRankMin?: number;
  hkRankMax?: number;
  hkBands?: AiFilterHkBand[];
  prefix?: string;
  suffix?: string;
  root?: string;
  awl?: boolean;
  msvl?: boolean;
  msvlSubjects?: AiFilterMsvlSubject[];
  externalLevels?: string[];
  cpb100?: boolean;
  limit: number;
  sort: AiFilterSort;
}

export interface AiFilterResult {
  status: AiFilterStatus;
  summary: string;
  filters: AiFilterConditions | null;
  clarifyingQuestion: string | null;
  warnings: string[];
}

export class AiFilterValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiFilterValidationError";
  }
}

const resultKeys = new Set(["status", "summary", "filters", "clarifyingQuestion", "warnings"]);
const filterKeys = new Set([
  "scope",
  "earliestObservedFrom",
  "earliestObservedTo",
  "overallRankMin",
  "overallRankMax",
  "hkRankMin",
  "hkRankMax",
  "hkBands",
  "prefix",
  "suffix",
  "root",
  "awl",
  "msvl",
  "msvlSubjects",
  "externalLevels",
  "cpb100",
  "limit",
  "sort",
]);

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AiFilterValidationError(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function rejectUnknown(record: Record<string, unknown>, allowed: Set<string>, label: string): void {
  const unknown = Object.keys(record).filter((key) => !allowed.has(key));
  if (unknown.length) throw new AiFilterValidationError(`${label} contains unknown fields.`);
}

function boundedString(
  value: unknown,
  label: string,
  maxLength: number,
  allowEmpty = false,
): string {
  if (typeof value !== "string") throw new AiFilterValidationError(`${label} must be text.`);
  const result = value.trim();
  if ((!allowEmpty && !result) || result.length > maxLength) {
    throw new AiFilterValidationError(`${label} is outside its allowed length.`);
  }
  return result;
}

function nullableString(value: unknown, label: string, maxLength: number): string | null {
  return value === null ? null : boundedString(value, label, maxLength);
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new AiFilterValidationError(`${label} is not allowlisted.`);
  }
  return value as T;
}

function integer(value: unknown, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new AiFilterValidationError(`${label} is outside its allowed range.`);
  }
  return value as number;
}

function optionalInteger(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): number | undefined {
  return record[key] === undefined ? undefined : integer(record[key], key, minimum, maximum);
}

function optionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new AiFilterValidationError(`${key} must be boolean.`);
  return value;
}

function optionalControlledText(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  const text = boundedString(value, key, AI_FILTER_MAX_CONTROLLED_TEXT_LENGTH);
  if (/\r|\n|[{};]/.test(text))
    throw new AiFilterValidationError(`${key} contains forbidden syntax.`);
  return text.replace(/^[-–—]+|[-–—]+$/g, "").trim();
}

function optionalEnumArray<T extends string>(
  record: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  maximum: number,
): T[] | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) {
    throw new AiFilterValidationError(`${key} must be a non-empty bounded array.`);
  }
  const result = value.map((item) => enumValue(item, allowed, key));
  if (new Set(result).size !== result.length)
    throw new AiFilterValidationError(`${key} has duplicates.`);
  return result;
}

function optionalStringArray(
  record: Record<string, unknown>,
  key: string,
  maximumItems: number,
  maximumLength: number,
  allowEmpty = false,
): string[] | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > maximumItems) {
    throw new AiFilterValidationError(`${key} must be a non-empty bounded array.`);
  }
  const result = value.map((item) => boundedString(item, key, maximumLength));
  if (new Set(result.map((item) => item.toLocaleLowerCase())).size !== result.length) {
    throw new AiFilterValidationError(`${key} has duplicates.`);
  }
  return result;
}

export function validateAiFilterRequest(value: unknown): AiFilterRequest {
  const record = objectValue(value, "request");
  rejectUnknown(record, new Set(["query", "locale", "surface"]), "request");
  return {
    query: boundedString(record.query, "query", AI_FILTER_MAX_QUERY_LENGTH),
    locale: enumValue(record.locale, ["en-HK", "zh-HK"] as const, "locale"),
    surface: enumValue(record.surface, ["browse"] as const, "surface"),
  };
}

export function validateAiFilterGatewayRequest(value: unknown): AiFilterGatewayRequest {
  const record = objectValue(value, "gateway request");
  rejectUnknown(
    record,
    new Set(["query", "locale", "surface", "turnstileToken", "anonymousSessionId"]),
    "gateway request",
  );
  const request = validateAiFilterRequest({
    query: record.query,
    locale: record.locale,
    surface: record.surface,
  });
  const anonymousSessionId = boundedString(
    record.anonymousSessionId,
    "anonymousSessionId",
    36,
  ).toLocaleLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      anonymousSessionId,
    )
  ) {
    throw new AiFilterValidationError("anonymousSessionId must be a random UUID v4.");
  }
  return {
    ...request,
    turnstileToken: boundedString(
      record.turnstileToken,
      "turnstileToken",
      AI_FILTER_MAX_TURNSTILE_TOKEN_LENGTH,
    ),
    anonymousSessionId,
  };
}

export function validateAiFilterConditions(value: unknown): AiFilterConditions {
  const record = objectValue(value, "filters");
  rejectUnknown(record, filterKeys, "filters");
  const result: AiFilterConditions = {
    scope: enumValue(record.scope, ["candidate", "inclusive_reference"] as const, "scope"),
    limit: integer(record.limit, "limit", 1, AI_FILTER_MAX_RESULTS),
    sort: enumValue(record.sort, ["overall", "hk", "az"] as const, "sort"),
  };
  const assign = <K extends keyof AiFilterConditions>(
    key: K,
    value: AiFilterConditions[K] | undefined,
  ) => {
    if (value !== undefined) result[key] = value;
  };
  assign(
    "earliestObservedFrom",
    record.earliestObservedFrom === undefined
      ? undefined
      : enumValue(record.earliestObservedFrom, AI_FILTER_GRADES, "earliestObservedFrom"),
  );
  assign(
    "earliestObservedTo",
    record.earliestObservedTo === undefined
      ? undefined
      : enumValue(record.earliestObservedTo, AI_FILTER_GRADES, "earliestObservedTo"),
  );
  assign("overallRankMin", optionalInteger(record, "overallRankMin", 1, 163570));
  assign("overallRankMax", optionalInteger(record, "overallRankMax", 1, 163570));
  assign("hkRankMin", optionalInteger(record, "hkRankMin", 1, 163570));
  assign("hkRankMax", optionalInteger(record, "hkRankMax", 1, 163570));
  assign("hkBands", optionalEnumArray(record, "hkBands", AI_FILTER_HK_BANDS, 5));
  assign("prefix", optionalControlledText(record, "prefix"));
  assign("suffix", optionalControlledText(record, "suffix"));
  assign("root", optionalControlledText(record, "root"));
  assign("awl", optionalBoolean(record, "awl"));
  assign("msvl", optionalBoolean(record, "msvl"));
  assign("msvlSubjects", optionalEnumArray(record, "msvlSubjects", AI_FILTER_MSVL_SUBJECTS, 5));
  assign(
    "externalLevels",
    optionalStringArray(
      record,
      "externalLevels",
      AI_FILTER_MAX_EXTERNAL_LEVELS,
      AI_FILTER_MAX_EXTERNAL_LEVEL_LENGTH,
    ),
  );
  assign("cpb100", optionalBoolean(record, "cpb100"));
  if (
    result.overallRankMin &&
    result.overallRankMax &&
    result.overallRankMin > result.overallRankMax
  ) {
    throw new AiFilterValidationError("overall rank range is reversed.");
  }
  if (result.hkRankMin && result.hkRankMax && result.hkRankMin > result.hkRankMax) {
    throw new AiFilterValidationError("HK rank range is reversed.");
  }
  const from = result.earliestObservedFrom
    ? AI_FILTER_GRADES.indexOf(result.earliestObservedFrom)
    : -1;
  const to = result.earliestObservedTo ? AI_FILTER_GRADES.indexOf(result.earliestObservedTo) : -1;
  if (from >= 0 && to >= 0 && from > to)
    throw new AiFilterValidationError("grade range is reversed.");
  return result;
}

export function validateAiFilterResult(value: unknown): AiFilterResult {
  const record = objectValue(value, "result");
  rejectUnknown(record, resultKeys, "result");
  const status = enumValue(
    record.status,
    ["ready", "needs_clarification", "unsupported"] as const,
    "status",
  );
  const warnings =
    optionalStringArray(
      record,
      "warnings",
      AI_FILTER_MAX_WARNINGS,
      AI_FILTER_MAX_WARNING_LENGTH,
      true,
    ) ?? [];
  const filters = record.filters === null ? null : validateAiFilterConditions(record.filters);
  const clarifyingQuestion = nullableString(record.clarifyingQuestion, "clarifyingQuestion", 120);
  if (status === "ready" && filters === null)
    throw new AiFilterValidationError("ready requires filters.");
  if (status !== "ready" && filters !== null)
    throw new AiFilterValidationError("non-ready results may not apply filters.");
  if (status === "needs_clarification" && clarifyingQuestion === null) {
    throw new AiFilterValidationError("needs_clarification requires a question.");
  }
  return {
    status,
    summary: boundedString(record.summary, "summary", AI_FILTER_MAX_SUMMARY_LENGTH),
    filters,
    clarifyingQuestion,
    warnings,
  };
}
