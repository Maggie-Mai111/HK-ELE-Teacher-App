export const READABILITY_MIN_WORDS = 30;

export interface ReadabilityResult {
  status: "READY" | "TOO_SHORT";
  words: number;
  sentences: number;
  syllables: number;
  fleschReadingEase: number | null;
  fleschKincaidGrade: number | null;
}

export function estimateSyllables(surface: string): number {
  const word = surface
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^a-z]/g, "");
  if (!word) return 0;
  if (word.length <= 3) return 1;
  const stripped = word.replace(/(?:[^l]e|ed|es)$/u, "");
  const groups = stripped.match(/[aeiouy]+/g)?.length ?? 0;
  return Math.max(1, groups);
}

export function estimateTextComplexity(text: string, wordSurfaces: string[]): ReadabilityResult {
  const words = wordSurfaces.filter((word) => /[A-Za-z]/.test(word));
  const wordCount = words.length;
  const sentences = Math.max(1, text.split(/[.!?]+/).filter((part) => part.trim()).length);
  const syllables = words.reduce((sum, word) => sum + estimateSyllables(word), 0);
  if (wordCount < READABILITY_MIN_WORDS) {
    return {
      status: "TOO_SHORT",
      words: wordCount,
      sentences,
      syllables,
      fleschReadingEase: null,
      fleschKincaidGrade: null,
    };
  }
  const wordsPerSentence = wordCount / sentences;
  const syllablesPerWord = syllables / wordCount;
  return {
    status: "READY",
    words: wordCount,
    sentences,
    syllables,
    fleschReadingEase: 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord,
    fleschKincaidGrade: 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59,
  };
}
