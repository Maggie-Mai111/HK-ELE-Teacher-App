import type { AiFilterResult } from "../domain/aiFilterSchema";
import type { BrowseScope } from "../domain/hkele";

function teacherText(value: string): string {
  return value
    .replace(/Candidate\s*(?:and|\+)\s*Reference/gi, "Core list")
    .replace(/Reference[ -]only/gi, "other database")
    .replace(/\bCandidate\b/g, "Core list");
}

export function teacherAiScope(query: string, selected: BrowseScope = "full"): "full" | "core" {
  if (/full database|entire database|whole database|完整(?:数据库|词库)|全部词库/i.test(query))
    return "full";
  if (/core\s+list|核心词[表库]/i.test(query)) return "core";
  return selected === "core" ? "core" : "full";
}

/** Translate the two teacher scopes for the already deployed legacy interpreter. */
export function teacherAiInterpreterQuery(query: string): string {
  return query
    .replace(/core\s+list|核心词[表库]/gi, "Candidate")
    .replace(
      /full database|entire database|whole database|完整(?:数据库|词库)|全部词库/gi,
      "database",
    )
    .trim();
}

/** Scope is reviewed and executed locally; the Worker only interprets other conditions. */
export function teacherAiResult(
  result: AiFilterResult,
  scope: "full" | "core" = "full",
): AiFilterResult {
  return {
    ...result,
    filters: result.filters
      ? { ...result.filters, scope: scope === "core" ? "candidate" : "full" }
      : null,
    summary: result.filters
      ? `${scope === "core" ? "Core list" : "Full database"} words matching these filters.`
      : teacherText(result.summary),
    clarifyingQuestion: result.clarifyingQuestion ? teacherText(result.clarifyingQuestion) : null,
    warnings: result.warnings.map(teacherText),
  };
}
