import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { ocrAdapter } from "../services/ocr/ocrAdapter";
import { recognizeToEditableText } from "../services/ocr/OcrContract";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";

interface Props {
  currentText: string;
  onApplyText: (text: string) => void;
}

export function OcrInputPanel({ currentText, onApplyText }: Props) {
  const [recognizedText, setRecognizedText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const supported = ocrAdapter.isSupported();

  const processResult = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) {
      setMessage("Image selection was cancelled. Existing text was not changed.");
      return;
    }
    const asset = result.assets[0];
    if (!asset?.uri) {
      setMessage("The selected image did not provide a local file URI.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const recognized = await recognizeToEditableText(ocrAdapter, asset.uri);
      setRecognizedText(recognized.text);
      setMessage(
        `${recognized.lineCount} text line${recognized.lineCount === 1 ? "" : "s"} recognized on device. Review and edit before using it.`,
      );
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setMessage("Camera permission was not granted. Paste text or choose an existing image.");
      return;
    }
    await processResult(
      await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        mediaTypes: ["images"],
        quality: 1,
      }),
    );
  };

  const chooseImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage("Photo-library permission was not granted. Paste text or use the camera.");
      return;
    }
    await processResult(
      await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ["images"],
        quality: 1,
      }),
    );
  };

  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" style={styles.title}>
        Camera and on-device OCR
      </Text>
      <Text style={styles.note}>
        The image stays on this device and is not uploaded by the App. OCR creates editable source
        text only; it never chooses a word family. Paste and manual editing remain available.
      </Text>
      <View style={styles.actions}>
        <ActionButton
          disabled={!supported || busy}
          kind="secondary"
          label="Take photo"
          onPress={() => void takePhoto()}
        />
        <ActionButton
          disabled={!supported || busy}
          kind="secondary"
          label="Choose image"
          onPress={() => void chooseImage()}
        />
      </View>
      {!supported ? (
        <Text style={styles.notice}>
          Native OCR is unavailable in this Web build. Use an Android or iOS development/release
          build, or paste text below.
        </Text>
      ) : null}
      {busy ? <ActivityIndicator accessibilityLabel="Recognizing text on device" /> : null}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
      {recognizedText ? (
        <View style={styles.review}>
          <Text style={styles.reviewTitle}>Editable OCR result</Text>
          <TextInput
            accessibilityLabel="Editable OCR result"
            multiline
            onChangeText={setRecognizedText}
            style={styles.textarea}
            textAlignVertical="top"
            value={recognizedText}
          />
          <View style={styles.actions}>
            <ActionButton label="Use OCR text" onPress={() => onApplyText(recognizedText)} />
            <ActionButton
              disabled={!currentText.trim()}
              kind="secondary"
              label="Append OCR text"
              onPress={() =>
                onApplyText(
                  `${currentText.trimEnd()}${currentText.trim() ? "\n" : ""}${recognizedText}`,
                )
              }
            />
            <ActionButton
              kind="danger"
              label="Discard OCR result"
              onPress={() => {
                setRecognizedText("");
                setMessage("OCR result discarded. Existing text was not changed.");
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  box: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  message: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  notice: {
    backgroundColor: colors.warningSoft,
    borderRadius: 9,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
    padding: spacing.sm,
  },
  review: { gap: spacing.sm },
  reviewTitle: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  textarea: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 130,
    padding: spacing.sm,
  },
  title: { color: colors.ink, fontSize: 19, fontWeight: "800" },
});
