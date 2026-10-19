import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { ResolvedOccurrence } from "../domain/hkele";
import { lessonChoicesFromResults } from "../services/lessonPlanning";
import type { TeachingListStore } from "../services/teachingListService";
import { selectedWordCount } from "../services/lessonSelectionPresentation";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { CurrentLesson } from "./CurrentLesson";

export function LessonWordPicker({
  results,
  teaching,
  onOpenList,
  showHeading = true,
}: {
  results: ResolvedOccurrence[];
  teaching: TeachingListStore;
  onOpenList: () => void;
  showHeading?: boolean;
}) {
  const choices = useMemo(() => lessonChoicesFromResults(results), [results]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [limit, setLimit] = useState(6);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const matches = choices.filter((choice) =>
    `${choice.selectedForms.join(" ")} ${choice.family.display_family}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  if (!choices.length) return null;
  const chosen = choices.filter((choice) => selected.has(choice.family.baseword_key));
  return (
    <View style={styles.box}>
      {showHeading ? (
        <Text accessibilityRole="header" aria-level={2} style={styles.title}>
          Choose words for this lesson
        </Text>
      ) : null}
      <Text style={styles.note}>Select words to add to your teaching list.</Text>
      <CurrentLesson teaching={teaching} />
      <TextInput
        accessibilityLabel="Find a word in this text"
        placeholder="Find a word in this text"
        value={query}
        onChangeText={(value) => {
          setQuery(value);
          setLimit(6);
        }}
        style={styles.search}
      />
      {!matches.length ? (
        <Text style={styles.note}>No matched words found. Try another word from your passage.</Text>
      ) : null}
      <View style={styles.choices}>
        {matches.slice(0, limit).map((choice) => {
          const key = choice.family.baseword_key;
          const inList = teaching.items.find((item) => item.basewordKey === key);
          const complete = choice.selectedForms.every((form) =>
            inList?.selectedForms.includes(form),
          );
          return (
            <Pressable
              key={key}
              accessibilityRole="checkbox"
              accessibilityLabel={`Select ${choice.selectedForms.join(", ")}`}
              accessibilityState={{ checked: selected.has(key) }}
              aria-checked={selected.has(key)}
              onPress={() => {
                setMessage("");
                setSelected((current) => {
                  const next = new Set(current);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                });
              }}
              style={[styles.choice, selected.has(key) && styles.selected]}
            >
              <Text aria-hidden style={styles.check}>
                {selected.has(key) ? "☑" : "☐"}
              </Text>
              <View style={styles.choiceText}>
                <Text style={styles.word}>{choice.selectedForms.join(", ")}</Text>
                <Text style={styles.note}>
                  Family: {choice.family.display_family}
                  {complete ? " · In your list" : ""}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {limit < matches.length ? (
        <ActionButton
          kind="secondary"
          label={`Show more words (${matches.length - limit} remaining)`}
          onPress={() => setLimit((value) => value + 6)}
        />
      ) : null}
      <View style={styles.actions}>
        <ActionButton
          disabled={!chosen.length || !teaching.ready}
          label={`Add selected words (${chosen.reduce((sum, choice) => sum + choice.selectedForms.length, 0)})`}
          onPress={() => {
            const result = teaching.addSelections(chosen);
            setMessage(
              result.formsAdded
                ? `${result.formsAdded} ${result.formsAdded === 1 ? "word" : "words"} added to your lesson.`
                : "These words are already in your lesson.",
            );
            setSelected(new Set());
          }}
        />
        {selected.size ? (
          <ActionButton
            kind="secondary"
            label="Clear selection"
            onPress={() => setSelected(new Set())}
          />
        ) : null}
        <ActionButton
          kind="secondary"
          label={`View teaching list (${selectedWordCount(teaching.items)})`}
          onPress={onOpenList}
        />
      </View>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.success}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 15,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { color: colors.primary, fontSize: 19, fontWeight: "800" },
  note: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  search: {
    backgroundColor: colors.canvas,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    minHeight: 46,
    fontSize: 16,
    padding: spacing.sm,
    color: colors.ink,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    flexGrow: 1,
    flexBasis: 220,
    minHeight: 54,
  },
  selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  check: { color: colors.primary, fontSize: 23 },
  choiceText: { flex: 1 },
  word: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  success: { color: colors.primary, fontSize: 15, fontWeight: "700" },
});
