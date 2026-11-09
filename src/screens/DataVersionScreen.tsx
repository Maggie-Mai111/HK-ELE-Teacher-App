import { useEffect, useState } from "react";
import approved from "../config/approvedDataReleases.json";
import { StyleSheet, Text, View } from "react-native";

import manifestJson from "../../data/current-manifest.json";
import { APP_VERSION } from "../config/release";
import { FullDatabaseDownload } from "../components/FullDatabaseDownload";
import { AppCard } from "../components/AppCard";
import { DataModeNotice } from "../components/DataModeNotice";
import { DataUpdatePanel } from "../components/DataUpdatePanel";
import { ProgressiveDisclosure } from "../components/ProgressiveDisclosure";
import type { DataManifest } from "../domain/contracts";
import type { HkeleRepository } from "../domain/hkele";
import { assertCompatibleManifest } from "../domain/manifest";
import { colors, spacing } from "../theme/tokens";

const manifest = manifestJson as DataManifest;
assertCompatibleManifest(manifest, APP_VERSION);

function versionRows(version: string): ReadonlyArray<[string, string]> {
  const counts = (approved.releases as Record<string, typeof manifest.counts>)[version];
  return [
    ["90% list families", counts?.candidate.toLocaleString("en") ?? "—"],
    ["Full database families", counts?.totalFamilies.toLocaleString("en") ?? "—"],
    ["Word forms", counts?.forms.toLocaleString("en") ?? "—"],
  ];
}

export function DataVersionScreen({ repository }: { repository: HkeleRepository }) {
  const [version, setVersion] = useState(manifest.dataVersion);
  const coreCount = (approved.releases as Record<string, typeof manifest.counts>)[version]?.candidate;
  useEffect(() => {
    let active = true;
    void repository
      .getDataVersion?.()
      .then((value) => {
        if (active) setVersion(value);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [repository]);
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" aria-level={1} style={styles.heading}>
        About HK-ELE
      </Text>
      <Text style={styles.intro}>
        Explore vocabulary for your lessons using English text collections and Hong Kong
        teaching materials.
      </Text>
      <DataModeNotice detailed mode={repository.getDataMode()} />
      <ProgressiveDisclosure title="Wordlist information">
        {versionRows(version).map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text selectable style={styles.value}>
              {value}
            </Text>
          </View>
        ))}
      </ProgressiveDisclosure>
      <FullDatabaseDownload dataVersion={version} />
      <DataUpdatePanel />
      <ProgressiveDisclosure title="How to read the word information">
        <Text style={styles.note}>
          HK-ELE Word List contains {coreCount?.toLocaleString("en") ?? "—"} word families selected to cover at least 90% of the words counted in each of four Hong Kong text collections in the study.
          Choose words that fit your class and text. Full database includes more word families.
        </Text>
        <Text style={styles.note}>
          Textbook stages and US grade references describe the selected spelling. HK ranks compare
          whole word families. A textbook appearance does not establish when students know a word.
        </Text>
        <Text style={styles.note}>
          Check the words in your passage and explore compound words too. Your original text stays
          unchanged, including words without a match.
        </Text>
      </ProgressiveDisclosure>
      <AppCard title="Privacy at a glance">
        <Text style={styles.note}>
          Text analysis and selected words remain on the device. Photo recognition runs on this
          device; review and edit the text before using it. Photos are not uploaded or saved by the
          App. Linked forms receive only what you submit; AI search sends your request when used.
          Review your agreement from Menu → Your data choices.
        </Text>
      </AppCard>

    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  heading: { color: colors.ink, fontSize: 32, fontWeight: "800", lineHeight: 39 },
  intro: { color: colors.muted, fontSize: 20, lineHeight: 27 },
  label: { color: colors.muted, flex: 1, fontSize: 18, lineHeight: 26 },
  note: { color: colors.muted, fontSize: 18, lineHeight: 27 },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  value: { color: colors.ink, flexShrink: 1, fontSize: 18, fontWeight: "700", lineHeight: 26 },
});
