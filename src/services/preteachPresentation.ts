import type { PreteachSuggestion } from "./preteachService";

// Presentation only: keep the generator's eligibility, form records and priority order.
export function groupPreteachSuggestions(entries: PreteachSuggestion[]) {
  const groups = new Map<string, { key: string; family: string; forms: PreteachSuggestion[] }>();
  for (const entry of entries) {
    const group = groups.get(entry.basewordKey) ?? {
      key: entry.basewordKey,
      family: entry.displayFamily,
      forms: [],
    };
    group.forms.push(entry);
    groups.set(entry.basewordKey, group);
  }
  return [...groups.values()];
}

export function preteachEvidence(entry: PreteachSuggestion) {
  const reasons = entry.reasons;
  const primary = reasons.find(reason => reason === "You marked this use May need explaining");
  const label = (reason: string) => reason === "Listed in AWL" ? "Listed in the Academic Word List"
    : reason.startsWith("MSVL:") ? reason.replace("MSVL:", "Subject list:") : reason;
  return {
    primary: primary ? label(primary) : null,
    extra: reasons
      .filter((reason) => reason !== primary && !reason.startsWith("Appears "))
      .map(label),
  };
}
