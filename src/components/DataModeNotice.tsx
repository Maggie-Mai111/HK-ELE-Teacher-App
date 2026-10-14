import { StyleSheet, Text, View } from "react-native";

import type { DataMode } from "../domain/hkele";
import { dataModePresentation } from "../services/dataModePresentation";
import { colors, spacing } from "../theme/tokens";

export function DataModeNotice({ mode, detailed = false }: { mode: DataMode; detailed?: boolean }) {
  const value = dataModePresentation(mode);
  if (!detailed && value.fullDatabaseAvailable) return null;
  return (
    <View accessibilityLabel={`Available data: ${value.title}`} style={styles.box}>
      <Text style={styles.title}>
        {detailed ? value.title : "Using saved words. Connect to check the full wordlist."}
      </Text>
      {detailed ? <Text style={styles.note}>{value.explanation}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: "transparent",
    borderRadius: 12,
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  note: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  title: { color: colors.primary, fontSize: 14, fontWeight: "500" },
});
