import { inCoverageFamily } from "./coverageLists";
/** Presentation only: Package67 membership values stay unchanged in storage. */
export function teacherWordListLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "Not recorded";
  return value === "Candidate" || value === "Core list" || value === "HK-ELE Word List" ? "HK-ELE Word List" : "Full database";
}

export function inTeacherWordScope(
  family: { candidate_member: number | boolean; overall_frequency_order?: number | null },
  scope: string,
): boolean {
  if (scope === "core95") return inCoverageFamily({ ...family, overall_frequency_order: family.overall_frequency_order ?? null }, "95");
  return scope !== "core" || family.candidate_member === true || family.candidate_member === 1;
}
