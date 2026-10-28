import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ChoiceChip } from "../components/ChoiceChip";
import { ComplexityPanel } from "../components/ComplexityPanel";
import { DataModeNotice } from "../components/DataModeNotice";
import { CurrentLesson } from "../components/CurrentLesson";
import { HighlightedText } from "../components/HighlightedText";
import { KnowledgeTestPanel } from "../components/KnowledgeTestPanel";
import { LessonWordPicker } from "../components/LessonWordPicker";
import { OccurrenceCard } from "../components/OccurrenceCard";
import { OcrInputPanel } from "../components/OcrInputPanel";
import { PreteachPanel } from "../components/PreteachPanel";
import { ProgressiveDisclosure } from "../components/ProgressiveDisclosure";
import { ScreenHeader } from "../components/ScreenHeader";
import { TextWordSheet } from "../components/TextWordSheet";
import { CompoundCard } from "../components/CompoundCard";
import type { DataMode, HkeleRepository, ResolvedOccurrence } from "../domain/hkele";
import { matchCpb100 } from "../services/cpbService";
import { validHkRange } from "../services/frequencyService";
import type { KnowledgeFamily } from "../services/knowledgeTestService";
import {
  groupOccurrences,
  nextBatchSize,
  OCCURRENCE_BATCH_SIZE,
} from "../services/progressiveResults";
import { textResultsAreCurrent, textResultKind } from "../services/textResultPresentation";
import { textWordAction, type CheckedTextEvidence } from "../services/textReaderService";
import type { TeachingListStore } from "../services/teachingListService";
import { scan, TokenizerError } from "../services/tokenizer";
import { colors, spacing } from "../theme/tokens";
import type { SessionWork } from "../services/reopenSession";

type ResultFilter =
  | "all"
  | "candidate"
  | "other"
  | "grammar"
  | "cpb"
  | "unavailable"
  | "unmatched"
  | "review"
  | "compound";
type ResultSort = "occurrence" | "family";
type Category = Exclude<ResultFilter, "all" | "cpb">;
interface Props {
  onSessionWorkChange: (work: SessionWork) => void;
  onRevealSection: (section: View | null) => void;
  onOpenTeachingList: () => void;
  repository: HkeleRepository;
  teaching: TeachingListStore;
  onOpenFamily: (
    basewordKey: string,
    evidence?: CheckedTextEvidence,
    selectedForm?: string,
  ) => void;
}
function category(item: ResolvedOccurrence): Category {
  const kind = textResultKind(item);
  if (kind === "compound-expression") return "compound";
  if (kind === "grammatical-relation") return "grammar";
  if (kind === "full-check-unavailable") return "unavailable";
  if (kind === "unmatched") return "unmatched";
  if (item.status !== "RESOLVED" || item.owners.length !== 1) return "review";
  return item.owners[0]?.candidate_member ? "candidate" : "other";
}

export function CheckTextScreen({
  repository,
  teaching,
  onOpenFamily,
  onOpenTeachingList,
  onRevealSection,
  onSessionWorkChange,
}: Props) {
  const [text, setText] = useState("");
  const sourceRef = useRef("");
  const [checkedText, setCheckedText] = useState<string | null>(null);
  const [results, setResults] = useState<ResolvedOccurrence[]>([]);
  const [editing, setEditing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dataMode, setDataMode] = useState<DataMode>(() => repository.getDataMode());
  const [showHighlights, setShowHighlights] = useState(false);
  const [cpbEnabled, setCpbEnabled] = useState(false);
  const [hkEnabled, setHkEnabled] = useState(false);
  const [customEnabled, setCustomEnabled] = useState(false);
  const [customStart, setCustomStart] = useState("1");
  const [customEnd, setCustomEnd] = useState("500");
  const [wordSheet, setWordSheet] = useState<ResolvedOccurrence | null>(null);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [sort, setSort] = useState<ResultSort>("occurrence");
  const [groupLimit, setGroupLimit] = useState(OCCURRENCE_BATCH_SIZE);
  const [occurrenceLimit, setOccurrenceLimit] = useState(OCCURRENCE_BATCH_SIZE);
  const [knowledgeNotKnown, setKnowledgeNotKnown] = useState<KnowledgeFamily[]>([]);
  const [ocrWork, setOcrWork] = useState(false);
  const [knowledgeWork, setKnowledgeWork] = useState(false);
  const hasText = Boolean(text.trim() || checkedText?.trim());
  useEffect(
    () => onSessionWorkChange({ text: hasText, ocr: ocrWork, knowledge: knowledgeWork }),
    [hasText, ocrWork, knowledgeWork, onSessionWorkChange],
  );
  const readerRef = useRef<View>(null);
  const suggestionsRef = useRef<View>(null);
  const changeText = (value: string) => {
    sourceRef.current = value;
    setText(value);
    setWordSheet(null);
  };
  const analyze = async () => {
    const source = sourceRef.current;
    setLoading(true);
    setError("");
    setWordSheet(null);
    try {
      const tokens = scan(source);
      const next = await repository.resolveOccurrences(source, tokens.occurrences);
      if (sourceRef.current !== source) return;
      if (!next.length) {
        setError("Add some English text to check.");
        setEditing(true);
        return;
      }
      setResults(next);
      setCheckedText(source);
      setEditing(false);
      setFilter("all");
      setSort("occurrence");
      setGroupLimit(OCCURRENCE_BATCH_SIZE);
      setOccurrenceLimit(OCCURRENCE_BATCH_SIZE);
      setKnowledgeNotKnown([]);
      setDataMode(repository.getDataMode());
      setTimeout(() => onRevealSection(readerRef.current), 0);
    } catch (reason) {
      setEditing(true);
      if (reason instanceof TokenizerError) {
        setError("Check the spelling and symbols in the text, then try again.");
      } else if (reason instanceof Error && reason.message.startsWith("The technical limit is")) {
        setError("Check up to 500 words at a time. Split a longer passage into sections.");
      } else setError("We couldn't check the text. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };
  const counts = useMemo(() => {
    const values = {
      candidate: 0,
      compound: 0,
      other: 0,
      grammar: 0,
      unavailable: 0,
      unmatched: 0,
      review: 0,
      cpb: 0,
    };
    for (const item of results) {
      values[category(item)] += 1;
      if (matchCpb100(item.surface)) values.cpb += 1;
    }
    return values;
  }, [results]);
  const visible = useMemo(() => {
    const values =
      filter === "all"
        ? [...results]
        : results.filter((item) =>
            filter === "cpb" ? Boolean(matchCpb100(item.surface)) : category(item) === filter,
          );
    if (sort === "family")
      values.sort((a, b) =>
        (a.owners[0]?.display_family ?? a.surface).localeCompare(
          b.owners[0]?.display_family ?? b.surface,
        ),
      );
    return values;
  }, [filter, results, sort]);
  const groups = useMemo(() => groupOccurrences(visible), [visible]);
  const uniqueFamilies = useMemo(
    () =>
      new Set(
        results
          .filter((item) => textWordAction(item) === "family")
          .map((item) => item.owners[0]?.baseword_key),
      ).size,
    [results],
  );
  const customRange = useMemo(
    () =>
      customEnabled && validHkRange(Number(customStart), Number(customEnd))
        ? { start: Number(customStart), end: Number(customEnd) }
        : null,
    [customEnabled, customStart, customEnd],
  );
  const current = textResultsAreCurrent(text, checkedText);
  const showResults = results.length > 0 && current && !editing && !loading;
  const familyEvidence = (key: string, surface?: string): CheckedTextEvidence => {
    const forms = new Map<string, number>();
    for (const item of results) {
      if (textWordAction(item) !== "family" || item.owners[0]?.baseword_key !== key) continue;
      forms.set(item.surface, (forms.get(item.surface) ?? 0) + 1);
    }
    const members = [...forms].map(([surface, count]) => ({ surface, count }));
    const context = results.find(
      (item) => item.owners[0]?.baseword_key === key && (!surface || item.surface === surface),
    )?.context;
    return {
      members,
      count: members.reduce((sum, member) => sum + member.count, 0),
      ...(context ? { context } : {}),
    };
  };
  const openWord = (item: ResolvedOccurrence) => {
    if (textWordAction(item) === "family")
      onOpenFamily(
        item.owners[0]!.baseword_key,
        { ...familyEvidence(item.owners[0]!.baseword_key), context: item.context },
        item.surface,
      );
    else setWordSheet(item);
  };
  return (
    <View style={styles.content}>
      <ScreenHeader title="Check a text" intro="Explore the vocabulary in your lesson text." />
      {editing || !current || !results.length ? (
        <>
          <ProgressiveDisclosure title="Scan text from a photo">
            <OcrInputPanel currentText={text} onApplyText={changeText} onWorkChange={setOcrWork} />
          </ProgressiveDisclosure>
          <TextInput
            accessibilityLabel="Text to check"
            multiline
            value={text}
            onChangeText={changeText}
            placeholder="Paste or type your text here…"
            style={styles.textarea}
            textAlignVertical="top"
          />
          <View style={styles.actions}>
            <ActionButton
              disabled={loading || !text.trim()}
              label={loading ? "Checking…" : "Check text"}
              onPress={() => void analyze()}
            />
            {checkedText !== null ? (
              <ActionButton
                disabled={loading}
                kind="secondary"
                label="Back to checked text"
                onPress={() => {
                  changeText(checkedText);
                  setError("");
                  setEditing(false);
                }}
              />
            ) : null}
          </View>
        </>
      ) : null}
      <DataModeNotice mode={dataMode} />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {showResults && results.some((item) => item.expressionLayerStatus === "UNAVAILABLE") ? (
        <Text style={styles.meta}>Connect or update Offline use to check compound words.</Text>
      ) : null}
      {loading ? (
        <ActivityIndicator accessibilityLabel="Checking text" color={colors.primary} size="large" />
      ) : null}
      {checkedText !== null && results.length > 0 ? (
        <View
          style={showResults ? styles.resultContent : styles.hiddenResults}
          accessibilityElementsHidden={!showResults}
          importantForAccessibility={showResults ? "auto" : "no-hide-descendants"}
          pointerEvents={showResults ? "auto" : "none"}
        >
          <View
            ref={readerRef}
            tabIndex={-1}
            style={styles.reader}
            accessibilityLabel="Checked text"
          >
            <View style={styles.readerHeading}>
              <Text accessibilityRole="header" aria-level={2} style={styles.title}>
                Your text
              </Text>
              <Text style={styles.meta}>
                {results.length} {results.length === 1 ? "word" : "words"} · {uniqueFamilies}{" "}
                {uniqueFamilies === 1 ? "family" : "families"}
              </Text>
            </View>
            <Text style={styles.meta}>Tap a word to see its information.</Text>
            {results.length > 80 ? (
              <ActionButton
                kind="secondary"
                label="Pre-teaching suggestions ↓"
                onPress={() => onRevealSection(suggestionsRef.current)}
              />
            ) : null}
            <View style={styles.actions}>
              <ActionButton kind="secondary" label="Edit text" onPress={() => setEditing(true)} />
              <ActionButton
                kind="secondary"
                label={showHighlights ? "Hide highlight options" : "Highlight words"}
                onPress={() => setShowHighlights(!showHighlights)}
              />
            </View>
            {showHighlights ? (
              <View style={styles.highlightOptions}>
                <View style={styles.actions}>
                  <ChoiceChip
                    label="Common words"
                    selected={cpbEnabled}
                    onPress={() => setCpbEnabled(!cpbEnabled)}
                  />
                  <ChoiceChip
                    label="HK frequency"
                    selected={hkEnabled}
                    onPress={() => setHkEnabled(!hkEnabled)}
                  />
                  <ChoiceChip
                    label="Custom rank range"
                    selected={customEnabled}
                    onPress={() => setCustomEnabled(!customEnabled)}
                  />
                </View>
                {customEnabled ? (
                  <View style={styles.actions}>
                    <TextInput
                      accessibilityLabel="Custom HK rank start"
                      keyboardType="number-pad"
                      value={customStart}
                      onChangeText={setCustomStart}
                      style={styles.rangeInput}
                    />
                    <Text style={styles.meta}>to</Text>
                    <TextInput
                      accessibilityLabel="Custom HK rank end"
                      keyboardType="number-pad"
                      value={customEnd}
                      onChangeText={setCustomEnd}
                      style={styles.rangeInput}
                    />
                  </View>
                ) : null}
                {customEnabled && !customRange ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    Enter a valid start and end rank.
                  </Text>
                ) : null}
              </View>
            ) : null}
            <HighlightedText
              text={checkedText!}
              results={results}
              cpbEnabled={cpbEnabled}
              hkEnabled={hkEnabled}
              customRange={customRange}
              onWordPress={openWord}
            />
          </View>
          <View
            ref={suggestionsRef}
            tabIndex={-1}
            accessibilityLabel="Pre-teaching suggestions"
            style={styles.resultContent}
          >
            {results.length > 80 ? (
              <ActionButton
                kind="secondary"
                label="↑ Back to text"
                onPress={() => onRevealSection(readerRef.current)}
              />
            ) : null}
            <CurrentLesson teaching={teaching} />
            <PreteachPanel
              key={teaching.activeLessonId}
              text={checkedText!}
              results={results}
              teaching={teaching}
              notKnownFamilies={knowledgeNotKnown}
              onOpenFamily={(key, surface) =>
                onOpenFamily(key, familyEvidence(key, surface), surface)
              }
              onOpenList={onOpenTeachingList}
            />
          </View>
          {results.some((item) => item.expression) ? (
            <ProgressiveDisclosure title="Compound words in this text">
              {[
                ...new Map(
                  results
                    .filter((item) => item.expression)
                    .map((item) => [item.expression!.expressionId, item.expression!]),
                ).values(),
              ].map((expression) => (
                <CompoundCard
                  key={expression.expressionId}
                  expression={expression}
                  teaching={teaching}
                  onOpenFamily={(key, form) => onOpenFamily(key, undefined, form)}
                  source="Check a text"
                />
              ))}
            </ProgressiveDisclosure>
          ) : null}
          <ProgressiveDisclosure title="Check word knowledge" keepMounted>
            <KnowledgeTestPanel
              key={teaching.activeLessonId}
              text={checkedText!}
              results={results}
              teaching={teaching}
              onNotKnownChange={setKnowledgeNotKnown}
              onHasResponsesChange={setKnowledgeWork}
            />
          </ProgressiveDisclosure>
          <ProgressiveDisclosure title="Choose more lesson words" keepMounted>
            <LessonWordPicker
              key={`${checkedText}:${teaching.activeLessonId}`}
              showHeading={false}
              results={results}
              teaching={teaching}
              onOpenList={onOpenTeachingList}
            />
          </ProgressiveDisclosure>
          <ProgressiveDisclosure title="More text details">
            <ProgressiveDisclosure title="Readability estimates">
              <ComplexityPanel text={checkedText!} results={results} />
            </ProgressiveDisclosure>
            <ProgressiveDisclosure title="All word results">
              <View style={styles.actions}>
                {(
                  [
                    ["all", `All (${results.length})`],
                    ["candidate", `Core list (${counts.candidate})`],
                    ["other", `Other words (${counts.other})`],
                    ["compound", `Compounds (${counts.compound})`],
                    ["grammar", `Short forms (${counts.grammar})`],
                    ["cpb", `Common words (${counts.cpb})`],
                    ["unavailable", `Check online (${counts.unavailable})`],
                    ["unmatched", `No entry (${counts.unmatched})`],
                    ["review", `Choose family (${counts.review})`],
                  ] as Array<[ResultFilter, string]>
                )
                  .filter(([value]) => value === "all" || counts[value as keyof typeof counts] > 0)
                  .map(([value, label]) => (
                    <ChoiceChip
                      key={value}
                      label={label}
                      selected={filter === value}
                      onPress={() => {
                        setFilter(value);
                        setGroupLimit(OCCURRENCE_BATCH_SIZE);
                        setOccurrenceLimit(OCCURRENCE_BATCH_SIZE);
                      }}
                    />
                  ))}
              </View>
              <View style={styles.actions}>
                <ChoiceChip
                  label="In text"
                  selected={sort === "occurrence"}
                  onPress={() => setSort("occurrence")}
                />
                <ChoiceChip
                  label="Family A–Z"
                  selected={sort === "family"}
                  onPress={() => setSort("family")}
                />
              </View>
              <Text style={styles.meta}>
                {visible.length} word occurrences · {groups.length} different forms
              </Text>
              {groups.slice(0, groupLimit).map((group) => (
                <View key={group.key} style={styles.groupRow}>
                  <Text style={styles.groupTitle}>
                    {group.form} × {group.count}
                  </Text>
                  <Text style={styles.meta}>
                    {group.family} · {group.status}
                  </Text>
                </View>
              ))}
              {groupLimit < groups.length ? (
                <ActionButton
                  kind="secondary"
                  label="Show more words"
                  onPress={() =>
                    setGroupLimit((value) =>
                      nextBatchSize(value, groups.length, OCCURRENCE_BATCH_SIZE),
                    )
                  }
                />
              ) : null}
            </ProgressiveDisclosure>
            <ProgressiveDisclosure title="Words in context">
              {visible.slice(0, occurrenceLimit).map((item) => (
                <OccurrenceCard
                  key={item.occurrenceId}
                  item={item}
                  teaching={teaching}
                  cpbEnabled={cpbEnabled}
                  hkEnabled={hkEnabled}
                  customRange={customRange}
                  onOpenFamily={(key) =>
                    onOpenFamily(
                      key,
                      { ...familyEvidence(key), context: item.context },
                      item.surface,
                    )
                  }
                />
              ))}
              {occurrenceLimit < visible.length ? (
                <ActionButton
                  kind="secondary"
                  label="Show more occurrences"
                  onPress={() =>
                    setOccurrenceLimit((value) =>
                      nextBatchSize(value, visible.length, OCCURRENCE_BATCH_SIZE),
                    )
                  }
                />
              ) : null}
            </ProgressiveDisclosure>
          </ProgressiveDisclosure>
        </View>
      ) : null}
      <TextWordSheet
        teaching={teaching}
        item={wordSheet}
        onClose={() => setWordSheet(null)}
        onOpenFamily={(key, surface, context) =>
          onOpenFamily(key, { members: [{ surface, count: 1 }], count: 1, context }, surface)
        }
        onRetry={() => void analyze()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  resultContent: { gap: spacing.md },
  hiddenResults: { display: "none" },
  content: { padding: spacing.lg, gap: spacing.md },
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 17,
    lineHeight: 26,
    minHeight: 180,
    borderRadius: 12,
    padding: spacing.md,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  reader: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.sm,
  },
  readerHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  title: { fontSize: 21, fontWeight: "800", color: colors.ink },
  meta: { fontSize: 14, lineHeight: 21, color: colors.muted },
  highlightOptions: {
    backgroundColor: colors.canvas,
    padding: spacing.sm,
    borderRadius: 10,
    gap: spacing.sm,
  },
  rangeInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 16,
    color: colors.ink,
    width: 95,
    backgroundColor: colors.surface,
    minHeight: 44,
  },
  error: { fontSize: 15, lineHeight: 22, color: colors.danger },
  groupRow: {
    backgroundColor: colors.canvas,
    padding: spacing.sm,
    borderRadius: 9,
    gap: spacing.xs,
  },
  groupTitle: { fontSize: 16, color: colors.ink, fontWeight: "700" },
});
