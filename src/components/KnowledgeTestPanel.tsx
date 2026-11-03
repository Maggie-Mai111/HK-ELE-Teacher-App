import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ResolvedOccurrence } from "../domain/hkele";
import {
  calculateCoverage,
  collectEligibleFamilies,
  seededKnowledgeSample,
  type KnowledgeFamily,
  type KnowledgeResponses,
} from "../services/knowledgeTestService";
import type { TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { ProgressiveDisclosure } from "./ProgressiveDisclosure";

type Mode = "n10" | "n20" | "full" | null;

function percent(value: number | null): string {
  return value === null ? "Complete all questions to calculate" : `${value.toFixed(1)}%`;
}

export function KnowledgeTestPanel({
  text,
  results,
  teaching,
  onNotKnownChange,
  onHasResponsesChange,
  onKnownChange,
}: {
  text: string;
  results: ResolvedOccurrence[];
  teaching: TeachingListStore;
  onNotKnownChange?: (families: KnowledgeFamily[]) => void;
  onHasResponsesChange?: (hasResponses: boolean) => void;
  onKnownChange?: (forms: string[]) => void;
}) {
  const eligible = useMemo(() => collectEligibleFamilies(results), [results]);
  const [mode, setMode] = useState<Mode>(null);
  const [responses, setResponses] = useState<KnowledgeResponses>({});
  const hasResponses = Object.keys(responses).length > 0;
  useEffect(() => onHasResponsesChange?.(hasResponses), [hasResponses, onHasResponsesChange]);
  useEffect(() => () => onHasResponsesChange?.(false), [onHasResponsesChange]);
  const seed = useMemo(() => `hkele:${text.length}:${text}`, [text]);

  useEffect(() => {
    setMode(null);
    setResponses({});
  }, [results]);

  const active = useMemo(() => {
    if (mode === "n10") return seededKnowledgeSample(eligible, 10, seed);
    if (mode === "n20") return seededKnowledgeSample(eligible, 20, seed);
    if (mode === "full") return eligible;
    return [];
  }, [eligible, mode, seed]);
  const coverage = calculateCoverage(active, responses);
  const notKnown = useMemo(
    () => active.filter((family) => responses[family.basewordKey] === false),
    [active, responses],
  );
  useEffect(() => onNotKnownChange?.(notKnown), [notKnown, onNotKnownChange]);
  const knownForms = useMemo(
    () =>
      active.filter((item) => responses[item.basewordKey] === true).map((item) => item.actualForm),
    [active, responses],
  );
  useEffect(() => onKnownChange?.(knownForms), [knownForms, onKnownChange]);
  const start = (next: Exclude<Mode, null>) => {
    setMode(next);
    setResponses({});
  };

  return (
    <View style={styles.box}>
      <Text style={styles.intro}>
        Mark whether your students know each word in context. Answers clear when you reopen HK-ELE
        or check another text.
      </Text>
      <ProgressiveDisclosure title="How this check works">
        <Text style={styles.note}>
          Quick checks choose 10 or 20 word families from your text. The same text gives the same
          selection each time. To include every family found, choose All matched families.
        </Text>
        <Text style={styles.note}>
          You answer one word in context for each family. Percentages cover only the displayed words
          and appearances of those spellings in the text. Words without a match, words needing a
          context check and separate compound entries are not included.
        </Text>
        <Text style={styles.note}>
          Not known puts the displayed word first in pre-teaching. Known hides that displayed word
          from automatic suggestions for this check. Other forms and meanings are not marked as
          known.
        </Text>
      </ProgressiveDisclosure>
      <View style={styles.actions}>
        <ActionButton
          disabled={!eligible.length}
          kind={mode === "n10" ? "primary" : "secondary"}
          label="Quick check (10)"
          onPress={() => start("n10")}
        />
        <ActionButton
          disabled={!eligible.length}
          kind={mode === "n20" ? "primary" : "secondary"}
          label="More words (20)"
          onPress={() => start("n20")}
        />
        <ActionButton
          disabled={!eligible.length}
          kind={mode === "full" ? "primary" : "secondary"}
          label={`All matched families (${eligible.length})`}
          onPress={() => start("full")}
        />
      </View>
      {mode ? (
        <>
          {active.map((item, index) => {
            const answer = responses[item.basewordKey];
            return (
              <View key={item.basewordKey} style={styles.question}>
                <Text style={styles.questionNumber}>
                  Question {index + 1} of {active.length}
                </Text>
                <Text style={styles.form}>{item.actualForm}</Text>
                <Text style={styles.family}>
                  Family: {item.displayFamily} · {item.actualFormTokenCount ?? item.tokenCount} occurrence
                  {(item.actualFormTokenCount ?? item.tokenCount) === 1 ? "" : "s"} of this word
                </Text>
                <Text style={styles.context}>{item.context}</Text>
                <Text style={styles.prompt}>
                  Do your students (or you) know the meaning of this word?
                </Text>
                <View style={styles.actions}>
                  <ActionButton
                    accessibilityLabel={`Known: ${item.actualForm}`}
                    kind={answer === true ? "primary" : "secondary"}
                    label="Known"
                    onPress={() =>
                      setResponses((current) => ({ ...current, [item.basewordKey]: true }))
                    }
                  />
                  <ActionButton
                    accessibilityLabel={`Not known: ${item.actualForm}`}
                    kind={answer === false ? "primary" : "secondary"}
                    label="Not known"
                    onPress={() =>
                      setResponses((current) => ({ ...current, [item.basewordKey]: false }))
                    }
                  />
                </View>
                {answer === false ? (
                  <View style={styles.notKnownAction}>
                    <Text style={styles.note}>Marked Not known</Text>
                    <ActionButton
                      disabled={teaching.items.some(
                        (entry) =>
                          entry.basewordKey === item.basewordKey &&
                          entry.selectedForms.includes(item.actualForm),
                      )}
                      kind="secondary"
                      label={
                        teaching.items.some(
                          (entry) =>
                            entry.basewordKey === item.basewordKey &&
                            entry.selectedForms.includes(item.actualForm),
                        )
                          ? "Added"
                          : "Add to selected words"
                      }
                      onPress={() =>
                        teaching.add(
                          item.family,
                          item.actualForm,
                          "Learner/teacher marked as Not known",
                        )
                      }
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
          <View accessibilityLabel="Knowledge check results" style={styles.results}>
            <Text style={styles.resultsTitle}>
              {coverage.answeredFamilies}/{coverage.totalFamilies} words answered
            </Text>
            {coverage.complete ? (
              <>
                <Text style={styles.resultLabel}>
                  {mode === "full"
                    ? `Checked words (${active.length})`
                    : `Sample of ${active.length} words from ${active.length} matched families`}
                </Text>
                <Text style={styles.resultLine}>
                  Words marked Known: {coverage.knownFamilies}/{coverage.totalFamilies} (
                  {percent(coverage.familyKnownPercent)})
                </Text>
                <Text style={styles.resultLine}>
                  Words marked Not known: {coverage.unfamiliarFamilies}/{coverage.totalFamilies} (
                  {percent(coverage.familyUnfamiliarPercent)})
                </Text>
                <Text style={styles.resultLine}>
                  Known occurrences in this check: {coverage.knownTokens}/{coverage.totalTokens} (
                  {percent(coverage.tokenCoveragePercent)})
                </Text>
                <Text style={styles.resultLine}>
                  Unfamiliar occurrences in this check:{" "}
                  {percent(coverage.unfamiliarTokenRatePercent)}
                </Text>
              </>
            ) : (
              <Text style={styles.note}>Mark the remaining words to see the results.</Text>
            )}
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  box: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  caution: {
    backgroundColor: colors.warningSoft,
    borderRadius: 9,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 23,
    padding: spacing.sm,
  },
  context: { color: colors.muted, fontSize: 17, fontStyle: "italic", lineHeight: 25 },
  family: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  form: { color: colors.ink, fontSize: 23, fontWeight: "800" },
  guidance: { color: colors.ink, fontSize: 16, fontWeight: "700", lineHeight: 24 },
  intro: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  note: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  notKnownAction: { alignItems: "flex-start", gap: spacing.sm, paddingTop: spacing.xs },
  prompt: { color: colors.ink, fontSize: 17, fontWeight: "700", lineHeight: 25 },
  question: {
    backgroundColor: colors.canvas,
    borderRadius: 12,
    gap: spacing.xs,
    padding: spacing.md,
  },
  questionNumber: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  resultLine: { color: colors.ink, fontSize: 17, lineHeight: 25 },
  resultLabel: { color: colors.primary, fontSize: 18, fontWeight: "800", lineHeight: 26 },
  results: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    gap: spacing.xs,
    padding: spacing.md,
  },
  resultsTitle: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
});
