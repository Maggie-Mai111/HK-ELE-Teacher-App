import { StyleSheet, Text, View } from "react-native";
import type { TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";
import { LessonLibraryControls } from "./LessonLibraryControls";

export function CurrentLesson({ teaching }: { teaching: TeachingListStore }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Adding to: {teaching.lessonDisplayTitle || "Your lesson"}</Text>
      <LessonLibraryControls teaching={teaching} compact />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  label: { color: colors.primary, fontSize: 15, lineHeight: 22, fontWeight: "600", flexShrink: 1 },
});
