/** The source's 25 categories. Keep source labels and HK/US evidence separate. */
export const US_REFERENCE_LABELS = Object.freeze([
  "Kindergarten–Grade 1",
  "Grade 1",
  "Grades 1–2",
  "Grade 2",
  "Grades 2–3",
  "Grade 3",
  "Grades 3–4",
  "Grade 4",
  "Grades 4–5",
  "Grade 5",
  "Grades 5–6",
  "Grade 6",
  "Grades 6–7",
  "Grade 7",
  "Grades 7–8",
  "Grade 8",
  "Grades 8–9",
  "Grade 9",
  "Grades 9–10",
  "Grade 10",
  "Grades 10–11",
  "Grade 11",
  "Grades 11–12",
  "Grade 12",
  "Grade 12–College",
]);

export interface UsReferenceConditions {
  externalLevels?: string[];
  usGradeFrom?: number;
  usGradeTo?: number;
  usGradeMatch?: "overlap" | "within";
  usCollege?: boolean;
}

const normalized = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/\s+/g, " ");

export function canonicalUsReference(value: unknown): string | null {
  const text = normalized(value);
  const exact = US_REFERENCE_LABELS.find((label) => normalized(label) === text);
  if (exact) return exact;
  if (/^(?:college|university|higher education|tertiary|大学|大學|大学阶段|大學階段)$/.test(text))
    return "Grade 12–College";
  if (/^(?:kindergarten|k|kg|幼稚园|幼稚園)$/.test(text)) return "Kindergarten–Grade 1";
  const cleaned = text
    .replace(/^(?:us|u\.s\.|american)\s+/, "")
    .replace(/^grades?\s*/, "")
    .replace(/^g\s*(?=\d)/, "")
    .replace(/\s*(?:to|through)\s*/g, "-");
  const one = cleaned.match(/^(\d{1,2})$/);
  if (one && Number(one[1]) >= 1 && Number(one[1]) <= 12) return `Grade ${Number(one[1])}`;
  const range = cleaned.match(/^(\d{1,2})\s*-\s*(\d{1,2})$/);
  if (range)
    return (
      US_REFERENCE_LABELS.find(
        (label) => normalized(label) === `grades ${Number(range[1])}-${Number(range[2])}`,
      ) ?? null
    );
  if (/^12\s*-\s*(?:college|university)$/.test(cleaned)) return "Grade 12–College";
  return null;
}

export function hasUsReferenceConditions(filters: UsReferenceConditions): boolean {
  return (
    filters.externalLevels !== undefined ||
    filters.usGradeFrom !== undefined ||
    filters.usGradeTo !== undefined ||
    filters.usCollege !== undefined
  );
}

export function validateUsReferenceConditions(filters: UsReferenceConditions): void {
  const numeric = filters.usGradeFrom !== undefined || filters.usGradeTo !== undefined;
  for (const value of [filters.usGradeFrom, filters.usGradeTo])
    if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 12))
      throw new Error("US grades must be Kindergarten (0) to Grade 12.");
  if (
    filters.usGradeFrom !== undefined &&
    filters.usGradeTo !== undefined &&
    filters.usGradeFrom > filters.usGradeTo
  )
    throw new Error("US grade range is reversed.");
  if (filters.usGradeMatch !== undefined && !["overlap", "within"].includes(filters.usGradeMatch))
    throw new Error("US grade match mode is invalid.");
  if (filters.usGradeMatch !== undefined && !numeric)
    throw new Error("US grade match needs a grade bound.");
  if (filters.usCollege !== undefined && typeof filters.usCollege !== "boolean")
    throw new Error("US college selector must be boolean.");
  if (filters.externalLevels && (numeric || filters.usCollege !== undefined))
    throw new Error("Choose US source categories or US grade bounds, not both.");
}

function referenceRanges(value: unknown) {
  return String(value ?? "")
    .split(/[|;,·/]+/)
    .map((part) => {
      const label = canonicalUsReference(part);
      if (!label) return null;
      if (label === "Grade 12–College") return { label, from: 12, to: Infinity, college: true };
      if (label === "Kindergarten–Grade 1") return { label, from: 0, to: 1, college: false };
      const numbers = label.match(/\d+/g)!.map(Number);
      return { label, from: numbers[0]!, to: numbers[numbers.length - 1]!, college: false };
    })
    .filter((item) => item !== null);
}

export function matchesUsReference(value: unknown, filters: UsReferenceConditions): boolean {
  if (!hasUsReferenceConditions(filters)) return true;
  const ranges = referenceRanges(value);
  if (filters.externalLevels) {
    const wanted = filters.externalLevels.map(canonicalUsReference);
    return ranges.some((range) => wanted.includes(range.label));
  }
  const numeric = filters.usGradeFrom !== undefined || filters.usGradeTo !== undefined;
  return ranges.some((range) => {
    if (filters.usCollege === false && range.college) return false;
    const lower = filters.usGradeFrom ?? 0,
      upper = filters.usGradeTo ?? Infinity;
    const gradeMatch =
      numeric &&
      (filters.usGradeMatch === "within"
        ? range.from >= lower && range.to <= upper
        : range.to >= lower && range.from <= upper);
    return (
      gradeMatch ||
      (filters.usCollege === true && range.college) ||
      (!numeric && filters.usCollege === false && !range.college)
    );
  });
}

export function describeUsReference(filters: UsReferenceConditions): string | null {
  if (!hasUsReferenceConditions(filters)) return null;
  if (filters.externalLevels) return `US grade reference: ${filters.externalLevels.join(", ")}`;
  const from = filters.usGradeFrom,
    to = filters.usGradeTo;
  const name = (value: number) => (value === 0 ? "Kindergarten" : `Grade ${value}`);
  let text = "";
  if (from !== undefined || to !== undefined) {
    if (filters.usGradeMatch === "within")
      text =
        from !== undefined && to !== undefined
          ? `recorded range within ${name(from)}–${name(to)}`
          : from !== undefined
            ? `${name(from)} or higher`
            : `no higher than ${name(to!)}`;
    else
      text =
        from !== undefined && to !== undefined
          ? from === to
            ? `includes ${name(from)}`
            : `overlaps ${name(from)}–${name(to)}`
          : from !== undefined
            ? `overlaps ${name(from)} and higher`
            : `overlaps Kindergarten–${name(to!)}`;
  }
  if (filters.usCollege === true) text = text ? `${text} or Grade 12–College` : "Grade 12–College";
  if (filters.usCollege === false)
    text = text
      ? `${text}; excluding Grade 12–College`
      : "school grades; excluding Grade 12–College";
  return `US grade reference: ${text}`;
}

/** School-year correspondence is for understanding terms, not replacing evidence. */
export function hkStageForSchoolYear(year: number): string | null {
  return Number.isInteger(year) && year >= 1 && year <= 12
    ? year <= 6
      ? `P${year}`
      : `S${year - 6}`
    : null;
}
