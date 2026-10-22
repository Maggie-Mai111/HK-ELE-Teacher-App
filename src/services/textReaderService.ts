import type { FormRecord, ResolvedOccurrence } from "../domain/hkele";
import { hasFlag } from "../domain/hkele";

export function selectedFormEvidence(form: FormRecord | null | undefined) {
  const withheld = String(form?.phase1c_evidence_withheld_fields ?? "").toLowerCase();
  return {
    firstSeen: form?.first_seen_hk_textbooks ?? null,
    awl: hasFlag(form?.awl),
    msvl: form?.msvl ?? null,
    root: form?.root ?? null,
    meaning:
      form?.root_meaning_alignment_status === "MATCHED_UNIQUE_EXACT" ? form.root_meaning : null,
    prefix: withheld.includes("prefix") ? null : (form?.prefix ?? null),
    suffix: withheld.includes("suffix") ? null : (form?.suffix ?? null),
    subjects: form?.academic_subject_evidence ?? null,
  };
}

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
): "family" | "choices" | "grammar" | "offline" | "missing" | "compound" {
  if (item.status === "REGISTERED_EXPRESSION" && item.expression) return "compound";
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
