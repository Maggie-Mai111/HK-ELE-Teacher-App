import { File } from "expo-file-system";
import { gunzipSync, strFromU8 } from "fflate";

export async function loadGzipJson<T>(url: string): Promise<T> {
  let bytes: Uint8Array;
  if (url.startsWith("file:")) {
    const file = new File(url);
    if (!file.exists) throw new Error(`Local data file unavailable: ${url}`);
    bytes = await file.bytes();
  } else {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) throw new Error(`Data file unavailable (${response.status}): ${url}`);
    bytes = new Uint8Array(await response.arrayBuffer());
  }
  return JSON.parse(strFromU8(gunzipSync(bytes))) as T;
}

export function inflateRecord<T>(fields: string[], row: unknown[]): T {
  return Object.fromEntries(fields.map((field, index) => [field, row[index] ?? null])) as T;
}
