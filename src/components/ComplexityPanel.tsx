import { StyleSheet, Text, View } from "react-native";

import type { ResolvedOccurrence } from "../domain/hkele";
import { estimateTextComplexity, READABILITY_MIN_WORDS } from "../services/readabilityService";
import { colors, spacing } from "../theme/tokens";
import { ProgressiveDisclosure } from "./ProgressiveDisclosure";

export function ComplexityPanel({
  text,
  results,
}: {
  text: string;
  results: ResolvedOccurrence[];
}) {
  const value = estimateTextComplexity(
    text,
    results.filter((item) => item.tokenStatus === "SUPPORTED_TOKEN").map((item) => item.surface),
  );
  return (
    <View style={styles.box}>
      <Text style={styles.meta}>
        {value.words} English words · {value.sentences} {value.sentences === 1 ? "sentence" : "sentences"}
      </Text>
      {value.status === "TOO_SHORT" ? (
        <Text style={styles.notice}>
          Use a passage with at least {READABILITY_MIN_WORDS} English words to see the scores.
        </Text>
      ) : (
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{value.fleschReadingEase?.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Reading ease</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{value.fleschKincaidGrade?.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Approx. US grade</Text>
          </View>
        </View>
      )}
      {value.status === "READY" && value.words < 100 ? (
        <Text style={styles.note}>This is a short passage; use the scores as a rough guide.</Text>
      ) : null}
      {value.status === "READY" ? <>
        <Text style={styles.note}>A higher reading ease score suggests easier reading. The grade uses the US school scale.</Text>
      </> : null}
      <ProgressiveDisclosure title="How these scores work">
        <Text style={styles.note}>
          Flesch Reading Ease and Flesch–Kincaid use sentence length and the estimated number of syllables per word. Use the scores alongside your own reading of the text.
        </Text>
      </ProgressiveDisclosure>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  meta: { color: colors.muted, fontSize: 18, lineHeight: 26 },
  metric: {
    backgroundColor: colors.subdued,
    borderRadius: 10,
    flex: 1,
    minWidth: 130,
    padding: spacing.md,
  },
  metricLabel: { color: colors.muted, fontSize: 18, lineHeight: 26 },
  metricValue: { color: colors.primary, fontSize: 26, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  note: { color: colors.muted, fontSize: 18, lineHeight: 26 },
  notice: {
    backgroundColor: colors.warningSoft,
    borderRadius: 9,
    color: colors.ink,
    fontSize: 18,
    lineHeight: 26,
    padding: spacing.sm,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
});
