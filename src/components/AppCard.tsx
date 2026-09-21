import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

interface AppCardProps extends PropsWithChildren {
  title: string;
}

export function AppCard({ title, children }: AppCardProps) {
  return (
    <View accessibilityRole="summary" style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 27,
  },
});
