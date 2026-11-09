import { ProgressiveDisclosure } from "../components/ProgressiveDisclosure";
import { CopySelectedWords } from "../components/CopySelectedWords";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ChoiceChip } from "../components/ChoiceChip";
import { ScreenHeader } from "../components/ScreenHeader";
import { LessonLibraryControls } from "../components/LessonLibraryControls";
import type { TeachingListItem } from "../domain/teachingList";
import type { HkeleRepository } from "../domain/hkele";
import { LESSON_FOCUS_OPTIONS, lessonFocusLabel } from "../services/lessonPlanning";
import { exportTeachingList } from "../services/shareExport";
import type { TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";
import { CompoundCard } from "../components/CompoundCard";

interface Props {
  repository: HkeleRepository;
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
  const [planOpen, setPlanOpen] = useState(false);
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.order}>{index + 1}</Text>
          <View style={styles.wordLinks}>
            {(item.selectedForms.length ? item.selectedForms : [item.displayFamily]).map((form) => (
              <Pressable
                key={form}
                accessibilityRole="button"
                accessibilityLabel={`View ${form}`}
                disabled={Boolean(item.dataReviewStatus) && item.recordType !== "compound"}
                onPress={() => item.recordType === "compound"
                  ? setCompoundOpen(!compoundOpen)
                  : onOpenFamily(item.basewordKey, form)}
                style={styles.wordLink}
              >
                <Text style={styles.title}>{form}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${open ? "Close notes for" : item.notes ? "Edit note for" : "Add note for"} ${item.displayFamily}`}
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          onPress={() => setOpen(!open)}
          style={styles.editButton}
        >
          <Text style={styles.editText}>{open ? "Done" : item.notes ? "Edit note" : "Add note"}</Text>
        </Pressable>
      </View>
      <View style={styles.metaRow}>
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
      {compoundOpen && item.expression ? (
        <CompoundCard expression={item.expression} teaching={teaching} onOpenFamily={onOpenFamily} source="Selected words" />
      ) : null}
      {open ? (
        <View style={styles.editor}>
          <Text style={styles.label}>Teaching note (optional)</Text>
          <TextInput
            accessibilityLabel={`Teaching notes for ${item.displayFamily}`}
            multiline
            onChangeText={(notes) => teaching.update(item.basewordKey, { notes })}
            placeholder="For example: compare reusable with disposable"
            style={styles.input}
            value={item.notes}
          />
          <ProgressiveDisclosure title="More actions">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Teaching options for ${item.displayFamily}`}
            accessibilityState={{ expanded: planOpen }}
            aria-expanded={planOpen}
            onPress={() => setPlanOpen(!planOpen)}
            style={styles.editButton}
          >
            <Text style={styles.editText}>Teaching options{item.teachingFocus ? ` · ${lessonFocusLabel(item.teachingFocus)}` : ""} {planOpen ? "−" : "+"}</Text>
          </Pressable>
          {planOpen ? (
            <View style={styles.chips}>
              {LESSON_FOCUS_OPTIONS.map(({ value, label }) => (
                <ChoiceChip key={label} label={label} selected={(item.teachingFocus ?? "") === value}
                  onPress={() => teaching.update(item.basewordKey, { teachingFocus: value })} />
              ))}
            </View>
          ) : null}
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
            <Text style={styles.meta}>Added from: {teaching.sourceFor(item.basewordKey)?.replace("Not known", "May need explaining")}</Text>
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
              label="Remove word"
              onPress={() => teaching.remove(item.basewordKey)}
            />
          </View>
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
          </ProgressiveDisclosure>
        </View>
      ) : null}
    </View>
  );
}

export function TeachingListScreen({ teaching, repository, onOpenFamily, onFindWords, onCheckText }: Props) {
  const [message,setMessage]=useState("");
  const [exporting,setExporting]=useState(false);
  const activeLessonRef=useRef(teaching.activeLessonId);activeLessonRef.current=teaching.activeLessonId;
  useEffect(()=>setMessage(""),[teaching.activeLessonId]);
  const runExport=async()=>{
    const id=teaching.activeLessonId;setExporting(true);setMessage("");
    try{await exportTeachingList(teaching.items,"xlsx",teaching.lessonTitle,repository);if(activeLessonRef.current===id)setMessage("Your file is ready.");}
    catch{if(activeLessonRef.current===id)setMessage("We couldn't download your words. Please try again.");}
    finally{setExporting(false);}
  };
  const count=teaching.items.reduce((n,item)=>n+item.selectedForms.length,0);
  return <View style={styles.content}>
    <ScreenHeader title="Selected words" intro="Copy your words straight into your materials." />
    {teaching.saveError ? <View><Text accessibilityRole="alert" style={styles.error}>{teaching.saveError}</Text>{teaching.ready ? <ActionButton kind="secondary" label="Try saving again" onPress={teaching.retrySave} /> : null}</View> : null}
    {!teaching.ready ? <ActivityIndicator accessibilityLabel="Loading selected words" color={colors.primary} size="large" /> : <>
      {teaching.items.length ? <View style={styles.exportBox}>
        <Text style={styles.exportTitle}>{count} selected {count===1 ? "word" : "words"}</Text>
        <CopySelectedWords key={teaching.activeLessonId} items={teaching.items} />
        <ActionButton disabled={exporting} kind="secondary" label="Download Excel" onPress={()=>void runExport()} />
        {message ? <Text accessibilityRole="alert" style={styles.meta}>{message}</Text> : null}
      </View> : null}
      <LessonLibraryControls teaching={teaching} />
      <Text accessibilityLiveRegion="polite" style={styles.meta}>{teaching.saving ? "Saving…" : teaching.saveError ? "" : "Saved on this device."}</Text>
      {!teaching.items.length ? <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Which words would you like to keep?</Text>
        <Text style={styles.meta}>Choose words from a text or add them as you search.</Text>
        <ActionButton label="Choose words from a text" onPress={onCheckText} />
        <ActionButton kind="secondary" label="Find a word" onPress={onFindWords} />
      </View> : null}
      {teaching.undoState ? <View accessibilityLiveRegion="polite" style={styles.undoBox}>
        <Text style={styles.meta}>{teaching.undoState.label === "Bulk addition to Teaching list" ? "Added selected words" : teaching.undoState.label.replace(/lesson/gi, "saved")}</Text>
        <ActionButton kind="secondary" label="Undo last change" onPress={teaching.undo} />
      </View> : null}
      {teaching.items.map((item,index)=><ListItem key={`${teaching.activeLessonId}:${item.basewordKey}`} item={item} index={index} total={teaching.items.length} teaching={teaching} onOpenFamily={onOpenFamily} />)}
      {teaching.items.length ? <View style={styles.actions}><ActionButton kind="secondary" label="Add from a text" onPress={onCheckText} /><ActionButton kind="secondary" label="Find more words" onPress={onFindWords} /></View> : null}
    </>}
  </View>;
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
  title: { color: colors.primary, fontSize: 21, fontWeight: "800" },
  wordLinks: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  wordLink: { minHeight: 44, justifyContent: "center" },
  lessonHeading: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  lessonTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", flexShrink: 1 },
  order: { color: colors.muted, fontSize: 16, fontWeight: "700" },
  editButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  editText: { color: colors.primary, fontSize: 18, fontWeight: "800" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  meta: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  plan: {
    backgroundColor: colors.subdued,
    color: colors.muted,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: "700",
  },
  focusPlan: { backgroundColor: colors.primarySoft, color: colors.primary },
  notePreview: { color: colors.ink, fontSize: 17, lineHeight: 25 },
  editor: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  label: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 18,
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
    fontSize: 18,
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
  formChipText: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  empty: {
    backgroundColor: colors.subdued,
    borderRadius: 15,
    gap: spacing.md,
    padding: spacing.lg,
  },
  emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  emptyText: { color: colors.muted, fontSize: 17, lineHeight: 25 },
  exportBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 15,
    gap: spacing.sm,
    padding: spacing.md,
  },
  exportTitle: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  undoBox: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.sm,
    gap: spacing.xs,
  },
  error: { color: colors.danger, fontSize: 17, lineHeight: 25 },
});
