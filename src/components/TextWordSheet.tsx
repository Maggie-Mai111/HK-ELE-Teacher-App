import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { ResolvedOccurrence } from "../domain/hkele";
import { grammaticalRelationDisplay } from "../services/grammaticalRelationService";
import { textWordAction } from "../services/textReaderService";
import { colors, spacing } from "../theme/tokens";
import { useAppDimensions } from "./useAppDimensions";
import { MarkedContext } from "./MarkedContext";
import { TextReviewActions, type TextReviewTools } from "./TextReviewActions";
import { ActionButton } from "./ActionButton";
import { CompoundCard } from "./CompoundCard";
import type { TeachingListStore } from "../services/teachingListService";

export function TextWordSheet({
  item,
  onClose,
  onOpenFamily,
  onRetry,
  teaching,
  reviewTools,
}: {
  item: ResolvedOccurrence | null;
  onClose: () => void;
  onOpenFamily: (key: string, surface: string, context: string) => void;
  onRetry: () => void;
  teaching?: TeachingListStore;
  reviewTools?: TextReviewTools | undefined;
}) {
  const { height } = useAppDimensions();
  if (!item) return null;
  const action = textWordAction(item);
  const owners = item.owners.filter((owner) => !owner.blocked && !owner.display_blocked);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityLabel="Close word information"
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={[styles.sheet, { maxHeight: height - 32 }]}>
          <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: spacing.md }}>
          <Text accessibilityRole="header" aria-level={2} style={styles.word}>
            {item.surface}
          </Text>
          {action === "compound" && item.expression && teaching ? (
            <CompoundCard
              expression={item.expression}
              teaching={teaching}
              source="Check a text"
              onOpenFamily={(key, form) => {
                onClose();
                onOpenFamily(key, form || item.surface, item.context);
              }}
            />
          ) : action === "choices" ? (
            <>
              <Text style={styles.note}>Choose the family that fits this sentence.</Text>
              {owners.map((owner) => (
                <ActionButton
                  key={owner.baseword_key}
                  kind="secondary"
                  label={owner.display_family}
                  onPress={() => {
                    onClose();
                    onOpenFamily(owner.baseword_key, item.surface, item.context);
                  }}
                />
              ))}
            </>
          ) : action === "grammar" && item.grammaticalRelation ? (
            <>
              <Text style={styles.label}>Full form</Text>
              <Text style={styles.note}>
                {grammaticalRelationDisplay(item.grammaticalRelation)}
              </Text>
            </>
          ) : action === "offline" ? (
            <>
              <Text style={styles.note}>Connect to look up this word.</Text>
              <ActionButton
                label="Check text again"
                onPress={() => {
                  onClose();
                  onRetry();
                }}
              />
            </>
          ) : (
            <Text style={styles.note}>
              {item.status === "BLOCKED"
                ? "Check how this word is used in the sentence."
                : item.status === "UNSUPPORTED"
                  ? "This part was not checked. You can still explore the other words."
                  : "Not automatically matched in this text. You can still explore the other words."}
            </Text>
          )}
          {reviewTools && /[A-Za-z]/.test(item.surface) ? <>
            <Text style={styles.note}>{reviewTools.excerpt ? <MarkedContext excerpt={reviewTools.excerpt} /> : item.context}</Text>
            <TextReviewActions key={item.occurrenceId} tools={reviewTools} />
          </> : null}
          </ScrollView>
          <ActionButton kind="secondary" label="Close" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 480,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.md,
  },
  word: { fontSize: 24, fontWeight: "800", color: colors.ink },
  label: { fontSize: 17, fontWeight: "700", color: colors.muted },
  note: { fontSize: 19, lineHeight: 28, color: colors.ink },
});
