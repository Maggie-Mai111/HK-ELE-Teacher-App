import { Directory, File, Paths } from "expo-file-system";

import { releaseConfiguration } from "../config/release";
import { BundledReferenceRepository } from "./BundledReferenceRepository";
import { HybridRepository } from "./HybridRepository";
import { StaticShardRepository } from "./StaticShardRepository";

const root = new Directory(Paths.document, "hkele-data");
const active = new Directory(root, "active");
const previous = new Directory(root, "previous");
const staging = new Directory(root, "staging");
const stateFile = new File(root, "UPDATE_STATE.json");

root.create({ intermediates: true, idempotent: true });
let recordedActiveVersion: string | null = null;
if (stateFile.exists) {
  try {
    const value = (JSON.parse(stateFile.textSync()) as { activeVersion?: unknown }).activeVersion;
    recordedActiveVersion = typeof value === "string" ? value : null;
  } catch {
    recordedActiveVersion = null;
  }
}
if (!active.exists && previous.exists && recordedActiveVersion !== null) previous.moveSync(active);
if (staging.exists) staging.delete();

const configuredDataUrl = releaseConfiguration.fullDataUrl;
const fullDataUrl = active.exists ? active.uri : configuredDataUrl;

export const repository = fullDataUrl
  ? new HybridRepository(
      new StaticShardRepository(fullDataUrl, active.exists ? "installed-full" : "remote-full"),
      new BundledReferenceRepository(),
    )
  : new BundledReferenceRepository();
