export type EvidenceTokenKind = "subject" | "root" | "meaning";
export const subjectTokens = [
  ["English Grammar and Writing", "english"],
  ["Health", "health"],
  ["Mathematics", "math"],
  ["Science", "science"],
  ["Social Studies and History", "social"],
] as const;
export function evidenceKind(label: string): EvidenceTokenKind | null {
  return label === "Root"
    ? "root"
    : label === "Root meaning"
      ? "meaning"
      : label.startsWith("Middle School Vocabulary")
        ? "subject"
        : null;
}
export function evidenceTokenValues(value: unknown, kind: EvidenceTokenKind): string[] {
  if (value === null || value === undefined || value === false || value === 0) return [];
  const text = String(value).trim();
  if (!text || /^(—|0|no|false|null|none)$/i.test(text)) return [];
  if (kind === "subject") {
    if (/^all$/i.test(text)) return subjectTokens.map(([label]) => label);
    const aliases: Record<string, string> = {
      english: subjectTokens[0][0],
      math: "Mathematics",
      social_and_history: subjectTokens[4][0],
      "soc/hist": subjectTokens[4][0],
      history: subjectTokens[4][0],
      "social studies": subjectTokens[4][0],
    };
    const labels = new Set(
      text
        .replace(/^MSVL:\s*/i, "")
        .split(/[;,|·]/)
        .map((part) => {
          const normalized = part.trim().toLowerCase();
          return (
            aliases[normalized] ??
            subjectTokens.find(([label]) => label.toLowerCase() === normalized)?.[0]
          );
        })
        .filter(Boolean),
    );
    return subjectTokens.map(([label]) => label).filter((label) => labels.has(label));
  }
  if (kind === "root")
    return text
      .split(/\s*[/|;·]\s*/)
      .map((item) => item.trim())
      .filter(Boolean);
  const parts: string[] = [];
  let start = 0,
    depth = 0,
    quote = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && text[i - 1] !== "\\") {
      quote = quote ? "" : '"';
      continue;
    }
    if (quote) continue;
    if (char === "(" || char === "[") depth++;
    else if (char === ")" || char === "]") depth--;
    else if (depth === 0 && (char === "," || char === ";" || char === "|" || char === "·")) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
    if (depth < 0) return [text];
  }
  if (quote || depth !== 0) return [text];
  parts.push(text.slice(start).trim());
  return parts.filter(Boolean);
}
