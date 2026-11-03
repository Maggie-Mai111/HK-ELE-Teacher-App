import { StyleSheet, Text, View } from "react-native";

import type { UnmatchedWordSummary } from "../services/textResultPresentation";
import { colors, spacing } from "../theme/tokens";
import { AppCard } from "./AppCard";

export function UnmatchedWordsPanel({ items }: { items: UnmatchedWordSummary[] }) {
  if (items.length === 0) return null;
  return (
    <AppCard title="Words without a match">
      <Text style={styles.note}>These words were not matched in this text.</Text>
      {items.map((item) => (
        <View
          accessibilityLabel={`${item.displayForm}, ${item.count} occurrences, unmatched word to review`}
          key={item.normalizedForm}
          style={styles.row}
        >
          <View style={styles.headingRow}>
            <Text style={styles.form}>{item.displayForm}</Text>
            <Text style={styles.count}>
              {item.count} occurrence{item.count === 1 ? "" : "s"}
            </Text>
          </View>
        </View>
      ))}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  count: { color: colors.muted, fontSize: 16, fontWeight: "700" },
  explanation: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  form: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  headingRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  note: { color: colors.ink, fontSize: 17, lineHeight: 26 },
  row: {
    backgroundColor: colors.warningSoft,
    borderRadius: 10,
    gap: spacing.xs,
    padding: spacing.sm,
  },
});
