import { useState, type ReactNode } from "react";
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

export function TextReviewActions({ tools, saveAction }: { tools: TextReviewTools; saveAction?: ReactNode }) {
  const [answer, setAnswer] = useState(tools.getKnown);
  function mark(value: boolean | undefined) {
    setAnswer(value);
    tools.onJudge(value);
  }
  const clearMark = answer === undefined ? null : (
    <ActionButton label="Clear mark" kind="secondary" onPress={() => mark(undefined)} />
  );
  return <View style={styles.box}>
    <Text style={styles.title}>Do students know this use?</Text>
    <View style={styles.actions}>
      <ActionButton label="Known" kind={answer === true ? "primary" : "secondary"} onPress={() => mark(true)} />
      <ActionButton label="May need explaining" kind={answer === false ? "primary" : "secondary"} onPress={() => mark(false)} />
      {saveAction ? null : clearMark}
    </View>
    {saveAction}
    {answer !== undefined ? <Text accessibilityLiveRegion="polite" style={styles.note}>{answer ? "Marked Known in this sentence." : "Kept in Words to explain."}</Text> : null}
    {saveAction && clearMark ? <View style={styles.actions}>{clearMark}</View> : null}
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
