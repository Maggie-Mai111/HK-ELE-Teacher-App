import type { FormRecord } from "../domain/hkele";

export interface MorphologySegment {
  kind: "prefix" | "root" | "suffix";
  text: string;
}

const atomic = (value: string | null): string | null => {
  const normalized = value?.normalize("NFKC").trim().toLocaleLowerCase() ?? "";
  return /^[a-z]+$/.test(normalized) ? normalized : null;
};

export function safeMorphologySegments(form: FormRecord): MorphologySegment[] | null {
  const surface = form.normalized_form.normalize("NFKC").trim().toLocaleLowerCase();
  const prefix = atomic(form.prefix);
  const root = atomic(form.root);
  const suffix = atomic(form.suffix);
  if (
    (form.prefix?.trim() && !prefix) ||
    (form.root?.trim() && !root) ||
    (form.suffix?.trim() && !suffix)
  ) {
    return null;
  }
  if (!root || (!prefix && !suffix)) return null;
  const segments: MorphologySegment[] = [];
  if (prefix) segments.push({ kind: "prefix", text: prefix });
  segments.push({ kind: "root", text: root });
  if (suffix) segments.push({ kind: "suffix", text: suffix });
  return segments.map((segment) => segment.text).join("") === surface ? segments : null;
}
