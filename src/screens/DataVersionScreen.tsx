import { StyleSheet, Text, View } from "react-native";

import manifestJson from "../../data/current-manifest.json";
import { APP_VERSION } from "../config/release";
import { AppCard } from "../components/AppCard";
import { DataModeNotice } from "../components/DataModeNotice";
import { DataUpdatePanel } from "../components/DataUpdatePanel";
import { BUNDLED_DATA_FILE_COUNT } from "../data/bundledAssets";
import type { DataManifest } from "../domain/contracts";
import type { HkeleRepository } from "../domain/hkele";
import { assertCompatibleManifest } from "../domain/manifest";
import { colors, spacing } from "../theme/tokens";

const manifest = manifestJson as DataManifest;
assertCompatibleManifest(manifest, APP_VERSION);

const rows: ReadonlyArray<[string, string]> = [
  ["Data version", manifest.dataVersion],
  ["Schema version", manifest.schemaVersion],
  ["Released", manifest.releaseDate],
  ["Candidate", manifest.counts.candidate.toLocaleString("en")],
  ["Candidate + Reference", manifest.counts.inclusiveReference.toLocaleString("en")],
  ["Full database families", manifest.counts.totalFamilies.toLocaleString("en")],
  ["Registered forms", manifest.counts.forms.toLocaleString("en")],
  ["Bundled offline data files", String(BUNDLED_DATA_FILE_COUNT)],
];

export function DataVersionScreen({ repository }: { repository: HkeleRepository }) {
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" aria-level={1} style={styles.heading}>
        About &amp; data version
      </Text>
      <Text style={styles.intro}>
        The app checks schema compatibility and frozen population controls before loading a data
        release.
      </Text>
      <DataModeNotice detailed mode={repository.getDataMode()} />
      <AppCard title="Current bundled release">
        {rows.map(([label, value]) => (
          <View key={label} style={styles.row}>
            <Text style={styles.label}>{label}</Text>
            <Text selectable style={styles.value}>
              {value}
            </Text>
          </View>
        ))}
      </AppCard>
      <AppCard title="Interpretation">
        <Text style={styles.note}>
          “General unavailable” means that the General-source component is unavailable. It does not
          mean that the family is absent or has a frequency of zero.
        </Text>
      </AppCard>
      <DataUpdatePanel />
      <AppCard title="Privacy at a glance">
        <Text style={styles.note}>
          Text analysis and teaching lists remain on the device. The Web/PWA uses pasted or typed
          text and does not show camera controls. On-device image OCR appears only in a native build
          that actually supports it; images are not retained by the App. Data-update requests do not
          include classroom content. See PRIVACY_ZH.md for the full statement.
        </Text>
      </AppCard>
      <AppCard title="Licence and data sources">
        <Text style={styles.note}>
          Licence notices and source attribution remain part of this release in
          THIRD_PARTY_NOTICES.md and DATA_PROVENANCE.md. Full privacy terms remain in PRIVACY_ZH.md.
        </Text>
      </AppCard>
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
