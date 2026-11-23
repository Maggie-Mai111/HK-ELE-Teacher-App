import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { aiRuntimeConfiguration } from "../config/runtime";
import { aiEvidenceForms, loadAiFormEvidence } from "../services/aiFormEvidence";
import { filterAiWordEvidence, hasAiWordConditions } from "../services/aiFormFilter";
import type { AiFilterResult } from "../domain/aiFilterSchema";
import { VERIFIED_AI_QUICK_EXAMPLES } from "../domain/verifiedAiExamples";
import type { BrowseScope, HkeleRepository } from "../domain/hkele";
import { getAnonymousSessionId } from "../services/anonymousSession";
import { AiFilterClientError, interpretAiFilter } from "../services/aiFilterClient";
import { AI_OFFLINE_MESSAGE, isAiNetworkOnline } from "../services/aiConnectivity";
import {
  teacherAiResult,
  teacherAiScope,
  teacherAiInterpreterQuery,
} from "../services/teacherAiPresentation";
import {
  describeAiFilterConditions,
  executeAiFilter,
  prepareAiFilterContext,
  type AiFilterExecution,
} from "../services/aiFilterExecutor";
import { getWordView, wordViewLabels } from "../services/wordView";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { TurnstileGate } from "./TurnstileGate";

interface Props {
  repository: HkeleRepository;
  scope?: BrowseScope;
  onApply: (execution: AiFilterExecution) => void;
  onUseManualFilters: () => void;
  editRequestNonce: number;
}

export function AiFilterAssistant({
  repository,
  scope = "full",
  onApply,
  onUseManualFilters,
  editRequestNonce,
}: Props) {
  const [query, setQuery] = useState("");
  const [interpretation, setInterpretation] = useState<AiFilterResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetNonce, setTurnstileResetNonce] = useState(0);
  const [anonymousSessionId] = useState(() => getAnonymousSessionId());
  const [expanded, setExpanded] = useState(false);
  const [online, setOnline] = useState(isAiNetworkOnline);
  const pendingRequest = useRef<AbortController | null>(null);
  const inputRef = useRef<TextInput>(null);
  const latestBrowse = useRef({ scope, repository });
  latestBrowse.current = { scope, repository };
  const browseIsCurrent = () => latestBrowse.current.scope === scope && latestBrowse.current.repository === repository;

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const update = () => {
      const connected = isAiNetworkOnline();
      setOnline(connected);
      setTurnstileToken(null);
      setTurnstileResetNonce((value) => value + 1);
      setError("");
      if (!connected) pendingRequest.current?.abort();
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      pendingRequest.current?.abort();
    };
  }, []);

  useEffect(() => {
    pendingRequest.current?.abort();
    setInterpretation(null);
    setError("");
  }, [scope, repository]);

  useEffect(() => {
    if (editRequestNonce === 0) return;
    setExpanded(true);
    setInterpretation(null);
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [editRequestNonce]);

  const interpret = async () => {
    if (!query.trim()) return;
    if (!isAiNetworkOnline()) {
      setOnline(false);
      return;
    }
    if (!aiRuntimeConfiguration.configured || !turnstileToken || !anonymousSessionId) {
      setError("Please finish the verification below, then try again.");
      return;
    }
    setBusy(true);
    setError("");
    setInterpretation(null);
    const controller = new AbortController();
    pendingRequest.current = controller;
    try {
      const raw = await interpretAiFilter(
        {
          query: teacherAiInterpreterQuery(query),
          locale: /[\u3400-\u9fff]/u.test(query) ? "zh-HK" : "en-HK",
          surface: "browse",
        },
        { turnstileToken, anonymousSessionId },
        { signal: controller.signal },
      );
      if (!controller.signal.aborted && browseIsCurrent())
        setInterpretation(teacherAiResult(raw, teacherAiScope(query, scope, raw)));
    } catch (reason) {
      if (controller.signal.aborted) return;
      setError(
        reason instanceof AiFilterClientError
          ? reason.message
          : "We couldn't complete the search. Try again or search for a word above.",
      );
    } finally {
      setTurnstileToken(null);
      setTurnstileResetNonce((value) => value + 1);
      setBusy(false);
      if (pendingRequest.current === controller) pendingRequest.current = null;
    }
  };

  const confirm = async () => {
    if (!interpretation?.filters) return;
    setBusy(true);
    setError("");
    try {
      const reviewedScope = teacherAiScope(query, scope, interpretation);
      const context = await prepareAiFilterContext(repository, reviewedScope);
      if (!browseIsCurrent()) return;
      if (hasAiWordConditions(interpretation.filters)) {
        const evidence = await loadAiFormEvidence(await repository.getDataVersion!());
        if (!browseIsCurrent()) return;
        onApply({
          ...filterAiWordEvidence(context, interpretation.filters, (key) =>
            aiEvidenceForms(evidence, key),
          ),
          browseScope: reviewedScope,
        });
      } else
        onApply({
          ...executeAiFilter(context, interpretation.filters),
          browseScope: reviewedScope,
        });
      setExpanded(false);
    } catch {
      setError(
        interpretation.filters.scope === "full"
          ? "We couldn't load the full database for these filters. Reconnect and try again, or choose HK-ELE Word List."
          : "We couldn't show these results. Try again or search for a word above.",
      );
    } finally {
      setBusy(false);
    }
  };

  const searchConditions = interpretation?.status === "ready" && interpretation.filters
    ? describeAiFilterConditions(interpretation.filters, teacherAiScope(query, scope, interpretation))
    : [];
  if (searchConditions.length)
    searchConditions.splice(1, 0, `Vocabulary set: ${wordViewLabels[getWordView()]}`);

  if (Platform.OS !== "web") return null;

  return (
    <View style={styles.panel}>
      <Pressable
        accessibilityLabel={`${expanded ? "Close" : "Open"} Find words with AI`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        aria-expanded={expanded}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.compactHeader, pressed && styles.pressed]}
      >
        <View style={styles.compactText}>
          <Text accessibilityRole="header" aria-level={2} style={styles.title}>
            Find words with AI
          </Text>
          <Text style={styles.compactDescription}>Describe the words you need.</Text>
        </View>
        <Text aria-hidden style={styles.chevron}>
          {expanded ? "Close −" : "Open +"}
        </Text>
      </Pressable>
      {expanded && !aiRuntimeConfiguration.configured ? (
        <View style={styles.unavailableRow}>
          <Text role="status" style={styles.unavailableText}>
            AI search is temporarily unavailable here. You can still search for a word above.
          </Text>
        </View>
      ) : expanded ? (
        <View style={styles.expandedBody}>
          {!online ? (
            <Text role="status" style={styles.description}>
              {AI_OFFLINE_MESSAGE}
            </Text>
          ) : null}
          <Text style={styles.description}>
            {scope === "full"
              ? "Search all entries in this vocabulary set."
              : `Search the ${scope === "core95" ? "95% list" : "90% list"} in this vocabulary set.`}
          </Text>
          <TextInput
            accessibilityLabel="Describe the words to find"
            editable={!busy}
            maxLength={300}
            multiline
            onChangeText={(value) => {
              setQuery(value);
              setInterpretation(null);
              setError("");
            }}
            placeholder="Example: Find words with the root act."
            ref={inputRef}
            style={styles.input}
            value={query}
          />
          <Text style={styles.description}>Your request goes to the AI service. Leave out classroom text and student names.</Text>
          <Text style={styles.quickTitle}>Try an example</Text>
          <View style={styles.actions}>
            {VERIFIED_AI_QUICK_EXAMPLES.map((example) => (
              <ActionButton
                disabled={busy}
                key={example.id}
                kind="secondary"
                label={example.label}
                onPress={() => {
                  setQuery(example.query);
                  setInterpretation(null);
                  setError("");
                }}
              />
            ))}
          </View>
          {online ? (
            <TurnstileGate onTokenChange={setTurnstileToken} resetNonce={turnstileResetNonce} />
          ) : null}
          <View style={styles.actions}>
            <ActionButton
              disabled={!online || busy || !query.trim() || !turnstileToken || !anonymousSessionId}
              label={busy ? "Preparing your search…" : "Review search"}
              onPress={() => void interpret()}
            />
            {interpretation ? (
              <ActionButton
                disabled={busy}
                kind="secondary"
                label="Edit request"
                onPress={() => {
                  setInterpretation(null);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
              />
            ) : null}
          </View>
          {busy ? <ActivityIndicator accessibilityLabel="Working" color={colors.primary} /> : null}
          {error && online ? (
            <View style={styles.errorBox}>
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
              <ActionButton
                kind="secondary"
                label="Browse and sort words"
                onPress={onUseManualFilters}
              />
            </View>
          ) : null}
          {interpretation ? (
            <View style={styles.summary}>
              <Text accessibilityRole="header" aria-level={3} style={styles.summaryTitle}>
                Review your search
              </Text>
              {searchConditions.map((condition) => (
                <Text key={condition} style={styles.condition}>• {condition}</Text>
              ))}
              {interpretation.status === "needs_clarification" ? (
                <Text style={styles.question}>{interpretation.clarifyingQuestion || "Which words would you like to find?"}</Text>
              ) : null}
              {interpretation.warnings
                .filter((warning) => !/^No filters? (?:was|were) applied\.?$/i.test(warning))
                .map((warning) => (
                  <Text key={warning} style={styles.warning}>
                    • {warning}
                  </Text>
                ))}
              {interpretation.status === "unsupported" ? (
                <Text style={styles.error}>
                  We can't search for that information yet. Try one of the examples or search for a
                  word above.
                </Text>
              ) : null}
              {interpretation.status === "ready" ? (
                <ActionButton
                  disabled={busy}
                  label="Show matching words"
                  onPress={() => void confirm()}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chevron: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  compactDescription: { color: colors.muted, fontSize: 18, lineHeight: 26 },
  compactHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 48,
    padding: spacing.md,
  },
  compactText: { flex: 1, gap: spacing.xs },
  condition: { color: colors.ink, fontSize: 18, lineHeight: 26 },
  description: { color: colors.muted, fontSize: 18, lineHeight: 26 },
  error: { color: colors.danger, fontSize: 18, lineHeight: 26 },
  errorBox: { gap: spacing.sm },
  expandedBody: { gap: spacing.sm, padding: spacing.md, paddingTop: 0 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 18,
    minHeight: 88,
    padding: spacing.md,
    textAlignVertical: "top",
  },
  panel: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: 15,
    borderWidth: 1,
    overflow: "hidden",
  },
  pressed: { backgroundColor: colors.subdued },
  question: { color: colors.ink, fontSize: 18, fontWeight: "700", lineHeight: 26 },
  quickTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: 11,
    gap: spacing.sm,
    padding: spacing.md,
  },
  summaryTitle: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  unavailableRow: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing.sm,
    padding: spacing.md,
    paddingTop: 0,
  },
  unavailableText: { color: colors.muted, fontSize: 18, lineHeight: 26 },
  verifiedNote: { color: colors.muted, fontSize: 18, lineHeight: 26 },
  warning: { color: colors.accent, fontSize: 18, lineHeight: 26 },
});
