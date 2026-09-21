import type { DataManifest } from "./contracts";

const REQUIRED_COUNTS = {
  totalFamilies: 163_784,
  forms: 319_924,
  ranked: 163_570,
  unranked: 214,
  candidate: 3_185,
  inclusiveReference: 3_430,
  referenceOnly: 245,
} as const;

export function schemaMajor(version: string): number {
  const match = /^(\d+)\./.exec(version);
  if (!match?.[1]) {
    throw new Error(`Invalid schemaVersion: ${version}`);
  }
  return Number(match[1]);
}

export function assertCompatibleManifest(manifest: DataManifest, appVersion: string): void {
  const expectedMajor = manifest.compatibilityRules.compatibleSchemaMajor;
  if (schemaMajor(manifest.schemaVersion) !== expectedMajor) {
    throw new Error("Incompatible data schema. Refusing to load the data package.");
  }
  if (compareVersions(appVersion, manifest.minimumAppVersion) < 0) {
    throw new Error(`App ${appVersion} is older than required ${manifest.minimumAppVersion}.`);
  }
  for (const [field, expected] of Object.entries(REQUIRED_COUNTS)) {
    const actual = manifest.counts[field as keyof typeof REQUIRED_COUNTS];
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
