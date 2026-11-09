import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ResolvedOccurrence } from "../domain/hkele";
import { occurrencesOfWord, textOccurrenceExcerpt } from "../services/textReviewService";
import { textWordAction } from "../services/textReaderService";
import { textResultStatusLabel } from "../services/textResultPresentation";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { useAppDimensions } from "./useAppDimensions";

export function TextOccurrencesModal({ surface, results, text, onClose, onOpenWord }: {
  surface: string | null;
  results: ResolvedOccurrence[];
  text: string;
  onClose: () => void;
  onOpenWord: (item: ResolvedOccurrence) => void;
}) {
  const { width, height } = useAppDimensions();
  const [limit, setLimit] = useState(12);
  useEffect(() => setLimit(12), [surface]);
  if (surface === null) return null;
  const occurrences = occurrencesOfWord(results, surface);
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}>
      <View accessibilityViewIsModal style={[styles.sheet, { width: width - 24, maxHeight: height - 32 }]}>
        <Text accessibilityRole="header" style={styles.title}>“{surface}” in your text</Text>
        <Text style={styles.note}>{occurrences.length} {occurrences.length === 1 ? "occurrence" : "occurrences"}</Text>
        <ActionButton label="Close occurrences" kind="secondary" onPress={onClose} />
        <ScrollView style={styles.scroll} contentContainerStyle={styles.entries}>
          {occurrences.slice(0, limit).map((item, index) => {
            const excerpt = textOccurrenceExcerpt(text, item);
            return <View key={item.occurrenceId} style={styles.occurrence}>
            <Text style={styles.note}>Occurrence {index + 1}</Text>
            <Text selectable style={styles.context}>{excerpt.before}<Text style={styles.matched}>{excerpt.word}</Text>{excerpt.after}</Text>
            <Text style={styles.note}>{textWordAction(item) === "family" ? `Family: ${item.owners[0]!.display_family}` : textResultStatusLabel(item)}</Text>
            <ActionButton label={`View ${item.surface}`} kind="secondary" onPress={() => { onClose(); onOpenWord(item); }} />
          </View>;})}
          {limit < occurrences.length ? <ActionButton label="Show more occurrences" kind="secondary" onPress={() => setLimit(value => value + 20)} /> : null}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: { padding: spacing.md, borderRadius: 16, backgroundColor: colors.surface, gap: spacing.sm },
  scroll: { flexShrink: 1 },
  entries: { gap: spacing.md },
  occurrence: { padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 12 },
  context: { color: colors.ink, fontSize: 19, lineHeight: 29 },
  matched: { backgroundColor: colors.primarySoft, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 22, lineHeight: 30, fontWeight: "700" },
  note: { color: colors.muted, fontSize: 17, lineHeight: 25 },
});
