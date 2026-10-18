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
import type { AiFilterResult } from "../domain/aiFilterSchema";
import { VERIFIED_AI_QUICK_EXAMPLES } from "../domain/verifiedAiExamples";
import type { BrowseScope, HkeleRepository } from "../domain/hkele";
import { getAnonymousSessionId } from "../services/anonymousSession";
import { AiFilterClientError, interpretAiFilter } from "../services/aiFilterClient";
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
  const inputRef = useRef<TextInput>(null);
  const latestScope = useRef(scope);
  latestScope.current = scope;

  useEffect(() => {
    setInterpretation(null);
    setError("");
  }, [scope]);

  useEffect(() => {
    if (editRequestNonce === 0) return;
    setExpanded(true);
    setInterpretation(null);
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [editRequestNonce]);

  const interpret = async () => {
    if (!query.trim()) return;
    if (!aiRuntimeConfiguration.configured || !turnstileToken || !anonymousSessionId) {
      setError("Please finish the verification below, then try again.");
      return;
    }
    setBusy(true);
    setError("");
    setInterpretation(null);
    try {
      setInterpretation(
        teacherAiResult(
          await interpretAiFilter(
            {
              query: teacherAiInterpreterQuery(query),
              locale: /[\u3400-\u9fff]/u.test(query) ? "zh-HK" : "en-HK",
              surface: "browse",
            },
            { turnstileToken, anonymousSessionId },
          ),
          teacherAiScope(query, latestScope.current),
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof AiFilterClientError
          ? reason.message
          : "We couldn't complete the search. Try again or use the word filters below.",
      );
    } finally {
      setTurnstileToken(null);
      setTurnstileResetNonce((value) => value + 1);
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!interpretation?.filters) return;
    setBusy(true);
    setError("");
    try {
      const context = await prepareAiFilterContext(
        repository,
        interpretation.filters.scope === "full" ? "full" : "core",
      );
      onApply(executeAiFilter(context, interpretation.filters));
      setExpanded(false);
    } catch {
      setError(
        interpretation.filters.scope === "full"
          ? "We couldn't load the full database for these filters. Reconnect and try again, or choose Core list."
          : "We couldn't show these results. Try again or adjust the word filters below.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (Platform.OS !== "web" || !aiRuntimeConfiguration.configured) return null;

  return (
    <View style={styles.panel}>
      <Pressable
        accessibilityLabel={`${expanded ? "Close" : "Open"} Find words with AI`}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.compactHeader, pressed && styles.pressed]}
      >
        <View style={styles.compactText}>
          <Text accessibilityRole="header" aria-level={2} style={styles.title}>
            Find words with AI
          </Text>
          <Text style={styles.compactDescription}>
            Find words for your lesson in the selected list.
          </Text>
        </View>
        <Text aria-hidden style={styles.chevron}>
          {expanded ? "Close −" : "Open +"}
        </Text>
      </Pressable>
      {expanded ? (
        <View style={styles.expandedBody}>
          <Text style={styles.description}>
            Search {scope === "core" ? "Core list" : "Full database"}. Review the suggested filters
            before seeing the words. Only this request is shared with the AI service.
          </Text>
          <TextInput
            accessibilityLabel="Describe the words to find"
            editable={!busy}
            maxLength={300}
            multiline
            onChangeText={setQuery}
            placeholder="Example: Find 10 words first observed by P4 with HK rank 1–2000 and suffix -tion"
            ref={inputRef}
            style={styles.input}
            value={query}
          />
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
          <TurnstileGate onTokenChange={setTurnstileToken} resetNonce={turnstileResetNonce} />
          <View style={styles.actions}>
            <ActionButton
              disabled={busy || !query.trim() || !turnstileToken || !anonymousSessionId}
              label={busy ? "Finding filters…" : "Review suggested filters"}
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
          {error ? (
            <View style={styles.errorBox}>
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
              <ActionButton
                kind="secondary"
                label="Choose filters yourself"
                onPress={onUseManualFilters}
              />
            </View>
          ) : null}
          {interpretation ? (
            <View style={styles.summary}>
              <Text accessibilityRole="header" aria-level={3} style={styles.summaryTitle}>
                Review your search
              </Text>
              <Text style={styles.summaryText}>{interpretation.summary}</Text>
              {interpretation.filters
                ? describeAiFilterConditions(interpretation.filters).map((condition) => (
                    <Text key={condition} style={styles.condition}>
                      • {condition}
                    </Text>
                  ))
                : null}
              {interpretation.clarifyingQuestion ? (
                <Text style={styles.question}>{interpretation.clarifyingQuestion}</Text>
              ) : null}
              {interpretation.warnings.map((warning) => (
                <Text key={warning} style={styles.warning}>
                  • {warning}
                </Text>
              ))}
              {interpretation.status === "unsupported" ? (
                <Text style={styles.error}>
                  We can't search for that information yet. Try one of the examples or choose
                  filters yourself.
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
  chevron: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  compactDescription: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  compactHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 48,
    padding: spacing.md,
  },
  compactText: { flex: 1, gap: spacing.xs },
  condition: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  description: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  error: { color: colors.danger, fontSize: 15, lineHeight: 22 },
  errorBox: { gap: spacing.sm },
  expandedBody: { gap: spacing.sm, padding: spacing.md, paddingTop: 0 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
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
  question: { color: colors.ink, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  quickTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: 11,
    gap: spacing.sm,
    padding: spacing.md,
  },
  summaryText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  summaryTitle: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  unavailableRow: {
    alignItems: "flex-start",
    flexDirection: "column",
    gap: spacing.sm,
    padding: spacing.md,
    paddingTop: 0,
  },
  unavailableText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  verifiedNote: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  warning: { color: colors.accent, fontSize: 15, lineHeight: 22 },
});
