import { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { familySetLabel, hasFlag, type FamilyRecord } from "../domain/hkele";
import { vocabularyListLabel } from "../services/externalLevelPresentation";
import { colors, spacing } from "../theme/tokens";
import { ChoiceChip } from "./ChoiceChip";
import { ProgressiveDisclosure } from "./ProgressiveDisclosure";

const STORAGE_KEY = "hkele-phase1v-columns-v1";
const columns = [
  ["family", "Word family", 170],
  ["status", "Word list", 150],
  ["overall", "Overall frequency rank", 125],
  ["hk", "HK frequency rank / band", 155],
  ["first_seen", "Earliest observed in HK textbooks", 155],
  ["external", "External level reference", 185],
  ["academic", "Academic Word List (AWL)", 125],
  ["subjects", "Middle School Vocabulary Lists (MSVL)", 210],
  ["earlier", "Earlier HK list", 110],
  ["root", "Root", 135],
  ["root_meaning", "Root meaning", 175],
  ["prefix", "Prefix", 120],
  ["suffix", "Suffix", 120],
  ["view", "View", 90],
  ["add", "Add", 90],
] as const;
type ColumnKey = (typeof columns)[number][0];
const fixed = new Set<ColumnKey>(["family", "view", "add"]);
function defaults(): Record<ColumnKey, boolean> {
  return Object.fromEntries(columns.map(([key]) => [key, true])) as Record<ColumnKey, boolean>;
}

function initialVisibility(): Record<ColumnKey, boolean> {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return defaults();
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Record<
      string,
      unknown
    > | null;
    return { ...defaults(), ...(stored ?? {}) };
  } catch {
    return defaults();
  }
}

function display(value: unknown): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function cellValue(key: ColumnKey, family: FamilyRecord): string {
  switch (key) {
    case "family":
      return typeof family.browse_display_word === "string" &&
        family.browse_display_word !== family.display_family
        ? `${family.browse_display_word}\nFamily: ${family.display_family}`
        : family.display_family;
    case "status":
      return familySetLabel(family);
    case "overall":
      return family.overall_frequency_order?.toLocaleString("en") ?? "Unranked";
    case "hk":
      return (
        [family.current_hk_frequency_rank?.toLocaleString("en"), family.current_hk_frequency_band]
          .filter(Boolean)
          .join(" · ") || "—"
      );
    case "first_seen":
      return display(family.textbook_first_seen_level);
    case "external":
      return display(family.browse_external_level_reference);
    case "academic":
      return hasFlag(family.awl) ? "Yes" : "—";
    case "subjects":
      return vocabularyListLabel(family.msvl);
    case "earlier":
      return hasFlag(family.earlier_hk) ? "Yes" : "—";
    case "root":
      return display(family.browse_root);
    case "root_meaning":
      return display(family.browse_root_meaning);
    case "prefix":
      return display(family.browse_prefix);
    case "suffix":
      return display(family.browse_suffix);
    case "view":
      return "View";
    case "add":
      return "Add";
  }
}

interface Props {
  families: FamilyRecord[];
  isAdded: (family: FamilyRecord) => boolean;
  onAdd: (family: FamilyRecord) => void;
  onOpen: (family: FamilyRecord) => void;
  canAdd?: boolean;
}

export function WebFamilyTable({ families, isAdded, onAdd, onOpen, canAdd = true }: Props) {
  const [visible, setVisible] = useState(initialVisibility);
  const shown = useMemo(() => columns.filter(([key]) => visible[key]), [visible]);
  if (Platform.OS !== "web") return null;
  return (
    <View style={styles.wrapper}>
      <Text style={styles.settingsTitle}>Full word information · {shown.length} columns</Text>
      <ProgressiveDisclosure title="Choose columns">
        <View style={styles.settings}>
          {columns.map(([key, label]) => (
            <ChoiceChip
              key={key}
              label={label}
              onPress={() => {
                if (fixed.has(key)) return;
                setVisible((current) => {
                  const next = { ...current, [key]: !current[key] };
                  if (typeof localStorage !== "undefined")
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
                  return next;
                });
              }}
              selected={visible[key]}
            />
          ))}
        </View>
      </ProgressiveDisclosure>
      <ScrollView horizontal nestedScrollEnabled style={styles.scroll}>
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            {shown.map(([key, label, width]) => (
              <Text key={key} style={[styles.headerCell, { width }]}>
                {label}
              </Text>
            ))}
          </View>
          {families.map((family, index) => (
            <View
              key={family.baseword_key}
              style={[styles.row, index % 2 === 1 && styles.alternateRow]}
            >
              {shown.map(([key, _label, width]) => {
                if (key === "view" || key === "add") {
                  const added = key === "add" && isAdded(family);
                  const disabled = key === "add" && (added || !canAdd);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      disabled={disabled}
                      key={key}
                      onPress={() => (key === "view" ? onOpen(family) : onAdd(family))}
                      style={[styles.action, { width }, disabled && styles.disabled]}
                    >
                      <Text style={styles.actionText}>
                        {added ? "Added" : cellValue(key, family)}
                      </Text>
                    </Pressable>
                  );
                }
                return (
                  <Text
                    key={key}
                    style={[
                      styles.cell,
                      { width },
                      key === "family" && styles.wordCell,
                      (key === "overall" || key === "hk") && styles.rankCell,
                      key === "first_seen" && styles.textbookCell,
                      key === "external" && styles.externalCell,
                    ]}
                  >
                    {cellValue(key, family)}
                  </Text>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: "center",
    minHeight: 54,
    padding: spacing.sm,
  },
  actionText: { color: colors.primary, fontSize: 14, fontWeight: "800" },
  cell: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    color: colors.ink,
    fontSize: 16,
    lineHeight: 23,
    minHeight: 54,
    padding: spacing.sm,
  },
  alternateRow: { backgroundColor: "#F5F9F6" },
  wordCell: { color: colors.primary, fontSize: 19, fontWeight: "800" },
  rankCell: { fontWeight: "700" },
  textbookCell: { color: colors.hkTop, backgroundColor: "#EFF8F7", fontWeight: "700" },
  externalCell: { color: colors.cpb, backgroundColor: "#F6F2FC", fontWeight: "700" },
  disabled: { opacity: 0.45 },
  headerCell: { color: colors.surface, fontSize: 14, fontWeight: "800", padding: spacing.sm },
  headerRow: { backgroundColor: colors.primary },
  row: { flexDirection: "row" },
  scroll: { borderColor: colors.border, borderRadius: 12, borderWidth: 1, maxWidth: "100%" },
  settings: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  settingsTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  table: { backgroundColor: colors.surface },
  wrapper: { gap: spacing.sm, maxWidth: "100%" },
  viewNote: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  viewRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
});
