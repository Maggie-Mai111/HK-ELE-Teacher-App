import { StyleSheet, Text, View } from "react-native";

import { AppCard } from "../components/AppCard";
import { colors, spacing } from "../theme/tokens";

export function HomeScreen() {
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={styles.heading}>
        HK-ELE Teacher
      </Text>
      <Text style={styles.intro}>
        A mobile workspace for exploring the HK-ELE lexical database and planning vocabulary
        support.
      </Text>
      <AppCard title="Teacher workspace">
        <Text style={styles.body}>
          Find words, Check a text and Teaching list use the registered HK-ELE evidence and preserve
          the existing data contract.
        </Text>
      </AppCard>
      <AppCard title="Available offline">
        <Text style={styles.body}>
          Candidate + Reference data remains available after the PWA has completed one online load.
          Full-database checks remain online-only.
        </Text>
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  content: { gap: spacing.md, padding: spacing.lg },
  heading: { color: colors.ink, fontSize: 34, fontWeight: "800", lineHeight: 41 },
  intro: { color: colors.muted, fontSize: 19, lineHeight: 28, marginBottom: spacing.sm },
});
