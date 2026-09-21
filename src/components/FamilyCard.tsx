import { Pressable, StyleSheet, Text, View } from "react-native";

import { familySetLabel, type FamilyRecord } from "../domain/hkele";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";

interface Props {
  family: FamilyRecord;
  onOpen: (family: FamilyRecord) => void;
  onAdd: (family: FamilyRecord) => void;
  added: boolean;
  matchNote?: string;
}

const shown = (value: unknown) =>
  value === null || value === undefined || value === "" ? "Not available" : String(value);

export function FamilyCard({ family, onOpen, onAdd, added, matchNote }: Props) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={`Open word detail for ${family.display_family}`}
        accessibilityRole="button"
        onPress={() => onOpen(family)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{family.display_family}</Text>
          <Text style={styles.badge}>{familySetLabel(family)}</Text>
        </View>
        {matchNote ? <Text style={styles.match}>{matchNote}</Text> : null}
        <Text style={styles.meta}>
          Overall rank {shown(family.overall_frequency_order)} · HK rank{" "}
          {shown(family.current_hk_frequency_rank)}
        </Text>
        <Text style={styles.meta}>
          Earliest observed {shown(family.textbook_first_seen_level)} · Level{" "}
          {shown(family.external_level_reference_display)}
        </Text>
      </Pressable>
      <ActionButton
        disabled={added}
        kind="secondary"
        label={added ? "In teaching list" : "Add to teaching list"}
        onPress={() => onAdd(family)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: colors.subdued,
    borderRadius: 999,
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  match: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  pressed: { opacity: 0.72 },
  title: { color: colors.ink, flex: 1, fontSize: 22, fontWeight: "800" },
  titleRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
});
