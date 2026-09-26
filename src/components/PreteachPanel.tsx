import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { HkeleRepository, ResolvedOccurrence } from "../domain/hkele";
import { matchCpb100 } from "../services/cpbService";
import { collectEligibleFamilies, type KnowledgeFamily } from "../services/knowledgeTestService";
import {
  generatePreteachSuggestions,
  type ClassLevel,
  type PreteachSuggestion,
} from "../services/preteachService";
import type { TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { ChoiceChip } from "./ChoiceChip";

const levels: ClassLevel[] = ["P1", "P2", "P3", "P4", "P5", "P6", "S1", "S2", "S3"];

interface Props {
  text: string;
  results: ResolvedOccurrence[];
  repository: HkeleRepository;
  teaching: TeachingListStore;
  notKnownFamilies?: KnowledgeFamily[];
}

export function PreteachPanel({
  text,
  results,
  repository,
  teaching,
  notKnownFamilies = [],
}: Props) {
  const [classLevel, setClassLevel] = useState<ClassLevel>("P4");
  const generated = useMemo(
    () => generatePreteachSuggestions(text, results, classLevel),
    [classLevel, results, text],
  );
  const [items, setItems] = useState<PreteachSuggestion[]>(generated);
  useEffect(() => setItems(generated), [generated]);

  const manualOptions = useMemo(() => {
    const selected = new Set(items.map((item) => item.basewordKey));
    return collectEligibleFamilies(results)
      .filter((item) => !selected.has(item.basewordKey) && !matchCpb100(item.actualForm))
      .slice(0, 12);
  }, [items, results]);
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    setItems(next);
  };

  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" aria-level={2} style={styles.title}>
        Words to review for possible pre-teaching
      </Text>
      <Text style={styles.intro}>
        Choose the class level. “Earliest observed” describes sampled textbook evidence, not a
        prescribed teaching year.
      </Text>
      <View style={styles.levels}>
        {levels.map((level) => (
          <ChoiceChip
            key={level}
            label={level}
            onPress={() => setClassLevel(level)}
            selected={classLevel === level}
          />
        ))}
      </View>
      <Text style={styles.note}>
        Suggestions exclude CPB 100, capitalized name-like items, unresolved, ambiguous, blocked and
        unsupported items. Ordering uses the number of displayed reasons, repetition and HK rank—no
        hidden composite score.
      </Text>
      <View style={styles.evidenceSection}>
        <Text accessibilityRole="header" aria-level={3} style={styles.sectionTitle}>
          Learner/teacher marked as Not known
        </Text>
        <Text style={styles.note}>
          Direct marks from the current Knowledge check session are kept separate from system
          suggestions and are not turned into a score.
        </Text>
        {notKnownFamilies.length ? (
          notKnownFamilies.map((item) => {
            const inList = teaching.items.some((entry) => entry.basewordKey === item.basewordKey);
            return (
              <View key={item.basewordKey} style={styles.directItem}>
                <Text style={styles.itemTitle}>
                  {item.actualForm} <Text style={styles.family}>({item.displayFamily})</Text>
                </Text>
                <ActionButton
                  disabled={inList}
                  kind="secondary"
                  label={inList ? "In Teaching list" : "Add marked word to Teaching list"}
                  onPress={() =>
                    teaching.add(
                      item.family,
                      item.actualForm,
                      "Learner/teacher marked as Not known",
                    )
                  }
                />
              </View>
            );
          })
        ) : (
          <Text style={styles.empty}>No Not known marks in this session yet.</Text>
        )}
      </View>
      <View style={styles.evidenceSection}>
        <Text accessibilityRole="header" aria-level={3} style={styles.sectionTitle}>
          System-suggested words with registered reasons
        </Text>
        <Text style={styles.note}>
          These are deterministic review suggestions, not predictions of what a learner does not
          know. No LLM selects, orders or explains them.
        </Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.empty}>
          No eligible suggestion has a registered reason for this text and class level.
        </Text>
      ) : null}
      {items.map((item, index) => {
        const inList = teaching.items.some((entry) => entry.basewordKey === item.basewordKey);
        return (
          <View key={item.basewordKey} style={styles.item}>
            <Text style={styles.itemTitle}>
              {index + 1}. {item.actualForm}{" "}
              <Text style={styles.family}>({item.displayFamily})</Text>
            </Text>
            {item.reasons.map((reason) => (
              <Text key={reason} style={styles.reason}>
                • {reason}
              </Text>
            ))}
            <View style={styles.actions}>
              <ActionButton
                disabled={inList}
                kind="secondary"
                label={inList ? "In teaching list" : "Add to teaching list"}
                onPress={() => teaching.add(item.family)}
              />
              <ActionButton
                disabled={index === 0}
                kind="secondary"
                label="Move up"
                onPress={() => move(index, -1)}
              />
              <ActionButton
                disabled={index === items.length - 1}
                kind="secondary"
                label="Move down"
                onPress={() => move(index, 1)}
              />
              <ActionButton
                kind="danger"
                label="Remove suggestion"
                onPress={() =>
                  setItems((current) =>
                    current.filter((entry) => entry.basewordKey !== item.basewordKey),
                  )
                }
              />
            </View>
          </View>
        );
      })}
      {manualOptions.length ? (
        <View style={styles.manual}>
          <Text style={styles.manualTitle}>Add another resolved family manually</Text>
          <View style={styles.actions}>
            {manualOptions.map((option) => (
              <ActionButton
                key={option.basewordKey}
                kind="secondary"
                label={`+ ${option.displayFamily}`}
                onPress={() => {
                  void repository.getFamily(option.basewordKey).then(({ family }) => {
                    setItems((current) => [
                      ...current,
                      {
                        basewordKey: option.basewordKey,
                        displayFamily: option.displayFamily,
                        actualForm: option.actualForm,
                        occurrences: option.tokenCount,
                        reasons: ["Teacher added for review"],
                        family,
                      },
                    ]);
                  });
                }}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  box: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  empty: {
    backgroundColor: colors.subdued,
    borderRadius: 9,
    color: colors.muted,
    padding: spacing.sm,
  },
  directItem: {
    alignItems: "flex-start",
    backgroundColor: colors.canvas,
    borderRadius: 12,
    gap: spacing.sm,
    padding: spacing.md,
  },
  evidenceSection: { gap: spacing.sm },
  family: { color: colors.muted, fontWeight: "600" },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  item: { backgroundColor: colors.canvas, borderRadius: 12, gap: spacing.xs, padding: spacing.md },
  itemTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  levels: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  manual: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  manualTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  note: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  reason: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", lineHeight: 24 },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
});
