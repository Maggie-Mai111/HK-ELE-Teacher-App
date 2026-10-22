import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { SupplementaryExpression } from "../domain/supplementaryExpressions";
import type { TeachingListStore } from "../services/teachingListService";
import { expressionItemKey } from "../services/compoundTeaching";
import { COMPOUND_RELEASE } from "../services/compoundData";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { FeedbackPanel, type FeedbackRequest } from "./FeedbackPanel";
export function CompoundCard({
  expression,
  teaching,
  onOpenFamily,
  source = "Find words",
}: {
  expression: SupplementaryExpression;
  teaching: TeachingListStore;
  onOpenFamily: (key: string, form?: string) => void;
  source?: string;
}) {
  const [feedback, setFeedback] = useState<FeedbackRequest | null>(null);
  const added = teaching.items.some((item) => item.basewordKey === expressionItemKey(expression));
  const context = {
    product: "App/PWA" as const,
    page: source,
    word: expression.displayExpression,
    registeredForms: [expression.displayExpression],
    expressionId: expression.expressionId,
    expressionVersion: expression.sourceVersion,
    dataVersion: COMPOUND_RELEASE.dataVersion,
  };
  return (
    <View style={styles.card}>
      <Text style={styles.badge}>Compound</Text>
      <Text style={styles.word}>{expression.displayExpression}</Text>
      {expression.parts?.length ? (
        <View style={styles.parts}>
          <Text style={styles.label}>Recorded word parts</Text>
          {expression.parts.map((part, index) =>
            part.familyKey ? (
              <ActionButton
                key={index}
                kind="secondary"
                label={part.form}
                onPress={() => onOpenFamily(part.familyKey!, part.form)}
              />
            ) : (
              <Text key={index} style={styles.part}>
                {part.form}
              </Text>
            ),
          )}
        </View>
      ) : null}
      <View style={styles.actions}>
        <ActionButton
          disabled={added}
          label={added ? "Added ✓" : "Add to Teaching list"}
          onPress={() => teaching.addExpression(expression, source)}
        />
        <ActionButton
          kind="secondary"
          label="Rate this word"
          onPress={() => setFeedback({ kind: "rating", context })}
        />
        <ActionButton
          kind="secondary"
          label="Report a problem"
          onPress={() => setFeedback({ kind: "report", context })}
        />
      </View>
      <FeedbackPanel request={feedback} onClose={() => setFeedback(null)} />
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  word: { fontSize: 21, fontWeight: "800", color: colors.ink },
  badge: {
    alignSelf: "flex-start",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    padding: 6,
    borderRadius: 6,
    fontWeight: "700",
  },
  label: { width: "100%", fontSize: 15, color: colors.muted },
  parts: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  part: { fontSize: 16, color: colors.ink },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
