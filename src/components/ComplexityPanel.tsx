import { StyleSheet, Text, View } from "react-native";

import type { ResolvedOccurrence } from "../domain/hkele";
import { estimateTextComplexity, READABILITY_MIN_WORDS } from "../services/readabilityService";
import { colors, spacing } from "../theme/tokens";

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
      <Text accessibilityRole="header" style={styles.title}>
        Estimated text complexity
      </Text>
      <Text style={styles.meta}>
        {value.words} recognized English words · {value.sentences} sentences · {value.syllables}{" "}
        estimated syllables
      </Text>
      {value.status === "TOO_SHORT" ? (
        <Text style={styles.notice}>
          Enter at least {READABILITY_MIN_WORDS} recognized English words for a less unstable
          estimate.
        </Text>
      ) : (
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{value.fleschReadingEase?.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Flesch Reading Ease</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{value.fleschKincaidGrade?.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Flesch–Kincaid Grade</Text>
          </View>
        </View>
      )}
      <Text style={styles.note}>
        Transparent formula estimate only—not Lexile or a Lexile proxy. Sentence splitting and
        syllable counting are heuristic; suitability still depends on the reader, text and task.
      </Text>
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
  meta: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  metric: {
    backgroundColor: colors.subdued,
    borderRadius: 10,
    flex: 1,
    minWidth: 130,
    padding: spacing.md,
  },
  metricLabel: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  metricValue: { color: colors.primary, fontSize: 26, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  notice: {
    backgroundColor: colors.warningSoft,
    borderRadius: 9,
    color: colors.ink,
    fontSize: 14,
    lineHeight: 21,
    padding: spacing.sm,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
});
