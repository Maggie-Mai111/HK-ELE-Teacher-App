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
      <AppCard title="Foundation ready">
        <Text style={styles.body}>
          This first build establishes the shared data contract, verified identity rules, offline
          Candidate + Reference package, and cross-platform app shell.
        </Text>
      </AppCard>
      <AppCard title="Coming after approval">
        <Text style={styles.body}>
          Browse, Check a Text, Teaching List, classroom review tools, and OCR are deliberately not
          included in this phase.
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
