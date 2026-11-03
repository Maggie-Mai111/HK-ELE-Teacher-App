import type { SurfaceSearchResult } from "../domain/hkele";

/** Family-name navigation is not evidence for a spelling in a passage. */
export function acceptedWordResolution(result: SurfaceSearchResult): SurfaceSearchResult {
  const owners = result.owners.filter(
    (owner) => !owner.match_classes.includes("FAMILY_LABEL_ONLY"),
  );
  if (owners.length === result.owners.length) return result;
  const allowed = owners.filter((owner) => !owner.blocked);
  return {
    ...result,
    owners,
    bestOwnerCount: allowed.length,
    status: allowed.length > 1 ? "AMBIGUOUS" : allowed.length ? "RESOLVED" : "UNMATCHED",
  };
}
