export const READABILITY_MIN_WORDS = 30;

// Small, explicit exceptions keep this offline estimate independent of a large dictionary.
// Pronunciation variants and unfamiliar names remain estimates; see READABILITY_METHOD.md.
const SYLLABLE_EXCEPTIONS: Readonly<Record<string, number>> = {
  anyone: 3,
  anything: 3,
  beautiful: 3,
  biological: 5,
  biology: 4,
  business: 2,
  businesses: 3,
  create: 2,
  created: 3,
  creating: 3,
  creation: 3,
  different: 3,
  difference: 3,
  environment: 4,
  environmental: 5,
  every: 2,
  everybody: 4,
  everyone: 3,
  everywhere: 3,
  hour: 1,
  hours: 1,
  homework: 2,
  housework: 2,
  interesting: 3,
  interest: 2,
  knowledge: 2,
  language: 2,
  languages: 3,
  people: 2,
  quiet: 2,
  queue: 1,
  queues: 1,
  queued: 1,
  reusable: 4,
  reuse: 2,
  reused: 2,
  science: 2,
  scientific: 4,
  someone: 2,
  something: 2,
  "couldn't": 2,
  "didn't": 2,
  "doesn't": 2,
  "hadn't": 2,
  "hasn't": 2,
  "haven't": 2,
  "isn't": 2,
  "shouldn't": 2,
  "wasn't": 2,
  "wouldn't": 2,
  dr: 2,
  mr: 2,
  mrs: 2,
  ms: 1,
  prof: 3,
};

export interface ReadabilityResult {
  status: "READY" | "TOO_SHORT";
  words: number;
  sentences: number;
  syllables: number;
  fleschReadingEase: number | null;
  fleschKincaidGrade: number | null;
}

export function estimateSyllables(surface: string): number {
  const parts =
    surface
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .match(/[a-z]+(?:'[a-z]+)*/g) ?? [];
  return parts.reduce((total, part) => {
    if (Object.hasOwn(SYLLABLE_EXCEPTIONS, part)) return total + SYLLABLE_EXCEPTIONS[part]!;
    const word = part.replace(/'/g, "");
    let count = word.match(/[aeiouy]+/g)?.length ?? 0;
    // Silent final e, except a consonant followed by syllabic -le.
    if (/e$/.test(word) && !/[^aeiouy]le$/.test(word)) count--;
    // -ed is pronounced after /t/ or /d/; do not strip all past-tense endings.
    if (/[^aeiouytd]ed$/.test(word)) count--;
    // Preserve the extra syllable in boxes, classes, changes and bottles.
    if (/es$/.test(word) && !/(?:[sxz]|ch|sh|[cg]|[^aeiouy]l)es$/.test(word) && !/ies$/.test(word))
      count--;
    // Common vowel hiatus; -tion and -sion keep their joined vowel group.
    count += (word.match(/ia|iu|eo|(?<![ts])io/g) ?? []).length;
    return total + Math.max(1, count);
  }, 0);
}

/** Count English sentence spans without treating abbreviation/decimal dots as stops. */
export function countReadabilitySentences(text: string): number {
  const dot = "\uE000";
  const protect = (value: string) => value.replace(/\./g, dot);
  const starters =
    /^(?:I|It|Its|We|You|He|She|They|The|This|That|These|Those|A|An|Our|Their|But|However|Then|Next|Finally)\b/;
  let value = text.normalize("NFKC").replace(/\uE000/g, " ");
  // URL/email punctuation is part of the address; retain trailing sentence punctuation.
  value = value.replace(
    /\b(?:https?:\/\/|www\.)\S+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi,
    (address) => {
      const trailing = address.match(/[.!?]+$/)?.[0] ?? "";
      return protect(address.slice(0, address.length - trailing.length)) + trailing;
    },
  );
  value = value.replace(/(?<=\d)\.(?=\d)/g, dot);
  value = value.replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr)\.(?=\s+\S)/gi, protect);
  value = value.replace(/\b(?:e\.g|i\.e)\./gi, protect);
  value = value.replace(/\b(?:[A-Za-z]\.){2,}/g, (initialism, offset: number) => {
    const after = value.slice(offset + initialism.length).trimStart();
    return after && starters.test(after)
      ? protect(initialism.slice(0, -1)) + "."
      : protect(initialism);
  });
  value = value.replace(/\b[A-Z]\.(?=\s+[A-Z][a-z])/g, (initial, offset: number) =>
    starters.test(value.slice(offset + initial.length).trimStart()) ? initial : protect(initial),
  );
  value = value.replace(/\b(?:etc|vs|no|fig|figs|vol|pp|p)\./gi, (abbreviation, offset: number) => {
    const after = value.slice(offset + abbreviation.length).trimStart();
    return after && /^[A-Z]/.test(after) ? abbreviation : protect(abbreviation);
  });
  return value.split(/[.!?]+|\n\s*\n/g).filter((part) => /[A-Za-z]/.test(part)).length;
}

export function estimateTextComplexity(text: string, wordSurfaces: string[]): ReadabilityResult {
  const words = wordSurfaces.filter((word) => /[A-Za-z]/.test(word));
  const wordCount = words.length;
  const sentences = Math.max(1, countReadabilitySentences(text));
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
