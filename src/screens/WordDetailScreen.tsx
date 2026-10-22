import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { AppCard } from "../components/AppCard";
import { EvidenceBadge } from "../components/EvidenceBadge";
import { EvidenceTokens } from "../components/EvidenceTokens";
import { evidenceKind } from "../services/evidenceTokens";
import type { FeedbackRequest } from "../components/FeedbackPanel";
import { DataModeNotice } from "../components/DataModeNotice";
import { CurrentLesson } from "../components/CurrentLesson";
import { ProgressiveDisclosure } from "../components/ProgressiveDisclosure";
import { MorphologyLegend, SafeMorphologyForm } from "../components/SafeMorphologyForm";
import {
  familySetLabel,
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
import {
  selectedWordForm,
  selectedFormEvidence,
  type CheckedTextEvidence,
} from "../services/textReaderService";
import { teacherLevelLabel, vocabularyListLabel } from "../services/externalLevelPresentation";
import { colors, spacing } from "../theme/tokens";

interface Props {
  basewordKey: string;
  selectedForm?: string;
  repository: HkeleRepository;
  teaching: TeachingListStore;
  onBack: () => void;
  backLabel?: string;
  onFeedback: (request: FeedbackRequest) => void;
  textEvidence?: CheckedTextEvidence;
  sourceLabel?: string;
}

interface FormTierProps {
  title: string;
  description: string;
  forms: FormRecord[];
  family: FamilyDetail["family"];
  teaching: TeachingListStore;
}

function display(value: unknown): string {
  return value === null || value === undefined || value === "" ? "—" : String(value);
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  const kind = evidenceKind(label);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {kind ? (
        <EvidenceTokens value={value} kind={kind} />
      ) : (
        <Text selectable style={styles.rowValue}>
          {display(value)}
        </Text>
      )}
    </View>
  );
}

function FormTier({ title, description, forms, family, teaching }: FormTierProps) {
  const [limit, setLimit] = useState(PROGRESSIVE_BATCH_SIZE);
  const shown = visibleForms(forms, limit);
  return (
    <ProgressiveDisclosure
      summary={`${forms.length.toLocaleString("en")} word forms · ${description}`}
      title={`${title} (${forms.length.toLocaleString("en")})`}
    >
      {forms.length ? (
        <>
          <Text style={styles.caution}>
            Showing {shown.length.toLocaleString("en")} of {forms.length.toLocaleString("en")}{" "}
            forms.
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
                      First seen in HK textbooks: {display(form.first_seen_hk_textbooks)} · US grade
                      reference: {display(form.external_level_reference)}
                    </Text>
                  </View>
                  <ActionButton
                    disabled={selected || !teaching.ready}
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
        <Text style={styles.caution}>No forms in this group.</Text>
      )}
    </ProgressiveDisclosure>
  );
}

export function WordDetailScreen({
  basewordKey,
  repository,
  teaching,
  onBack,
  onFeedback,
  textEvidence,
  selectedForm,
  backLabel = "← Back to results",
  sourceLabel = "Find words",
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
          void reason;
          setError("We couldn't load this word. Check your connection and open it again.");
        }
      });
    return () => {
      active = false;
    };
  }, [basewordKey, repository]);

  const activeForm = useMemo(
    () => selectedWordForm(detail?.forms ?? [], selectedForm || detail?.family.display_family),
    [detail, selectedForm],
  );
  const chosenWord = selectedForm || detail?.family.display_family || "";
  const inList = detail
    ? teaching.items.some(
        (item) =>
          item.basewordKey === detail.family.baseword_key &&
          item.selectedForms.includes(chosenWord),
      )
    : false;

  const morphology = useMemo(() => selectedFormEvidence(activeForm), [activeForm]);

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
        description: "Forms observed in the sampled textbooks.",
        forms: textbook,
      },
      {
        key: "external",
        title: "Supported by external level references",
        description: "Forms with external level references.",
        forms: external,
      },
      {
        key: "remaining",
        title: "Other word forms",
        description: "Additional forms in this word family.",
        forms: remaining,
      },
    ];
  }, [detail]);

  return (
    <View style={styles.content}>
      <View style={styles.back}>
        <ActionButton kind="secondary" label={backLabel} onPress={onBack} />
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
              {chosenWord}
            </Text>
            {selectedForm ? (
              <Text style={styles.caution}>Word family: {detail.family.display_family}</Text>
            ) : null}
            {textEvidence?.context ? (
              <View style={styles.contextBox}>
                <Text style={styles.caution}>In your text</Text>
                <Text selectable style={styles.context}>
                  {textEvidence.context}
                </Text>
              </View>
            ) : null}
            {activeForm ? <SafeMorphologyForm form={activeForm} /> : null}
            <View style={styles.badges}>
              <Text style={styles.badge}>{familySetLabel(detail.family)}</Text>
              <Text style={styles.rankBadge}>
                {selectedForm ? "Family overall rank" : "Overall rank"}{" "}
                {display(detail.family.overall_frequency_order)}
              </Text>
              <Text style={styles.rankBadge}>
                {selectedForm ? "Family HK rank" : "HK rank"}{" "}
                {display(detail.family.current_hk_frequency_rank)}
              </Text>
            </View>
            <View style={styles.badges}>
              <EvidenceBadge
                label={
                  activeForm
                    ? "Word · first seen in HK textbooks"
                    : "Family · first seen in HK textbooks"
                }
                value={
                  activeForm
                    ? activeForm.first_seen_hk_textbooks
                    : detail.family.textbook_first_seen_level
                }
                tone="textbook"
              />
              <EvidenceBadge
                label="US grade reference"
                value={teacherLevelLabel(activeForm?.external_level_reference)}
                tone="external"
              />
            </View>
            <ActionButton
              disabled={inList || !teaching.ready}
              label={inList ? "In teaching list" : `Add ${chosenWord} to teaching list`}
              onPress={() => teaching.add(detail.family, chosenWord, sourceLabel)}
            />
            <CurrentLesson teaching={teaching} />
            <View style={styles.feedbackActions}>
              <ActionButton
                kind="secondary"
                label="Rate this word"
                onPress={() =>
                  onFeedback({
                    kind: "rating",
                    context: {
                      product: "App/PWA",
                      page: "Word detail",
                      family: detail.family.display_family,
                      familyKey: detail.family.baseword_key,
                      word:
                        activeForm?.form ??
                        textEvidence?.members.find((member) =>
                          detail.forms.some(
                            (form) => form.form.toLowerCase() === member.surface.toLowerCase(),
                          ),
                        )?.surface ??
                        detail.forms.find(
                          (form) =>
                            form.form.toLowerCase() === detail.family.display_family.toLowerCase(),
                        )?.form ??
                        detail.forms[0]?.form ??
                        "",
                      registeredForms: detail.forms.map((form) => form.form),
                    },
                  })
                }
              />
              <ActionButton
                kind="secondary"
                label="Report a problem"
                onPress={() =>
                  onFeedback({
                    kind: "report",
                    context: {
                      product: "App/PWA",
                      page: "Word detail",
                      family: detail.family.display_family,
                      familyKey: detail.family.baseword_key,
                      word: activeForm?.form ?? chosenWord,
                      registeredForms: detail.forms.map((form) => form.form),
                    },
                  })
                }
              />
            </View>
          </View>
          <DataModeNotice mode={dataMode} />
          {textEvidence ? (
            <AppCard title="In the checked text">
              <DetailRow
                label="Forms in your text"
                value={textEvidence.members
                  .map((member) => `${member.surface} × ${member.count}`)
                  .join(" · ")}
              />
              <DetailRow label="Total occurrences" value={textEvidence.count} />
            </AppCard>
          ) : null}
          <ProgressiveDisclosure
            summary="Frequency, textbook levels and subject links."
            title="Word information"
          >
            <DetailRow label="Word list" value={familySetLabel(detail.family)} />
            <DetailRow label="Overall rank" value={detail.family.overall_frequency_order} />
            <DetailRow label="HK frequency rank" value={detail.family.current_hk_frequency_rank} />
            <DetailRow label="HK frequency band" value={detail.family.current_hk_frequency_band} />
            <DetailRow label="First seen in HK textbooks" value={morphology.firstSeen} />
            <DetailRow
              label="US grade reference"
              value={teacherLevelLabel(activeForm?.external_level_reference)}
            />
            <DetailRow label="Academic Word List (AWL)" value={morphology.awl ? "Yes" : "—"} />
            <DetailRow
              label="Middle School Vocabulary List (MSVL)"
              value={vocabularyListLabel(morphology.msvl)}
            />
            <DetailRow label="Academic subject evidence" value={morphology?.subjects} />
          </ProgressiveDisclosure>
          <ProgressiveDisclosure summary="Explore roots, prefixes and suffixes." title="Word parts">
            <DetailRow label="Root" value={morphology?.root} />
            <DetailRow label="Root meaning" value={morphology?.meaning} />
            <DetailRow label="Prefix" value={morphology?.prefix} />
            <DetailRow label="Suffix" value={morphology?.suffix} />
            <MorphologyLegend />
          </ProgressiveDisclosure>
          <View style={styles.formsIntro}>
            <Text accessibilityRole="header" aria-level={2} style={styles.formsTitle}>
              Word forms ({detail.forms.length.toLocaleString("en")})
            </Text>
            <Text style={styles.caution}>
              Open a group to explore its word forms and add the ones you want to teach.
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
  context: { color: colors.ink, fontSize: 17, lineHeight: 26 },
  contextBox: {
    backgroundColor: colors.canvas,
    padding: spacing.sm,
    borderRadius: 10,
    gap: spacing.xs,
  },
  feedbackActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  back: { alignSelf: "flex-start" },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
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
  formsTitle: { color: colors.ink, fontSize: 22, fontWeight: "700", lineHeight: 29 },
  gradeEvidence: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  heading: { color: colors.ink, fontSize: 34, fontWeight: "700", lineHeight: 41 },
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
  noticeTitle: { color: colors.ink, fontSize: 17, fontWeight: "700" },
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
