import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { AppCard } from "../components/AppCard";
import { DataModeNotice } from "../components/DataModeNotice";
import { MorphologyLegend, SafeMorphologyForm } from "../components/SafeMorphologyForm";
import {
  familySetLabel,
  hasFlag,
  type DataMode,
  type FamilyDetail,
  type HkeleRepository,
} from "../domain/hkele";
import type { TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";

interface TextEvidence {
  members: Array<{ surface: string; count: number }>;
  count: number;
}

interface Props {
  basewordKey: string;
  repository: HkeleRepository;
  teaching: TeachingListStore;
  onBack: () => void;
  textEvidence?: TextEvidence;
}

function display(value: unknown): string {
  return value === null || value === undefined || value === "" ? "Not available" : String(value);
}

function unique(values: Array<string | null | undefined>): string {
  const found = [...new Set(values.map((value) => value?.trim()).filter(Boolean))];
  return found.length ? found.join(" · ") : "Not recorded";
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text selectable style={styles.rowValue}>
        {display(value)}
      </Text>
    </View>
  );
}

export function WordDetailScreen({
  basewordKey,
  repository,
  teaching,
  onBack,
  textEvidence,
}: Props) {
  const [detail, setDetail] = useState<FamilyDetail | null>(null);
  const [dataMode, setDataMode] = useState<DataMode>(() => repository.getDataMode());
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setDetail(null);
    setError("");
    void repository
      .getFamily(basewordKey)
      .then((value) => {
        if (active) {
          setDetail(value);
          setDataMode(repository.getDataMode());
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setDataMode(repository.getDataMode());
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      active = false;
    };
  }, [basewordKey, repository]);

  const morphology = useMemo(() => {
    if (!detail) return null;
    return {
      root: unique([detail.family.browse_root, ...detail.forms.map((form) => form.root)]),
      meaning: unique([
        detail.family.browse_root_meaning,
        ...detail.forms.map((form) => form.root_meaning),
      ]),
      prefix: unique([detail.family.browse_prefix, ...detail.forms.map((form) => form.prefix)]),
      suffix: unique([detail.family.browse_suffix, ...detail.forms.map((form) => form.suffix)]),
      subjects: unique(detail.forms.map((form) => form.academic_subject_evidence)),
    };
  }, [detail]);

  return (
    <View style={styles.content}>
      <View style={styles.back}>
        <ActionButton kind="secondary" label="← Back" onPress={onBack} />
      </View>
      <DataModeNotice mode={dataMode} />
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {!detail && !error ? (
        <ActivityIndicator
          accessibilityLabel="Loading word detail"
          color={colors.primary}
          size="large"
        />
      ) : null}
      {detail ? (
        <>
          <View style={styles.hero}>
            <Text accessibilityRole="header" style={styles.heading}>
              {detail.family.display_family}
            </Text>
            <Text style={styles.key}>{detail.family.baseword_key}</Text>
            <Text style={styles.badge}>{familySetLabel(detail.family)}</Text>
            <ActionButton
              disabled={teaching.items.some(
                (item) => item.basewordKey === detail.family.baseword_key,
              )}
              label={
                teaching.items.some((item) => item.basewordKey === detail.family.baseword_key)
                  ? "In teaching list"
                  : "Add to teaching list"
              }
              onPress={() => teaching.add(detail.family)}
            />
          </View>
          {textEvidence ? (
            <AppCard title="In the checked text">
              <DetailRow
                label="Current-text family members"
                value={textEvidence.members
                  .map((member) => `${member.surface} × ${member.count}`)
                  .join(" · ")}
              />
              <DetailRow label="Total occurrences" value={textEvidence.count} />
            </AppCard>
          ) : null}
          <AppCard title="Current evidence">
            <DetailRow
              label="Set"
              value={detail.family.set_membership ?? familySetLabel(detail.family)}
            />
            <DetailRow label="Overall rank" value={detail.family.overall_frequency_order} />
            <DetailRow label="HK frequency rank" value={detail.family.current_hk_frequency_rank} />
            <DetailRow label="HK frequency band" value={detail.family.current_hk_frequency_band} />
            <DetailRow
              label="Earliest observed in HK textbooks"
              value={detail.family.textbook_first_seen_level}
            />
            <DetailRow
              label="External level reference"
              value={detail.family.external_level_reference_display}
            />
            <DetailRow
              label="AWL"
              value={hasFlag(detail.family.awl) ? "Yes" : "No / not recorded"}
            />
            <DetailRow label="MSVL" value={detail.family.msvl} />
            <DetailRow label="Academic subject evidence" value={morphology?.subjects} />
            <DetailRow
              label="Earlier HK list"
              value={hasFlag(detail.family.earlier_hk) ? "Yes" : "No / not recorded"}
            />
          </AppCard>
          {detail.family.general_evidence_status?.toLowerCase().includes("unavailable") ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>General-source component unavailable</Text>
              <Text style={styles.noticeText}>
                This means the source component is unavailable. It does not mean zero frequency or
                absence from the database.
              </Text>
            </View>
          ) : null}
          <AppCard title="Recorded morphology">
            <Text style={styles.caution}>
              These are registered fields for teacher reference. This summary stays record-only; the
              forms below are segmented only when exact registered boundaries can be proved.
            </Text>
            <DetailRow label="Root" value={morphology?.root} />
            <DetailRow label="Root meaning" value={morphology?.meaning} />
            <DetailRow label="Prefix" value={morphology?.prefix} />
            <DetailRow label="Suffix" value={morphology?.suffix} />
          </AppCard>
          <AppCard title={`Registered forms (${detail.forms.length.toLocaleString("en")})`}>
            <Text style={styles.caution}>
              Colour segments appear only where the registered prefix/root/suffix concatenate
              exactly to the normalized form. Other forms stay plain.
            </Text>
            <MorphologyLegend />
            <View style={styles.forms}>
              {detail.forms.map((form, index) => (
                <SafeMorphologyForm
                  form={form}
                  key={form.form_key ?? `${form.normalized_form}-${index}`}
                />
              ))}
            </View>
          </AppCard>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start" },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    color: colors.primary,
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  caution: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  content: { gap: spacing.md, padding: spacing.lg },
  error: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    color: colors.danger,
    padding: spacing.md,
  },
  forms: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  heading: { color: colors.ink, fontSize: 34, fontWeight: "800" },
  hero: { gap: spacing.sm },
  key: { color: colors.muted, fontSize: 13 },
  notice: {
    backgroundColor: colors.warningSoft,
    borderRadius: 14,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noticeText: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  noticeTitle: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  rowLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  rowValue: { color: colors.ink, fontSize: 16, lineHeight: 23 },
});
