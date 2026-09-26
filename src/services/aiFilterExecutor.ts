import { CPB_ITEMS } from "./cpbService";
import {
  AI_FILTER_GRADES,
  validateAiFilterConditions,
  type AiFilterConditions,
} from "../domain/aiFilterSchema";
import { hasFlag, type FamilyRecord, type HkeleRepository } from "../domain/hkele";

export interface AiFilterExecutionContext {
  families: FamilyRecord[];
  cpbFamilyKeys: ReadonlySet<string>;
}

export interface AiFilterExecution {
  filters: AiFilterConditions;
  matchedBeforeLimit: number;
  families: FamilyRecord[];
}

const contextCache = new WeakMap<HkeleRepository, Promise<AiFilterExecutionContext>>();

export function describeAiFilterConditions(filters: AiFilterConditions): string[] {
  const descriptions = [
    filters.scope === "candidate" ? "Scope: Candidate" : "Scope: Candidate + Reference",
  ];
  if (filters.earliestObservedFrom || filters.earliestObservedTo) {
    descriptions.push(
      filters.earliestObservedFrom && filters.earliestObservedTo
        ? `Grade: ${filters.earliestObservedFrom}–${filters.earliestObservedTo}`
        : filters.earliestObservedFrom
          ? `Grade: ${filters.earliestObservedFrom} or later`
          : `Grade: ${filters.earliestObservedTo} or earlier`,
    );
  }
  const range = (label: string, minimum?: number, maximum?: number) => {
    if (minimum === undefined && maximum === undefined) return;
    descriptions.push(
      minimum !== undefined && maximum !== undefined
        ? `${label}: ${minimum.toLocaleString("en")}–${maximum.toLocaleString("en")}`
        : minimum !== undefined
          ? `${label}: ${minimum.toLocaleString("en")} or lower priority`
          : `${label}: up to ${maximum?.toLocaleString("en")}`,
    );
  };
  range("Overall rank", filters.overallRankMin, filters.overallRankMax);
  range("HK rank", filters.hkRankMin, filters.hkRankMax);
  if (filters.hkBands) descriptions.push(`HK band: ${filters.hkBands.join(", ")}`);
  for (const [label, value] of [
    ["Prefix", filters.prefix],
    ["Suffix", filters.suffix],
    ["Root", filters.root],
  ] as const) {
    if (value) descriptions.push(`${label}: ${value}`);
  }
  if (filters.awl !== undefined) descriptions.push(`AWL: ${filters.awl ? "yes" : "no"}`);
  if (filters.msvl !== undefined) descriptions.push(`MSVL: ${filters.msvl ? "yes" : "no"}`);
  if (filters.msvlSubjects) descriptions.push(`MSVL subject: ${filters.msvlSubjects.join(", ")}`);
  if (filters.cpb100 !== undefined) descriptions.push(`CPB 100: ${filters.cpb100 ? "yes" : "no"}`);
  if (filters.externalLevels)
    descriptions.push(`External level: ${filters.externalLevels.join(", ")}`);
  descriptions.push(`Sort: ${filters.sort}`, `Result limit: ${filters.limit}`);
  return descriptions;
}

const normalize = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase();
const tokens = (value: unknown): string[] =>
  normalize(value)
    .split(/[|;,·/]+/)
    .map((item) => item.trim().replace(/^[-–—]+|[-–—]+$/g, ""))
    .filter(Boolean);

function hasRegisteredValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "" && value !== 0 && value !== false;
}

function includesControlledValue(value: unknown, requested: string): boolean {
  const target = normalize(requested).replace(/^[-–—]+|[-–—]+$/g, "");
  return tokens(value).includes(target);
}

function gradeIndex(value: string | null): number {
  return AI_FILTER_GRADES.indexOf(value as (typeof AI_FILTER_GRADES)[number]);
}

function inNullableRange(value: number | null, minimum?: number, maximum?: number): boolean {
  if (minimum === undefined && maximum === undefined) return true;
  if (value === null || !Number.isFinite(value)) return false;
  return (minimum === undefined || value >= minimum) && (maximum === undefined || value <= maximum);
}

function compare(filters: AiFilterConditions, left: FamilyRecord, right: FamilyRecord): number {
  if (filters.sort === "az")
    return (
      left.display_family.localeCompare(right.display_family) ||
      left.baseword_key.localeCompare(right.baseword_key)
    );
  const field = filters.sort === "hk" ? "current_hk_frequency_rank" : "overall_frequency_order";
  return (
    ((left[field] as number | null) ?? Number.MAX_SAFE_INTEGER) -
      ((right[field] as number | null) ?? Number.MAX_SAFE_INTEGER) ||
    left.baseword_key.localeCompare(right.baseword_key)
  );
}

export function executeAiFilter(
  context: AiFilterExecutionContext,
  proposedFilters: unknown,
): AiFilterExecution {
  const filters = validateAiFilterConditions(proposedFilters);
  const from = filters.earliestObservedFrom
    ? AI_FILTER_GRADES.indexOf(filters.earliestObservedFrom)
    : -1;
  const to = filters.earliestObservedTo ? AI_FILTER_GRADES.indexOf(filters.earliestObservedTo) : -1;
  const matches = context.families.filter((family) => {
    if (hasFlag(family.display_blocked)) return false;
    if (
      filters.scope === "candidate"
        ? !hasFlag(family.candidate_member)
        : !hasFlag(family.reference_member)
    )
      return false;
    const grade = gradeIndex(family.textbook_first_seen_level);
    if ((from >= 0 || to >= 0) && grade < 0) return false;
    if (from >= 0 && grade < from) return false;
    if (to >= 0 && grade > to) return false;
    if (
      !inNullableRange(
        family.overall_frequency_order,
        filters.overallRankMin,
        filters.overallRankMax,
      )
    )
      return false;
    if (!inNullableRange(family.current_hk_frequency_rank, filters.hkRankMin, filters.hkRankMax))
      return false;
    if (filters.hkBands && !filters.hkBands.includes(family.current_hk_frequency_band as never))
      return false;
    if (filters.prefix && !includesControlledValue(family.browse_prefix, filters.prefix))
      return false;
    if (filters.suffix && !includesControlledValue(family.browse_suffix, filters.suffix))
      return false;
    if (filters.root && !includesControlledValue(family.browse_root, filters.root)) return false;
    if (filters.awl !== undefined && hasFlag(family.awl) !== filters.awl) return false;
    if (filters.msvl !== undefined && hasRegisteredValue(family.msvl) !== filters.msvl)
      return false;
    if (
      filters.msvlSubjects &&
      !filters.msvlSubjects.some((subject) => includesControlledValue(family.msvl, subject))
    )
      return false;
    const external =
      family.browse_external_level_reference ?? family.external_level_reference_display;
    if (
      filters.externalLevels &&
      !filters.externalLevels.some((level) => includesControlledValue(external, level))
    )
      return false;
    if (
      filters.cpb100 !== undefined &&
      context.cpbFamilyKeys.has(family.baseword_key) !== filters.cpb100
    )
      return false;
    return true;
  });
  matches.sort((left, right) => compare(filters, left, right));
  return { filters, matchedBeforeLimit: matches.length, families: matches.slice(0, filters.limit) };
}

async function loadFamilies(repository: HkeleRepository): Promise<FamilyRecord[]> {
  if (repository.aiFilterFamilies) return repository.aiFilterFamilies();
  const first = await repository.browse({
    scope: "broader",
    sort: "overall",
    page: 1,
    pageSize: 100,
  });
  const pages = Math.ceil(first.availableItems / first.pageSize);
  const remaining = await Promise.all(
    Array.from({ length: Math.max(0, pages - 1) }, (_, index) =>
      repository.browse({ scope: "broader", sort: "overall", page: index + 2, pageSize: 100 }),
    ),
  );
  return [first, ...remaining].flatMap((page) => page.families);
}

async function loadCpbFamilyKeys(repository: HkeleRepository): Promise<ReadonlySet<string>> {
  const results = await Promise.all(CPB_ITEMS.map((item) => repository.searchSurface(item.word)));
  return new Set(
    results.flatMap((result) =>
      result.status === "RESOLVED" || result.status === "AMBIGUOUS"
        ? result.owners.filter((owner) => !owner.blocked).map((owner) => owner.baseword_key)
        : [],
    ),
  );
}

export function prepareAiFilterContext(
  repository: HkeleRepository,
): Promise<AiFilterExecutionContext> {
  const existing = contextCache.get(repository);
  if (existing) return existing;
  const loading = Promise.all([loadFamilies(repository), loadCpbFamilyKeys(repository)]).then(
    ([families, cpbFamilyKeys]) => ({ families, cpbFamilyKeys }),
  );
  contextCache.set(repository, loading);
  return loading;
}
