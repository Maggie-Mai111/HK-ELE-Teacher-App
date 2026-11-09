import { useEffect, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { ocrAdapter } from "../services/ocr/ocrAdapter";
import { recognizeToEditableText } from "../services/ocr/OcrContract";
import { joinOcrWrappedLines } from "../services/ocr/ocrTextLayout";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { AutoGrowingTextInput } from "./AutoGrowingTextInput";

interface Props {
  currentText: string;
  onApplyText: (text: string) => void;
  onWorkChange?: (hasWork: boolean) => void;
  onReviewChange?: (reviewing: boolean) => void;
}
export function OcrInputPanel({ currentText, onApplyText, onWorkChange, onReviewChange }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [recognizedText, setRecognizedText] = useState("");
  const [originalText, setOriginalText] = useState<string|null>(null);
  const flowedText=originalText===null?"":joinOcrWrappedLines(originalText);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState("");
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const hasWork = Boolean(image || originalText!==null || busy);
  useEffect(() => onWorkChange?.(hasWork), [hasWork, onWorkChange]);
  useEffect(() => () => onWorkChange?.(false), [onWorkChange]);
  useEffect(()=>onReviewChange?.(originalText!==null),[originalText,onReviewChange]);
  useEffect(()=>()=>onReviewChange?.(false),[onReviewChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  const supported = ocrAdapter.isSupported();
  const choose = async (camera: boolean) => {
    try {
      if (Platform.OS !== "web") {
        const permission = camera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setMessage(
            "Permission was not granted. You can still paste text or choose another source.",
          );
          return;
        }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            mediaTypes: ["images"],
            quality: 1,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: false,
            mediaTypes: ["images"],
            quality: 1,
          });
      if (result.canceled) {
        setMessage("Selection cancelled.");
        return;
      }
      const asset = result.assets[0];
      if (!asset?.uri)
        throw new Error("This image could not be opened. Choose a JPG or PNG photo.");
      if (asset.fileSize && asset.fileSize > 12 * 1024 * 1024)
        throw new Error("Choose a photo smaller than 12 MB, or crop it first.");
      setImage(asset.uri);
      setRecognizedText("");
      setOriginalText(null);
      setReplaceConfirmed(false);
      setMessage("Photo ready. Recognition works best with clear printed English.");
    } catch (reason) {
      setMessage(
        reason instanceof Error &&
          [
            "This image could not be opened. Choose a JPG or PNG photo.",
            "Choose a photo smaller than 12 MB, or crop it first.",
          ].includes(reason.message)
          ? reason.message
          : "Photo selection failed. Choose an existing image or paste text.",
      );
    }
  };
  const recognize = async () => {
    if (!image || busy) return;
    const job = new AbortController();
    controller.current = job;
    setBusy(true);
    setMessage("");
    setProgress("Preparing photo…");
    const timeout = setTimeout(() => job.abort(), 120_000);
    try {
      const result = await recognizeToEditableText(ocrAdapter, image, {
        signal: job.signal,
        onProgress: (value) => {
          if (mounted.current && !job.signal.aborted) setProgress(value);
        },
      });
      if (mounted.current && !job.signal.aborted) {
        setOriginalText(result.text);
        setRecognizedText(joinOcrWrappedLines(result.text));
        setReplaceConfirmed(false);
        setMessage("Check the wording against your photo.");
      }
    } catch {
      if (mounted.current)
        setMessage(
          job.signal.aborted
            ? "Recognition stopped."
            : "We couldn't read this photo. Try a clearer image or paste text.",
        );
    } finally {
      clearTimeout(timeout);
      if (mounted.current) {
        setBusy(false);
        setProgress("");
      }
      if (controller.current === job) controller.current = null;
    }
  };
  const apply=(value:string)=>{
    onApplyText(value);
    setRecognizedText("");
    setOriginalText(null);
    setImage(null);
    setReplaceConfirmed(false);
    setMessage("");
  };
  const replace = () => {
    if (currentText.trim() && currentText!==recognizedText && !replaceConfirmed) {
      setReplaceConfirmed(true);
      setMessage("Replace your existing text? Choose Confirm replacement, or Add to existing text to keep both.");
      return;
    }
    apply(recognizedText);
  };
  return (
    <View style={styles.box}>
      <Text style={styles.note}>
        Take a photo or choose an image. Recognition happens on this device; your photo is not
        uploaded.
      </Text>
      <View style={styles.actions}>
        <ActionButton
          disabled={!supported || busy}
          kind="secondary"
          label="Take photo"
          onPress={() => void choose(true)}
        />
        <ActionButton
          disabled={!supported || busy}
          kind="secondary"
          label="Choose image"
          onPress={() => void choose(false)}
        />
      </View>
      {Platform.OS === "web" ? (
        <Text style={styles.note}>
          If your browser does not open the camera, take a photo first and choose it from your
          library.
        </Text>
      ) : null}
      {!supported ? (
        <Text style={styles.note}>
          Photo recognition is unavailable in this browser. Paste text instead.
        </Text>
      ) : null}
      {image ? (
        <Image
          accessibilityLabel="Selected photo preview"
          source={{ uri: image }}
          style={styles.image}
          resizeMode="contain"
        />
      ) : null}
      {image && !busy ? (
        <ActionButton
          label={originalText!==null ? "Recognize again" : "Recognize text"}
          onPress={() => void recognize()}
        />
      ) : null}
      {busy ? (
        <View style={styles.actions}>
          <ActivityIndicator accessibilityLabel="Recognizing text on device" />
          <Text accessibilityLiveRegion="polite" style={styles.note}>
            {progress}
          </Text>
          <ActionButton
            kind="secondary"
            label="Cancel recognition"
            onPress={() => {
              controller.current?.abort();
              setMessage("Stopping recognition…");
            }}
          />
        </View>
      ) : null}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
      {originalText!==null ? (
        <View style={styles.review}>
          <Text style={styles.title}>Review recognized text</Text>
          <AutoGrowingTextInput
            accessibilityLabel="Text from your photo"
            minimumHeight={240}
            editable={!busy}
            onChangeText={(value) => {
              setRecognizedText(value);
              setReplaceConfirmed(false);
            }}
            style={styles.textarea}
            textAlignVertical="top"
            value={recognizedText}
          />
          {originalText!==flowedText && (recognizedText===flowedText || recognizedText===originalText) ? (
            <ActionButton kind="secondary" disabled={busy}
              label={recognizedText===flowedText?"Keep photo line breaks":"Join wrapped lines"}
              onPress={()=>{setRecognizedText(recognizedText===flowedText?originalText:flowedText);setReplaceConfirmed(false);}}/>
          ):null}
          <View style={styles.actions}>
            <ActionButton
              disabled={!recognizedText.trim() || busy}
              label={replaceConfirmed ? "Confirm replacement" : "Use this text"}
              onPress={replace}
            />
            <ActionButton
              disabled={!currentText.trim() || !recognizedText.trim() || busy}
              kind="secondary"
              label="Add to existing text"
              onPress={() => {
                apply(`${currentText.trimEnd()}\n\n${recognizedText}`);
              }}
            />
            <ActionButton
              disabled={busy}
              kind="secondary"
              label="Discard photo and result"
              onPress={() => {
                setImage(null);
                setRecognizedText("");
                setOriginalText(null);
                setReplaceConfirmed(false);
                setMessage("Photo and result discarded. Existing text is unchanged.");
              }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, alignItems: "center" },
  box: { gap: spacing.md },
  image: { width: "100%", height: 180, backgroundColor: colors.canvas, borderRadius: 10 },
  message: { color: colors.ink, fontSize: 18, lineHeight: 27 },
  note: { color: colors.muted, fontSize: 17, lineHeight: 26 },
  review: { gap: spacing.md },
  title: { color: colors.ink, fontSize: 19, fontWeight: "700" },
  textarea: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    color: colors.ink,
    fontSize: 20,
    lineHeight: 27,
    minHeight: 160,
    padding: spacing.sm,
  },
});
