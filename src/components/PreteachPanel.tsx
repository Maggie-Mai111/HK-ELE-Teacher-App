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
import { selectedWordCount } from "../services/lessonSelectionPresentation";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { ChoiceChip } from "./ChoiceChip";

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
  onOpenFamily: (key: string, surface: string) => void;
  onOpenList: () => void;
}
export function PreteachPanel({
  text,
  results,
  teaching,
  notKnownFamilies = [],
  onOpenFamily,
  onOpenList,
}: Props) {
  const [classLevel, setClassLevel] = useState<ClassLevel | null>(null);
  const [chooseLevel, setChooseLevel] = useState(false);
  const [limit, setLimit] = useState(4);
  const generated = useMemo(
    () => generatePreteachSuggestions(text, results, classLevel),
    [text, results, classLevel],
  );
  useEffect(() => setLimit(4), [results]);
  const direct = notKnownFamilies.filter(
    (item) => !item.family.blocked && !item.family.display_blocked,
  );
  const directKeys = new Set(direct.map((item) => item.basewordKey));
  const entries: Array<PreteachSuggestion & { marked?: boolean }> = [
    ...direct.map((item) => ({
      basewordKey: item.basewordKey,
      displayFamily: item.displayFamily,
      actualForm: item.actualForm,
      occurrences: item.tokenCount,
      family: item.family,
      reasons: ["Marked Not known"],
      marked: true,
    })),
    ...generated.filter((item) => !directKeys.has(item.basewordKey)),
  ];
  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" aria-level={2} style={styles.title}>
        Suggested words for pre-teaching
      </Text>
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
      {!entries.length ? (
        <Text style={styles.note}>
          No suggestions for this class level. You can choose words directly from the text.
        </Text>
      ) : null}
      {entries.slice(0, limit).map((item) => {
        const visibleReasons = [...item.reasons]
          .sort(
            (left, right) =>
              Number(right.includes("first seen at ")) - Number(left.includes("first seen at ")),
          )
          .slice(0, 2);
        const inList = teaching.items.some(
          (entry) =>
            entry.basewordKey === item.basewordKey && entry.selectedForms.includes(item.actualForm),
        );
        return (
          <View key={item.basewordKey} style={styles.item}>
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
          onPress={() => setLimit(entries.length)}
        />
      ) : null}
      {teaching.items.length ? (
        <ActionButton
          kind="secondary"
          label={`View teaching list (${selectedWordCount(teaching.items)})`}
          onPress={onOpenList}
        />
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
  levelText: { fontSize: 15, fontWeight: "700", color: colors.ink },
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
  family: { fontSize: 14, color: colors.muted },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  reason: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    backgroundColor: colors.subdued,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    overflow: "hidden",
  },
  note: { fontSize: 15, lineHeight: 22, color: colors.muted },
});
