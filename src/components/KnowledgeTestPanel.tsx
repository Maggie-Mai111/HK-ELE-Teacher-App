import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { ResolvedOccurrence } from "../domain/hkele";
import {
  calculateCoverage,
  collectEligibleFamilies,
  seededKnowledgeSample,
  tokenCoverageGuidance,
  type KnowledgeResponses,
} from "../services/knowledgeTestService";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";

type Mode = "n10" | "n20" | "full" | null;

function percent(value: number | null): string {
  return value === null ? "Complete all questions to calculate" : `${value.toFixed(1)}%`;
}

export function KnowledgeTestPanel({
  text,
  results,
}: {
  text: string;
  results: ResolvedOccurrence[];
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
  const start = (next: Exclude<Mode, null>) => {
    setMode(next);
    setResponses({});
  };

  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" aria-level={3} style={styles.title}>
        Test Word Knowledge
      </Text>
      <Text style={styles.intro}>
        {eligible.length} unique resolved families are eligible. Sampling is deterministic for this
        exact text.
      </Text>
      <View style={styles.actions}>
        <ActionButton
          disabled={!eligible.length}
          kind={mode === "n10" ? "primary" : "secondary"}
          label="Sample N=10"
          onPress={() => start("n10")}
        />
        <ActionButton
          disabled={!eligible.length}
          kind={mode === "n20" ? "primary" : "secondary"}
          label="Sample N=20"
          onPress={() => start("n20")}
        />
        <ActionButton
          disabled={!eligible.length}
          kind={mode === "full" ? "primary" : "secondary"}
          label="Full coverage check"
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
                    accessibilityLabel={`Yes, know ${item.displayFamily}`}
                    kind={answer === true ? "primary" : "secondary"}
                    label="Yes"
                    onPress={() =>
                      setResponses((current) => ({ ...current, [item.basewordKey]: true }))
                    }
                  />
                  <ActionButton
                    accessibilityLabel={`No, do not know ${item.displayFamily}`}
                    kind={answer === false ? "primary" : "secondary"}
                    label="No"
                    onPress={() =>
                      setResponses((current) => ({ ...current, [item.basewordKey]: false }))
                    }
                  />
                </View>
              </View>
            );
          })}
          <View accessibilityLabel="Knowledge check results" style={styles.results}>
            <Text style={styles.resultsTitle}>
              {coverage.answeredFamilies}/{coverage.totalFamilies} families answered
            </Text>
            <Text style={styles.resultLine}>
              {mode === "full" ? "Known families" : "Sample known percentage"}:{" "}
              {percent(coverage.familyKnownPercent)}
            </Text>
            <Text style={styles.resultLine}>
              {mode === "full"
                ? "Exact checked token coverage"
                : "Estimated token coverage from this sample"}
              : {percent(coverage.tokenCoveragePercent)}
            </Text>
            {coverage.tokenCoveragePercent !== null ? (
              <Text style={styles.guidance}>
                {tokenCoverageGuidance(coverage.tokenCoveragePercent)}
              </Text>
            ) : null}
            {mode !== "full" ? (
              <Text style={styles.note}>
                The estimate weights answered sample families by their token frequency in this text.
                It is not exact full-text coverage.
              </Text>
            ) : (
              <Text style={styles.note}>
                Exact coverage appears only after every eligible family in this full check has an
                answer.
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
  prompt: { color: colors.ink, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  question: {
    backgroundColor: colors.canvas,
    borderRadius: 12,
    gap: spacing.xs,
    padding: spacing.md,
  },
  questionNumber: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  resultLine: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  results: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    gap: spacing.xs,
    padding: spacing.md,
  },
  resultsTitle: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 20, fontWeight: "800" },
});
