import { gunzipSync, strFromU8 } from "fflate";

export async function loadGzipJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) throw new Error(`Data file unavailable (${response.status}): ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return JSON.parse(strFromU8(gunzipSync(bytes))) as T;
}

export function inflateRecord<T>(fields: string[], row: unknown[]): T {
  return Object.fromEntries(fields.map((field, index) => [field, row[index] ?? null])) as T;
}
