import { StyleSheet, Text, View } from "react-native";

import type { PendingFullCheckSummary } from "../services/textResultPresentation";
import { colors, spacing } from "../theme/tokens";
import { AppCard } from "./AppCard";

export function PendingFullCheckPanel({ items }: { items: PendingFullCheckSummary[] }) {
  if (items.length === 0) return null;
  return (
    <AppCard title="Check online">
      <Text style={styles.note}>Connect to check these words.</Text>
      {items.map((item) => (
        <View key={item.normalizedForm} style={styles.row}>
          <Text style={styles.form}>{item.displayForm}</Text>
          <Text style={styles.count}>
            {item.count} occurrence{item.count === 1 ? "" : "s"}
          </Text>
        </View>
      ))}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  count: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  form: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  note: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  row: {
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderRadius: 10,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    padding: spacing.sm,
  },
});
