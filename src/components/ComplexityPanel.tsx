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
          Add at least {READABILITY_MIN_WORDS} English words for a more useful estimate.
        </Text>
      ) : (
        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{value.fleschReadingEase?.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Flesch Reading Ease</Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>{value.fleschKincaidGrade?.toFixed(1)}</Text>
            <Text style={styles.metricLabel}>Flesch–Kincaid (U.S. grade estimate)</Text>
          </View>
        </View>
      )}
      {value.status === "READY" && value.words < 100 ? (
        <Text style={styles.note}>This is a short passage; use the scores as a rough guide.</Text>
      ) : null}
      <Text style={styles.note}>Higher Reading Ease scores indicate easier text.</Text>
      <Text style={styles.note}>Use alongside your knowledge of the class.</Text>
      <ProgressiveDisclosure title="How these estimates are calculated">
        <Text style={styles.note}>
          Both formulas use average sentence length and estimated syllables per word. Flesch Reading
          Ease = 206.835 − 1.015 × words per sentence − 84.6 × syllables per word. Flesch–Kincaid =
          0.39 × words per sentence + 11.8 × syllables per word − 15.59.
        </Text>
        <Text style={styles.note}>
          The scores use estimated syllable and sentence counts and appear for texts with at least
          30 English words. They describe sentence and word length; they do not predict a Hong Kong
          class level or how well your students will understand the text.
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
  meta: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  metric: {
    backgroundColor: colors.subdued,
    borderRadius: 10,
    flex: 1,
    minWidth: 130,
    padding: spacing.md,
  },
  metricLabel: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  metricValue: { color: colors.primary, fontSize: 26, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  note: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  notice: {
    backgroundColor: colors.warningSoft,
    borderRadius: 9,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
    padding: spacing.sm,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
});
