import { useAppDimensions } from "./useAppDimensions";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  familySetLabel,
  hasFlag,
  type FamilyRecord,
  type FormRecord,
  type HkeleRepository,
} from "../domain/hkele";
import { vocabularyListLabel } from "../services/externalLevelPresentation";
import { hasSelectedForm } from "../services/lessonSelectionPresentation";
import type { TeachingListStore } from "../services/teachingListService";
import {
  loadFamilySearchGroups,
  familySearchFormSummary,
  sortWordForms,
  type FamilySearchGroup,
  type WordFormSort,
} from "../services/wordFamilySearch";
import { colors, spacing } from "../theme/tokens";
import { ActionButton } from "./ActionButton";
import { ChoiceChip } from "./ChoiceChip";
import { ProgressiveDisclosure } from "./ProgressiveDisclosure";
import { EvidenceTokens } from "./EvidenceTokens";
import { evidenceKind } from "../services/evidenceTokens";

interface Props {
  families: FamilyRecord[];
  query: string;
  repository: HkeleRepository;
  teaching: TeachingListStore;
  onOpenFamily: (key: string, form?: string) => void;
}
const shown = (value: unknown) =>
  value === null || value === undefined || value === "" ? "—" : String(value);
const columns = [
  ["Word", 160],
  ["First seen in HK textbooks", 150],
  ["US grade reference", 160],
  ["Academic Word List (AWL)", 160],
  ["Middle School Vocabulary List (MSVL)", 200],
  ["Greek/Latin root", 120],
  ["Root meaning", 180],
  ["Prefix", 100],
  ["Suffix", 100],
  ["View", 85],
  ["Add", 85],
] as const;
function evidence(form: FormRecord) {
  const withheld = String(form.phase1c_evidence_withheld_fields ?? "").toLowerCase();
  return [
    shown(form.first_seen_hk_textbooks),
    shown(form.external_level_reference),
    hasFlag(form.awl) ? "Yes" : "—",
    vocabularyListLabel(form.msvl),
    shown(form.root),
    shown(form.root_meaning_alignment_status === "MATCHED_UNIQUE_EXACT" ? form.root_meaning : null),
    shown(withheld.includes("prefix") ? null : form.prefix),
    shown(withheld.includes("suffix") ? null : form.suffix),
  ];
}
export function FamilySearchResults({
  families,
  query,
  repository,
  teaching,
  onOpenFamily,
}: Props) {
  const [groups, setGroups] = useState<FamilySearchGroup[]>([]);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [retry, setRetry] = useState(0),
    [sort, setSort] = useState<WordFormSort>("frequency-desc");
  const wide = useAppDimensions().width >= 760;
  useEffect(() => {
    setSort("frequency-desc");
  }, [query]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setGroups([]);
    void loadFamilySearchGroups(repository, families)
      .then((value) => {
        if (active) setGroups(value);
      })
      .catch(() => {
        if (active) setError("We couldn't load the related words. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [repository, families, query, retry]);
  if (loading)
    return <ActivityIndicator accessibilityLabel="Loading related words" color={colors.primary} />;
  if (error)
    return (
      <View style={styles.stack}>
        <Text accessibilityRole="alert">{error}</Text>
        <ActionButton label="Try again" onPress={() => setRetry((value) => value + 1)} />
      </View>
    );
  return (
    <View style={styles.stack}>
      <Text style={styles.note}>{familySearchFormSummary(groups, query)}</Text>
      <Text style={styles.note}>Ranks compare whole word families; 1 is the highest.</Text>
      <ProgressiveDisclosure title="Sort words">
        <View style={styles.chips}>
          {(
            [
              ["frequency-desc", "Most frequent forms"],
              ["frequency-asc", "Least frequent forms"],
              ["az", "A–Z"],
              ["za", "Z–A"],
            ] as const
          ).map(([value, label]) => (
            <ChoiceChip
              key={value}
              label={label}
              selected={sort === value}
              onPress={() => setSort(value)}
            />
          ))}
        </View>
      </ProgressiveDisclosure>
      {groups.some((group) => group.frequencyUnavailable) ? (
        <View style={styles.stack}>
          <Text style={styles.note}>
            Frequency sorting is temporarily unavailable. You can still view and choose words.
          </Text>
          <ActionButton
            kind="secondary"
            label="Retry sorting"
            onPress={() => setRetry((value) => value + 1)}
          />
        </View>
      ) : null}
      {groups.map((group) => {
        const rows = sortWordForms(group.forms, query, group.frequencies, sort);
        const add = (form: FormRecord) => teaching.add(group.family, form.form, "Find words");
        return (
          <View key={group.family.baseword_key} style={styles.group}>
            <Text accessibilityRole="header" style={styles.heading}>
              Word family: {group.family.display_family}
            </Text>
            <Text style={styles.note}>
              {familySetLabel(group.family)} · {group.forms.length} word forms
            </Text>
            <Text style={styles.note}>
              Overall family rank: {shown(group.family.overall_frequency_order)} · HK family rank:{" "}
              {shown(group.family.current_hk_frequency_rank)}
            </Text>
            {wide ? (
              <ScrollView horizontal nestedScrollEnabled>
                <View>
                  <View style={styles.tableRow}>
                    {columns.map(([label, width]) => (
                      <Text key={label} style={[styles.tableHead, { width }]}>
                        {label}
                      </Text>
                    ))}
                  </View>
                  {rows.map(({ form, isSearch }) => {
                    const values = [
                      form.form,
                      ...evidence(form),
                    ];
                    const added = hasSelectedForm(teaching.items, group.family, form.form);
                    return (
                      <View
                        key={form.form_key ?? form.normalized_form}
                        style={[styles.tableRow, isSearch && styles.searchHit]}
                      >
                        {columns.map(([label, width], index) =>
                          index === 0 ? (
                            <Pressable
                              accessibilityRole="button"
                              key={label}
                              onPress={() => onOpenFamily(group.family.baseword_key, form.form)}
                              style={[styles.cell, { width }]}
                            >
                              <Text style={styles.word}>{form.form}</Text>
                              {isSearch ? <Text style={styles.marker}>Your search</Text> : null}
                            </Pressable>
                          ) : index === 4 || index === 5 || index === 6 ? (
                            <View key={label} style={[styles.cell, { width }]}>
                              <EvidenceTokens
                                value={values[index]}
                                kind={index === 4 ? "subject" : index === 5 ? "root" : "meaning"}
                              />
                            </View>
                          ) : index < 9 ? (
                            <Text key={label} style={[styles.cell, { width }]}>
                              {values[index]}
                            </Text>
                          ) : (
                            <View key={label} style={[styles.cell, { width }]}>
                              <ActionButton
                                kind="secondary"
                                disabled={index === 10 && (added || !teaching.ready)}
                                label={index === 9 ? "View" : added ? "Added" : "Add"}
                                onPress={() =>
                                  index === 9
                                    ? onOpenFamily(group.family.baseword_key, form.form)
                                    : add(form)
                                }
                              />
                            </View>
                          ),
                        )}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            ) : (
              rows.map(({ form, isSearch }) => {
                const values = evidence(form),
                  added = hasSelectedForm(teaching.items, group.family, form.form);
                return (
                  <View
                    key={form.form_key ?? form.normalized_form}
                    style={[styles.wordCard, isSearch && styles.searchHit]}
                  >
                    <View style={styles.titleRow}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`View ${form.form}`}
                        onPress={() => onOpenFamily(group.family.baseword_key, form.form)}
                        style={styles.wordButton}
                      >
                        <Text style={styles.word}>{form.form}</Text>
                      </Pressable>
                      {isSearch ? <Text style={styles.marker}>Your search</Text> : null}
                    </View>
                    <View style={styles.evidenceRow}>
                      <Text style={styles.textbook}>First seen in HK textbooks: {values[0]}</Text>
                      <Text style={styles.grade}>US grade reference: {values[1]}</Text>
                    </View>
                    <ProgressiveDisclosure title="Word information">
                      <View style={styles.stack}>
                        {columns.slice(3, 9).map(([label], index) => {
                          const kind = evidenceKind(label);
                          return kind ? (
                            <View key={label} style={styles.stack}>
                              <Text style={[styles.note, styles.bold]}>{label}</Text>
                              <EvidenceTokens value={values[index + 2]} kind={kind} />
                            </View>
                          ) : (
                            <Text key={label} style={styles.note}>
                              <Text style={styles.bold}>{label}: </Text>
                              {values[index + 2]}
                            </Text>
                          );
                        })}
                      </View>
                    </ProgressiveDisclosure>
                    <View style={styles.chips}>
                      <ActionButton
                        kind="secondary"
                        label="View"
                        onPress={() => onOpenFamily(group.family.baseword_key, form.form)}
                      />
                      <ActionButton
                        kind="secondary"
                        label={added ? "Added" : "Add to selected words"}
                        disabled={added || !teaching.ready}
                        onPress={() => add(form)}
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  group: {
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  heading: { fontSize: 21, fontWeight: "800", color: colors.ink },
  note: { fontSize: 17, lineHeight: 25, color: colors.muted },
  wordCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.md,
    gap: spacing.sm,
  },
  searchHit: {
    backgroundColor: "#E1F3E8",
    borderColor: "#7EB59A",
    borderLeftColor: colors.primary,
    borderLeftWidth: 4,
  },
  titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm },
  wordButton: { flexGrow: 1 },
  word: { color: colors.primary, fontSize: 20, fontWeight: "800", textDecorationLine: "underline" },
  marker: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primary,
    backgroundColor: colors.surface,
    padding: 5,
    borderRadius: 5,
  },
  bold: { fontWeight: "700" },
  evidenceRow: { gap: spacing.xs },
  textbook: { fontSize: 17, lineHeight: 25, color: colors.hkTop },
  grade: { fontSize: 17, lineHeight: 25, color: colors.cpb },
  tableRow: { flexDirection: "row" },
  tableHead: {
    fontSize: 16,
    color: colors.surface,
    fontWeight: "800",
    backgroundColor: colors.primary,
    padding: spacing.sm,
  },
  cell: {
    fontSize: 18,
    lineHeight: 26,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
});
