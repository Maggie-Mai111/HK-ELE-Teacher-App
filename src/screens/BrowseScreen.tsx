import { useEffect, useMemo, useRef, useState } from "react";
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
import { CurrentLesson } from "../components/CurrentLesson";
import { FamilySearchResults } from "../components/FamilySearchResults";
import { FamilyCard } from "../components/FamilyCard";
import { CompoundCard } from "../components/CompoundCard";
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
import { describeAiFilterConditions, type AiFilterExecution } from "../services/aiFilterExecutor";
import type { TeachingListStore } from "../services/teachingListService";
import { colors, spacing } from "../theme/tokens";
import { inTeacherWordScope } from "../services/wordListPresentation";
import { hasSelectedForm, searchSelectedForm } from "../services/lessonSelectionPresentation";
import { displayedWordEvidence } from "../services/externalLevelPresentation";

interface Props {
  repository: HkeleRepository;
  teaching: TeachingListStore;
  onOpenFamily: (basewordKey: string, selectedForm?: string) => void;
}

const scopes: Array<[BrowseScope, string]> = [
  ["full", "Full database"],
  ["core", "Core list"],
];
const sorts: Array<[BrowseSort, string]> = [
  ["overall", "Overall"],
  ["hk", "HK frequency"],
  ["az", "A–Z"],
];

function searchStatus(result: SurfaceSearchResult): string {
  if (result.status === "REGISTERED_EXPRESSION") return "Compound found";
  if (result.status === "FULL_DATABASE_CHECK_UNAVAILABLE") return "Connect to check more words";
  if (result.status === "UNMATCHED") return "No match in the current wordlist";
  if (result.status === "RESOLVED") return "Family found";
  if (result.status === "AMBIGUOUS") return "More than one family — review";
  if (result.status === "REGISTERED_GRAMMATICAL_RELATION") return "Grammar word";
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
  const [scope, setScope] = useState<BrowseScope>("full");
  const [sort, setSort] = useState<BrowseSort>("overall");
  const [pageNumber, setPageNumber] = useState(1);
  const [reload, setReload] = useState(0);
  const [page, setPage] = useState<BrowsePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const retrySearch = useRef(false);
  const [query, setQuery] = useState("");
  const currentQuery = useRef("");
  const searchRequest = useRef(0);
  useEffect(
    () => () => {
      searchRequest.current += 1;
    },
    [],
  );
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
          void reason;
          setPage(null);
          retrySearch.current = false;
          setError(
            scope === "full"
              ? "Connect to load the full database, or browse the saved Core list."
              : "We couldn't load the words. Check your connection and try again.",
          );
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [pageNumber, repository, scope, sort, reload]);

  const activateBrowse = () => {
    searchRequest.current += 1;
    setSearching(false);
    setResultMode("browse");
    setSearch(null);
    setAiSelection(null);
    setBatchMessage("");
  };
  const selectScope = (next: BrowseScope) => {
    if (resultMode === "search" && search) {
      setScope(next);
      setPageNumber(1);
      focusAndReveal(resultSummaryRef.current);
      return;
    }
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
    const request = ++searchRequest.current;
    setSearching(true);
    setError("");
    setBatchMessage("");
    try {
      const result = await repository.searchSurface(query);
      if (request !== searchRequest.current || currentQuery.current !== query) return;
      setSearch(result);
      setAiSelection(null);
      setResultMode("search");
      setDataMode(result.dataMode);
      focusAndReveal(resultSummaryRef.current);
    } catch (reason) {
      void reason;
      if (request !== searchRequest.current) return;
      retrySearch.current = true;
      setError("We couldn't complete the search. Check your connection and try again.");
    } finally {
      if (request === searchRequest.current) setSearching(false);
    }
  };
  const clearSearch = () => {
    searchRequest.current += 1;
    setSearching(false);
    currentQuery.current = "";
    setQuery("");
    setSearch(null);
    setResultMode("browse");
    focusAndReveal(resultSummaryRef.current);
  };
  const selectedFormFor = (family: FamilyRecord) =>
    state.searchActive ? searchSelectedForm(family, search) : undefined;
  const isAdded = (family: FamilyRecord) =>
    hasSelectedForm(teaching.items, family, selectedFormFor(family));
  const addFamily = (family: FamilyRecord) =>
    teaching.add(family, selectedFormFor(family), "Find words");
  const openFamily = (family: FamilyRecord) =>
    onOpenFamily(family.baseword_key, selectedFormFor(family));
  const useTable = Platform.OS === "web" && viewport.width >= 760;
  const searchFamilies = (search?.owners ?? []).filter(
    (family) => !family.blocked && inTeacherWordScope(family, scope),
  );
  const outsideCore =
    scope === "core" && Boolean(search?.owners.length) && searchFamilies.length === 0;
  const activeFamilies = useMemo(
    () =>
      state.aiActive
        ? (aiSelection?.families ?? [])
        : state.searchActive
          ? (search?.owners ?? []).filter(
              (family) => !family.blocked && inTeacherWordScope(family, scope),
            )
          : (page?.families ?? []),
    [state.aiActive, state.searchActive, aiSelection, search, scope, page],
  );
  const [wordEvidence, setWordEvidence] = useState<{
    source: FamilyRecord[];
    families: FamilyRecord[];
  } | null>(null);
  useEffect(() => {
    if (state.searchActive) return;
    let active = true;
    void Promise.all(
      activeFamilies.map(async (family) => {
        const word = state.searchActive ? searchSelectedForm(family, search) : undefined;
        try {
          const detail = await repository.getFamily(family.baseword_key);
          return displayedWordEvidence(family, detail.forms, word);
        } catch {
          return displayedWordEvidence(family, [], word);
        }
      }),
    ).then((families) => {
      if (active) setWordEvidence({ source: activeFamilies, families });
    });
    return () => {
      active = false;
    };
  }, [activeFamilies, repository, state.searchActive, search]);
  const displayedFamilies =
    wordEvidence?.source === activeFamilies
      ? wordEvidence.families
      : activeFamilies.map((family) => displayedWordEvidence(family, []));

  const showManualFilters = () => {
    activateBrowse();
    setMoreFiltersOpen(true);
    focusAndReveal(manualFiltersRef.current);
  };
  const applyAi = (execution: AiFilterExecution) => {
    searchRequest.current += 1;
    setSearching(false);
    setScope(execution.filters.scope === "full" ? "full" : "core");
    setAiSelection(execution);
    setSearch(null);
    setResultMode("ai");
    setBatchMessage("");
    focusAndReveal(resultSummaryRef.current);
  };

  return (
    <View style={styles.content}>
      <ScreenHeader intro="Find words for your lesson." title="Find words" />
      <View style={styles.searchBox}>
        <TextInput
          accessibilityLabel="Search a word or form"
          autoCapitalize="none"
          onChangeText={(value) => {
            searchRequest.current += 1;
            setSearching(false);
            currentQuery.current = value;
            setQuery(value);
            if (resultMode === "search") {
              setSearch(null);
              setResultMode("browse");
            }
          }}
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
      <View accessibilityLabel="Word list scope" style={styles.chips}>
        {scopes.map(([value, label]) => (
          <ChoiceChip
            key={value}
            label={label}
            onPress={() => selectScope(value)}
            selected={scope === value}
          />
        ))}
      </View>
      <DataModeNotice mode={dataMode} />
      <CurrentLesson teaching={teaching} />
      {state.searchActive && search?.expression ? (
        <CompoundCard
          expression={search.expression}
          teaching={teaching}
          onOpenFamily={onOpenFamily}
        />
      ) : null}
      {state.searchActive && search?.expressionLayerStatus === "UNAVAILABLE" ? (
        <Text style={styles.label}>Connect or update Offline use to check compound words.</Text>
      ) : null}
      <AiFilterAssistant
        scope={scope}
        editRequestNonce={editRequestNonce}
        onApply={applyAi}
        onUseManualFilters={showManualFilters}
        repository={repository}
      />
      {!state.searchActive ? (
        <View ref={manualFiltersRef} style={styles.moreFilters} tabIndex={-1}>
          <ActionButton
            kind="secondary"
            label={moreFiltersOpen ? "Hide sort options" : "Sort"}
            onPress={() => setMoreFiltersOpen((value) => !value)}
          />
          {moreFiltersOpen ? (
            <View style={styles.filterBody}>
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
      ) : null}
      {error ? (
        <View style={styles.filterBody}>
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
          <View style={styles.actions}>
            <ActionButton
              kind="secondary"
              label="Try again"
              onPress={() => {
                if (retrySearch.current) void searchNow();
                else setReload((value) => value + 1);
              }}
            />
            {scope === "full" && dataMode === "bundled-reference" ? (
              <ActionButton
                kind="secondary"
                label="Browse saved Core list"
                onPress={() => selectScope("core")}
              />
            ) : null}
          </View>
        </View>
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
              {(searchFamilies.length + (search.expression ? 1 : 0)).toLocaleString("en")} result
              {searchFamilies.length + (search.expression ? 1 : 0) === 1 ? "" : "s"} for “
              {search.submittedQuery}”
            </Text>
            <Text style={styles.resultStatus}>
              {outsideCore ? "Outside the Core list" : searchStatus(search)}
            </Text>
            {searchFamilies.length === 1 && selectedFormFor(searchFamilies[0]!) ? (
              <Text style={styles.muted}>
                Matched word: {selectedFormFor(searchFamilies[0]!)} · Family:{" "}
                {searchFamilies[0]!.display_family}
              </Text>
            ) : null}
            {outsideCore ? (
              <>
                <Text style={styles.muted}>
                  This word is recorded in the full database. It is outside the Core list.
                </Text>
                <ActionButton
                  kind="secondary"
                  label="View in Full database"
                  onPress={() => setScope("full")}
                />
              </>
            ) : null}
            {search.identityException ? (
              <Text style={styles.warning}>{search.identityException.teacherDisplay}</Text>
            ) : null}
            {search.owners.length === 0 && !search.expression ? (
              <Text style={styles.muted}>
                {search.status === "FULL_DATABASE_CHECK_UNAVAILABLE"
                  ? "This word isn't in the saved wordlist. Connect to the internet and search again."
                  : search.status === "UNMATCHED"
                    ? "Check the spelling, or try another word form. Common words can also be missing from this wordlist."
                    : "Read the word in context before choosing a family."}
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
                No words match all your filters. Try a broader search or remove a filter.
              </Text>
            ) : null}
          </>
        ) : page ? (
          <>
            <Text accessibilityRole="header" aria-level={2} style={styles.sectionTitle}>
              {page.availableItems.toLocaleString("en")} families · page {page.page}
            </Text>
            <Text style={styles.resultStatus}>
              {scopes.find(([value]) => value === page.scope)?.[1]}
            </Text>
          </>
        ) : null}
      </View>
      {state.searchActive && activeFamilies.length > 0 ? (
        <FamilySearchResults
          families={activeFamilies}
          query={search!.submittedQuery}
          repository={repository}
          teaching={teaching}
          onOpenFamily={onOpenFamily}
        />
      ) : activeFamilies.length > 0 ? (
        useTable ? (
          <WebFamilyTable
            families={displayedFamilies}
            isAdded={isAdded}
            onAdd={addFamily}
            onOpen={openFamily}
            canAdd={teaching.ready}
          />
        ) : (
          displayedFamilies.map((family) => (
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
              onAdd={addFamily}
              onOpen={openFamily}
              canAdd={teaching.ready}
              selectedForm={selectedFormFor(family)}
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
