import { StyleSheet, Text, View } from "react-native";

import type { FormRecord } from "../domain/hkele";
import { safeMorphologySegments } from "../services/morphologyService";
import { colors, spacing } from "../theme/tokens";

export function SafeMorphologyForm({ form }: { form: FormRecord }) {
  const segments = safeMorphologySegments(form);
  if (!segments) return <Text style={styles.plain}>{form.form}</Text>;
  return (
    <View
      accessibilityLabel={`${form.form}; safely segmented registered morphology`}
      style={styles.box}
    >
      <Text style={styles.word}>
        {segments.map((segment, index) => (
          <Text key={`${segment.kind}-${index}`} style={styles[segment.kind]}>
            {segment.text}
          </Text>
        ))}
      </Text>
      <Text style={styles.labels}>
        {segments.map((segment) => `${segment.kind}: ${segment.text}`).join(" · ")}
      </Text>
    </View>
  );
}

export function MorphologyLegend() {
  return (
    <View style={styles.legend}>
      <Text style={[styles.legendItem, styles.prefix]}>Prefix</Text>
      <Text style={[styles.legendItem, styles.root]}>Root</Text>
      <Text style={[styles.legendItem, styles.suffix]}>Suffix</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.subdued,
    borderRadius: 8,
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  labels: { color: colors.muted, fontSize: 10 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  legendItem: { borderBottomWidth: 3, fontSize: 12, fontWeight: "800", paddingBottom: 2 },
  plain: {
    backgroundColor: colors.subdued,
    borderRadius: 8,
    color: colors.ink,
    fontSize: 15,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  prefix: { borderBottomColor: colors.morphologyPrefix, color: colors.morphologyPrefix },
  root: { borderBottomColor: colors.morphologyRoot, color: colors.morphologyRoot },
  suffix: { borderBottomColor: colors.morphologySuffix, color: colors.morphologySuffix },
  word: { fontSize: 16, fontWeight: "800" },
});
