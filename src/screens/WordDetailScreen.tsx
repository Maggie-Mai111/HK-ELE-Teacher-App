import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { AppCard } from "../components/AppCard";
import { DataModeNotice } from "../components/DataModeNotice";
import { ProgressiveDisclosure } from "../components/ProgressiveDisclosure";
import { MorphologyLegend, SafeMorphologyForm } from "../components/SafeMorphologyForm";
import {
  familySetLabel,
  hasFlag,
  type DataMode,
  type FamilyDetail,
  type FormRecord,
  type HkeleRepository,
} from "../domain/hkele";
import {
  nextBatchSize,
  PROGRESSIVE_BATCH_SIZE,
  visibleForms,
} from "../services/progressiveResults";
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

interface FormTierProps {
  title: string;
  description: string;
  forms: FormRecord[];
  family: FamilyDetail["family"];
  teaching: TeachingListStore;
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

function FormTier({ title, description, forms, family, teaching }: FormTierProps) {
  const [limit, setLimit] = useState(PROGRESSIVE_BATCH_SIZE);
  const shown = visibleForms(forms, limit);
  return (
    <ProgressiveDisclosure
      summary={`${forms.length.toLocaleString("en")} registered forms · ${description}`}
      title={`${title} (${forms.length.toLocaleString("en")})`}
    >
      {forms.length ? (
        <>
          <Text style={styles.caution}>
            Showing {shown.length.toLocaleString("en")} of {forms.length.toLocaleString("en")} in
            this layer.
          </Text>
          <View style={styles.formRows}>
            {shown.map((form, index) => {
              const selected = teaching.items.some(
                (item) =>
                  item.basewordKey === family.baseword_key &&
                  item.selectedForms.includes(form.form),
              );
              return (
                <View
                  key={form.form_key ?? `${form.normalized_form}-${index}`}
                  style={styles.formRow}
                >
                  <View style={styles.formEvidence}>
                    <SafeMorphologyForm form={form} />
                    <Text style={styles.formNote}>
                      Textbook: {display(form.first_seen_hk_textbooks)} · External:{" "}
                      {display(form.external_level_reference)}
                    </Text>
                  </View>
                  <ActionButton
                    disabled={selected}
                    kind="secondary"
                    label={selected ? `${form.form} selected` : `Add ${form.form}`}
                    onPress={() => teaching.add(family, form.form)}
                  />
                </View>
              );
            })}
          </View>
          {limit < forms.length ? (
            <ActionButton
              kind="secondary"
              label={`Show ${Math.min(PROGRESSIVE_BATCH_SIZE, forms.length - limit)} more forms`}
              onPress={() =>
                setLimit((value) => nextBatchSize(value, forms.length, PROGRESSIVE_BATCH_SIZE))
              }
            />
          ) : null}
        </>
      ) : (
        <Text style={styles.caution}>No forms in this layer.</Text>
      )}
    </ProgressiveDisclosure>
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

  const formTiers = useMemo(() => {
    if (!detail) return [];
    const textbook = detail.forms.filter((form) => Boolean(form.first_seen_hk_textbooks));
    const external = detail.forms.filter(
      (form) => !form.first_seen_hk_textbooks && Boolean(form.external_level_reference),
    );
    const remaining = detail.forms.filter(
      (form) => !form.first_seen_hk_textbooks && !form.external_level_reference,
    );
    return [
      {
        key: "textbook",
        title: "Observed in sampled HK textbooks",
        description: "Forms with a registered textbook observation.",
        forms: textbook,
      },
      {
        key: "external",
        title: "Supported by external level references",
        description:
          "Forms with external level evidence and no registered HK textbook observation.",
        forms: external,
      },
      {
        key: "remaining",
        title: "Other registered family members",
        description: "Missing evidence is not interpreted as absence.",
        forms: remaining,
      },
    ];
  }, [detail]);

  return (
    <View style={styles.content}>
      <View style={styles.back}>
        <ActionButton kind="secondary" label="← Back to results" onPress={onBack} />
      </View>
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
            <Text accessibilityRole="header" aria-level={1} style={styles.heading}>
              {detail.family.display_family}
            </Text>
            <View style={styles.badges}>
              <Text style={styles.badge}>{familySetLabel(detail.family)}</Text>
              <Text style={styles.rankBadge}>
                Overall rank {display(detail.family.overall_frequency_order)}
              </Text>
              <Text style={styles.rankBadge}>
                HK rank {display(detail.family.current_hk_frequency_rank)}
              </Text>
            </View>
            <Text style={styles.gradeEvidence}>
              HK textbooks: {display(detail.family.textbook_first_seen_level)} · External level:{" "}
              {display(detail.family.external_level_reference_display)}
            </Text>
            <ActionButton
              disabled={teaching.items.some(
                (item) => item.basewordKey === detail.family.baseword_key,
              )}
              label={
                teaching.items.some((item) => item.basewordKey === detail.family.baseword_key)
                  ? "In Teaching list"
                  : "Add family to Teaching list"
              }
              onPress={() => teaching.add(detail.family)}
            />
          </View>
          <DataModeNotice mode={dataMode} />
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
          {detail.family.general_evidence_status?.toLowerCase().includes("unavailable") ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>General-source component unavailable</Text>
              <Text style={styles.noticeText}>
                This means the source component is unavailable. It does not mean zero frequency or
                absence from the database.
              </Text>
            </View>
          ) : null}
          <ProgressiveDisclosure
            summary="Set, frequency, grade, list and subject evidence."
            title="Complete registered evidence"
          >
            <DetailRow label="Stable family identity" value={detail.family.baseword_key} />
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
          </ProgressiveDisclosure>
          <ProgressiveDisclosure
            summary="Registered fields only; no morphology is inferred or rewritten."
            title="Recorded morphology"
          >
            <Text style={styles.caution}>
              Forms are segmented only when exact registered boundaries can be proved.
            </Text>
            <DetailRow label="Root" value={morphology?.root} />
            <DetailRow label="Root meaning" value={morphology?.meaning} />
            <DetailRow label="Prefix" value={morphology?.prefix} />
            <DetailRow label="Suffix" value={morphology?.suffix} />
            <MorphologyLegend />
          </ProgressiveDisclosure>
          <View style={styles.formsIntro}>
            <Text accessibilityRole="header" aria-level={2} style={styles.formsTitle}>
              Registered forms ({detail.forms.length.toLocaleString("en")})
            </Text>
            <Text style={styles.caution}>
              Three evidence layers are preserved. Open one layer to show forms in batches of{" "}
              {PROGRESSIVE_BATCH_SIZE}.
            </Text>
          </View>
          {formTiers.map((tier) => (
            <FormTier
              description={tier.description}
              family={detail.family}
              forms={tier.forms}
              key={tier.key}
              teaching={teaching}
              title={tier.title}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  back: { alignSelf: "flex-start" },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  caution: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  content: { gap: spacing.md, padding: spacing.lg },
  error: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    color: colors.danger,
    fontSize: 15,
    padding: spacing.md,
  },
  formEvidence: { flex: 1, gap: spacing.xs, minWidth: 220 },
  formNote: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  formRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "space-between",
    minHeight: 56,
    paddingVertical: spacing.sm,
  },
  formRows: { gap: spacing.xs },
  formsIntro: { gap: spacing.xs, paddingTop: spacing.sm },
  formsTitle: { color: colors.ink, fontSize: 22, fontWeight: "800", lineHeight: 29 },
  gradeEvidence: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  heading: { color: colors.ink, fontSize: 34, fontWeight: "800", lineHeight: 41 },
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  notice: {
    backgroundColor: colors.warningSoft,
    borderRadius: 14,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noticeText: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  noticeTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  rankBadge: {
    backgroundColor: colors.subdued,
    borderRadius: 999,
    color: colors.ink,
    fontSize: 14,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  row: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  rowLabel: { color: colors.muted, fontSize: 15, fontWeight: "700" },
  rowValue: { color: colors.ink, fontSize: 16, lineHeight: 23 },
});
