import release from "../config/wordOriginsRelease.json";
import { loadGzipJson } from "../data/gzipJson";
import { originBucket, originQuery, selectOrigins, type OriginShard } from "./wordOriginsContract";

export const WORD_ORIGINS_RELEASE = release;
const shards = new Map<string, Promise<OriginShard>>();
export async function lookupWordOrigins(familyKey: string, word: string, dataVersion: string) {
  if (dataVersion !== release.dataVersion) return null;
  const bucket = originBucket(originQuery(word));
  if (!shards.has(bucket)) {
    shards.set(
      bucket,
      loadGzipJson<OriginShard>(
        `/HK-ELE-Teacher-App/hkele-data/word-origins/${release.version}/${bucket}.json.gz`,
      ).catch((error) => {
        shards.delete(bucket);
        throw error;
      }),
    );
  }
  return selectOrigins(await shards.get(bucket)!, familyKey, word, release.version, dataVersion);
}
