import { StyleSheet, Text, View } from "react-native";

import { colors } from "../theme/tokens";

interface Props {
  label: string;
  value: string | number | null | undefined;
  tone?: "textbook" | "external" | "neutral";
}

export function EvidenceBadge({ label, value, tone = "neutral" }: Props) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <View style={[styles.badge, styles[tone]]}>
      <Text style={[styles.label, styles[`${tone}Text`]]}>{label}</Text>
      <Text style={[styles.value, styles[`${tone}Text`]]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: "baseline",
    borderRadius: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  label: { fontSize: 14, lineHeight: 21 },
  value: { fontSize: 15, fontWeight: "800", lineHeight: 21, flexShrink: 1 },
  textbook: { backgroundColor: colors.hkTopSoft },
  textbookText: { color: colors.hkTop },
  external: { backgroundColor: colors.cpbSoft },
  externalText: { color: colors.cpb },
  neutral: { backgroundColor: colors.subdued },
  neutralText: { color: colors.muted },
});
