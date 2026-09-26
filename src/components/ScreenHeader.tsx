import { StyleSheet, Text, View } from "react-native";

import { colors, spacing } from "../theme/tokens";

interface Props {
  title: string;
  intro: string;
}

export function ScreenHeader({ title, intro }: Props) {
  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" aria-level={1} style={styles.heading}>
        {title}
      </Text>
      <Text style={styles.intro}>{intro}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs },
  heading: { color: colors.ink, fontSize: 31, fontWeight: "800", lineHeight: 38 },
  intro: { color: colors.muted, fontSize: 16, lineHeight: 24 },
});
