import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ChoiceChip } from "../components/ChoiceChip";
import { ScreenHeader } from "../components/ScreenHeader";
import type { TeachingListItem } from "../domain/teachingList";
import { exportTeachingList } from "../services/shareExport";
import { TEACHING_STATUSES, type TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";

interface Props {
  teaching: TeachingListStore;
  onOpenFamily: (basewordKey: string) => void;
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
  onOpenFamily: (basewordKey: string) => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.order}>#{index + 1}</Text>
          <Text style={styles.title}>{item.displayFamily}</Text>
          <Text style={styles.key}>{item.basewordKey}</Text>
        </View>
        <ActionButton
          kind="secondary"
          label="Detail"
          onPress={() => onOpenFamily(item.basewordKey)}
        />
      </View>
      <Text style={styles.label}>Learning status</Text>
      <View style={styles.chips}>
        {TEACHING_STATUSES.map((status) => (
          <ChoiceChip
            key={status}
            label={status}
            onPress={() => teaching.update(item.basewordKey, { status })}
            selected={item.status === status}
          />
        ))}
      </View>
      <Text style={styles.label}>Selected forms</Text>
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
      <Text style={styles.label}>Teaching notes</Text>
      <TextInput
        accessibilityLabel={`Teaching notes for ${item.displayFamily}`}
        multiline
        onChangeText={(notes) => teaching.update(item.basewordKey, { notes })}
        placeholder="Add a classroom note"
        style={styles.input}
        value={item.notes}
      />
      <Text style={styles.label}>Connections</Text>
      <TextInput
        accessibilityLabel={`Connections for ${item.displayFamily}`}
        multiline
        onChangeText={(connections) => teaching.update(item.basewordKey, { connections })}
        placeholder="Related words, topics, or examples"
        style={styles.input}
        value={item.connections}
      />
      <View style={styles.actions}>
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
          label="Remove"
          onPress={() => teaching.remove(item.basewordKey)}
        />
      </View>
    </View>
  );
}

export function TeachingListScreen({ teaching, onOpenFamily }: Props) {
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);

  const runExport = async (format: "csv" | "md" | "xlsx") => {
    setExporting(true);
    setMessage("");
    try {
      const filename = await exportTeachingList(teaching.items, format);
      setMessage(`Created ${filename}`);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.content}>
      <ScreenHeader
        intro="Keep a stable, device-local list by family identity. Selected forms, status, notes, connections, and order are saved automatically."
        title="Teaching List"
      />
      {!teaching.ready ? (
        <ActivityIndicator
          accessibilityLabel="Loading teaching list"
          color={colors.primary}
          size="large"
        />
      ) : null}
      {teaching.ready ? (
        <>
          <View style={styles.exportBox}>
            <Text style={styles.exportTitle}>Export ({teaching.items.length} families)</Text>
            <Text style={styles.exportNote}>
              CSV and Markdown are lightweight; Excel includes a frozen header row and filters.
            </Text>
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
              <ActionButton
                disabled={exporting}
                kind="secondary"
                label="Excel"
                onPress={() => void runExport("xlsx")}
              />
            </View>
            {message ? (
              <Text accessibilityRole="alert" style={styles.message}>
                {message}
              </Text>
            ) : null}
          </View>
          {teaching.items.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Your teaching list is empty.</Text>
              <Text style={styles.emptyText}>
                Add a family from Browse, Check a Text, or Word detail.
              </Text>
            </View>
          ) : null}
          {teaching.items.map((item, index) => (
            <ListItem
              index={index}
              item={item}
              key={item.basewordKey}
              onOpenFamily={onOpenFamily}
              teaching={teaching}
              total={teaching.items.length}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  content: { gap: spacing.md, padding: spacing.lg },
  empty: {
    alignItems: "center",
    backgroundColor: colors.subdued,
    borderRadius: 15,
    gap: spacing.xs,
    padding: spacing.xl,
  },
  emptyText: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  exportBox: {
    backgroundColor: colors.primarySoft,
    borderRadius: 15,
    gap: spacing.sm,
    padding: spacing.md,
  },
  exportNote: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  exportTitle: { color: colors.primary, fontSize: 19, fontWeight: "800" },
  formChip: {
    alignItems: "center",
    backgroundColor: colors.subdued,
    borderRadius: 10,
    flexDirection: "row",
    gap: spacing.xs,
    paddingLeft: spacing.sm,
  },
  formChipText: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  input: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 70,
    padding: spacing.sm,
    textAlignVertical: "top",
  },
  key: { color: colors.muted, fontSize: 12 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  message: { color: colors.ink, fontSize: 14 },
  order: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  title: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  titleRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  titleText: { flex: 1 },
});
