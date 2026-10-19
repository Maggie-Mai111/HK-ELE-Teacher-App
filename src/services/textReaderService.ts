import type { FormRecord, ResolvedOccurrence } from "../domain/hkele";

export type ReaderSegment = { key: string; text: string; occurrence?: ResolvedOccurrence };

export interface CheckedTextEvidence {
  members: Array<{ surface: string; count: number }>;
  count: number;
  context?: string;
}

export function textReaderSegments(text: string, results: ResolvedOccurrence[]): ReaderSegment[] {
  const segments: ReaderSegment[] = [];
  const ordered = [...results].sort(
    (a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset,
  );
  let cursor = 0;
  for (const item of ordered) {
    const start = item.startOffset,
      end = item.endOffset;
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < cursor ||
      end <= start ||
      end > text.length
    )
      continue;
    if (start > cursor) segments.push({ key: `space-${cursor}`, text: text.slice(cursor, start) });
    const surface = text.slice(start, end);
    segments.push({
      key: `word-${start}-${end}`,
      text: surface,
      ...(surface === item.surface ? { occurrence: item } : {}),
    });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ key: `tail-${cursor}`, text: text.slice(cursor) });
  return segments;
}

export function textWordAction(
  item: ResolvedOccurrence,
): "family" | "choices" | "grammar" | "offline" | "missing" {
  const owners = item.owners.filter((owner) => !owner.blocked && !owner.display_blocked);
  if (item.status === "RESOLVED" && item.owners.length === 1 && owners.length === 1)
    return "family";
  if (item.status === "AMBIGUOUS" && owners.length) return "choices";
  if (item.status === "REGISTERED_GRAMMATICAL_RELATION" && item.grammaticalRelation)
    return "grammar";
  if (item.status === "FULL_DATABASE_CHECK_UNAVAILABLE") return "offline";
  return "missing";
}

export function selectedWordForm(forms: FormRecord[], surface?: string): FormRecord | undefined {
  if (!surface) return undefined;
  const normalize = (value: string) =>
    value
      .normalize("NFKC")
      .replace(/[\u2018\u2019]/g, "'")
      .toLocaleLowerCase();
  const key = normalize(surface);
  return forms.find(
    (form) => normalize(form.form) === key || normalize(form.normalized_form) === key,
  );
}
