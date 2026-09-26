import { StyleSheet, Text, View } from "react-native";

import type { DataMode } from "../domain/hkele";
import { dataModePresentation } from "../services/dataModePresentation";
import { colors, spacing } from "../theme/tokens";

export function DataModeNotice({ mode, detailed = false }: { mode: DataMode; detailed?: boolean }) {
  const value = dataModePresentation(mode);
  return (
    <View accessibilityLabel={`Available data: ${value.title}`} style={styles.box}>
      <Text style={styles.title}>Database status: {value.title}</Text>
      {detailed ? <Text style={styles.note}>{value.explanation}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    gap: spacing.xs,
    padding: spacing.md,
  },
  note: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  title: { color: colors.primary, fontSize: 16, fontWeight: "800" },
});
