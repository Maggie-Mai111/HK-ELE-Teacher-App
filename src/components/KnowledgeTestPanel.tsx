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
import { MarkedContext } from "./MarkedContext";
import { textOccurrenceExcerpt, responsesForWords, type WordJudgements } from "../services/textReviewService";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { ProgressiveDisclosure } from "./ProgressiveDisclosure";

type Mode = "n10" | "n20" | "full" | null;

export function KnowledgeTestPanel({
  text,
  results,
  teaching,
  onNotKnownChange,
  onHasResponsesChange,
  onKnownChange,
  judgements,
  onJudge,
}: {
  text: string;
  results: ResolvedOccurrence[];
  teaching: TeachingListStore;
  onNotKnownChange?: (families: KnowledgeFamily[]) => void;
  onHasResponsesChange?: (hasResponses: boolean) => void;
  onKnownChange?: (forms: string[]) => void;
  judgements?: WordJudgements;
  onJudge?: (occurrenceId: string, value: boolean) => void;
}) {
  const eligible = useMemo(() => collectEligibleFamilies(results), [results]);
  const [mode, setMode] = useState<Mode>(null);
  const [localResponses, setResponses] = useState<KnowledgeResponses>({});
  const hasResponses = Object.keys(judgements ?? localResponses).length > 0;
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
  const responses = useMemo(() => judgements ? responsesForWords(active, judgements) : localResponses, [active, judgements, localResponses]);
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
        Mark whether students know each word in the sentence shown. You can also tap words
        in the passage. Marks clear when you check another text or close HK-ELE.
      </Text>
      <ProgressiveDisclosure title="How this check works">
        <Text style={styles.note}>
          Choose 10, 20 or all matched families. The check shows one word from each family.
          The same text gives the same quick-check selection.
        </Text>
        <Text style={styles.note}>
          Results describe only the examples shown. Other uses of the same spelling are separate. Unmatched words,
          words with more than one possible family and separate compounds are left out.
        </Text>
        <Text style={styles.note}>
          May need explaining keeps this example in Words to explain. Known applies only to this occurrence; it does not mark other uses or the whole family as known.
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
                  Family: {item.displayFamily}
                </Text>
                <Text style={styles.context}>{item.occurrenceId && results.find(row => row.occurrenceId === item.occurrenceId) ? <MarkedContext excerpt={textOccurrenceExcerpt(text, results.find(row => row.occurrenceId === item.occurrenceId)!)} /> : item.context}</Text>
                <Text style={styles.prompt}>
                  Do students know this meaning in the sentence?
                </Text>
                <View style={styles.actions}>
                  <ActionButton
                    accessibilityLabel={`Known: ${item.actualForm}`}
                    kind={answer === true ? "primary" : "secondary"}
                    label="Known"
                    onPress={() =>
                      onJudge ? onJudge(item.occurrenceId ?? item.basewordKey, true) : setResponses((current) => ({ ...current, [item.basewordKey]: true }))
                    }
                  />
                  <ActionButton
                    accessibilityLabel={`May need explaining: ${item.actualForm}`}
                    kind={answer === false ? "primary" : "secondary"}
                    label="May need explaining"
                    onPress={() =>
                      onJudge ? onJudge(item.occurrenceId ?? item.basewordKey, false) : setResponses((current) => ({ ...current, [item.basewordKey]: false }))
                    }
                  />
                </View>
                {answer === false ? (
                  <View style={styles.notKnownAction}>
                    <Text style={styles.note}>Marked May need explaining</Text>
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
                          "Chosen from word check",
                        )
                      }
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
          <View accessibilityLabel="Your word marks" style={styles.results}>
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
                <Text style={styles.resultLine}>Known: {coverage.knownFamilies} · May need explaining: {coverage.unfamiliarFamilies}</Text>
                <Text style={styles.note}>These are your marks for the examples shown, not a score for the whole text or class.</Text>
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
