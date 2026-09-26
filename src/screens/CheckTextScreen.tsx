import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ChoiceChip } from "../components/ChoiceChip";
import { ComplexityPanel } from "../components/ComplexityPanel";
import { DataModeNotice } from "../components/DataModeNotice";
import { HighlightedText } from "../components/HighlightedText";
import { KnowledgeTestPanel } from "../components/KnowledgeTestPanel";
import { OccurrenceCard } from "../components/OccurrenceCard";
import { OcrInputPanel } from "../components/OcrInputPanel";
import { PendingFullCheckPanel } from "../components/PendingFullCheckPanel";
import { PreteachPanel } from "../components/PreteachPanel";
import { ProgressiveDisclosure } from "../components/ProgressiveDisclosure";
import { ScreenHeader } from "../components/ScreenHeader";
import { UnmatchedWordsPanel } from "../components/UnmatchedWordsPanel";
import type { DataMode, HkeleRepository, ResolvedOccurrence } from "../domain/hkele";
import { matchCpb100 } from "../services/cpbService";
import { validHkRange } from "../services/frequencyService";
import {
  groupOccurrences,
  nextBatchSize,
  OCCURRENCE_BATCH_SIZE,
} from "../services/progressiveResults";
import {
  groupPendingFullDatabaseChecks,
  groupUnmatchedWords,
  textResultKind,
} from "../services/textResultPresentation";
import type { TeachingListStore } from "../services/teachingListService";
import { scan, TokenizerError } from "../services/tokenizer";
import { colors, spacing } from "../theme/tokens";

type ResultFilter =
  "all" | "candidate" | "reference" | "other" | "grammar" | "cpb" | "unavailable" | "review";
type ResultSort = "occurrence" | "family";
type MembershipCategory =
  "candidate" | "reference" | "other" | "grammar" | "unavailable" | "unmatched" | "review";

interface Props {
  repository: HkeleRepository;
  teaching: TeachingListStore;
  onOpenFamily: (
    basewordKey: string,
    evidence: { members: Array<{ surface: string; count: number }>; count: number },
  ) => void;
}

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

function focusAndReveal(target: View | null) {
  setTimeout(() => {
    const node = target as unknown as {
      focus?: () => void;
      scrollIntoView?: (options: { block: string; behavior: string }) => void;
    } | null;
    node?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    node?.focus?.();
  }, 0);
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
  const [groupLimit, setGroupLimit] = useState(OCCURRENCE_BATCH_SIZE);
  const [occurrenceLimit, setOccurrenceLimit] = useState(OCCURRENCE_BATCH_SIZE);
  const summaryRef = useRef<View>(null);
  const filteredSummaryRef = useRef<View>(null);

  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      const tokenScan = scan(text);
      const next = await repository.resolveOccurrences(text, tokenScan.occurrences);
      setResults(next);
      setFilter("all");
      setSort("occurrence");
      setGroupLimit(OCCURRENCE_BATCH_SIZE);
      setOccurrenceLimit(OCCURRENCE_BATCH_SIZE);
      setDataMode(next[0]?.dataMode ?? repository.getDataMode());
      focusAndReveal(summaryRef.current);
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
  const groups = useMemo(() => groupOccurrences(visible), [visible]);
  const uniqueFamilies = useMemo(
    () => new Set(results.flatMap((item) => item.owners.map((owner) => owner.baseword_key))).size,
    [results],
  );
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
  const customRange = useMemo(() => {
    const start = Number(customStart);
    const end = Number(customEnd);
    return customEnabled && validHkRange(start, end) ? { start, end } : null;
  }, [customEnabled, customEnd, customStart]);
  const changeFilter = (next: ResultFilter) => {
    setFilter(next);
    setGroupLimit(OCCURRENCE_BATCH_SIZE);
    setOccurrenceLimit(OCCURRENCE_BATCH_SIZE);
    focusAndReveal(filteredSummaryRef.current);
  };
  const changeSort = (next: ResultSort) => {
    setSort(next);
    setGroupLimit(OCCURRENCE_BATCH_SIZE);
    setOccurrenceLimit(OCCURRENCE_BATCH_SIZE);
    focusAndReveal(filteredSummaryRef.current);
  };

  return (
    <View style={styles.content}>
      <ScreenHeader
        intro="Paste or type classroom text. Analysis uses registered identity routes and stays in this session."
        title="Check a text"
      />
      {Platform.OS !== "web" ? <OcrInputPanel currentText={text} onApplyText={setText} /> : null}
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
      <DataModeNotice mode={dataMode} />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {loading ? (
        <ActivityIndicator accessibilityLabel="Checking text" color={colors.primary} size="large" />
      ) : null}
      {results.length ? (
        <>
          <View
            accessibilityLabel="Text check summary"
            accessibilityLiveRegion="polite"
            ref={summaryRef}
            style={styles.summary}
            tabIndex={-1}
          >
            <Text accessibilityRole="header" aria-level={2} style={styles.summaryTitle}>
              Text summary
            </Text>
            <Text style={styles.summaryLead}>
              {results.length} occurrences · {uniqueFamilies} registered families
            </Text>
            <Text style={styles.summaryText}>
              Candidate {counts.candidate} · Reference {counts.reference} · Other ranked{" "}
              {counts.other}
              {" · "}Grammar {counts.grammar} · Needs review{" "}
              {counts.unavailable + counts.unmatched + counts.review}
            </Text>
          </View>
          <PreteachPanel
            repository={repository}
            results={results}
            teaching={teaching}
            text={text}
          />
          <ProgressiveDisclosure
            summary="CPB, HK frequency and custom-range highlighting controls."
            title="Text highlighting"
          >
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
            <HighlightedText
              cpbEnabled={cpbEnabled}
              customRange={customRange}
              hkEnabled={hkEnabled}
              results={results}
              text={text}
            />
          </ProgressiveDisclosure>
          <ProgressiveDisclosure
            summary="Readability indicators and transparent calculation notes."
            title="Text complexity"
          >
            <ComplexityPanel results={results} text={text} />
          </ProgressiveDisclosure>
          <ProgressiveDisclosure
            summary="Generate teacher-controlled review questions."
            title="Knowledge check"
          >
            <KnowledgeTestPanel results={results} text={text} />
          </ProgressiveDisclosure>
          <ProgressiveDisclosure
            summary="Filter status categories and review repeated forms as grouped rows."
            title="Detailed status and grouped results"
          >
            <UnmatchedWordsPanel items={unmatched} />
            <PendingFullCheckPanel items={pendingFullCheck} />
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
              ).map(([value, label]) => (
                <ChoiceChip
                  key={value}
                  label={label}
                  onPress={() => changeFilter(value)}
                  selected={filter === value}
                />
              ))}
            </View>
            <Text style={styles.label}>Order</Text>
            <View style={styles.chips}>
              <ChoiceChip
                label="In text"
                onPress={() => changeSort("occurrence")}
                selected={sort === "occurrence"}
              />
              <ChoiceChip
                label="Family A–Z"
                onPress={() => changeSort("family")}
                selected={sort === "family"}
              />
            </View>
            <View
              accessibilityLiveRegion="polite"
              ref={filteredSummaryRef}
              style={styles.filteredSummary}
              tabIndex={-1}
            >
              <Text style={styles.filteredText}>
                {visible.length} occurrences · {groups.length} grouped family/form rows · showing
                first {Math.min(groupLimit, groups.length)}
              </Text>
            </View>
            {groups.slice(0, groupLimit).map((group) => (
              <View key={group.key} style={styles.groupRow}>
                <View style={styles.groupText}>
                  <Text style={styles.groupTitle}>
                    {group.form} × {group.count}
                  </Text>
                  <Text style={styles.groupNote}>
                    {group.family} · {group.status}
                  </Text>
                </View>
              </View>
            ))}
            {groupLimit < groups.length ? (
              <ActionButton
                kind="secondary"
                label={`Show ${Math.min(OCCURRENCE_BATCH_SIZE, groups.length - groupLimit)} more grouped rows`}
                onPress={() =>
                  setGroupLimit((value) =>
                    nextBatchSize(value, groups.length, OCCURRENCE_BATCH_SIZE),
                  )
                }
              />
            ) : null}
          </ProgressiveDisclosure>
          <ProgressiveDisclosure
            summary={`${visible.length} individual records, shown ${OCCURRENCE_BATCH_SIZE} at a time.`}
            title="All occurrences"
          >
            {visible.slice(0, occurrenceLimit).map((item) => {
              return (
                <OccurrenceCard
                  cpbEnabled={cpbEnabled}
                  customRange={customRange}
                  hkEnabled={hkEnabled}
                  item={item}
                  key={item.occurrenceId}
                  onOpenFamily={(basewordKey) =>
                    onOpenFamily(basewordKey, familyEvidence(basewordKey))
                  }
                  teaching={teaching}
                />
              );
            })}
            {occurrenceLimit < visible.length ? (
              <ActionButton
                kind="secondary"
                label={`Show ${Math.min(OCCURRENCE_BATCH_SIZE, visible.length - occurrenceLimit)} more occurrences`}
                onPress={() =>
                  setOccurrenceLimit((value) =>
                    nextBatchSize(value, visible.length, OCCURRENCE_BATCH_SIZE),
                  )
                }
              />
            ) : null}
          </ProgressiveDisclosure>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  content: { gap: spacing.md, padding: spacing.lg },
  error: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    color: colors.danger,
    fontSize: 15,
    lineHeight: 22,
    padding: spacing.md,
  },
  filteredSummary: { backgroundColor: colors.subdued, borderRadius: 10, padding: spacing.sm },
  filteredText: { color: colors.ink, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  groupNote: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  groupRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
    paddingVertical: spacing.sm,
  },
  groupText: { gap: spacing.xs },
  groupTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  label: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  rangeDash: { color: colors.muted, fontSize: 15, fontWeight: "700" },
  rangeError: { color: colors.danger, fontSize: 15, lineHeight: 22 },
  rangeInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    width: 116,
  },
  rangeRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  summary: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    gap: spacing.xs,
    padding: spacing.md,
  },
  summaryLead: { color: colors.ink, fontSize: 18, fontWeight: "800", lineHeight: 25 },
  summaryText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  summaryTitle: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  textarea: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 180,
    padding: spacing.md,
  },
});
