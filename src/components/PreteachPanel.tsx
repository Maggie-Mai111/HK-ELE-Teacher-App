import { CopySelectedWords } from "./CopySelectedWords";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ResolvedOccurrence } from "../domain/hkele";
import type { KnowledgeFamily } from "../services/knowledgeTestService";
import {
  generatePreteachSuggestions,
  type ClassLevel,
  type PreteachSuggestion,
} from "../services/preteachService";
import type { TeachingListStore } from "../services/teachingListService";
import { normalizeCpbSurface } from "../services/cpbService";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { ChoiceChip } from "./ChoiceChip";
import { ProgressiveDisclosure } from "./ProgressiveDisclosure";

const levels: ClassLevel[] = ["P1", "P2", "P3", "P4", "P5", "P6", "S1", "S2", "S3"];
function reasonLabel(reason: string): string {
  if (reason === "Registered morphology available") return "Word parts available";
  if (reason === "AWL evidence") return "Academic vocabulary (AWL)";
  if (reason === "MSVL / subject evidence") return "Subject vocabulary";
  if (reason === "Outside HK Top 2k") return "Beyond HK Top 2k";
  if (reason === "Outside HK Top 1k") return "Beyond HK Top 1k";
  if (reason.startsWith("Word first seen at "))
    return reason.replace("Word first seen at ", "Textbooks: ");
  if (reason.startsWith("Family first seen at "))
    return reason.replace("Family first seen at ", "Family first seen: ");
  return reason;
}
interface Props {
  text: string;
  results: ResolvedOccurrence[];
  teaching: TeachingListStore;
  notKnownFamilies?: KnowledgeFamily[];
  knownForms?: string[];
  onOpenFamily: (key: string, surface: string) => void;
  onOpenList: () => void;
}
export function PreteachPanel({
  text,
  results,
  teaching,
  notKnownFamilies = [],
  knownForms = [],
  onOpenFamily,
  onOpenList,
}: Props) {
  const [classLevel, setClassLevel] = useState<ClassLevel | null>(null);
  const [chooseLevel, setChooseLevel] = useState(false);
  const [limit, setLimit] = useState(4);
  const [expandedWords, setExpandedWords] = useState<Set<string>>(() => new Set());
  const generated = useMemo(
    () =>
      generatePreteachSuggestions(text, results, classLevel, Infinity, {
        knownForms: new Set(knownForms.map(normalizeCpbSurface)),
        notKnownForms: new Set(
          notKnownFamilies.map((item) => normalizeCpbSurface(item.actualForm)),
        ),
      }),
    [text, results, classLevel, knownForms, notKnownFamilies],
  );
  useEffect(() => setLimit(4), [results]);
  const entries: PreteachSuggestion[] = generated;
  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" aria-level={2} style={styles.title}>
        Suggested words for pre-teaching
      </Text>
      <ProgressiveDisclosure title="How these words are chosen">
        <Text style={styles.note}>
          Suggestions include words first seen in textbooks after your class level, words listed
          in AWL or MSVL, and words outside the 1,000 most frequent HK families. Use
          these clues to choose what your class needs.
        </Text>
        <Text style={styles.note}>
          Words marked Not known come first, followed by words first seen in textbooks after your
          class level. Within each group, words repeated more often come first; ties follow their
          order in your text. Known applies only to the spelling shown in this check.
        </Text>
        <Text style={styles.note}>
          Repetition helps order suggestions; it does not make a word a suggestion on its own.
          All matched words remain available in your text.
        </Text>
      </ProgressiveDisclosure>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={classLevel ? `Class level: ${classLevel}` : "Class level (optional)"}
        accessibilityState={{ expanded: chooseLevel }}
        aria-expanded={chooseLevel}
        onPress={() => setChooseLevel(!chooseLevel)}
        style={styles.levelButton}
      >
        <Text style={styles.levelText}>
          {classLevel ? `Class level: ${classLevel}` : "Class level (optional)"} ▾
        </Text>
      </Pressable>
      {chooseLevel ? (
        <View style={styles.actions}>
          <ChoiceChip
            label="Any level"
            selected={classLevel === null}
            onPress={() => {
              setClassLevel(null);
              setChooseLevel(false);
              setLimit(4);
            }}
          />
          {levels.map((level) => (
            <ChoiceChip
              key={level}
              label={level}
              selected={classLevel === level}
              onPress={() => {
                setClassLevel(level);
                setChooseLevel(false);
                setLimit(4);
              }}
            />
          ))}
        </View>
      ) : null}
      {classLevel && entries.some((item) => item.laterThanClass) ? (
        <Text style={styles.note}>
          {`${entries.filter((item) => item.laterThanClass).length} ${entries.filter((item) => item.laterThanClass).length === 1 ? "word" : "words"} first seen after ${classLevel}. `}
          Use your knowledge of the class to decide which words need teaching.
        </Text>
      ) : null}
      {!entries.length ? (
        <Text style={styles.note}>
          No suggestions for this text. You can choose matched words directly from the text.
        </Text>
      ) : null}
      {entries.slice(0, limit).map((item) => {
        const visibleReasons = item.reasons.slice(0, 2);
        const inList = teaching.items.some(
          (entry) =>
            entry.basewordKey === item.basewordKey && entry.selectedForms.includes(item.actualForm),
        );
        return (
          <View key={item.selectionKey} style={styles.item}>
            <View style={styles.itemTop}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.actualForm} word information`}
                onPress={() => onOpenFamily(item.basewordKey, item.actualForm)}
                style={styles.wordButton}
              >
                <Text style={styles.word}>{item.actualForm}</Text>
                {item.displayFamily.toLocaleLowerCase() !== item.actualForm.toLocaleLowerCase() ? (
                  <Text style={styles.family}>Family: {item.displayFamily}</Text>
                ) : null}
              </Pressable>
              <ActionButton
                kind="secondary"
                disabled={inList || !teaching.ready}
                label={inList ? "Added" : "Add"}
                onPress={() =>
                  teaching.add(
                    item.family,
                    item.actualForm,
                    item.marked ? "Learner/teacher marked as Not known" : "Pre-teaching review",
                  )
                }
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Why ${item.actualForm}?`}
              accessibilityState={{ expanded: expandedWords.has(item.selectionKey) }}
              aria-expanded={expandedWords.has(item.selectionKey)}
              onPress={() =>
                setExpandedWords((current) => {
                  const next = new Set(current);
                  if (next.has(item.selectionKey)) next.delete(item.selectionKey);
                  else next.add(item.selectionKey);
                  return next;
                })
              }
            >
              <Text style={styles.note}>
                {expandedWords.has(item.selectionKey) ? "Hide reasons" : "Why this word?"}
              </Text>
            </Pressable>
            {expandedWords.has(item.selectionKey) ? (
              <Text style={styles.note}>{item.reasons.join(" · ")}</Text>
            ) : null}
            <View style={styles.reasons}>
              {visibleReasons.map((reason) => (
                <Text key={reason} style={styles.reason}>
                  {reasonLabel(reason)}
                </Text>
              ))}
            </View>
          </View>
        );
      })}
      {limit < entries.length ? (
        <ActionButton
          kind="secondary"
          label={`Show ${entries.length - limit} more suggestions`}
          onPress={() => setLimit((value) => Math.min(entries.length, value + 20))}
        />
      ) : null}
      {teaching.items.length ? (
        <CopySelectedWords key={teaching.activeLessonId} items={teaching.items} onReview={onOpenList} />
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 20, lineHeight: 27, fontWeight: "800", color: colors.primary },
  levelButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.subdued,
  },
  levelText: { fontSize: 17, fontWeight: "700", color: colors.ink },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  item: { backgroundColor: colors.canvas, borderRadius: 12, padding: spacing.sm, gap: spacing.xs },
  itemTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  wordButton: { flex: 1, minHeight: 44, justifyContent: "center" },
  word: { fontSize: 19, fontWeight: "800", color: colors.ink },
  family: { fontSize: 16, color: colors.muted },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  reason: {
    fontSize: 16,
    lineHeight: 23,
    color: colors.muted,
    backgroundColor: colors.subdued,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    overflow: "hidden",
  },
  note: { fontSize: 17, lineHeight: 25, color: colors.muted },
});
