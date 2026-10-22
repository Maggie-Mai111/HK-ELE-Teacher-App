import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ChoiceChip } from "../components/ChoiceChip";
import { ScreenHeader } from "../components/ScreenHeader";
import { LessonLibraryControls } from "../components/LessonLibraryControls";
import type { TeachingListItem } from "../domain/teachingList";
import { LESSON_FOCUS_OPTIONS, lessonFocusLabel } from "../services/lessonPlanning";
import { exportTeachingList } from "../services/shareExport";
import type { TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";
import { CompoundCard } from "../components/CompoundCard";

interface Props {
  teaching: TeachingListStore;
  onOpenFamily: (basewordKey: string, selectedForm?: string) => void;
  onFindWords: () => void;
  onCheckText: () => void;
}

function ListItem({
  item,
  index,
  total,
  teaching,
  onOpenFamily,
}: {
  item: TeachingListItem;
  index: number;
  total: number;
  teaching: TeachingListStore;
  onOpenFamily: (basewordKey: string, selectedForm?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [chooseWord, setChooseWord] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(Boolean(item.connections));
  const [compoundOpen, setCompoundOpen] = useState(false);
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.order}>{index + 1}</Text>
          <Text style={styles.title}>{item.selectedForms.join(", ") || item.displayFamily}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${open ? "Close editing" : "Edit"} ${item.displayFamily}`}
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onPress={() => setOpen(!open)}
          style={styles.editButton}
        >
          <Text style={styles.editText}>{open ? "Done" : "Edit"}</Text>
        </Pressable>
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.plan, item.teachingFocus === "focus" && styles.focusPlan]}>
          {lessonFocusLabel(item.teachingFocus)}
        </Text>
        <Text style={styles.meta}>
          {item.recordType === "compound" ? "Compound" : `Family: ${item.displayFamily}`}
        </Text>
      </View>
      {item.dataReviewStatus ? <Text style={styles.meta}>{item.dataReviewStatus}</Text> : null}
      {!open && item.notes ? (
        <Text numberOfLines={2} style={styles.notePreview}>
          {item.notes}
        </Text>
      ) : null}
      {!open && item.connections ? (
        <Text numberOfLines={1} style={styles.meta}>
          Related: {item.connections}
        </Text>
      ) : null}
      {open ? (
        <View style={styles.editor}>
          <Text style={styles.label}>Your teaching plan</Text>
          <View style={styles.chips}>
            {LESSON_FOCUS_OPTIONS.map(({ value, label }) => (
              <ChoiceChip
                key={label}
                label={label}
                selected={(item.teachingFocus ?? "") === value}
                onPress={() => teaching.update(item.basewordKey, { teachingFocus: value })}
              />
            ))}
          </View>
          <Text style={styles.label}>Teaching note (optional)</Text>
          <TextInput
            accessibilityLabel={`Teaching notes for ${item.displayFamily}`}
            multiline
            onChangeText={(notes) => teaching.update(item.basewordKey, { notes })}
            placeholder="For example: compare reusable with disposable"
            style={styles.input}
            value={item.notes}
          />
          {relatedOpen ? (
            <>
              <Text style={styles.label}>Related words or example (optional)</Text>
              <TextInput
                accessibilityLabel={`Connections for ${item.displayFamily}`}
                multiline
                onChangeText={(connections) => teaching.update(item.basewordKey, { connections })}
                style={styles.input}
                value={item.connections}
                placeholder="A related word, topic or classroom example"
              />
            </>
          ) : (
            <ActionButton
              kind="secondary"
              label="Add related words or example"
              onPress={() => setRelatedOpen(true)}
            />
          )}
          <Text style={styles.label}>Selected words</Text>
          <View style={styles.chips}>
            {item.selectedForms.map((form) => (
              <View key={form} style={styles.formChip}>
                <Text style={styles.formChipText}>{form}</Text>
                <ActionButton
                  accessibilityLabel={`Remove selected form ${form}`}
                  kind="secondary"
                  label="×"
                  onPress={() => teaching.removeSelectedForm(item.basewordKey, form)}
                />
              </View>
            ))}
          </View>
          {teaching.sourceFor(item.basewordKey) ? (
            <Text style={styles.meta}>Added from: {teaching.sourceFor(item.basewordKey)}</Text>
          ) : null}
          {item.status !== "Notice" ? (
            <Text style={styles.meta}>Previous setting: {item.status}</Text>
          ) : null}
          <View style={styles.actions}>
            <ActionButton
              kind="secondary"
              label="View word information"
              onPress={() =>
                item.recordType === "compound"
                  ? setCompoundOpen(!compoundOpen)
                  : item.selectedForms.length > 1
                    ? setChooseWord(!chooseWord)
                    : !item.dataReviewStatus &&
                      onOpenFamily(item.basewordKey, item.selectedForms[0])
              }
            />
            <ActionButton
              disabled={index === 0}
              kind="secondary"
              label="Move up"
              onPress={() => teaching.move(item.basewordKey, -1)}
            />
            <ActionButton
              disabled={index === total - 1}
              kind="secondary"
              label="Move down"
              onPress={() => teaching.move(item.basewordKey, 1)}
            />
            <ActionButton
              kind="danger"
              label="Remove from lesson"
              onPress={() => teaching.remove(item.basewordKey)}
            />
          </View>
          {compoundOpen && item.expression ? (
            <CompoundCard
              expression={item.expression}
              teaching={teaching}
              onOpenFamily={onOpenFamily}
              source="Teaching list"
            />
          ) : null}
          {chooseWord ? (
            <View style={styles.actions}>
              {item.selectedForms.map((form) => (
                <ActionButton
                  key={form}
                  kind="secondary"
                  label={`View ${form}`}
                  onPress={() => !item.dataReviewStatus && onOpenFamily(item.basewordKey, form)}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function TeachingListScreen({ teaching, onOpenFamily, onFindWords, onCheckText }: Props) {
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [moreFormats, setMoreFormats] = useState(false);
  const activeLessonRef = useRef(teaching.activeLessonId);
  activeLessonRef.current = teaching.activeLessonId;
  useEffect(() => {
    setMessage("");
    setMoreFormats(false);
  }, [teaching.activeLessonId]);
  const runExport = async (format: "csv" | "md" | "xlsx") => {
    const exportedLesson = teaching.activeLessonId;
    setExporting(true);
    setMessage("");
    try {
      await exportTeachingList(teaching.items, format, teaching.lessonTitle);
      if (activeLessonRef.current === exportedLesson) setMessage("Your file is ready.");
    } catch {
      if (activeLessonRef.current === exportedLesson)
        setMessage("We couldn't export your list. Please try again.");
    } finally {
      setExporting(false);
    }
  };
  const focusCount = teaching.items.filter((item) => item.teachingFocus === "focus").length;
  const mentionCount = teaching.items.filter((item) => item.teachingFocus === "mention").length;
  const selectedWordCount = teaching.items.reduce(
    (sum, item) => sum + item.selectedForms.length,
    0,
  );
  return (
    <View style={styles.content}>
      <ScreenHeader title="Teaching list" intro="Your words for this lesson." />
      {teaching.saveError ? (
        <View>
          <Text accessibilityRole="alert" style={styles.error}>
            {teaching.saveError}
          </Text>
          {teaching.ready ? (
            <ActionButton kind="secondary" label="Try saving again" onPress={teaching.retrySave} />
          ) : null}
        </View>
      ) : null}
      {!teaching.ready ? (
        <ActivityIndicator
          accessibilityLabel="Loading teaching list"
          color={colors.primary}
          size="large"
        />
      ) : (
        <>
          <LessonLibraryControls teaching={teaching} />
          <View style={styles.lessonBox}>
            <Text style={styles.label}>Lesson name (optional)</Text>
            <TextInput
              accessibilityLabel="Lesson name"
              placeholder="For example: P5 · A greener school"
              value={teaching.lessonTitle}
              onChangeText={teaching.updateLessonTitle}
              style={styles.titleInput}
            />
            <Text accessibilityLiveRegion="polite" style={styles.meta}>
              {teaching.saving ? "Saving…" : teaching.saveError ? "" : "Saved on this device."}
            </Text>
          </View>
          {teaching.items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Which words will you teach?</Text>
              <Text style={styles.emptyText}>
                Check a passage and choose a few words, or add words as you search.
              </Text>
              <ActionButton label="Choose words from a text" onPress={onCheckText} />
              <ActionButton kind="secondary" label="Find a word" onPress={onFindWords} />
            </View>
          ) : (
            <>
              <View style={styles.exportBox}>
                <Text style={styles.exportTitle}>
                  {selectedWordCount} selected {selectedWordCount === 1 ? "word" : "words"} ·{" "}
                  {teaching.items.filter((item) => item.recordType !== "compound").length}{" "}
                  {teaching.items.filter((item) => item.recordType !== "compound").length === 1
                    ? "family"
                    : "families"}
                  {teaching.items.some((item) => item.recordType === "compound")
                    ? ` · ${teaching.items.filter((item) => item.recordType === "compound").length} ${teaching.items.filter((item) => item.recordType === "compound").length === 1 ? "compound" : "compounds"}`
                    : ""}
                </Text>
                <Text style={styles.meta}>
                  In depth {focusCount} · Brief {mentionCount} · Undecided{" "}
                  {teaching.items.length - focusCount - mentionCount}
                </Text>
                <View style={styles.actions}>
                  <ActionButton
                    disabled={exporting}
                    label="Export to Excel"
                    onPress={() => void runExport("xlsx")}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="More formats"
                    accessibilityState={{ expanded: moreFormats }}
                    aria-expanded={moreFormats}
                    style={styles.editButton}
                    onPress={() => setMoreFormats(!moreFormats)}
                  >
                    <Text style={styles.editText}>
                      {moreFormats ? "Fewer formats" : "More formats"}
                    </Text>
                  </Pressable>
                </View>
                {moreFormats ? (
                  <View style={styles.actions}>
                    <ActionButton
                      disabled={exporting}
                      kind="secondary"
                      label="CSV"
                      onPress={() => void runExport("csv")}
                    />
                    <ActionButton
                      disabled={exporting}
                      kind="secondary"
                      label="Markdown"
                      onPress={() => void runExport("md")}
                    />
                  </View>
                ) : null}
                {message ? (
                  <Text accessibilityRole="alert" style={styles.meta}>
                    {message}
                  </Text>
                ) : null}
              </View>
            </>
          )}
          {teaching.undoState ? (
            <View accessibilityLiveRegion="polite" style={styles.undoBox}>
              <Text style={styles.meta}>{teaching.undoState.label}</Text>
              <ActionButton kind="secondary" label="Undo last change" onPress={teaching.undo} />
            </View>
          ) : null}
          {teaching.items.map((item, index) => (
            <ListItem
              key={`${teaching.activeLessonId}:${item.basewordKey}`}
              item={item}
              index={index}
              total={teaching.items.length}
              teaching={teaching}
              onOpenFamily={onOpenFamily}
            />
          ))}
          {teaching.items.length ? (
            <View style={styles.actions}>
              <ActionButton kind="secondary" label="Add from a text" onPress={onCheckText} />
              <ActionButton kind="secondary" label="Find more words" onPress={onFindWords} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, padding: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  titleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  titleText: { flex: 1, flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  title: { color: colors.ink, fontSize: 21, fontWeight: "800", flex: 1 },
  order: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  editButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  editText: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  plan: {
    backgroundColor: colors.subdued,
    color: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: "700",
  },
  focusPlan: { backgroundColor: colors.primarySoft, color: colors.primary },
  notePreview: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  editor: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  label: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 70,
    padding: spacing.sm,
    textAlignVertical: "top",
  },
  titleInput: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 16,
    minHeight: 48,
    padding: spacing.sm,
  },
  lessonBox: { gap: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  formChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.subdued,
    borderRadius: 10,
    paddingLeft: spacing.sm,
  },
  formChipText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  empty: {
    backgroundColor: colors.subdued,
    borderRadius: 15,
    gap: spacing.md,
    padding: spacing.lg,
  },
  emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  exportBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 15,
    gap: spacing.sm,
    padding: spacing.md,
  },
  exportTitle: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  undoBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.sm,
    gap: spacing.xs,
  },
  error: { color: colors.danger, fontSize: 15, lineHeight: 22 },
});
