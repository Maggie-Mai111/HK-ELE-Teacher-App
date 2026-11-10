import {WordViewSelector} from "../components/WordViewSelector";
import { PassageCoverage } from "../components/PassageCoverage";
import { occurrenceInCoverage, type CoverageTarget } from "../services/coverageLists";
import { normalizedCounts } from "../services/textNormalization";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { AutoGrowingTextInput } from "../components/AutoGrowingTextInput";
import { ChoiceChip } from "../components/ChoiceChip";
import { ComplexityPanel } from "../components/ComplexityPanel";
import { DataModeNotice } from "../components/DataModeNotice";
import { HighlightedText } from "../components/HighlightedText";
import { KnowledgeTestPanel } from "../components/KnowledgeTestPanel";
import { LessonWordPicker } from "../components/LessonWordPicker";
import { TextOccurrencesModal } from "../components/TextOccurrencesModal";
import type { TextReviewTools } from "../components/TextReviewActions";
import { textOccurrenceExcerpt, updateWordJudgement, type WordJudgements } from "../services/textReviewService";
import { OcrInputPanel } from "../components/OcrInputPanel";
import { PreteachPanel } from "../components/PreteachPanel";
import { ProgressiveDisclosure } from "../components/ProgressiveDisclosure";
import { ScreenHeader } from "../components/ScreenHeader";
import { TextWordSheet } from "../components/TextWordSheet";
import { CompoundCard } from "../components/CompoundCard";
import type { DataMode, HkeleRepository, ResolvedOccurrence } from "../domain/hkele";
import { matchCpb100 } from "../services/cpbService";
import { validHkRange } from "../services/frequencyService";
import {
  groupOccurrences,
  nextBatchSize,
  OCCURRENCE_BATCH_SIZE,
} from "../services/progressiveResults";
import {
  textResultsAreCurrent,
  textResultFilterCategory,
} from "../services/textResultPresentation";
import { textWordAction, type CheckedTextEvidence } from "../services/textReaderService";
import type { TeachingListStore } from "../services/teachingListService";
import { scanTeacherText } from "../services/tokenizer";
import { colors, spacing } from "../theme/tokens";
import type { SessionWork } from "../services/reopenSession";

type ResultFilter =
  | "all"
  | "outside"
  | "candidate"
  | "other"
  | "grammar"
  | "cpb"
  | "unavailable"
  | "unmatched"
  | "review"
  | "compound";
type ResultSort = "occurrence" | "family";
type Category = Exclude<ResultFilter, "all" | "cpb" | "outside">;
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
    textTools?: TextReviewTools,
  ) => void;
}
function category(item: ResolvedOccurrence): Category {
  return textResultFilterCategory(item);
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
  const [coverageTarget, setCoverageTarget] = useState<CoverageTarget>("90");
  const [allResultsOpen, setAllResultsOpen] = useState(false);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const allResultsRef = useRef<View>(null);
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
  const [occurrencesWord, setOccurrencesWord] = useState<string | null>(null);
  const [wordJudgements, setWordJudgements] = useState<WordJudgements>({});
  const judgementsRef = useRef(wordJudgements);
  judgementsRef.current = wordJudgements;
  const judgeWord = (occurrenceId: string, value: boolean | undefined) => setWordJudgements(current => updateWordJudgement(current, occurrenceId, value));
  useEffect(() => { setWordJudgements({}); setOccurrencesWord(null); }, [teaching.activeLessonId]);
  const [ocrWork, setOcrWork] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [ocrReviewing, setOcrReviewing] = useState(false);
  const editorRef = useRef<View>(null);
  const [knowledgeWork, setKnowledgeWork] = useState(false);
  const hasText = Boolean(text.trim() || checkedText?.trim());
  useEffect(
    () => onSessionWorkChange({ text: hasText, ocr: ocrWork, knowledge: knowledgeWork || Object.keys(wordJudgements).length > 0 }),
    [hasText, ocrWork, knowledgeWork, wordJudgements, onSessionWorkChange],
  );
  const readerRef = useRef<View>(null);
  const suggestionsRef = useRef<View>(null);
  const changeText = (value: string) => {
    sourceRef.current = value;
    setText(value);
    setWordSheet(null);
  };
  const applyPhotoText = (value: string) => {
    changeText(value);
    setOcrOpen(false);
    setOcrReviewing(false);
    setTimeout(()=>onRevealSection(editorRef.current),0);
  };
  const analyze = async () => {
    const source = sourceRef.current;
    setLoading(true);
    setError("");
    setWordSheet(null);
    try {
      const tokens = scanTeacherText(source);
      const next = await repository.resolveOccurrences(source, tokens.occurrences);
      if (sourceRef.current !== source) return;
      if (!next.length) {
        setError("No words found. Paste or type some English text to check.");
        setEditing(true);
        return;
      }
      setResults(next);
      setCheckedText(source);
      setEditing(false);
      setFilter("all");
      setSort("occurrence");
      setGroupLimit(OCCURRENCE_BATCH_SIZE);
      setOccurrencesWord(null);
      setWordJudgements({});
      setDataMode(repository.getDataMode());
      setTimeout(() => onRevealSection(readerRef.current), 0);
    } catch (reason) {
      setEditing(true);
      if (reason instanceof Error && reason.message.startsWith("The technical limit is")) {
        setError("Check up to 500 words at a time. Split a longer passage into sections.");
      } else setError("We couldn't check the text. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(()=>{let active=true;if(checkedText!==null){const source=checkedText;void repository.resolveOccurrences(source,scanTeacherText(source).occurrences).then(next=>{if(active)setResults(next);});}return()=>{active=false;};},[repository]);
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
      values[item.status === "RESOLVED" ? (occurrenceInCoverage(item,coverageTarget) ? "candidate" : "other") : category(item)] += 1;
      if (matchCpb100(item.surface)) values.cpb += 1;
    }
    return values;
  }, [results,coverageTarget]);
  const visible = useMemo(() => {
    const values =
      filter === "all"
        ? [...results]
        : results.filter((item) =>
            filter === "outside" ? !occurrenceInCoverage(item,coverageTarget) : filter === "cpb" ? Boolean(matchCpb100(item.surface)) : (item.status === "RESOLVED" ? (occurrenceInCoverage(item,coverageTarget) ? "candidate" : "other") : category(item)) === filter,
          );
    if (sort === "family")
      values.sort((a, b) =>
        (a.owners[0]?.display_family ?? a.surface).localeCompare(
          b.owners[0]?.display_family ?? b.surface,
        ),
      );
    return values;
  }, [filter, results, sort,coverageTarget]);
  const groups = useMemo(() => groupOccurrences(visible, sort), [visible, sort]);
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
  const reviewTools = (item: ResolvedOccurrence):TextReviewTools => ({surface:item.surface,occurrenceId:item.occurrenceId,excerpt:textOccurrenceExcerpt(checkedText ?? "",item),getKnown:()=>judgementsRef.current[item.occurrenceId],onJudge:value=>judgeWord(item.occurrenceId,value),onShowOccurrences:()=>setOccurrencesWord(item.surface)});
  const openWord = (item: ResolvedOccurrence) => {
    if (textWordAction(item) === "family")
      onOpenFamily(
        item.owners[0]!.baseword_key,
        { ...familyEvidence(item.owners[0]!.baseword_key), context: item.context },
        item.surface,
        reviewTools(item),
      );
    else setWordSheet(item);
  };
  return (
    <View style={styles.content}>
      <ScreenHeader title="Check a text" intro="Paste text or scan a photo, then choose Check text." />
      <WordViewSelector />
      {editing || !current || !results.length ? (
        <>
          <ProgressiveDisclosure title="Scan text from a photo" open={ocrOpen} onOpenChange={setOcrOpen} keepMounted>
            <OcrInputPanel currentText={text} onApplyText={applyPhotoText} onWorkChange={setOcrWork} onReviewChange={setOcrReviewing} />
          </ProgressiveDisclosure>
          {!(ocrOpen&&ocrReviewing)?<View ref={editorRef} style={styles.editor}>
          <Text style={styles.editorLabel}>Text to check</Text>
          <AutoGrowingTextInput
            accessibilityLabel="Text to check"
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
          </View>:null}
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
            <Text style={styles.meta}>Tap a word to view it; choose Add to keep it.</Text>
            {results.length > 80 ? (
              <ActionButton
                kind="secondary"
                label="Words to explain ↓"
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
                    label="CPB100 sight words"
                    selected={cpbEnabled}
                    onPress={() => setCpbEnabled(!cpbEnabled)}
                  />
                  <ChoiceChip
                    label="HK family frequency"
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
          <PassageCoverage results={results} target={coverageTarget} onTarget={setCoverageTarget} onOutside={()=>{setFilter("outside");setMoreToolsOpen(true);setAllResultsOpen(true);setTimeout(()=>onRevealSection(allResultsRef.current),0);}} />
          <View
            ref={suggestionsRef}
            tabIndex={-1}
            accessibilityLabel="Words to explain"
            style={styles.resultContent}
          >
            {results.length > 80 ? (
              <ActionButton
                kind="secondary"
                label="↑ Back to text"
                onPress={() => onRevealSection(readerRef.current)}
              />
            ) : null}

            <PreteachPanel
              key={teaching.activeLessonId}
              text={checkedText!}
              results={results}
              teaching={teaching}
              judgements={wordJudgements}
              onOpenWord={openWord}
              onOpenList={onOpenTeachingList}
            />
          </View>
          <ProgressiveDisclosure title="More text tools" keepMounted open={moreToolsOpen} onOpenChange={setMoreToolsOpen}>
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
          <ProgressiveDisclosure title="Check word familiarity" keepMounted>
            <KnowledgeTestPanel
              key={teaching.activeLessonId}
              text={checkedText!}
              results={results}
              teaching={teaching}
              judgements={wordJudgements}
              onJudge={judgeWord}
              onHasResponsesChange={setKnowledgeWork}
            />
          </ProgressiveDisclosure>
            {results.some(item=>item.normalizedAnalysis?.applied) ? <Text style={styles.meta}>Original text: {results.length} words. With short forms and spelling variants expanded: {normalizedCounts(results).tokens} words, {normalizedCounts(results).families} matched families; {normalizedCounts(results).wordList} words in the HK-ELE Word List.</Text> : null}
            <ProgressiveDisclosure title="Readability estimates">
              <ComplexityPanel text={checkedText!} results={results} />
            </ProgressiveDisclosure>
            <View ref={allResultsRef}><ProgressiveDisclosure title="All word results" keepMounted open={allResultsOpen} onOpenChange={setAllResultsOpen}>
              <Text style={styles.meta}>Choose a word to see every occurrence in your text.</Text>
            <ProgressiveDisclosure title="Choose several words" keepMounted>
            <LessonWordPicker
              key={`${checkedText}:${teaching.activeLessonId}`}
              showHeading={false}
              results={results}
              teaching={teaching}
              onOpenList={onOpenTeachingList}
            />
            </ProgressiveDisclosure>
              <View style={styles.actions}>
                {(
                  [
                    ["all", `All (${results.length})`],
                    ["outside", `Outside ${coverageTarget}% list (${results.filter(item=>!occurrenceInCoverage(item,coverageTarget)).length})`],
                    ["candidate", `${coverageTarget}% list (${counts.candidate})`],
                    ["other", `Other words (${counts.other})`],
                    ["compound", `Compounds (${counts.compound})`],
                    ["grammar", `Short forms (${counts.grammar})`],
                    ["cpb", `CPB100 words (${counts.cpb})`],
                    ["unavailable", `Check online (${counts.unavailable})`],
                    ["unmatched", `Not matched (${counts.unmatched})`],
                    ["review", `Check in context (${counts.review})`],
                  ] as Array<[ResultFilter, string]>
                )
                  .filter(([value]) => value === "all" || value === "outside" || counts[value as keyof typeof counts] > 0)
                  .map(([value, label]) => (
                    <ChoiceChip
                      key={value}
                      label={label}
                      selected={filter === value}
                      onPress={() => {
                        setFilter(value);
                        setGroupLimit(OCCURRENCE_BATCH_SIZE);
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
                {visible.length} word {visible.length === 1 ? "occurrence" : "occurrences"} · {groups.length} different {groups.length === 1 ? "form" : "forms"}
              </Text>
              {groups.slice(0, groupLimit).map((group) => (
                <View key={group.key} style={styles.groupRow}>
                  <ActionButton kind="secondary" label={`${group.form} · ${group.count} ${group.count === 1 ? "occurrence" : "occurrences"}`} onPress={() => setOccurrencesWord(group.form)} />
                  <Text style={styles.meta}>
                    {group.family === "No single family" ? group.status : `${group.family} · ${group.status}`}
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
            </ProgressiveDisclosure></View>
          </ProgressiveDisclosure>
        </View>
      ) : null}
      <TextOccurrencesModal surface={occurrencesWord} results={results} text={checkedText ?? ""} onClose={() => setOccurrencesWord(null)} onOpenWord={openWord} />
      <TextWordSheet
        teaching={teaching}
        reviewTools={wordSheet ? reviewTools(wordSheet) : undefined}
        item={wordSheet}
        onClose={() => setWordSheet(null)}
        onOpenFamily={(key, surface, context) =>
          onOpenFamily(key, { members: [{ surface, count: 1 }], count: 1, context }, surface, wordSheet && surface === wordSheet.surface ? reviewTools(wordSheet) : undefined)
        }
        onRetry={() => void analyze()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: spacing.md },
  editorLabel: { color: colors.ink, fontSize: 19, fontWeight: "700" },
  resultContent: { gap: spacing.md },
  hiddenResults: { display: "none" },
  content: { padding: spacing.lg, gap: spacing.md },
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 19,
    lineHeight: 29,
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
  meta: { fontSize: 16, lineHeight: 24, color: colors.muted },
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
    fontSize: 18,
    color: colors.ink,
    width: 95,
    backgroundColor: colors.surface,
    minHeight: 44,
  },
  error: { fontSize: 17, lineHeight: 25, color: colors.danger },
  groupRow: {
    backgroundColor: colors.canvas,
    padding: spacing.sm,
    borderRadius: 9,
    gap: spacing.xs,
  },
  groupTitle: { fontSize: 18, color: colors.ink, fontWeight: "700" },
});
