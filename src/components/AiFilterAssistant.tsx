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
import type { HkeleRepository } from "../domain/hkele";
import { getAnonymousSessionId } from "../services/anonymousSession";
import { interpretAiFilter } from "../services/aiFilterClient";
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
  onApply: (execution: AiFilterExecution) => void;
  onUseManualFilters: () => void;
  editRequestNonce: number;
}

export function AiFilterAssistant({
  repository,
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
      setError("AI anti-abuse protection is not ready. Manual filters remain available.");
      return;
    }
    setBusy(true);
    setError("");
    setInterpretation(null);
    try {
      setInterpretation(
        await interpretAiFilter(
          {
            query,
            locale: /[\u3400-\u9fff]/u.test(query) ? "zh-HK" : "en-HK",
            surface: "browse",
          },
          { turnstileToken, anonymousSessionId },
        ),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "AI search is unavailable. Manual filters remain available.",
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
      const context = await prepareAiFilterContext(repository);
      onApply(executeAiFilter(context, interpretation.filters));
      setExpanded(false);
    } catch {
      setError(
        "The controlled filter could not be applied. Nothing changed; manual filters remain available.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (Platform.OS !== "web") {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Find words with AI</Text>
        <Text style={styles.description}>
          AI is not available in this native build. Exact search, manual filters, Check a text,
          Teaching list, detail and exports remain available.
        </Text>
        <ActionButton kind="secondary" label="Use manual filters" onPress={onUseManualFilters} />
      </View>
    );
  }

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
            Optional request interpreter · teacher confirmation required
          </Text>
        </View>
        <Text aria-hidden style={styles.chevron}>
          {expanded ? "Close −" : "Open +"}
        </Text>
      </Pressable>
      {!aiRuntimeConfiguration.configured && !expanded ? (
        <View style={styles.unavailableRow}>
          <Text style={styles.unavailableText}>AI is offline or not configured.</Text>
          <ActionButton kind="secondary" label="Use manual filters" onPress={onUseManualFilters} />
        </View>
      ) : null}
      {expanded ? (
        <View style={styles.expandedBody}>
          <Text style={styles.description}>
            Only this short request is sent. Classroom text, notes and lists stay local. Confirmed
            conditions are applied deterministically to registered principal data.
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
          <Text style={styles.quickTitle}>Verified quick examples</Text>
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
          <Text style={styles.verifiedNote}>
            Verified against the 3,430-family principal payload; no example hard-codes a result.
          </Text>
          <TurnstileGate onTokenChange={setTurnstileToken} resetNonce={turnstileResetNonce} />
          <View style={styles.actions}>
            <ActionButton
              disabled={busy || !query.trim() || !turnstileToken || !anonymousSessionId}
              label="Preview"
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
                label="Use manual filters"
                onPress={onUseManualFilters}
              />
            </View>
          ) : null}
          {interpretation ? (
            <View style={styles.summary}>
              <Text accessibilityRole="header" aria-level={3} style={styles.summaryTitle}>
                Confirm the AI interpretation
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
                  This request needs a field that is not authoritative in the current data. No
                  filter was applied.
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
