/** Presentation only: Package67 membership values stay unchanged in storage. */
export function teacherWordListLabel(value: string | null | undefined): string {
  if (!value?.trim()) return "Not recorded";
  return value === "Candidate" || value === "Core list" ? "Core list" : "Full database";
}

export function inTeacherWordScope(
  family: { candidate_member: number | boolean },
  scope: string,
): boolean {
  return scope !== "core" || family.candidate_member === true || family.candidate_member === 1;
}
