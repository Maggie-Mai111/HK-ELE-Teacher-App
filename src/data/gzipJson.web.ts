import { gunzipSync, strFromU8 } from "fflate";
import { readInstalledData } from "../services/offline/offlineStorage.web";
import integrity from "../config/staticDataIntegrity.json";

export async function loadGzipJson<T>(url: string): Promise<T> {
  const installed = await readInstalledData(url);
  const response =
    installed ??
    (await fetch(`${url}${url.includes("?") ? "&" : "?"}v=${integrity.dataVersion}`, {
      cache: "force-cache",
    }));
  if (!response.ok) throw new Error(`Data file unavailable (${response.status}): ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!installed) {
    const path = url.split("/hkele-data/")[1]?.split("?")[0];
    const expected = (integrity.files as Record<string, string>)[path ?? ""];
    if (expected) {
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const actual = Array.from(new Uint8Array(digest), (n) =>
        n.toString(16).padStart(2, "0"),
      ).join("");
      if (actual !== expected) throw new Error("The word data changed. Please reopen the App.");
    }
  }
  return JSON.parse(strFromU8(gunzipSync(bytes))) as T;
}

export function inflateRecord<T>(fields: string[], row: unknown[]): T {
  return Object.fromEntries(fields.map((field, index) => [field, row[index] ?? null])) as T;
}
