import { Pressable, StyleSheet, Text, View } from "react-native";

import { familySetLabel, type FamilyRecord } from "../domain/hkele";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { EvidenceBadge } from "./EvidenceBadge";

interface Props {
  family: FamilyRecord;
  onOpen: (family: FamilyRecord) => void;
  onAdd: (family: FamilyRecord) => void;
  added: boolean;
  matchNote?: string;
  canAdd?: boolean;
  selectedForm?: string | undefined;
}

const shown = (value: unknown) =>
  value === null || value === undefined || value === "" ? "Not available" : String(value);

export function FamilyCard({
  family,
  onOpen,
  onAdd,
  added,
  matchNote,
  canAdd = true,
  selectedForm,
}: Props) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={`Open word detail for ${selectedForm || family.display_family}`}
        accessibilityRole="button"
        onPress={() => onOpen(family)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>{selectedForm || family.display_family}</Text>
          <Text style={styles.badge}>{familySetLabel(family)}</Text>
        </View>
        {selectedForm ? (
          <Text style={styles.match}>Family: {family.display_family}</Text>
        ) : matchNote ? (
          <Text style={styles.match}>{matchNote}</Text>
        ) : null}
        <Text style={styles.meta}>
          {selectedForm ? "Family overall rank" : "Overall rank"}{" "}
          {shown(family.overall_frequency_order)} · HK rank{" "}
          {shown(family.current_hk_frequency_rank)}
        </Text>
        <View style={styles.evidence}>
          <EvidenceBadge
            label="Family · earliest HK textbook"
            value={family.textbook_first_seen_level}
            tone="textbook"
          />
          <EvidenceBadge
            label={selectedForm ? "Family · external level" : "External level"}
            value={
              family.browse_external_level_reference ?? family.external_level_reference_display
            }
            tone="external"
          />
        </View>
      </Pressable>
      <ActionButton
        disabled={added || !canAdd}
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
    fontSize: 14,
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
  evidence: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: spacing.xs },
  pressed: { opacity: 0.72 },
  title: { color: colors.ink, flex: 1, fontSize: 22, fontWeight: "700" },
  titleRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
});
