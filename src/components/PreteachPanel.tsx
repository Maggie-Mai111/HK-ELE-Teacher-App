import { CopySelectedWords } from "./CopySelectedWords";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ResolvedOccurrence } from "../domain/hkele";
import { MarkedContext } from "./MarkedContext";
import { textOccurrenceExcerpt, type WordJudgements } from "../services/textReviewService";
import { generatePreteachSuggestions, markedOtherOccurrences, type ReviewFilter, type ClassLevel } from "../services/preteachService";
import type { TeachingListStore } from "../services/teachingListService";
import { groupPreteachSuggestions, preteachEvidence } from "../services/preteachPresentation";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { ChoiceChip } from "./ChoiceChip";
import { ProgressiveDisclosure } from "./ProgressiveDisclosure";

const levels: ClassLevel[] = ["P1", "P2", "P3", "P4", "P5", "P6", "S1", "S2", "S3"];
interface Props {
  text: string;
  results: ResolvedOccurrence[];
  teaching: TeachingListStore;
  judgements: WordJudgements;
  onOpenWord: (item: ResolvedOccurrence) => void;
  onOpenList: () => void;
}
export function PreteachPanel({
  text,
  results,
  teaching,
  judgements,
  onOpenWord,
  onOpenList,
}: Props) {
  const [classLevel, setClassLevel] = useState<ClassLevel | null>(null);
  const [chooseLevel, setChooseLevel] = useState(false);
  const [limit, setLimit] = useState(4);
  const [expandedWords, setExpandedWords] = useState<Set<string>>(() => new Set());
  const [filter, setFilter] = useState<ReviewFilter>("marked");
  const generated = useMemo(() => generatePreteachSuggestions(text, results, classLevel, Infinity, { judgements, filter }), [text, results, classLevel, judgements, filter]);
  const otherMarked = filter === "marked" ? markedOtherOccurrences(results, judgements) : [];
  useEffect(() => { setFilter("marked"); setClassLevel(null); }, [results]);
  useEffect(() => setLimit(4), [results]);
  const entries = generated;
  const families = groupPreteachSuggestions(entries);
  const reviewCards = [...families.map(group => ({...group, other: null as ResolvedOccurrence | null})),
    ...otherMarked.map(item => ({key:item.occurrenceId, family:"", forms:[] as typeof entries, other:item}))]
    .sort((a,b) => (a.other?.occurrenceOrder ?? a.forms[0]!.firstOrder) - (b.other?.occurrenceOrder ?? b.forms[0]!.firstOrder));
  const cards = filter === "marked" ? reviewCards : families.map(group => ({...group,other:null}));
  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" aria-level={2} style={styles.title}>
        Words to explain
      </Text>
      <Text style={styles.note}>Tap a word in your text and mark May need explaining to keep it here.</Text>
      <ProgressiveDisclosure title="How to choose">
        <Text style={styles.note}>Might students need help with this use? Would explaining it help them understand the text or complete the task?</Text>
        <Text style={styles.note}>Marked words are grouped by family, starting with the first marked use. Frequency, list membership and textbook stages are records to consult, not a decision about what students know. CPB100 only highlights words.</Text>
      </ProgressiveDisclosure>
      <ProgressiveDisclosure title="Browse words by records">
        <View style={styles.actions}>{([
          ["marked", "Marked by you"], ["all", "All matched words"],
          ["academic", "Academic / subject lists"], ["repeated", "Repeated words"],
          ["later", "Later textbook stages"],
        ] as const).map(([value,label]) => <ChoiceChip key={value} label={label} selected={filter===value} onPress={() => {setFilter(value);setLimit(4);}} />)}</View>
        {filter !== "marked" ? <Text style={styles.note}>Showing records from this text, most repeated words first. Choose which uses need explaining. You can also mark any word directly in the text.</Text> : null}
        {filter === "later" ? <>
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
        </> : null}
      </ProgressiveDisclosure>
      {filter === "later" && !classLevel ? <Text style={styles.note}>Choose a class level to compare first recorded textbook stages.</Text> : null}
      {!entries.length && !otherMarked.length ? <Text style={styles.note}>{filter === "marked" ? "No words marked yet. You can start by tapping a word in the text." : "No words match this filter. You can still choose words from the text."}</Text> : null}
      {cards.slice(0, limit).map(group => group.other ? (
        <View key={group.key} style={styles.item}>
          <Pressable accessibilityRole="button" onPress={() => onOpenWord(group.other!)} style={styles.wordButton}><Text style={styles.word}>{group.other.surface}</Text></Pressable>
          <Text style={styles.note}><MarkedContext excerpt={textOccurrenceExcerpt(text,group.other)} /></Text>
          <Text style={styles.reason}>You marked this use May need explaining</Text>
          <ActionButton kind="secondary" label="View" onPress={() => onOpenWord(group.other!)} />
        </View>
      ) : (
        <View key={group.key} style={styles.item}>
          {group.forms.length > 1 ? (
            <Text style={styles.family}>
              Family: {group.family} · {group.forms.length} forms in your text
            </Text>
          ) : null}
          {group.forms.map((item, index) => {
            const evidence = preteachEvidence(item);
            const inList = teaching.items.some(
              (entry) =>
                entry.basewordKey === item.basewordKey &&
                entry.selectedForms.includes(item.actualForm),
            );
            return (
              <View key={item.selectionKey} style={[styles.form, index > 0 && styles.nextForm]}>
                <View style={styles.itemTop}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${item.actualForm} word information`}
                    onPress={() => item.occurrence && onOpenWord(item.occurrence)}
                    style={styles.wordButton}
                  >
                    <Text style={styles.word}>{item.actualForm}</Text>
                    {group.forms.length === 1 &&
                    item.displayFamily.toLocaleLowerCase() !==
                      item.actualForm.toLocaleLowerCase() ? (
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
                        "Chosen from text",
                      )
                    }
                  />
                </View>
                {item.occurrence?.context ? <Text style={styles.note}><MarkedContext excerpt={textOccurrenceExcerpt(text,item.occurrence)} /></Text> : null}
                {evidence.primary ? <Text style={styles.reason}>{evidence.primary}</Text> : null}
                <Text style={styles.family}>
                  In this text: {item.occurrences} {item.occurrences === 1 ? "time" : "times"}
                </Text>
                {evidence.extra.length ? (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Word records for ${item.actualForm}`}
                      accessibilityState={{ expanded: expandedWords.has(item.selectionKey) }}
                      aria-expanded={expandedWords.has(item.selectionKey)}
                      style={styles.reasonButton}
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
                        {expandedWords.has(item.selectionKey) ? "Hide details" : "Word records"}
                      </Text>
                    </Pressable>
                    {expandedWords.has(item.selectionKey) ? (
                      <Text style={styles.note}>{evidence.extra.join(" · ")}</Text>
                    ) : null}
                  </>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
      {limit < cards.length ? (
        <ActionButton
          kind="secondary"
          label="Show more words"
          onPress={() => setLimit((value) => Math.min(cards.length, value + 20))}
        />
      ) : null}
      {teaching.items.length ? (
        <CopySelectedWords
          key={teaching.activeLessonId}
          items={teaching.items}
          onReview={onOpenList}
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
  levelText: { fontSize: 17, fontWeight: "700", color: colors.ink },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  item: { backgroundColor: colors.canvas, borderRadius: 12, padding: spacing.sm, gap: spacing.xs },
  form: { gap: spacing.xs },
  nextForm: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  reasonButton: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  itemTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  wordButton: { flex: 1, minHeight: 44, justifyContent: "center" },
  word: { fontSize: 19, fontWeight: "800", color: colors.ink },
  family: { fontSize: 16, color: colors.muted },
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
