import type { DataMode } from "../domain/hkele";

export const BUNDLED_REFERENCE_COUNT = 3430;
export const FULL_DATABASE_COUNT = 163784;

export interface DataModePresentation {
  title: string;
  shortLabel: string;
  explanation: string;
  fullDatabaseAvailable: boolean;
  worksOffline: boolean;
}

export function dataModePresentation(mode: DataMode): DataModePresentation {
  if (mode === "installed-full") {
    return {
      title: "Installed full database",
      shortLabel: "installed full database",
      explanation:
        "All 163,784 HK-ELE family records have been installed and verified on this device, so full searches remain available offline.",
      fullDatabaseAvailable: true,
      worksOffline: true,
    };
  }
  if (mode === "remote-full") {
    return {
      title: "Online full database",
      shortLabel: "online full database",
      explanation:
        "The app is checking all 163,784 HK-ELE family records online. This is not a complete local copy and requires the data service to remain available.",
      fullDatabaseAvailable: true,
      worksOffline: false,
    };
  }
  return {
    title: "Built-in Candidate + Reference",
    shortLabel: "built-in Candidate + Reference",
    explanation:
      "The built-in 3,430-family reference set works offline. A word outside this set is held for a later full-database check, not labelled unmatched.",
    fullDatabaseAvailable: false,
    worksOffline: true,
  };
}
