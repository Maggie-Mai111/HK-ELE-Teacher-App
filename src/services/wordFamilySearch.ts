import type {
  FamilyDetail,
  FamilyRecord,
  FormRecord,
  HkeleRepository,
  WordFormFrequencies,
} from "../domain/hkele";

export type WordFormSort = "frequency-desc" | "frequency-asc" | "az" | "za";
export interface FamilySearchGroup extends FamilyDetail {
  frequencies: WordFormFrequencies;
  frequencyUnavailable: boolean;
}
const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[’‘ʼ＇]/g, "'");
export function wordFormFrequency(
  record: [number | null, number | null] | undefined,
): number | null {
  const values: number[] = [];
  for (const value of record ?? []) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) values.push(value);
  }
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}
export function sortWordForms(
  forms: FormRecord[],
  query: string,
  frequencies: WordFormFrequencies,
  sort: WordFormSort = "frequency-desc",
) {
  const target = normalize(query);
  return forms
    .map((form) => ({
      form,
      isSearch: normalize(form.form) === target || normalize(form.normalized_form) === target,
      frequency: wordFormFrequency(frequencies[form.normalized_form]),
    }))
    .sort((a, b) => {
      if (a.isSearch !== b.isSearch) return a.isSearch ? -1 : 1;
      if (sort === "az" || sort === "za")
        return (
          (sort === "za" ? -1 : 1) *
          normalize(a.form.form).localeCompare(normalize(b.form.form), "en")
        );
      if (a.frequency === null || b.frequency === null) {
        if (a.frequency !== b.frequency) return a.frequency === null ? 1 : -1;
      } else if (a.frequency !== b.frequency)
        return (sort === "frequency-asc" ? 1 : -1) * (a.frequency - b.frequency);
      return normalize(a.form.form).localeCompare(normalize(b.form.form), "en");
    });
}
export async function loadFamilySearchGroups(
  repository: HkeleRepository,
  families: FamilyRecord[],
): Promise<FamilySearchGroup[]> {
  return Promise.all(
    families.map(async (family) => {
      const [detail, frequency] = await Promise.all([
        repository.getFamily(family.baseword_key),
        repository.getWordFormFrequencies
          ? repository.getWordFormFrequencies(family.baseword_key).then(
              (value) => ({ value, unavailable: false }),
              () => ({ value: {}, unavailable: true }),
            )
          : Promise.resolve({ value: {}, unavailable: true }),
      ]);
      return {
        ...detail,
        frequencies: frequency.value,
        frequencyUnavailable: frequency.unavailable,
      };
    }),
  );
}
