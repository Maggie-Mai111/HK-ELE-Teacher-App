import { StyleSheet, Text, View } from "react-native";

import manifestJson from "../../data/current-manifest.json";
import { APP_VERSION } from "../config/release";
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

const rows: ReadonlyArray<[string, string]> = [
  ["Data version", manifest.dataVersion],
  ["Released", manifest.releaseDate],
  ["Candidate", manifest.counts.candidate.toLocaleString("en")],
  ["Candidate + Reference", manifest.counts.inclusiveReference.toLocaleString("en")],
  ["Full database families", manifest.counts.totalFamilies.toLocaleString("en")],
  ["Word forms", manifest.counts.forms.toLocaleString("en")],
];

export function DataVersionScreen({ repository }: { repository: HkeleRepository }) {
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" aria-level={1} style={styles.heading}>
        About HK-ELE
      </Text>
      <Text style={styles.intro}>
        Find vocabulary for your lessons using word information and evidence from English corpora
        and Hong Kong teaching materials.
      </Text>
      <DataModeNotice detailed mode={repository.getDataMode()} />
      <ProgressiveDisclosure
        title="Wordlist information"
        summary={`Updated ${manifest.releaseDate}`}
      >
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text selectable style={styles.value}>
              {value}
            </Text>
          </View>
        ))}
      </ProgressiveDisclosure>
      <DataUpdatePanel />
      <AppCard title="Privacy at a glance">
        <Text style={styles.note}>
          Text analysis and teaching lists remain on the device. Photo recognition runs on this
          device; review and edit the text before using it. Photos are not uploaded or saved by the
          App. Linked forms receive only what you submit; AI search sends your request when used.
          Review your agreement from Menu → Your data choices.
        </Text>
      </AppCard>
      <ProgressiveDisclosure title="Sources and licences">
        <Text style={styles.note}>
          The wordlist brings together word-family records, corpus frequency information and
          textbook observations. Source attributions and licence notices are included with HK-ELE.
        </Text>
      </ProgressiveDisclosure>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  heading: { color: colors.ink, fontSize: 32, fontWeight: "800", lineHeight: 39 },
  intro: { color: colors.muted, fontSize: 18, lineHeight: 27 },
  label: { color: colors.muted, flex: 1, fontSize: 16, lineHeight: 23 },
  note: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  value: { color: colors.ink, flexShrink: 1, fontSize: 16, fontWeight: "700", lineHeight: 23 },
});
