import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";

export interface TextReviewTools {
  surface: string;
  occurrenceId?: string;
  excerpt?: { before: string; word: string; after: string };
  getKnown: () => boolean | undefined;
  onJudge: (value: boolean | undefined) => void;
  onShowOccurrences: () => void;
}

export function TextReviewActions({ tools }: { tools: TextReviewTools }) {
  const [answer, setAnswer] = useState(tools.getKnown);
  function mark(value: boolean | undefined) {
    setAnswer(value);
    tools.onJudge(value);
  }
  return <View style={styles.box}>
    <Text style={styles.title}>Do students know this use?</Text>
    <View style={styles.actions}>
      <ActionButton label="Known" kind={answer === true ? "primary" : "secondary"} onPress={() => mark(true)} />
      <ActionButton label="May need explaining" kind={answer === false ? "primary" : "secondary"} onPress={() => mark(false)} />
      {answer !== undefined ? <ActionButton label="Clear mark" kind="secondary" onPress={() => mark(undefined)} /> : null}
    </View>
    {answer !== undefined ? <Text accessibilityLiveRegion="polite" style={styles.note}>{answer ? "Marked Known in this sentence." : "Kept in Words to explain."}</Text> : null}
    <Text style={styles.note}>This mark applies only here. Check other uses separately.</Text>
    <ActionButton label="View all occurrences" kind="secondary" onPress={tools.onShowOccurrences} />
  </View>;
}

const styles = StyleSheet.create({
  box: { gap: spacing.sm, paddingTop: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  title: { color: colors.ink, fontSize: 19, lineHeight: 28, fontWeight: "700" },
  note: { color: colors.muted, fontSize: 16, lineHeight: 24 },
});
