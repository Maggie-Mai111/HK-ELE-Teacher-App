import { useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ChoiceChip } from "../components/ChoiceChip";
import { ComplexityPanel } from "../components/ComplexityPanel";
import { DataModeNotice } from "../components/DataModeNotice";
import { HighlightedText } from "../components/HighlightedText";
import { KnowledgeTestPanel } from "../components/KnowledgeTestPanel";
import { OcrInputPanel } from "../components/OcrInputPanel";
import { PendingFullCheckPanel } from "../components/PendingFullCheckPanel";
import { PreteachPanel } from "../components/PreteachPanel";
import { ScreenHeader } from "../components/ScreenHeader";
import { UnmatchedWordsPanel } from "../components/UnmatchedWordsPanel";
import type { DataMode, FamilyRecord, HkeleRepository, ResolvedOccurrence } from "../domain/hkele";
import { matchCpb100 } from "../services/cpbService";
import { hkFrequencyDisplay, inHkRange, validHkRange } from "../services/frequencyService";
import { grammaticalRelationDisplay } from "../services/grammaticalRelationService";
import {
  groupUnmatchedWords,
  groupPendingFullDatabaseChecks,
  textFormAndFamily,
  textResultKind,
  textResultStatusLabel,
} from "../services/textResultPresentation";
import type { TeachingListStore } from "../services/teachingListService";
import { scan, TokenizerError } from "../services/tokenizer";
import { colors, spacing } from "../theme/tokens";

type ResultFilter =
  "all" | "candidate" | "reference" | "other" | "grammar" | "cpb" | "unavailable" | "review";
type ResultSort = "occurrence" | "family";

interface Props {
  repository: HkeleRepository;
  teaching: TeachingListStore;
  onOpenFamily: (
    basewordKey: string,
    evidence: { members: Array<{ surface: string; count: number }>; count: number },
  ) => void;
}

type MembershipCategory =
  "candidate" | "reference" | "other" | "grammar" | "unavailable" | "unmatched" | "review";

function category(item: ResolvedOccurrence): MembershipCategory {
  const kind = textResultKind(item);
  if (kind === "grammatical-relation") return "grammar";
  if (kind === "full-check-unavailable") return "unavailable";
  if (kind === "unmatched") return "unmatched";
  if (item.status !== "RESOLVED" || item.owners.length !== 1) return "review";
  const owner = item.owners[0];
  if (owner?.candidate_member === true || owner?.candidate_member === 1) return "candidate";
  if (owner?.reference_member === true || owner?.reference_member === 1) return "reference";
  return "other";
}

export function CheckTextScreen({ repository, teaching, onOpenFamily }: Props) {
  const [dataMode, setDataMode] = useState<DataMode>(() => repository.getDataMode());
  const [text, setText] = useState("");
  const [results, setResults] = useState<ResolvedOccurrence[]>([]);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [sort, setSort] = useState<ResultSort>("occurrence");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cpbEnabled, setCpbEnabled] = useState(true);
  const [hkEnabled, setHkEnabled] = useState(true);
  const [customEnabled, setCustomEnabled] = useState(false);
  const [customStart, setCustomStart] = useState("1");
  const [customEnd, setCustomEnd] = useState("500");

  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      const tokenScan = scan(text);
      const next = await repository.resolveOccurrences(text, tokenScan.occurrences);
      setResults(next);
      setDataMode(next[0]?.dataMode ?? repository.getDataMode());
    } catch (reason) {
      setResults([]);
      if (reason instanceof TokenizerError) {
        setError(
          `${reason.message} ${reason.issues
            .slice(0, 3)
            .map((issue) => `${issue.codePoint} at ${issue.offset}`)
            .join("; ")}`,
        );
      } else {
        setError(reason instanceof Error ? reason.message : String(reason));
      }
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const values = {
      candidate: 0,
      reference: 0,
      other: 0,
      grammar: 0,
      unmatched: 0,
      unavailable: 0,
      cpb: 0,
      review: 0,
    };
    for (const item of results) {
      values[category(item)] += 1;
      if (matchCpb100(item.surface)) values.cpb += 1;
    }
    return values;
  }, [results]);
  const visible = useMemo(() => {
    const selected =
      filter === "all"
        ? results.filter((item) => category(item) !== "unmatched")
        : results.filter((item) =>
            filter === "cpb" ? Boolean(matchCpb100(item.surface)) : category(item) === filter,
          );
    if (sort === "family") {
      selected.sort((left, right) =>
        (left.owners[0]?.display_family ?? left.surface).localeCompare(
          right.owners[0]?.display_family ?? right.surface,
        ),
      );
    }
    return selected;
  }, [filter, results, sort]);
  const unmatched = useMemo(() => groupUnmatchedWords(results), [results]);
  const pendingFullCheck = useMemo(() => groupPendingFullDatabaseChecks(results), [results]);
  const familyEvidence = (basewordKey: string) => {
    const countsBySurface = new Map<string, number>();
    for (const result of results) {
      if (!result.owners.some((owner) => owner.baseword_key === basewordKey)) continue;
      countsBySurface.set(result.surface, (countsBySurface.get(result.surface) ?? 0) + 1);
    }
    const members = [...countsBySurface].map(([surface, count]) => ({ surface, count }));
    return { members, count: members.reduce((sum, member) => sum + member.count, 0) };
  };
  const add = (family: FamilyRecord) => teaching.add(family);
  const customRange = useMemo(() => {
    const start = Number(customStart);
    const end = Number(customEnd);
    return customEnabled && validHkRange(start, end) ? { start, end } : null;
  }, [customEnabled, customEnd, customStart]);

  return (
    <View style={styles.content}>
      <ScreenHeader
        intro="Analyze up to 500 word occurrences using registered identity routes. Your text stays visible and is not uploaded by this app."
        title="Check a Text"
      />
      <DataModeNotice mode={dataMode} />
      <OcrInputPanel currentText={text} onApplyText={setText} />
      <TextInput
        accessibilityLabel="Text to check"
        multiline
        onChangeText={setText}
        placeholder="Paste or type classroom text here…"
        style={styles.textarea}
        textAlignVertical="top"
        value={text}
      />
      <ActionButton
        disabled={loading || !text.trim()}
        label={loading ? "Checking…" : "Check text"}
        onPress={() => void analyze()}
      />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {loading ? <ActivityIndicator color={colors.primary} size="large" /> : null}
      {results.length ? (
        <>
          <View accessibilityLabel="Text check summary" style={styles.summary}>
            <Text style={styles.summaryTitle}>{results.length} word occurrences</Text>
            <Text style={styles.summaryText}>
              Candidate {counts.candidate} · Reference {counts.reference} · Other ranked{" "}
              {counts.other} · Grammatical relations {counts.grammar} · Full check unavailable{" "}
              {counts.unavailable} · Unmatched {counts.unmatched}
              {" · "}Other review {counts.review} · Independent CPB highlights {counts.cpb}
            </Text>
          </View>
          <UnmatchedWordsPanel items={unmatched} />
          <PendingFullCheckPanel items={pendingFullCheck} />
          <View style={styles.toolsBox}>
            <Text accessibilityRole="header" style={styles.toolsTitle}>
              Text highlighting
            </Text>
            <View style={styles.chips}>
              <ChoiceChip
                label={cpbEnabled ? "★ CPB 100 on" : "CPB 100 off"}
                onPress={() => setCpbEnabled((value) => !value)}
                selected={cpbEnabled}
              />
              <ChoiceChip
                label={hkEnabled ? "HK frequency on" : "HK frequency off"}
                onPress={() => setHkEnabled((value) => !value)}
                selected={hkEnabled}
              />
              <ChoiceChip
                label={customEnabled ? "Custom HK range on" : "Custom HK range off"}
                onPress={() => setCustomEnabled((value) => !value)}
                selected={customEnabled}
              />
            </View>
            {customEnabled ? (
              <View style={styles.rangeRow}>
                <TextInput
                  accessibilityLabel="Custom HK rank start"
                  keyboardType="number-pad"
                  onChangeText={setCustomStart}
                  style={styles.rangeInput}
                  value={customStart}
                />
                <Text style={styles.rangeDash}>to</Text>
                <TextInput
                  accessibilityLabel="Custom HK rank end"
                  keyboardType="number-pad"
                  onChangeText={setCustomEnd}
                  style={styles.rangeInput}
                  value={customEnd}
                />
              </View>
            ) : null}
            {customEnabled && !customRange ? (
              <Text accessibilityRole="alert" style={styles.rangeError}>
                Enter whole-number ranks with an end rank equal to or above the start.
              </Text>
            ) : null}
          </View>
          <HighlightedText
            cpbEnabled={cpbEnabled}
            customRange={customRange}
            hkEnabled={hkEnabled}
            results={results}
            text={text}
          />
          <ComplexityPanel results={results} text={text} />
          <KnowledgeTestPanel results={results} text={text} />
          <PreteachPanel
            repository={repository}
            results={results}
            teaching={teaching}
            text={text}
          />
          <Text style={styles.label}>Show</Text>
          <View style={styles.chips}>
            {(
              [
                ["all", `All (${results.length})`],
                ["candidate", `Candidate (${counts.candidate})`],
                ["reference", `Reference (${counts.reference})`],
                ["other", `Other (${counts.other})`],
                ["grammar", `Grammar (${counts.grammar})`],
                ["cpb", `CPB/common (${counts.cpb})`],
                ["unavailable", `Full check unavailable (${counts.unavailable})`],
                ["review", `Review (${counts.review})`],
              ] as Array<[ResultFilter, string]>
            ).map(([value, textLabel]) => (
              <ChoiceChip
                key={value}
                label={textLabel}
                onPress={() => setFilter(value)}
                selected={filter === value}
              />
            ))}
          </View>
          <Text style={styles.label}>Order</Text>
          <View style={styles.chips}>
            <ChoiceChip
              label="In text"
              onPress={() => setSort("occurrence")}
              selected={sort === "occurrence"}
            />
            <ChoiceChip
              label="Family A–Z"
              onPress={() => setSort("family")}
              selected={sort === "family"}
            />
          </View>
          {visible.map((item) => {
            const owner = item.owners.length === 1 ? item.owners[0] : null;
            const cpb = matchCpb100(item.surface);
            const hk = owner ? hkFrequencyDisplay(owner.current_hk_frequency_rank) : null;
            const custom =
              owner && customRange
                ? inHkRange(owner.current_hk_frequency_rank, customRange.start, customRange.end)
                : false;
            const inList = owner
              ? teaching.items.some((entry) => entry.basewordKey === owner.baseword_key)
              : false;
            const relation = item.grammaticalRelation ?? null;
            const mapping = textFormAndFamily(item);
            return (
              <View
                key={item.occurrenceId}
                style={[
                  styles.result,
                  cpbEnabled && cpb && styles.resultCpb,
                  custom && styles.resultCustom,
                ]}
              >
                <View style={styles.resultTop}>
                  <Text style={styles.surface}>{item.surface}</Text>
                  <Text style={[styles.status, category(item) === "review" && styles.review]}>
                    {textResultStatusLabel(item)}
                  </Text>
                </View>
                <View style={styles.badges}>
                  {cpbEnabled && cpb ? (
                    <Text style={styles.cpbBadge}>★ CPB 100 rank {cpb.rank}</Text>
                  ) : null}
                  {hkEnabled && hk ? (
                    <Text
                      style={[
                        styles.hkBadge,
                        hk.band === "top-1k" && styles.hkTopBadge,
                        hk.band === "next-1k" && styles.hkNextBadge,
                        hk.band === "later" && styles.hkLaterBadge,
                      ]}
                    >
                      {hk.symbol} {hk.label}
                      {owner?.current_hk_frequency_rank
                        ? ` · rank ${owner.current_hk_frequency_rank}`
                        : ""}
                    </Text>
                  ) : null}
                  {custom ? (
                    <Text style={styles.customBadge}>
                      ◎ Custom HK {customRange?.start}–{customRange?.end}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.offset}>
                  Characters {item.startOffset}–{item.endOffset}
                </Text>
                <Text style={styles.context}>{item.context}</Text>
                {owner ? (
                  <View accessibilityLabel="Text form and HK-ELE family" style={styles.mapping}>
                    <Text style={styles.mappingLabel}>Text form</Text>
                    <Text style={styles.mappingValue}>{mapping.textForm}</Text>
                    <Text style={styles.mappingLabel}>HK-ELE family</Text>
                    <Text style={styles.mappingValue}>{mapping.family}</Text>
                  </View>
                ) : null}
                {relation ? (
                  <View style={styles.relation}>
                    <Text style={styles.mappingLabel}>Registered relation</Text>
                    <Text style={styles.relationValue}>
                      {item.surface} → {grammaticalRelationDisplay(relation)}
                    </Text>
                    <Text style={styles.relationNote}>
                      This is a language relation, not a ranked HK-ELE family. Context decides
                      between alternatives where more than one is shown.
                    </Text>
                  </View>
                ) : null}
                {item.identityException ? (
                  <Text style={styles.warning}>{item.identityException.teacherDisplay}</Text>
                ) : null}
                {item.status === "AMBIGUOUS" ? (
                  <Text style={styles.warning}>
                    Possible owners: {item.owners.map((value) => value.display_family).join(", ")}
                  </Text>
                ) : null}
                {owner ? (
                  <View style={styles.actions}>
                    <ActionButton
                      kind="secondary"
                      label="Word detail"
                      onPress={() =>
                        onOpenFamily(owner.baseword_key, familyEvidence(owner.baseword_key))
                      }
                    />
                    <ActionButton
                      disabled={inList}
                      kind="secondary"
                      label={inList ? "In teaching list" : "Add to list"}
                      onPress={() => add(owner)}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  content: { gap: spacing.md, padding: spacing.lg },
  context: { color: colors.muted, fontSize: 14, fontStyle: "italic", lineHeight: 21 },
  error: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    color: colors.danger,
    lineHeight: 22,
    padding: spacing.md,
  },
  label: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  cpbBadge: {
    backgroundColor: colors.cpbSoft,
    borderRadius: 7,
    color: colors.cpb,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  customBadge: {
    backgroundColor: colors.customSoft,
    borderRadius: 7,
    color: colors.custom,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  hkBadge: {
    borderRadius: 7,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  hkLaterBadge: { backgroundColor: colors.hkLaterSoft, color: colors.hkLater },
  hkNextBadge: { backgroundColor: colors.hkNextSoft, color: colors.hkNext },
  hkTopBadge: { backgroundColor: colors.hkTopSoft, color: colors.hkTop },
  offset: { color: colors.muted, fontSize: 12 },
  mapping: {
    backgroundColor: colors.subdued,
    borderRadius: 10,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  mappingLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  mappingValue: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  relation: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  relationNote: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  relationValue: { color: colors.primary, fontSize: 17, fontWeight: "800" },
  result: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  resultCpb: { borderColor: colors.cpb, borderStyle: "dashed", borderWidth: 2 },
  resultCustom: { borderColor: colors.custom, borderWidth: 2 },
  resultTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  review: { backgroundColor: colors.warningSoft, color: colors.accent },
  status: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    color: colors.primary,
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: "center",
  },
  summary: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    gap: spacing.xs,
    padding: spacing.md,
  },
  summaryText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  summaryTitle: { color: colors.primary, fontSize: 19, fontWeight: "800" },
  toolsBox: {
    backgroundColor: colors.subdued,
    borderRadius: 14,
    gap: spacing.sm,
    padding: spacing.md,
  },
  toolsTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  rangeDash: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  rangeError: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  rangeInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 9,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    width: 105,
  },
  rangeRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  surface: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  textarea: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 25,
    minHeight: 180,
    padding: spacing.md,
  },
  warning: {
    backgroundColor: colors.warningSoft,
    borderRadius: 8,
    color: colors.ink,
    lineHeight: 21,
    padding: spacing.sm,
  },
});
