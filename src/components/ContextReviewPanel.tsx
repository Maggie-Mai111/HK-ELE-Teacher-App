import { StyleSheet, Text, View } from "react-native";
import type { ContextReviewSummary } from "../services/textResultPresentation";
import { colors, spacing } from "../theme/tokens";
import { AppCard } from "./AppCard";

export function ContextReviewPanel({ items }: { items: ContextReviewSummary[] }) {
  if (!items.length) return null;
  return (
    <AppCard title="Words that need a context check">
      <Text style={styles.note}>
        Check how each word is used in its sentence before choosing a word family.
      </Text>
      {items.map((item) => (
        <View key={item.key} style={styles.row}>
          <Text style={styles.form}>
            {item.displayForm} · {item.count} occurrence{item.count === 1 ? "" : "s"}
          </Text>
          <Text style={styles.note}>{item.explanation}</Text>
        </View>
      ))}
    </AppCard>
  );
}
const styles = StyleSheet.create({
  note: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  row: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  form: { color: colors.ink, fontSize: 17, fontWeight: "600", lineHeight: 24 },
});
