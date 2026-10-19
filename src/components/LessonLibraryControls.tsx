import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { lessonLabel } from "../services/lessonLibrary";
import type { TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";

export function LessonLibraryControls({
  teaching,
  compact = false,
}: {
  teaching: TeachingListStore;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"new" | "switch" | null>(null);
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(20);
  const matches = teaching.lessons
    .map((lesson, index) => ({ lesson, label: lessonLabel(lesson, index) }))
    .filter((item) => item.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return (
    <>
      <View style={styles.actions}>
        {!compact ? (
          <ActionButton
            kind="secondary"
            disabled={!teaching.ready}
            label="New lesson"
            onPress={() => {
              setTitle("");
              setMode("new");
            }}
          />
        ) : null}
        <ActionButton
          kind="secondary"
          disabled={!teaching.ready}
          label={compact ? "Change lesson" : `Saved lessons (${teaching.lessons.length})`}
          onPress={() => {
            setQuery("");
            setLimit(20);
            setMode("switch");
          }}
        />
      </View>
      {mode ? (
        <Modal visible transparent animationType="fade" onRequestClose={() => setMode(null)}>
          <View style={styles.backdrop}>
            <View accessibilityViewIsModal style={styles.dialog}>
              <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
              >
                <Text accessibilityRole="header" aria-level={1} style={styles.heading}>
                  {mode === "new" ? "New lesson" : "Saved lessons"}
                </Text>
                {mode === "new" ? (
                  <>
                    <Text style={styles.note}>Your current lesson stays saved.</Text>
                    <Text style={styles.label}>Lesson name (optional)</Text>
                    <TextInput
                      accessibilityLabel="New lesson name"
                      placeholder="For example: P5 · A greener school"
                      value={title}
                      onChangeText={setTitle}
                      style={styles.input}
                    />
                    <ActionButton
                      label="Create lesson"
                      disabled={!teaching.ready}
                      onPress={() => {
                        teaching.createLesson(title);
                        setMode(null);
                      }}
                    />
                  </>
                ) : (
                  <>
                    <ActionButton
                      kind="secondary"
                      label="New lesson"
                      onPress={() => {
                        setTitle("");
                        setMode("new");
                      }}
                    />
                    {teaching.lessons.length > 5 ? (
                      <TextInput
                        accessibilityLabel="Find a saved lesson"
                        placeholder="Find a saved lesson"
                        value={query}
                        onChangeText={(value) => {
                          setQuery(value);
                          setLimit(20);
                        }}
                        style={styles.input}
                      />
                    ) : null}
                    {matches.slice(0, limit).map(({ lesson, label }) => {
                      const count = lesson.items.reduce(
                        (sum, item) => sum + item.selectedForms.length,
                        0,
                      );
                      return (
                        <View key={lesson.id} style={styles.lesson}>
                          <Text style={styles.label}>{label}</Text>
                          <Text style={styles.note}>
                            {count} {count === 1 ? "word" : "words"}
                            {lesson.id === teaching.activeLessonId ? " · Current lesson" : ""}
                          </Text>
                          <ActionButton
                            kind="secondary"
                            label={`Open lesson ${label}`}
                            onPress={() => {
                              teaching.switchLesson(lesson.id);
                              setMode(null);
                            }}
                          />
                        </View>
                      );
                    })}
                    {!matches.length ? (
                      <Text style={styles.note}>No lessons found. Try another name.</Text>
                    ) : null}
                    {limit < matches.length ? (
                      <ActionButton
                        kind="secondary"
                        label="Show more lessons"
                        onPress={() => setLimit((value) => value + 20)}
                      />
                    ) : null}
                  </>
                )}
                <ActionButton kind="secondary" label="Cancel" onPress={() => setMode(null)} />
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  dialog: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "90%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: "hidden",
  },
  content: { padding: spacing.lg, gap: spacing.md },
  heading: { fontSize: 25, lineHeight: 32, fontWeight: "800", color: colors.ink },
  note: { fontSize: 15, lineHeight: 22, color: colors.muted },
  label: { fontSize: 17, lineHeight: 24, fontWeight: "700", color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    fontSize: 17,
    color: colors.ink,
    padding: spacing.sm,
    minHeight: 48,
    backgroundColor: colors.canvas,
  },
  lesson: {
    padding: spacing.md,
    borderRadius: 12,
    gap: spacing.sm,
    backgroundColor: colors.canvas,
  },
});
