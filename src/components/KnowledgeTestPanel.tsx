import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ResolvedOccurrence } from "../domain/hkele";
import {
  calculateCoverage,
  collectEligibleFamilies,
  seededKnowledgeSample,
  tokenCoverageGuidance,
  type KnowledgeFamily,
  type KnowledgeResponses,
} from "../services/knowledgeTestService";
import type { TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";

type Mode = "n10" | "n20" | "full" | null;

function percent(value: number | null): string {
  return value === null ? "Complete all questions to calculate" : `${value.toFixed(1)}%`;
}

export function KnowledgeTestPanel({
  text,
  results,
  teaching,
  onNotKnownChange,
}: {
  text: string;
  results: ResolvedOccurrence[];
  teaching: TeachingListStore;
  onNotKnownChange?: (families: KnowledgeFamily[]) => void;
}) {
  const eligible = useMemo(() => collectEligibleFamilies(results), [results]);
  const [mode, setMode] = useState<Mode>(null);
  const [responses, setResponses] = useState<KnowledgeResponses>({});
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
  const start = (next: Exclude<Mode, null>) => {
    setMode(next);
    setResponses({});
  };

  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" aria-level={3} style={styles.title}>
        Check word knowledge
      </Text>
      <Text style={styles.intro}>
        A teacher or learner can mark words as Known or Not known to estimate an unfamiliar-word
        rate. {eligible.length} unique resolved families are eligible; answers stay only in this
        current session.
      </Text>
      <Text style={styles.caution}>
        Unfamiliar words depend on the individual learner. Vocabulary coverage is not the same as
        reading comprehension.
      </Text>
      <View style={styles.actions}>
        <ActionButton
          disabled={!eligible.length}
          kind={mode === "n10" ? "primary" : "secondary"}
          label="Quick sample (10)"
          onPress={() => start("n10")}
        />
        <ActionButton
          disabled={!eligible.length}
          kind={mode === "n20" ? "primary" : "secondary"}
          label="Larger sample (20)"
          onPress={() => start("n20")}
        />
        <ActionButton
          disabled={!eligible.length}
          kind={mode === "full" ? "primary" : "secondary"}
          label="Full check"
          onPress={() => start("full")}
        />
      </View>
      {mode ? (
        <>
          {mode === "n10" ? (
            <Text style={styles.caution}>
              N=10 is a small sample and cannot accurately distinguish 95% from 98% coverage.
            </Text>
          ) : null}
          {mode === "n20" ? (
            <Text style={styles.caution}>
              N=20 is still a sample and cannot accurately measure 98% coverage.
            </Text>
          ) : null}
          {mode !== "full" && active.length < (mode === "n10" ? 10 : 20) ? (
            <Text style={styles.caution}>
              Only {active.length} eligible families were available; all were included.
            </Text>
          ) : null}
          {active.map((item, index) => {
            const answer = responses[item.basewordKey];
            return (
              <View key={item.basewordKey} style={styles.question}>
                <Text style={styles.questionNumber}>
                  Question {index + 1} of {active.length}
                </Text>
                <Text style={styles.form}>{item.actualForm}</Text>
                <Text style={styles.family}>
                  Family: {item.displayFamily} · {item.tokenCount} occurrence
                  {item.tokenCount === 1 ? "" : "s"}
                </Text>
                <Text style={styles.context}>{item.context}</Text>
                <Text style={styles.prompt}>
                  Do your students (or you) know the meaning of this word?
                </Text>
                <View style={styles.actions}>
                  <ActionButton
                    accessibilityLabel={`Known: ${item.displayFamily}`}
                    kind={answer === true ? "primary" : "secondary"}
                    label="Known"
                    onPress={() =>
                      setResponses((current) => ({ ...current, [item.basewordKey]: true }))
                    }
                  />
                  <ActionButton
                    accessibilityLabel={`Not known: ${item.displayFamily}`}
                    kind={answer === false ? "primary" : "secondary"}
                    label="Not known"
                    onPress={() =>
                      setResponses((current) => ({ ...current, [item.basewordKey]: false }))
                    }
                  />
                </View>
                {answer === false ? (
                  <View style={styles.notKnownAction}>
                    <Text style={styles.note}>Learner/teacher marked as Not known.</Text>
                    <ActionButton
                      disabled={teaching.items.some(
                        (entry) => entry.basewordKey === item.basewordKey,
                      )}
                      kind="secondary"
                      label={
                        teaching.items.some((entry) => entry.basewordKey === item.basewordKey)
                          ? "In Teaching list"
                          : "Add marked word to Teaching list"
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
              {coverage.answeredFamilies}/{coverage.totalFamilies} families answered
            </Text>
            {coverage.complete ? (
              <>
                <Text style={styles.resultLabel}>
                  {mode === "full" ? "Exact checked result" : "Sample estimate"}
                </Text>
                <Text style={styles.resultLine}>
                  Known families: {coverage.knownFamilies}/{coverage.totalFamilies} (
                  {percent(coverage.familyKnownPercent)})
                </Text>
                <Text style={styles.resultLine}>
                  Unfamiliar families: {coverage.unfamiliarFamilies}/{coverage.totalFamilies} (
                  {percent(coverage.familyUnfamiliarPercent)})
                </Text>
                <Text style={styles.resultLine}>
                  Known token coverage: {percent(coverage.tokenCoveragePercent)}
                </Text>
                <Text style={styles.resultLine}>
                  Unfamiliar token rate: {percent(coverage.unfamiliarTokenRatePercent)}
                </Text>
                {coverage.tokenCoveragePercent !== null ? (
                  <Text style={styles.guidance}>
                    {tokenCoverageGuidance(coverage.tokenCoveragePercent)}
                  </Text>
                ) : null}
                <Text style={styles.note}>
                  {mode === "full"
                    ? "This exact checked result covers eligible resolved families and their eligible tokens only. It is not an absolute unfamiliar-word rate for every item in the text."
                    : "This is an estimate from the sampled eligible families, weighted by their token occurrences in this text. It is not an exact full-text result."}
                </Text>
              </>
            ) : (
              <Text style={styles.note}>
                Continue marking every shown family. Final percentages remain hidden until this
                check is complete.
              </Text>
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
    fontSize: 14,
    lineHeight: 20,
    padding: spacing.sm,
  },
  context: { color: colors.muted, fontSize: 15, fontStyle: "italic", lineHeight: 22 },
  family: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  form: { color: colors.ink, fontSize: 23, fontWeight: "800" },
  guidance: { color: colors.ink, fontSize: 14, fontWeight: "700", lineHeight: 21 },
  intro: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  note: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  notKnownAction: { alignItems: "flex-start", gap: spacing.sm, paddingTop: spacing.xs },
  prompt: { color: colors.ink, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  question: {
    backgroundColor: colors.canvas,
    borderRadius: 12,
    gap: spacing.xs,
    padding: spacing.md,
  },
  questionNumber: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  resultLine: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  resultLabel: { color: colors.primary, fontSize: 16, fontWeight: "800", lineHeight: 23 },
  results: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    gap: spacing.xs,
    padding: spacing.md,
  },
  resultsTitle: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
});
