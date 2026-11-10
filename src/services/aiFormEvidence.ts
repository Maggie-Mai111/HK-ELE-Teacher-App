import {viewAllowsForm} from "./wordView";
import { gunzipSync, strFromU8 } from "fflate";
import release from "../config/aiFormEvidence.json";
import type { FormRecord } from "../domain/hkele";
import { teacherFormRecord } from "./externalLevelPresentation";
import { readInstalledData } from "./offline/offlineStorage.web";

export interface AiFormEvidence {
  schemaVersion: string;
  dataVersion: string;
  sourceManifestSha256: string;
  familyCount: number;
  formCount: number;
  fields: string[];
  strings: string[];
  families: Record<string, unknown[][]>;
}
export function aiEvidenceForms(document: AiFormEvidence, key: string): FormRecord[] {
  return (document.families[key] ?? []).map((row) => {
    const item = Object.fromEntries(
      document.fields.map((field, index) => {
        const value = row[index];
        return [
          field,
          field !== "form" && typeof value === "number" && value < 0
            ? document.strings[-value - 1]
            : (value ?? null),
        ];
      }),
    );
    return teacherFormRecord({
      ...item,
      baseword_key: key,
      normalized_form: String(item.form).toLowerCase(),
      form_key: null,
    } as FormRecord);
  }).filter(form=>viewAllowsForm(key,form.normalized_form));
}
let loading: Promise<AiFormEvidence> | null = null;
export function loadAiFormEvidence(dataVersion: string): Promise<AiFormEvidence> {
  if (dataVersion !== release.dataVersion)
    return Promise.reject(new Error("Word filters need the current wordlist."));
  loading ??= (async () => {
    const url = "/HK-ELE-Teacher-App/assets/" + release.path;
    const response = (await readInstalledData(url)) ?? (await fetch(url, { cache: "force-cache" }));
    if (!response.ok) throw new Error("Word filters need downloading.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== release.sha256) throw new Error("Word filter evidence changed.");
    const document = JSON.parse(strFromU8(gunzipSync(bytes))) as AiFormEvidence;
    if (
      document.schemaVersion !== "HK_ELE_AI_FORM_EVIDENCE_V1" ||
      document.dataVersion !== release.dataVersion ||
      document.sourceManifestSha256 !== release.sourceManifestSha256 ||
      document.familyCount !== release.familyCount ||
      document.formCount !== release.formCount
    )
      throw new Error("Word filter evidence belongs to another wordlist.");
    return document;
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}
