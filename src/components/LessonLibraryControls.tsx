import { StyleSheet, Text, View } from "react-native";
import type { TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { ProgressiveDisclosure } from "./ProgressiveDisclosure";

// Keep older collections reachable without creating or naming lessons.
export function LessonLibraryControls({ teaching }: { teaching: TeachingListStore; compact?: boolean }) {
  const previous = teaching.lessons.map((entry, index) => ({entry, index})).filter(({entry}) => entry.id !== teaching.activeLessonId && entry.items.length > 0);
  if (!previous.length) return null;
  return <ProgressiveDisclosure title="Previously saved words">
    {previous.map(({entry, index}) => {
      const count = entry.items.reduce((sum, item) => sum + item.selectedForms.length, 0);
      return <View key={entry.id} style={styles.row}>
        <Text style={styles.label}>Saved words {index + 1} · {count} {count === 1 ? "word" : "words"}</Text>
        <ActionButton label={`Open saved words ${index + 1}`} kind="secondary" disabled={!teaching.ready} onPress={() => teaching.switchLesson(entry.id)} />
      </View>;
    })}
  </ProgressiveDisclosure>;
}
const styles = StyleSheet.create({row:{gap:spacing.sm,paddingVertical:spacing.sm},label:{fontSize:18,lineHeight:26,color:colors.ink}});
