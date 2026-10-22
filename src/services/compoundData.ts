import { gunzipSync, strFromU8 } from "fflate";
import release from "../config/compoundRelease.json";
import type { SupplementaryExpression } from "../domain/supplementaryExpressions";
import { readInstalledData } from "./offline/offlineStorage.web";

export const COMPOUND_RELEASE = release;
const root = `/HK-ELE-Teacher-App/assets/compounds/${release.expressionVersion}/`;
export const normalizeCompound = (word: string) => word.normalize("NFKC").trim().toLowerCase();
export const canonicalCompoundManifestBytes = (raw: Uint8Array) =>
  new TextEncoder().encode(strFromU8(raw).replace(/\r\n/g, "\n"));
const hash = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>)),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
interface Descriptor {
  productDataVersion: string;
  expressionDataVersion: string;
  files: Record<string, { sha256: string; bytes: number }>;
}
let descriptor: Promise<Descriptor> | null = null;
const shards = new Map<string, Promise<Record<string, SupplementaryExpression>>>();
async function bytes(path: string): Promise<Uint8Array> {
  const response =
    (await readInstalledData(root + path)) ?? (await fetch(root + path, { cache: "force-cache" }));
  if (!response.ok) throw new Error("Compound words need downloading.");
  return new Uint8Array(await response.arrayBuffer());
}
async function manifest(): Promise<Descriptor> {
  descriptor ??= (async () => {
    const raw = await bytes("manifest.json");
    if ((await hash(canonicalCompoundManifestBytes(raw))) !== release.manifestSha256)
      throw new Error("Compound data changed.");
    const value = JSON.parse(strFromU8(raw)) as Descriptor;
    if (
      value.productDataVersion !== release.dataVersion ||
      value.expressionDataVersion !== release.expressionVersion
    )
      throw new Error("Incompatible compound data.");
    return value;
  })().catch((error) => {
    descriptor = null;
    throw error;
  });
  return descriptor;
}
export async function lookupCompound(
  word: string,
  dataVersion = release.dataVersion,
): Promise<SupplementaryExpression | null> {
  const normalized = normalizeCompound(word);
  if (!/^\p{L}+$/u.test(normalized)) return null;
  if (dataVersion !== release.dataVersion)
    throw new Error("Compound data belongs to another wordlist.");
  const bucket = /^[a-z]/.test(normalized) ? normalized[0]! : "_other";
  if (!shards.has(bucket))
    shards.set(
      bucket,
      (async () => {
        const info = (await manifest()).files[bucket + ".json.gz"];
        const raw = await bytes(bucket + ".json.gz");
        if (!info || raw.length !== info.bytes || (await hash(raw)) !== info.sha256)
          throw new Error("Compound words need downloading again.");
        return JSON.parse(strFromU8(gunzipSync(raw))) as Record<string, SupplementaryExpression>;
      })().catch((error) => {
        shards.delete(bucket);
        throw error;
      }),
    );
  const record = (await shards.get(bucket)!)[normalized] ?? null;
  if (
    record &&
    (record.kind !== "COMPOUND" ||
      record.normalizedExpression !== normalized ||
      record.sourceVersion !== release.expressionVersion)
  )
    throw new Error("Inconsistent compound record.");
  return record;
}
