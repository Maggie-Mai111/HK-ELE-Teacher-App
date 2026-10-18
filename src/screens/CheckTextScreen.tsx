import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ChoiceChip } from "../components/ChoiceChip";
import { ComplexityPanel } from "../components/ComplexityPanel";
import { ContextReviewPanel } from "../components/ContextReviewPanel";
import { DataModeNotice } from "../components/DataModeNotice";
import { HighlightedText } from "../components/HighlightedText";
import { KnowledgeTestPanel } from "../components/KnowledgeTestPanel";
import { LessonWordPicker } from "../components/LessonWordPicker";
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
import type { KnowledgeFamily } from "../services/knowledgeTestService";
import {
  groupOccurrences,
  nextBatchSize,
  OCCURRENCE_BATCH_SIZE,
} from "../services/progressiveResults";
import {
  groupPendingFullDatabaseChecks,
  groupContextReviews,
  groupUnmatchedWords,
  textResultsAreCurrent,
  textResultKind,
} from "../services/textResultPresentation";
import type { TeachingListStore } from "../services/teachingListService";
import { scan, TokenizerError } from "../services/tokenizer";
import { colors, spacing } from "../theme/tokens";

type ResultFilter =
  "all" | "candidate" | "other" | "grammar" | "cpb" | "unavailable" | "unmatched" | "review";
type ResultSort = "occurrence" | "family";
type MembershipCategory =
  "candidate" | "other" | "grammar" | "unavailable" | "unmatched" | "review";

interface Props {
  onOpenTeachingList: () => void;
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

export function CheckTextScreen({ repository, teaching, onOpenFamily, onOpenTeachingList }: Props) {
  const [dataMode, setDataMode] = useState<DataMode>(() => repository.getDataMode());
  const [text, setText] = useState("");
  const [checkedText, setCheckedText] = useState<string | null>(null);
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
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [knowledgeNotKnown, setKnowledgeNotKnown] = useState<KnowledgeFamily[]>([]);
  const summaryRef = useRef<View>(null);
  const filteredSummaryRef = useRef<View>(null);

  const analyze = async () => {
    setLoading(true);
    setError("");
    try {
      const tokenScan = scan(text);
      const next = await repository.resolveOccurrences(text, tokenScan.occurrences);
      setResults(next);
      setCheckedText(text);
      setFilter("all");
      setSort("occurrence");
      setGroupLimit(OCCURRENCE_BATCH_SIZE);
      setOccurrenceLimit(OCCURRENCE_BATCH_SIZE);
      setKnowledgeNotKnown([]);
      setKnowledgeOpen(false);
      setDataMode(repository.getDataMode());
      focusAndReveal(summaryRef.current);
    } catch (reason) {
      setResults([]);
      if (reason instanceof TokenizerError) {
        const offset = reason.issues[0]?.offset ?? 0;
        setError(
          `Check the text near “${text.slice(Math.max(0, offset - 12), offset + 12)}” and remove any unusual symbols, then try again.`,
        );
      } else if (reason instanceof Error && reason.message.startsWith("The technical limit is")) {
        setError("Please check up to 500 words at a time. Split a longer passage into sections.");
      } else {
        setError("We couldn't check the text. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const values = {
      candidate: 0,
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
        ? [...results]
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
    () =>
      new Set(
        results
          .filter((item) => item.status === "RESOLVED" && item.owners.length === 1)
          .flatMap((item) =>
            item.owners
              .filter((owner) => !owner.blocked && !owner.display_blocked)
              .map((owner) => owner.baseword_key),
          ),
      ).size,
    [results],
  );
  const unmatched = useMemo(() => groupUnmatchedWords(results), [results]);
  const contextReviews = useMemo(() => groupContextReviews(results), [results]);
  const resultsCurrent = textResultsAreCurrent(text, checkedText);
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
        intro="Paste text or scan a photo, then check the words."
        title="Check a text"
      />
      <ProgressiveDisclosure title="Scan text from a photo">
        <OcrInputPanel currentText={text} onApplyText={setText} />
      </ProgressiveDisclosure>
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
      {results.length && !resultsCurrent ? (
        <Text accessibilityLiveRegion="polite" style={styles.rangeError}>
          Text changed. Choose Check text to update the results.
        </Text>
      ) : null}
      {results.length && resultsCurrent && !loading ? (
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
              {results.length} word occurrences · {uniqueFamilies} matched families
            </Text>
            <Text style={styles.summaryText}>
              {(
                [
                  ["Core list", counts.candidate],
                  ["Other database words", counts.other],
                  ["Grammar", counts.grammar],
                  ["Not matched", counts.unmatched],
                  ["Context check", counts.review],
                  ["Check when online", counts.unavailable],
                ] as const
              )
                .filter(([, count]) => count > 0)
                .map(([label, count]) => `${label} ${count}`)
                .join(" · ")}
            </Text>
            {counts.unmatched ? (
              <Text style={styles.summaryText}>
                Not matched describes the current data, not what your students know.
              </Text>
            ) : null}
          </View>
          <LessonWordPicker
            key={checkedText}
            results={results}
            teaching={teaching}
            onOpenList={onOpenTeachingList}
          />
          {unmatched.length || contextReviews.length || pendingFullCheck.length ? (
            <ProgressiveDisclosure
              title="Words to review"
              summary="Words without a match or with more than one possible reading."
            >
              <UnmatchedWordsPanel items={unmatched} />
              <ContextReviewPanel items={contextReviews} />
              <PendingFullCheckPanel items={pendingFullCheck} />
            </ProgressiveDisclosure>
          ) : null}
          <View style={styles.knowledgeEntry}>
            <View style={styles.knowledgeEntryText}>
              <Text accessibilityRole="header" aria-level={2} style={styles.knowledgeEntryTitle}>
                Check word knowledge
              </Text>
              <Text style={styles.knowledgeEntryNote}>
                Let a teacher or learner mark Known / Not known and estimate the unfamiliar-word
                rate. Answers stay in this session.
              </Text>
            </View>
            <ActionButton
              kind={knowledgeOpen ? "secondary" : "primary"}
              label={knowledgeOpen ? "Hide word knowledge check" : "Check word knowledge"}
              onPress={() => setKnowledgeOpen((value) => !value)}
            />
          </View>
          {knowledgeOpen ? (
            <KnowledgeTestPanel
              onNotKnownChange={setKnowledgeNotKnown}
              results={results}
              teaching={teaching}
              text={text}
            />
          ) : null}
          <ProgressiveDisclosure title="Words to review for pre-teaching">
            <PreteachPanel
              notKnownFamilies={knowledgeNotKnown}
              repository={repository}
              results={results}
              teaching={teaching}
              text={text}
            />
          </ProgressiveDisclosure>
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
            summary="See how the passage reads and what the measures mean."
            title="Text complexity"
          >
            <ComplexityPanel results={results} text={text} />
          </ProgressiveDisclosure>
          <ProgressiveDisclosure
            summary="Browse word families, repeated words and matches."
            title="All word results"
          >
            <Text style={styles.label}>Show</Text>
            <View style={styles.chips}>
              {(
                [
                  ["all", `All (${results.length})`],
                  ["candidate", `Core list (${counts.candidate})`],
                  ["other", `Other database words (${counts.other})`],
                  ["grammar", `Grammar (${counts.grammar})`],
                  ["cpb", `CPB/common (${counts.cpb})`],
                  ["unavailable", `Full check unavailable (${counts.unavailable})`],
                  ["unmatched", `Not matched (${counts.unmatched})`],
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
            summary="See each word in its original sentence."
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
  knowledgeEntry: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: 14,
    borderWidth: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    justifyContent: "space-between",
    padding: spacing.md,
  },
  knowledgeEntryNote: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  knowledgeEntryText: { flex: 1, gap: spacing.xs, minWidth: 240 },
  knowledgeEntryTitle: { color: colors.primary, fontSize: 20, fontWeight: "800" },
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
