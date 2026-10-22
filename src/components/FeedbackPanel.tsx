import { useEffect, useState } from "react";
import {
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import configuration from "../config/feedbackForms.json";
import {
  buildFeedbackUrl,
  registeredFeedbackWord,
  type FeedbackContext,
  type FeedbackKind,
} from "../services/feedbackService";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";

export interface FeedbackRequest {
  kind: FeedbackKind;
  context: FeedbackContext;
}

export function FeedbackPanel({
  request,
  onClose,
}: {
  request: FeedbackRequest | null;
  onClose: () => void;
}) {
  const [word, setWord] = useState("");
  const [message, setMessage] = useState("");
  const [changeWord, setChangeWord] = useState(false);
  useEffect(() => {
    setWord(request?.context.word ?? "");
    setMessage("");
    setChangeWord(false);
  }, [request]);
  if (!request) return null;
  const canonicalWord = request.context.registeredForms
    ? registeredFeedbackWord(word, request.context.registeredForms)
    : word.trim();
  const context = { ...request.context, word: canonicalWord ?? "" };
  const url = buildFeedbackUrl(request.kind, context, configuration);
  const rating = request.kind === "rating";
  const openForm = async () => {
    if (!url) return;
    try {
      await Linking.openURL(url);
      setMessage("Google Form opened. Complete and submit your feedback there.");
    } catch {
      setMessage("The form could not be opened. Please try again when online.");
    }
  };
  return (
    <Modal animationType="slide" visible onRequestClose={onClose} presentationStyle="fullScreen">
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ActionButton kind="secondary" label="← Back to your work" onPress={onClose} />
          <Text accessibilityRole="header" aria-level={1} style={styles.heading}>
            {rating ? "Rate this word" : "Report a problem"}
          </Text>
          <Text style={styles.body}>
            {rating
              ? "Rate how easy this word is to teach and how suitable it is for your students."
              : "Tell us what happened and what you expected. Please leave out student names, classroom photos and full source texts."}
          </Text>
          {request.context.family || request.context.expressionId ? (
            <View style={styles.context}>
              <Text style={styles.value}>{canonicalWord || word}</Text>
              <Text style={styles.label}>
                {request.context.expressionId ? "Compound" : `Family: ${request.context.family}`}
              </Text>
              <ActionButton
                kind="secondary"
                label={changeWord ? "Done" : "Change word"}
                onPress={() => setChangeWord(!changeWord)}
              />
              {changeWord ? (
                <TextInput
                  accessibilityLabel="Word for feedback"
                  value={word}
                  onChangeText={setWord}
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              ) : null}
              {!canonicalWord ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  Choose a word form shown in this family.
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.note}>
            {context.product} · {context.page}
          </Text>
          <Text style={styles.body}>
            {request.context.family || request.context.expressionId
              ? "Your word and page details are filled in."
              : "Your page details are filled in."}{" "}
            Submit your response in Google Forms.
          </Text>
          <ActionButton
            disabled={!url}
            label="Continue to Google Form ↗"
            onPress={() => void openForm()}
          />
          {!url ? (
            <Text style={styles.note}>Feedback will be available soon. Nothing has been sent.</Text>
          ) : null}
          {message ? (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {message}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    maxWidth: 600,
    width: "100%",
    alignSelf: "center",
  },
  heading: { color: colors.ink, fontSize: 29, fontWeight: "700", lineHeight: 36 },
  body: { color: colors.ink, fontSize: 17, lineHeight: 26 },
  note: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  context: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 14,
    gap: spacing.sm,
  },
  label: { color: colors.muted, fontSize: 15 },
  value: { color: colors.ink, fontSize: 21, fontWeight: "600" },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: colors.ink,
    fontSize: 18,
    minHeight: 48,
  },
  error: { color: colors.danger, fontSize: 16, lineHeight: 23 },
});
