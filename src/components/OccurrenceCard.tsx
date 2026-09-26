import { StyleSheet, Text, View } from "react-native";

import type { ResolvedOccurrence } from "../domain/hkele";
import { matchCpb100 } from "../services/cpbService";
import { hkFrequencyDisplay, inHkRange } from "../services/frequencyService";
import { grammaticalRelationDisplay } from "../services/grammaticalRelationService";
import { textFormAndFamily, textResultStatusLabel } from "../services/textResultPresentation";
import type { TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";

interface Props {
  item: ResolvedOccurrence;
  teaching: TeachingListStore;
  cpbEnabled: boolean;
  hkEnabled: boolean;
  customRange: { start: number; end: number } | null;
  onOpenFamily: (basewordKey: string) => void;
}

export function OccurrenceCard({
  item,
  teaching,
  cpbEnabled,
  hkEnabled,
  customRange,
  onOpenFamily,
}: Props) {
  const owner = item.owners.length === 1 ? item.owners[0] : null;
  const cpb = matchCpb100(item.surface);
  const hk = owner ? hkFrequencyDisplay(owner.current_hk_frequency_rank) : null;
  const custom =
    owner && customRange
      ? inHkRange(owner.current_hk_frequency_rank, customRange.start, customRange.end)
      : false;
  const inList = owner
    ? teaching.items.some((entry) => entry.basewordKey === owner.baseword_key)
    : false;
  const relation = item.grammaticalRelation ?? null;
  const mapping = textFormAndFamily(item);
  return (
    <View
      style={[styles.result, cpbEnabled && cpb && styles.resultCpb, custom && styles.resultCustom]}
    >
      <View style={styles.resultTop}>
        <Text style={styles.surface}>{item.surface}</Text>
        <Text style={styles.status}>{textResultStatusLabel(item)}</Text>
      </View>
      <View style={styles.badges}>
        {cpbEnabled && cpb ? <Text style={styles.cpbBadge}>★ CPB 100 rank {cpb.rank}</Text> : null}
        {hkEnabled && hk ? (
          <Text
            style={[
              styles.hkBadge,
              hk.band === "top-1k" && styles.hkTopBadge,
              hk.band === "next-1k" && styles.hkNextBadge,
              hk.band === "later" && styles.hkLaterBadge,
            ]}
          >
            {hk.symbol} {hk.label}
            {owner?.current_hk_frequency_rank ? ` · rank ${owner.current_hk_frequency_rank}` : ""}
          </Text>
        ) : null}
        {custom ? (
          <Text style={styles.customBadge}>
            ◎ Custom HK {customRange?.start}–{customRange?.end}
          </Text>
        ) : null}
      </View>
      <Text style={styles.offset}>
        Characters {item.startOffset}–{item.endOffset}
      </Text>
      <Text style={styles.context}>{item.context}</Text>
      {owner ? (
        <View accessibilityLabel="Text form and HK-ELE family" style={styles.mapping}>
          <Text style={styles.mappingLabel}>Text form</Text>
          <Text style={styles.mappingValue}>{mapping.textForm}</Text>
          <Text style={styles.mappingLabel}>HK-ELE family</Text>
          <Text style={styles.mappingValue}>{mapping.family}</Text>
        </View>
      ) : null}
      {relation ? (
        <View style={styles.relation}>
          <Text style={styles.mappingLabel}>Registered relation</Text>
          <Text style={styles.relationValue}>
            {item.surface} → {grammaticalRelationDisplay(relation)}
          </Text>
          <Text style={styles.relationNote}>
            This is a language relation, not a ranked HK-ELE family. Context decides between
            alternatives where more than one is shown.
          </Text>
        </View>
      ) : null}
      {item.identityException ? (
        <Text style={styles.warning}>{item.identityException.teacherDisplay}</Text>
      ) : null}
      {item.status === "AMBIGUOUS" ? (
        <Text style={styles.warning}>
          Possible owners: {item.owners.map((value) => value.display_family).join(", ")}
        </Text>
      ) : null}
      {owner ? (
        <View style={styles.actions}>
          <ActionButton
            kind="secondary"
            label={`Open ${owner.display_family} word detail`}
            onPress={() => onOpenFamily(owner.baseword_key)}
          />
          <ActionButton
            disabled={inList}
            kind="secondary"
            label={inList ? "In Teaching list" : "Add to Teaching list"}
            onPress={() => teaching.add(owner)}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  context: { color: colors.muted, fontSize: 15, fontStyle: "italic", lineHeight: 22 },
  cpbBadge: {
    backgroundColor: colors.cpbSoft,
    borderRadius: 7,
    color: colors.cpb,
    fontSize: 14,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  customBadge: {
    backgroundColor: colors.customSoft,
    borderRadius: 7,
    color: colors.custom,
    fontSize: 14,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  hkBadge: {
    borderRadius: 7,
    fontSize: 14,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  hkLaterBadge: { backgroundColor: colors.hkLaterSoft, color: colors.hkLater },
  hkNextBadge: { backgroundColor: colors.hkNextSoft, color: colors.hkNext },
  hkTopBadge: { backgroundColor: colors.hkTopSoft, color: colors.hkTop },
  offset: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  mapping: {
    backgroundColor: colors.subdued,
    borderRadius: 10,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  mappingLabel: { color: colors.muted, fontSize: 14, fontWeight: "800" },
  mappingValue: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  relation: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    gap: spacing.xs,
    padding: spacing.sm,
  },
  relationNote: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  relationValue: { color: colors.primary, fontSize: 17, fontWeight: "800" },
  result: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  resultCpb: { borderColor: colors.cpb, borderStyle: "dashed", borderWidth: 2 },
  resultCustom: { borderColor: colors.custom, borderWidth: 2 },
  resultTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  status: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    color: colors.primary,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    textAlign: "center",
  },
  surface: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  warning: {
    backgroundColor: colors.warningSoft,
    borderRadius: 8,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    padding: spacing.sm,
  },
});
