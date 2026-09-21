import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ChoiceChip } from "../components/ChoiceChip";
import { DataModeNotice } from "../components/DataModeNotice";
import { FamilyCard } from "../components/FamilyCard";
import { ScreenHeader } from "../components/ScreenHeader";
import type {
  BrowsePage,
  BrowseScope,
  BrowseSort,
  FamilyRecord,
  HkeleRepository,
  SurfaceSearchResult,
  DataMode,
} from "../domain/hkele";
import { dataModePresentation } from "../services/dataModePresentation";
import type { TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";

interface Props {
  repository: HkeleRepository;
  teaching: TeachingListStore;
  onOpenFamily: (basewordKey: string) => void;
}

const scopes: Array<[BrowseScope, string]> = [
  ["core", "Candidate"],
  ["broader", "Candidate + Reference"],
  ["full", "Full database"],
];
const sorts: Array<[BrowseSort, string]> = [
  ["overall", "Overall"],
  ["hk", "HK frequency"],
  ["az", "A–Z"],
];

export function BrowseScreen({ repository, teaching, onOpenFamily }: Props) {
  const [dataMode, setDataMode] = useState<DataMode>(() => repository.getDataMode());
  const [scope, setScope] = useState<BrowseScope>("core");
  const [sort, setSort] = useState<BrowseSort>("overall");
  const [pageNumber, setPageNumber] = useState(1);
  const [page, setPage] = useState<BrowsePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SurfaceSearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void repository
      .browse({ scope, sort, page: pageNumber, pageSize: 25 })
      .then((result) => {
        if (active) {
          setPage(result);
          setDataMode(result.sourceMode);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setDataMode(repository.getDataMode());
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [pageNumber, repository, scope, sort]);

  const selectScope = (next: BrowseScope) => {
    setScope(next);
    setPageNumber(1);
    setSearch(null);
  };
  const selectSort = (next: BrowseSort) => {
    setSort(next);
    setPageNumber(1);
  };
  const searchNow = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    try {
      const result = await repository.searchSurface(query);
      setSearch(result);
      setDataMode(result.dataMode);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSearching(false);
    }
  };
  const isAdded = (family: FamilyRecord) =>
    teaching.items.some((item) => item.basewordKey === family.baseword_key);

  return (
    <View style={styles.content}>
      <ScreenHeader
        intro="Find a family by list position or search an exact word form. Current database evidence is shown without changing the registered ranking."
        title="Browse"
      />
      <DataModeNotice mode={dataMode} />
      <View style={styles.searchBox}>
        <TextInput
          accessibilityLabel="Search a word or form"
          autoCapitalize="none"
          onChangeText={setQuery}
          onSubmitEditing={() => void searchNow()}
          placeholder="Search a word or form"
          returnKeyType="search"
          style={styles.input}
          value={query}
        />
        <ActionButton
          disabled={searching || !query.trim()}
          label={searching ? "Searching…" : "Search"}
          onPress={() => void searchNow()}
        />
      </View>
      {search ? (
        <View style={styles.resultBox}>
          <Text style={styles.sectionTitle}>Search result: {search.submittedQuery}</Text>
          <Text style={styles.resultStatus}>
            Status:{" "}
            {search.status === "FULL_DATABASE_CHECK_UNAVAILABLE"
              ? "Full database check unavailable"
              : search.status === "UNMATCHED"
                ? "Not found after a full database check"
                : search.status === "RESOLVED"
                  ? "Family found"
                  : search.status === "AMBIGUOUS"
                    ? "More than one family — review"
                    : search.status === "REGISTERED_GRAMMATICAL_RELATION"
                      ? "Registered grammatical relation"
                      : "Context review required"}
          </Text>
          {search.identityException ? (
            <Text style={styles.warning}>{search.identityException.teacherDisplay}</Text>
          ) : null}
          {search.owners.length === 0 ? (
            <Text style={styles.muted}>
              {search.status === "FULL_DATABASE_CHECK_UNAVAILABLE"
                ? "This form is outside the built-in set. Recheck when the online or installed full database is available; it is not labelled unmatched."
                : search.status === "UNMATCHED"
                  ? "The full database was checked and no registered family owner was found."
                  : "No ranked family owner is assigned to this registered language relation or review state."}
            </Text>
          ) : null}
          {search.owners.map((family) => (
            <FamilyCard
              added={isAdded(family)}
              family={family}
              key={family.baseword_key}
              matchNote={`Matched: ${family.matched_forms.join(", ") || search.normalizedQuery}`}
              onAdd={teaching.add}
              onOpen={(item) => onOpenFamily(item.baseword_key)}
            />
          ))}
        </View>
      ) : null}
      <Text style={styles.label}>List</Text>
      <View style={styles.chips}>
        {scopes.map(([value, label]) => (
          <ChoiceChip
            key={value}
            label={label}
            onPress={() => selectScope(value)}
            selected={scope === value}
          />
        ))}
      </View>
      <Text style={styles.label}>Sort</Text>
      <View style={styles.chips}>
        {sorts.map(([value, label]) => (
          <ChoiceChip
            key={value}
            label={label}
            onPress={() => selectSort(value)}
            selected={sort === value}
          />
        ))}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {loading ? (
        <ActivityIndicator accessibilityLabel="Loading words" color={colors.primary} size="large" />
      ) : null}
      {page && !loading ? (
        <>
          <Text style={styles.count}>
            {page.availableItems.toLocaleString("en")} families · page {page.page} ·{" "}
            {dataModePresentation(page.sourceMode).shortLabel}
          </Text>
          {page.families.map((family) => (
            <FamilyCard
              added={isAdded(family)}
              family={family}
              key={family.baseword_key}
              onAdd={teaching.add}
              onOpen={(item) => onOpenFamily(item.baseword_key)}
            />
          ))}
          <View style={styles.pager}>
            <ActionButton
              disabled={pageNumber === 1}
              kind="secondary"
              label="Previous"
              onPress={() => setPageNumber((value) => Math.max(1, value - 1))}
            />
            <ActionButton
              disabled={pageNumber * 25 >= page.availableItems}
              kind="secondary"
              label="Next"
              onPress={() => setPageNumber((value) => value + 1)}
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  content: { gap: spacing.md, padding: spacing.lg },
  count: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  error: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    color: colors.danger,
    padding: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  label: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  muted: { color: colors.muted, fontSize: 15 },
  pager: { flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  resultBox: {
    backgroundColor: colors.subdued,
    borderRadius: 15,
    gap: spacing.sm,
    padding: spacing.md,
  },
  resultStatus: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  searchBox: { alignItems: "stretch", flexDirection: "row", gap: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "800" },
  warning: {
    backgroundColor: colors.warningSoft,
    borderRadius: 8,
    color: colors.ink,
    lineHeight: 22,
    padding: spacing.sm,
  },
});
