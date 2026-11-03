import type { FamilyRecord, FormRecord } from "../domain/hkele";
import { hasFlag } from "../domain/hkele";
import {
  AI_FILTER_GRADES,
  validateAiFilterConditions,
  type AiFilterConditions,
} from "../domain/aiFilterSchema";
import type { AiFilterExecution, AiFilterExecutionContext } from "./aiFilterExecutor";
import { matchCpb100 } from "./cpbService";

export const hasAiWordConditions = (f: AiFilterConditions) =>
  [
    f.root,
    f.prefix,
    f.suffix,
    f.earliestObservedFrom,
    f.earliestObservedTo,
    f.awl,
    f.msvl,
    f.msvlSubjects,
    f.externalLevels,
    f.cpb100,
  ].some((v) => v !== undefined);
const norm = (v: unknown) =>
  String(v ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
const values = (v: unknown) =>
  norm(v)
    .split(/[|;,·/]+/)
    .map((x) => x.trim().replace(/^[-–—]+|[-–—]+$/g, ""))
    .filter(Boolean);
const includes = (v: unknown, requested: string) =>
  values(v).includes(norm(requested).replace(/^[-–—]+|[-–—]+$/g, ""));
const registered = (v: unknown) =>
  v !== null && v !== undefined && v !== "" && v !== 0 && v !== false;
const range = (v: number | null, min?: number, max?: number) =>
  (min === undefined && max === undefined) ||
  (v !== null &&
    Number.isFinite(v) &&
    (min === undefined || v >= min) &&
    (max === undefined || v <= max));

export function matchesAiWord(form: FormRecord, f: AiFilterConditions): boolean {
  if (form.lookup_only) return false;
  const grade = AI_FILTER_GRADES.indexOf(
    form.first_seen_hk_textbooks as (typeof AI_FILTER_GRADES)[number],
  );
  if (
    f.earliestObservedFrom &&
    (grade < 0 || grade < AI_FILTER_GRADES.indexOf(f.earliestObservedFrom))
  )
    return false;
  if (f.earliestObservedTo && (grade < 0 || grade > AI_FILTER_GRADES.indexOf(f.earliestObservedTo)))
    return false;
  const withheld = String(form.phase1c_evidence_withheld_fields ?? "").toLowerCase();
  for (const key of ["root", "prefix", "suffix"] as const) {
    if (f[key] && (withheld.includes(key) || !includes(form[key], f[key]!))) return false;
  }
  if (f.awl !== undefined && (form.awl === null || hasFlag(form.awl) !== f.awl)) return false;
  if (f.msvl !== undefined && (form.msvl === null || registered(form.msvl) !== f.msvl))
    return false;
  if (f.msvlSubjects && !f.msvlSubjects.some((subject) => includes(form.msvl, subject)))
    return false;
  if (
    f.externalLevels &&
    !f.externalLevels.some((level) => includes(form.external_level_reference, level))
  )
    return false;
  if (f.cpb100 !== undefined && !!matchCpb100(form.form) !== f.cpb100) return false;
  return true;
}

export function matchedWordRow(family: FamilyRecord, form: FormRecord): FamilyRecord {
  const withheld = String(form.phase1c_evidence_withheld_fields ?? "").toLowerCase();
  return {
    ...family,
    ai_match_form: form.form,
    ai_match_key: family.baseword_key + "\u0000" + norm(form.form),
    ai_source_family: family,
    browse_display_word: form.form,
    textbook_first_seen_level: form.first_seen_hk_textbooks,
    external_level_reference_display: form.external_level_reference,
    browse_external_level_reference: form.external_level_reference,
    awl: form.awl,
    msvl: form.msvl,
    browse_root: form.root,
    browse_root_meaning:
      form.root_meaning_alignment_status === "MATCHED_UNIQUE_EXACT" ? form.root_meaning : null,
    browse_prefix: withheld.includes("prefix") ? null : form.prefix,
    browse_suffix: withheld.includes("suffix") ? null : form.suffix,
  };
}

export function filterAiWordEvidence(
  context: AiFilterExecutionContext,
  proposed: unknown,
  formsFor: (key: string) => FormRecord[],
): AiFilterExecution {
  const f = validateAiFilterConditions(proposed);
  const matches: Array<{ family: FamilyRecord; form: FormRecord }> = [];
  const compareHit = (
    a: { family: FamilyRecord; form: FormRecord },
    b: { family: FamilyRecord; form: FormRecord },
  ) =>
    f.sort === "az"
      ? norm(a.form.form).localeCompare(norm(b.form.form), "en") ||
        a.family.baseword_key.localeCompare(b.family.baseword_key)
      : ((a.family[f.sort === "hk" ? "current_hk_frequency_rank" : "overall_frequency_order"] as
          number | null) ?? Number.MAX_SAFE_INTEGER) -
          ((b.family[f.sort === "hk" ? "current_hk_frequency_rank" : "overall_frequency_order"] as
            number | null) ?? Number.MAX_SAFE_INTEGER) ||
        norm(a.form.form).localeCompare(norm(b.form.form), "en");
  let matchedBeforeLimit = 0;
  for (const family of context.families) {
    if (
      hasFlag(family.display_blocked) ||
      (f.scope === "candidate" && !hasFlag(family.candidate_member)) ||
      (f.scope === "inclusive_reference" && !hasFlag(family.reference_member))
    )
      continue;
    if (
      !range(family.overall_frequency_order, f.overallRankMin, f.overallRankMax) ||
      !range(family.current_hk_frequency_rank, f.hkRankMin, f.hkRankMax)
    )
      continue;
    if (f.hkBands && !f.hkBands.includes(family.current_hk_frequency_band as never)) continue;
    for (const form of formsFor(family.baseword_key))
      if (matchesAiWord(form, f)) {
        matchedBeforeLimit++;
        const hit = { family, form };
        if (matches.length < f.limit || compareHit(hit, matches[matches.length - 1]!) < 0) {
          matches.push(hit);
          matches.sort(compareHit);
          if (matches.length > f.limit) matches.pop();
        }
      }
  }

  return {
    filters: f,
    matchedBeforeLimit,
    families: matches.slice(0, f.limit).map((x) => matchedWordRow(x.family, x.form)),
    resultUnit: "word",
  };
}
