import type { DataCounts, DataManifest } from "./contracts";
import policyJson from "../config/approvedDataReleases.json";
import currentManifest from "../../data/current-manifest.json";

export interface DataReleasePolicy {
  supportedSchemaMajors: readonly number[];
  releases: Readonly<Record<string, DataCounts>>;
}
export const APPROVED_DATA_RELEASES: DataReleasePolicy = policyJson;
const REQUIRED_COUNTS = APPROVED_DATA_RELEASES.releases[currentManifest.dataVersion]!;

export function schemaMajor(version: string): number {
  const match = /^(\d+)\./.exec(version);
  if (!match?.[1]) {
    throw new Error(`Invalid schemaVersion: ${version}`);
  }
  return Number(match[1]);
}

export function assertCompatibleManifest(
  manifest: DataManifest,
  appVersion: string,
  policy: DataReleasePolicy = APPROVED_DATA_RELEASES,
): void {
  const expectedMajor = manifest.compatibilityRules.compatibleSchemaMajor;
  if (
    schemaMajor(manifest.schemaVersion) !== expectedMajor ||
    !policy.supportedSchemaMajors.includes(expectedMajor)
  ) {
    throw new Error("Incompatible data schema. Refusing to load the data package.");
  }
  if (compareVersions(appVersion, manifest.minimumAppVersion) < 0) {
    throw new Error(`App ${appVersion} is older than required ${manifest.minimumAppVersion}.`);
  }
  const required = policy.releases[manifest.dataVersion];
  if (!required)
    throw new Error("Unregistered data release. Register the approved release before loading it.");
  for (const [field, expected] of Object.entries(required)) {
    const actual = manifest.counts[field as keyof DataCounts];
    if (actual !== expected) {
      throw new Error(`Frozen control mismatch for ${field}: ${actual} != ${expected}`);
    }
  }
}

function compareVersions(left: string, right: string): number {
  const parse = (value: string) =>
    value.split(".").map((part) => Number(part.replace(/\D.*$/, "")) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return Math.sign(delta);
  }
  return 0;
}

export { REQUIRED_COUNTS };
