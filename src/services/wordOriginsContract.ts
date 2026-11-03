export interface OriginItem {
  slot: number;
  language: string | null;
  form: string;
  meaning: string | null;
}
export interface WordOrigins {
  familyKey: string;
  normalizedForm: string;
  sourceWords: string[];
  origins: OriginItem[];
}
export interface OriginShard {
  schema: string;
  version: string;
  dataVersion: string;
  records: Record<string, WordOrigins>;
}
export const originQuery = (word: string) => word.normalize("NFKC").trim().toLowerCase();
export const originBucket = (word: string) => (/^[a-z]/.test(word) ? word[0]! : "_other");
export function selectOrigins(
  shard: OriginShard,
  familyKey: string,
  word: string,
  version: string,
  dataVersion: string,
): WordOrigins | null {
  if (
    shard.schema !== "hkele-word-origins/1" ||
    shard.version !== version ||
    shard.dataVersion !== dataVersion
  )
    throw new Error("Incompatible word origins.");
  const normalized = originQuery(word);
  const record = shard.records[`${familyKey}\t${normalized}`] ?? null;
  if (
    record &&
    (record.familyKey !== familyKey ||
      record.normalizedForm !== normalized ||
      !Array.isArray(record.origins) ||
      !record.origins.length ||
      record.origins.some(
        (o) =>
          ![1, 2].includes(o.slot) ||
          typeof o.form !== "string" ||
          !o.form.trim() ||
          (o.language !== null && typeof o.language !== "string") ||
          (o.meaning !== null && typeof o.meaning !== "string"),
      ))
  )
    throw new Error("Inconsistent word origins.");
  return record;
}
