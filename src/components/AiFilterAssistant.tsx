import { useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { aiRuntimeConfiguration } from "../config/runtime";
import type { AiFilterResult } from "../domain/aiFilterSchema";
import { VERIFIED_AI_QUICK_EXAMPLES } from "../domain/verifiedAiExamples";
import type { HkeleRepository } from "../domain/hkele";
import { getAnonymousSessionId } from "../services/anonymousSession";
import { interpretAiFilter } from "../services/aiFilterClient";
import {
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
}

export function AiFilterAssistant({ repository, onApply }: Props) {
  const [query, setQuery] = useState("");
  const [interpretation, setInterpretation] = useState<AiFilterResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetNonce, setTurnstileResetNonce] = useState(0);
  const [anonymousSessionId] = useState(() => getAnonymousSessionId());

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
        <Text style={styles.title}>AI-assisted word selection</Text>
        <Text style={styles.description}>
          Native AI transport remains pending. Browse, Check a Text, Teaching List, detail and
          exports continue without AI.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>AI-assisted word selection</Text>
      <Text style={styles.description}>
        Optional online helper. Only this short request is sent; classroom text, notes, lists and
        HK-ELE data stay local. Results always come from registered principal data after you
        confirm.
      </Text>
      <TextInput
        accessibilityLabel="Describe the words to find"
        editable={!busy}
        maxLength={300}
        multiline
        onChangeText={setQuery}
        placeholder="Example: Find 10 words first observed by P4 with HK rank 1–2000 and suffix -tion"
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
        These examples were checked against the 3,430-family principal payload and each has at least
        one deterministic match.
      </Text>
      <TurnstileGate onTokenChange={setTurnstileToken} resetNonce={turnstileResetNonce} />
      <View style={styles.actions}>
        <ActionButton
          disabled={busy || !query.trim() || !turnstileToken || !anonymousSessionId}
          label="Interpret request"
          onPress={() => void interpret()}
        />
        {interpretation ? (
          <ActionButton
            disabled={busy}
            kind="secondary"
            label="Modify request"
            onPress={() => setInterpretation(null)}
          />
        ) : null}
      </View>
      {busy ? <ActivityIndicator accessibilityLabel="Working" color={colors.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {interpretation ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>AI understanding summary</Text>
          <Text style={styles.summaryText}>{interpretation.summary}</Text>
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
              This request needs a field that is not authoritative in the current data. No filter
              was applied.
            </Text>
          ) : null}
          {interpretation.status === "ready" ? (
            <ActionButton
              disabled={busy}
              label="Confirm and apply"
              onPress={() => void confirm()}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  description: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 21 },
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
    gap: spacing.sm,
    padding: spacing.md,
  },
  question: { color: colors.ink, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  quickTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: 11,
    gap: spacing.sm,
    padding: spacing.md,
  },
  summaryText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  summaryTitle: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  verifiedNote: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  warning: { color: colors.accent, fontSize: 14, lineHeight: 21 },
});
