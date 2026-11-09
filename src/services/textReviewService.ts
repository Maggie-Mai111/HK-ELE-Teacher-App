import type { ResolvedOccurrence } from "../domain/hkele";
import { normalizeCpbSurface } from "./cpbService";
import type { KnowledgeFamily, KnowledgeResponses } from "./knowledgeTestService";

export type WordJudgements = Record<string, boolean>;

export function updateWordJudgement(current: WordJudgements, occurrenceId: string, value: boolean | undefined): WordJudgements {
  const next = { ...current }, key = occurrenceId;
  if (value === undefined) delete next[key];
  else next[key] = value;
  return next;
}

export function responsesForWords(words: KnowledgeFamily[], judgements: WordJudgements): KnowledgeResponses {
  return Object.fromEntries(words.flatMap(word => {
    const value = judgements[word.occurrenceId ?? word.basewordKey];
    return value === undefined ? [] : [[word.basewordKey, value]];
  }));
}

// Always use the complete checked text, independently of result-list filters.
export function occurrencesOfWord(results: ResolvedOccurrence[], surface: string): ResolvedOccurrence[] {
  const key = normalizeCpbSurface(surface);
  return results.filter(item => normalizeCpbSurface(item.surface) === key);
}

export function textOccurrenceExcerpt(text: string, item: ResolvedOccurrence) {
  const start = item.startOffset, end = item.endOffset;
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > text.length || text.slice(start, end) !== item.surface)
    return { before: "", word: item.surface, after: "" };
  const left = Math.max(0, start - 70), right = Math.min(text.length, end + 70);
  return { before: (left ? "…" : "") + text.slice(left, start), word: text.slice(start, end), after: text.slice(end, right) + (right < text.length ? "…" : "") };
}

export function showSelectedWords(count: number, active: boolean): boolean {
  return count > 0 || active;
}
