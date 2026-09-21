import { StyleSheet, Text, View } from "react-native";

import type { ResolvedOccurrence } from "../domain/hkele";
import { matchCpb100 } from "../services/cpbService";
import { hkFrequencyDisplay, inHkRange } from "../services/frequencyService";
import { colors, spacing } from "../theme/tokens";

interface Props {
  text: string;
  results: ResolvedOccurrence[];
  cpbEnabled: boolean;
  hkEnabled: boolean;
  customRange: { start: number; end: number } | null;
}

export function HighlightedText({ text, results, cpbEnabled, hkEnabled, customRange }: Props) {
  const ordered = [...results].sort((left, right) => left.startOffset - right.startOffset);
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  for (const item of ordered) {
    if (item.startOffset > cursor) nodes.push(text.slice(cursor, item.startOffset));
    const cpb = cpbEnabled ? matchCpb100(item.surface) : null;
    const owner = item.status === "RESOLVED" && item.owners.length === 1 ? item.owners[0] : null;
    const rank = owner?.current_hk_frequency_rank ?? null;
    const hk = hkEnabled && owner ? hkFrequencyDisplay(rank) : null;
    const custom = customRange ? inHkRange(rank, customRange.start, customRange.end) : false;
    const labels = [
      cpb ? `CPB 100 rank ${cpb.rank}` : null,
      hk ? hk.label : null,
      custom ? `Custom HK range ${customRange?.start} to ${customRange?.end}` : null,
    ].filter(Boolean);
    nodes.push(
      <Text
        accessibilityLabel={labels.length ? `${item.surface}: ${labels.join(", ")}` : item.surface}
        key={item.occurrenceId}
        style={[
          styles.token,
          cpb && styles.cpb,
          hk?.band === "top-1k" && styles.hkTop,
          hk?.band === "next-1k" && styles.hkNext,
          hk?.band === "later" && styles.hkLater,
          custom && styles.custom,
        ]}
      >
        {item.surface}
      </Text>,
    );
    cursor = item.endOffset;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));

  return (
    <View style={styles.box}>
      <Text accessibilityRole="header" style={styles.title}>
        Highlighted text
      </Text>
      <Text selectable style={styles.text}>
        {nodes}
      </Text>
      <View accessibilityLabel="Highlight legend" style={styles.legend}>
        {cpbEnabled ? <Text style={[styles.legendItem, styles.cpb]}>★ CPB 100</Text> : null}
        {hkEnabled ? (
          <>
            <Text style={[styles.legendItem, styles.hkTop]}>● HK Top 1k</Text>
            <Text style={[styles.legendItem, styles.hkNext]}>◆ HK Next 1k</Text>
            <Text style={[styles.legendItem, styles.hkLater]}>▨ HK rank 2,001+</Text>
          </>
        ) : null}
        {customRange ? (
          <Text style={[styles.legendItem, styles.custom]}>
            ◎ Custom {customRange.start}–{customRange.end}
          </Text>
        ) : null}
      </View>
      <Text style={styles.note}>
        Symbols and labels accompany colour so the meaning does not depend on colour alone.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  cpb: { backgroundColor: colors.cpbSoft, color: colors.cpb, textDecorationLine: "underline" },
  custom: {
    backgroundColor: colors.customSoft,
    color: colors.custom,
    textDecorationLine: "underline",
  },
  hkLater: { backgroundColor: colors.hkLaterSoft, color: colors.hkLater },
  hkNext: { backgroundColor: colors.hkNextSoft, color: colors.hkNext },
  hkTop: { backgroundColor: colors.hkTopSoft, color: colors.hkTop },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  legendItem: {
    borderRadius: 7,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  text: { color: colors.ink, fontSize: 17, lineHeight: 28 },
  title: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  token: { borderRadius: 3, overflow: "hidden" },
});
