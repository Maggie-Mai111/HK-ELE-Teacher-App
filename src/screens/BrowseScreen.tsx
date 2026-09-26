import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";

import { ActionButton } from "../components/ActionButton";
import { AiFilterAssistant } from "../components/AiFilterAssistant";
import { ChoiceChip } from "../components/ChoiceChip";
import { DataModeNotice } from "../components/DataModeNotice";
import { FamilyCard } from "../components/FamilyCard";
import { ScreenHeader } from "../components/ScreenHeader";
import { WebFamilyTable } from "../components/WebFamilyTable";
import type {
  BrowsePage,
  BrowseScope,
  BrowseSort,
  DataMode,
  FamilyRecord,
  HkeleRepository,
  SurfaceSearchResult,
} from "../domain/hkele";
import { browseResultState, type BrowseResultMode } from "../services/browseResultState";
import { dataModePresentation } from "../services/dataModePresentation";
import { describeAiFilterConditions, type AiFilterExecution } from "../services/aiFilterExecutor";
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

function searchStatus(result: SurfaceSearchResult): string {
  if (result.status === "FULL_DATABASE_CHECK_UNAVAILABLE") return "Full database check unavailable";
  if (result.status === "UNMATCHED") return "Not found after a full database check";
  if (result.status === "RESOLVED") return "Family found";
  if (result.status === "AMBIGUOUS") return "More than one family — review";
  if (result.status === "REGISTERED_GRAMMATICAL_RELATION") return "Registered grammatical relation";
  return "Context review required";
}

function focusAndReveal(target: View | null) {
  setTimeout(() => {
    const node = target as unknown as {
      focus?: () => void;
      scrollIntoView?: (options: { block: string; behavior: string }) => void;
    } | null;
    node?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    node?.focus?.();
  }, 0);
}

export function BrowseScreen({ repository, teaching, onOpenFamily }: Props) {
  const viewport = useWindowDimensions();
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
  const [aiSelection, setAiSelection] = useState<AiFilterExecution | null>(null);
  const [resultMode, setResultMode] = useState<BrowseResultMode>("browse");
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [editRequestNonce, setEditRequestNonce] = useState(0);
  const [batchMessage, setBatchMessage] = useState("");
  const resultSummaryRef = useRef<View>(null);
  const manualFiltersRef = useRef<View>(null);
  const focusAfterBrowseLoad = useRef(false);
  const state = browseResultState(resultMode);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void repository
      .browse({ scope, sort, page: pageNumber, pageSize: 25 })
      .then((result) => {
        if (!active) return;
        setPage(result);
        setDataMode(result.sourceMode);
        if (focusAfterBrowseLoad.current) {
          focusAfterBrowseLoad.current = false;
          focusAndReveal(resultSummaryRef.current);
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

  const activateBrowse = () => {
    setResultMode("browse");
    setSearch(null);
    setAiSelection(null);
    setBatchMessage("");
  };
  const selectScope = (next: BrowseScope) => {
    activateBrowse();
    focusAfterBrowseLoad.current = true;
    setScope(next);
    setPageNumber(1);
  };
  const selectSort = (next: BrowseSort) => {
    activateBrowse();
    focusAfterBrowseLoad.current = true;
    setSort(next);
    setPageNumber(1);
  };
  const searchNow = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setError("");
    setBatchMessage("");
    try {
      const result = await repository.searchSurface(query);
      setSearch(result);
      setAiSelection(null);
      setResultMode("search");
      setDataMode(result.dataMode);
      focusAndReveal(resultSummaryRef.current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setSearching(false);
    }
  };
  const clearSearch = () => {
    setQuery("");
    setSearch(null);
    setResultMode("browse");
    focusAndReveal(resultSummaryRef.current);
  };
  const isAdded = (family: FamilyRecord) =>
    teaching.items.some((item) => item.basewordKey === family.baseword_key);
  const useTable = Platform.OS === "web" && viewport.width >= 760;
  const activeFamilies = state.aiActive
    ? (aiSelection?.families ?? [])
    : state.searchActive
      ? (search?.owners ?? [])
      : (page?.families ?? []);

  const showManualFilters = () => {
    activateBrowse();
    setMoreFiltersOpen(true);
    focusAndReveal(manualFiltersRef.current);
  };
  const applyAi = (execution: AiFilterExecution) => {
    setAiSelection(execution);
    setSearch(null);
    setResultMode("ai");
    setBatchMessage("");
    focusAndReveal(resultSummaryRef.current);
  };

  return (
    <View style={styles.content}>
      <ScreenHeader
        intro="Search an exact form first, or use AI and manual filters to work from registered principal data."
        title="Find words"
      />
      <View style={styles.searchBox}>
        <TextInput
          accessibilityLabel="Search a word or form"
          autoCapitalize="none"
          onChangeText={setQuery}
          onSubmitEditing={() => void searchNow()}
          placeholder="Search a word or exact form"
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
      <DataModeNotice mode={dataMode} />
      <AiFilterAssistant
        editRequestNonce={editRequestNonce}
        onApply={applyAi}
        onUseManualFilters={showManualFilters}
        repository={repository}
      />
      <View ref={manualFiltersRef} style={styles.moreFilters} tabIndex={-1}>
        <ActionButton
          kind="secondary"
          label={moreFiltersOpen ? "Hide filters" : "More filters"}
          onPress={() => setMoreFiltersOpen((value) => !value)}
        />
        {moreFiltersOpen ? (
          <View style={styles.filterBody}>
            <Text style={styles.label}>List scope</Text>
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
          </View>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      {loading && resultMode === "browse" ? (
        <ActivityIndicator accessibilityLabel="Loading words" color={colors.primary} size="large" />
      ) : null}
      <View
        accessibilityLiveRegion="polite"
        ref={resultSummaryRef}
        style={styles.resultSummary}
        tabIndex={-1}
      >
        {state.searchActive && search ? (
          <>
            <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>
              {search.owners.length.toLocaleString("en")} result
              {search.owners.length === 1 ? "" : "s"} for “{search.submittedQuery}”
            </Text>
            <Text style={styles.resultStatus}>{searchStatus(search)}</Text>
            {search.identityException ? (
              <Text style={styles.warning}>{search.identityException.teacherDisplay}</Text>
            ) : null}
            {search.owners.length === 0 ? (
              <Text style={styles.muted}>
                {search.status === "FULL_DATABASE_CHECK_UNAVAILABLE"
                  ? "This form is outside the built-in set. Recheck when the online full database is available."
                  : search.status === "UNMATCHED"
                    ? "The full database was checked and no registered family owner was found."
                    : "No ranked family owner is assigned to this registered relation or review state."}
              </Text>
            ) : null}
            <ActionButton kind="secondary" label="Clear search" onPress={clearSearch} />
          </>
        ) : state.aiActive && aiSelection ? (
          <>
            <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>
              {aiSelection.matchedBeforeLimit.toLocaleString("en")} matches · showing first{" "}
              {aiSelection.families.length.toLocaleString("en")}
            </Text>
            <Text style={styles.aiConditions}>
              {describeAiFilterConditions(aiSelection.filters).join(" · ")}
            </Text>
            <Text style={styles.muted}>
              Principal Candidate/Reference data · deterministic filtering
            </Text>
            <View style={styles.actions}>
              <ActionButton
                kind="secondary"
                label="Clear results"
                onPress={() => {
                  setAiSelection(null);
                  setBatchMessage("");
                  setResultMode("browse");
                }}
              />
              <ActionButton
                kind="secondary"
                label="Edit AI request"
                onPress={() => {
                  setAiSelection(null);
                  setBatchMessage("");
                  setResultMode("browse");
                  setEditRequestNonce((value) => value + 1);
                }}
              />
              <ActionButton
                kind="secondary"
                label="Adjust manual filters"
                onPress={showManualFilters}
              />
              <ActionButton
                disabled={aiSelection.families.length === 0}
                label="Add shown words to Teaching list"
                onPress={() => {
                  const result = teaching.addMany(aiSelection.families);
                  setBatchMessage(
                    `${result.added} added · ${result.existing} already in list · ${result.total} total`,
                  );
                }}
              />
            </View>
            {batchMessage ? (
              <View accessibilityLiveRegion="polite" style={styles.batchNotice}>
                <Text style={styles.batchText}>{batchMessage}</Text>
                {teaching.undoState?.label === "Bulk addition to Teaching list" ? (
                  <ActionButton
                    kind="secondary"
                    label="Undo bulk addition"
                    onPress={() => {
                      teaching.undo();
                      setBatchMessage("Bulk addition undone.");
                    }}
                  />
                ) : null}
              </View>
            ) : null}
            {aiSelection.families.length === 0 ? (
              <Text style={styles.muted}>
                No registered family meets every confirmed condition. Edit the request, adjust
                manual filters, or clear the result; no hidden condition was added.
              </Text>
            ) : null}
          </>
        ) : page ? (
          <>
            <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>
              {page.availableItems.toLocaleString("en")} families · page {page.page}
            </Text>
            <Text style={styles.muted}>{dataModePresentation(page.sourceMode).shortLabel}</Text>
          </>
        ) : null}
      </View>
      {activeFamilies.length > 0 ? (
        useTable ? (
          <WebFamilyTable
            families={activeFamilies}
            isAdded={isAdded}
            onAdd={teaching.add}
            onOpen={(family) => onOpenFamily(family.baseword_key)}
          />
        ) : (
          activeFamilies.map((family) => (
            <FamilyCard
              added={isAdded(family)}
              family={family}
              key={family.baseword_key}
              {...(state.searchActive
                ? {
                    matchNote: `Matched: ${
                      search?.owners
                        .find((owner) => owner.baseword_key === family.baseword_key)
                        ?.matched_forms.join(", ") ||
                      search?.normalizedQuery ||
                      ""
                    }`,
                  }
                : {})}
              onAdd={teaching.add}
              onOpen={(item) => onOpenFamily(item.baseword_key)}
            />
          ))
        )
      ) : null}
      {resultMode === "browse" && page && !loading ? (
        <View style={styles.pager}>
          <ActionButton
            disabled={pageNumber === 1}
            kind="secondary"
            label="Previous page"
            onPress={() => {
              focusAfterBrowseLoad.current = true;
              setPageNumber((value) => Math.max(1, value - 1));
            }}
          />
          <ActionButton
            disabled={pageNumber * 25 >= page.availableItems}
            kind="secondary"
            label="Next page"
            onPress={() => {
              focusAfterBrowseLoad.current = true;
              setPageNumber((value) => value + 1);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  aiConditions: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  batchNotice: {
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: 10,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  batchText: { color: colors.ink, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  content: { gap: spacing.md, padding: spacing.lg },
  error: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    color: colors.danger,
    fontSize: 15,
    lineHeight: 22,
    padding: spacing.md,
  },
  filterBody: { gap: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    color: colors.ink,
    flexBasis: 220,
    flexGrow: 1,
    flexShrink: 1,
    fontSize: 16,
    minHeight: 48,
    minWidth: 220,
    paddingHorizontal: spacing.md,
  },
  label: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  moreFilters: {
    alignItems: "flex-start",
    backgroundColor: colors.subdued,
    borderRadius: 14,
    gap: spacing.sm,
    padding: spacing.md,
  },
  muted: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  pager: { flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  resultStatus: { color: colors.primary, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  resultSummary: {
    backgroundColor: colors.primarySoft,
    borderRadius: 15,
    gap: spacing.sm,
    padding: spacing.md,
  },
  searchBox: {
    alignItems: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", lineHeight: 27 },
  warning: {
    backgroundColor: colors.warningSoft,
    borderRadius: 8,
    color: colors.ink,
    fontSize: 15,
    lineHeight: 22,
    padding: spacing.sm,
  },
});
