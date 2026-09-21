import type { SeparatorEvent, TokenOccurrence, TokenScan } from "../domain/contracts";

export const TOKENIZER_ID = "P69-TEXT-CHECK-PAIRED-QUOTES-1.3.0";

export const REGISTERED_APOSTROPHES = Object.freeze({
  "\u2018": "U+2018_TO_U+0027",
  "\u2019": "U+2019_TO_U+0027",
});

export const SAFE_SEPARATORS = Object.freeze({
  "\u201c": "U+201C_SAFE_SEPARATOR",
  "\u201d": "U+201D_SAFE_SEPARATOR",
  "\u2013": "U+2013_SAFE_SEPARATOR",
  "\u2014": "U+2014_SAFE_SEPARATOR",
  "\u2026": "U+2026_SAFE_SEPARATOR",
  "\u00a0": "U+00A0_SAFE_SEPARATOR",
});

const TOKEN_CANDIDATE_PATTERN =
  /[\p{L}\p{M}]+(?:['\u2018\u2019](?:[\p{L}\p{M}]+|(?=$|[^\p{L}\p{M}])))?/gu;
const SUPPORTED_SURFACE_PATTERN = /^[A-Za-z]+(?:['\u2018\u2019](?:[A-Za-z]+)?)?$/;
const ASCII_LETTER = /[A-Za-z]/;
const LETTER_OR_MARK = /^[\p{L}\p{M}]$/u;

export interface TokenizerIssue {
  offset: number;
  character: string;
  codePoint: string;
  reason: string;
}

export class TokenizerError extends Error {
  readonly code = "UNREGISTERED_CHARACTER_FAIL_CLOSED";

  constructor(readonly issues: TokenizerIssue[]) {
    super(
      "An unregistered character or word shape was found. Matching is paused until that item is removed or replaced.",
    );
    this.name = "TokenizerError";
  }
}

function codePointLabel(char: string): string {
  return `U+${(char.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, "0")}`;
}

export function externalQuoteOffsets(text: string): Set<number> {
  const offsets = new Set<number>();
  let opening: number | null = null;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    const before = text[index - 1] ?? "";
    const after = text[index + 1] ?? "";
    if (char === "\n" || char === "\r") {
      opening = null;
      continue;
    }
    if (!"'\u2018\u2019".includes(char)) continue;
    if (LETTER_OR_MARK.test(before) && LETTER_OR_MARK.test(after)) continue;
    if (
      opening !== null &&
      (char === "\u2019" || (char === "'" && text[opening] === "'")) &&
      !LETTER_OR_MARK.test(after)
    ) {
      const tail = text.slice(index + 1).split(/[\r\n]/, 1)[0] ?? "";
      const laterClose = tail.indexOf(char);
      const nextOpen = tail.search(/(?:^|[^\p{L}\p{M}])['\u2018](?=[\p{L}\p{M}])/u);
      if (
        /[sS]/.test(before) &&
        /^\s+[A-Za-z]/.test(tail) &&
        laterClose >= 0 &&
        (nextOpen < 0 || laterClose < nextOpen)
      ) {
        continue;
      }
      offsets.add(opening);
      offsets.add(index);
      opening = null;
    } else if (
      opening === null &&
      (char === "\u2018" || char === "'") &&
      !/[\p{L}\p{M}\d]/u.test(before) &&
      /[^\s]/.test(after)
    ) {
      opening = index;
    }
  }
  return offsets;
}

function quotationMask(text: string): { offsets: Set<number>; masked: string } {
  const offsets = externalQuoteOffsets(text);
  return {
    offsets,
    masked: text
      .split("")
      .map((char, index) => (offsets.has(index) ? " " : char))
      .join(""),
  };
}

export function inspectUnsupported(text: string): TokenizerIssue[] {
  const masked = quotationMask(text).masked;
  const issues: TokenizerIssue[] = [];
  for (let index = 0; index < masked.length; index += 1) {
    const char = masked[index] ?? "";
    const code = char.charCodeAt(0);
    if (code <= 0x7f && (code >= 0x20 || char === "\t" || char === "\n" || char === "\r")) {
      continue;
    }
    if (Object.hasOwn(SAFE_SEPARATORS, char)) continue;
    if (Object.hasOwn(REGISTERED_APOSTROPHES, char) && ASCII_LETTER.test(masked[index - 1] ?? "")) {
      continue;
    }
    if (LETTER_OR_MARK.test(char)) continue;
    issues.push({
      offset: index,
      character: char,
      codePoint: codePointLabel(char),
      reason: Object.hasOwn(REGISTERED_APOSTROPHES, char)
        ? "REGISTERED_APOSTROPHE_OUTSIDE_ENGLISH_WORD"
        : "UNREGISTERED_CHARACTER",
    });
  }
  for (const match of masked.matchAll(/[\p{L}\p{M}'\u2018\u2019]+/gu)) {
    const apostropheCount = [...match[0]].filter(
      (char) => char === "'" || Object.hasOwn(REGISTERED_APOSTROPHES, char),
    ).length;
    if (apostropheCount > 1) {
      issues.push({
        offset: match.index,
        character: match[0],
        codePoint: "WORD_SHAPE",
        reason: "UNSUPPORTED_MULTIPLE_APOSTROPHES",
      });
    }
  }
  return issues;
}

export function separatorAudit(text: string): SeparatorEvent[] {
  const events: SeparatorEvent[] = [];
  const quotes = externalQuoteOffsets(text);
  for (let index = 0; index < text.length; index += 1) {
    const surface = text[index] ?? "";
    const processingRuleId = quotes.has(index)
      ? "PAIRED_EXTERNAL_SINGLE_QUOTE"
      : SAFE_SEPARATORS[surface as keyof typeof SAFE_SEPARATORS];
    if (!processingRuleId) continue;
    events.push({
      separatorId: `sep-${String(events.length + 1).padStart(4, "0")}`,
      surface,
      codePoint: codePointLabel(surface),
      startOffset: index,
      endOffset: index + 1,
      processingRuleId,
    });
  }
  return events;
}

export function normalizeSurface(surface: string): {
  normalizedToken: string;
  normalizationRuleIds: string[];
} {
  const normalizationRuleIds = ["ASCII_CASEFOLD_LOWER"];
  let normalizedToken = "";
  for (const char of surface) {
    const rule = REGISTERED_APOSTROPHES[char as keyof typeof REGISTERED_APOSTROPHES];
    if (rule) {
      normalizedToken += "'";
      if (!normalizationRuleIds.includes(rule)) normalizationRuleIds.push(rule);
    } else {
      normalizedToken += char.toLowerCase();
    }
  }
  if (surface.includes("'")) normalizationRuleIds.push("U+0027_PRESERVED");
  return { normalizedToken, normalizationRuleIds };
}

export function scan(text: string, maxOccurrences = 500): TokenScan {
  const issues = inspectUnsupported(text);
  if (issues.length > 0) throw new TokenizerError(issues);
  const occurrences: TokenOccurrence[] = [];
  const scanText = quotationMask(text).masked;
  TOKEN_CANDIDATE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_CANDIDATE_PATTERN.exec(scanText)) !== null) {
    const surface = match[0];
    const supported = SUPPORTED_SURFACE_PATTERN.test(surface);
    const normalized = supported ? normalizeSurface(surface) : null;
    occurrences.push({
      occurrenceId: `occ-${String(occurrences.length + 1).padStart(4, "0")}`,
      tokenStatus: supported ? "SUPPORTED_TOKEN" : "UNSUPPORTED_TOKEN",
      surface,
      normalizedToken: normalized?.normalizedToken ?? null,
      normalizationRuleIds: normalized?.normalizationRuleIds ?? [
        "UNSUPPORTED_NON_ASCII_TOKEN_PRESERVED",
      ],
      startOffset: match.index,
      endOffset: match.index + surface.length,
      occurrenceOrder: occurrences.length + 1,
      failureReason: supported ? null : "NON_ASCII_LETTER_TOKEN",
    });
    if (occurrences.length > maxOccurrences) {
      throw new Error(
        `The technical limit is ${maxOccurrences} recognized occurrences. Shorten the text and try again.`,
      );
    }
  }
  return { occurrences, separatorEvents: separatorAudit(text) };
}

export const tokenize = (text: string, maxOccurrences = 500): TokenOccurrence[] =>
  scan(text, maxOccurrences).occurrences;
