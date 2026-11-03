import registry from "../config/identityMigration.json";

/** A changed form cannot silently inherit the evidence of a same-named old family. */
export function savedIdentityStillApplies(
  key: string,
  forms: readonly string[],
  fromVersion: string,
  toVersion: string,
): boolean {
  if (toVersion !== registry.dataVersion || fromVersion === toVersion) return true;
  const bySource = registry.transitionsBySource as Record<string, Record<string, Record<string,string[]>>>;
  const transitions = bySource[fromVersion] ?? registry.transitions as Record<string, Record<string, string[]>>;
  const changed = transitions[key];
  return forms.every((form) => {
    const word = form.normalize("NFKC").trim().toLowerCase();
    const destinations = changed?.[word];
    return !destinations || (destinations.length === 1 && destinations[0] === key);
  });
}

export const SAVED_IDENTITY_REVIEW =
  "Saved word kept — its family has changed. Please check it in Find words.";
