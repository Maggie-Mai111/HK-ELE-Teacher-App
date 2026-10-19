import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";

import manifestJson from "../../data/current-manifest.json";
import type { FamilyRecord, HkeleRepository } from "../domain/hkele";
import type {
  TeachingListDocument,
  TeachingListItem,
  TeachingStatus,
} from "../domain/teachingList";
import { migratePackage72TeachingList } from "./teachingListMigration";
import { mergeLessonSelections, type LessonSelection } from "./lessonPlanning";
import { registeredExternalLevel } from "./externalLevelPresentation";
import {
  LESSON_LIBRARY_STORAGE_KEY,
  activeLesson,
  addSavedLesson,
  lessonLabel,
  mergeRefreshedLessonItems,
  migrateLessonLibrary,
  parseLessonLibrary,
  renameActiveLesson,
  replaceLessonItems,
  selectSavedLesson,
  type LessonLibrary,
} from "./lessonLibrary";

const STORAGE_KEY = "hkele-teaching-list-v2";
const LEGACY_WEB_STORAGE_KEY = "hkele-phase1v-teaching-list-v1";
const EMPTY_DOCUMENT: TeachingListDocument = { schemaVersion: "1.1.0", items: [] };

function derivedFields(family: FamilyRecord): TeachingListItem["derived"] {
  return {
    set_membership: family.set_membership,
    overall_frequency_order: family.overall_frequency_order,
    current_hk_frequency_rank: family.current_hk_frequency_rank,
    current_hk_frequency_band: family.current_hk_frequency_band,
    textbook_first_seen_level: family.textbook_first_seen_level,
    external_level_reference_display: registeredExternalLevel(
      family,
      "external_level_reference_display",
    ),
  };
}

function normalizeDocument(raw: string | null): TeachingListDocument {
  if (!raw) return EMPTY_DOCUMENT;
  const parsed = JSON.parse(raw) as Partial<TeachingListDocument>;
  if (!Array.isArray(parsed.items)) throw new Error("Invalid saved list.");
  const items = parsed.items
    .map((item) => {
      if (typeof item?.basewordKey !== "string" || typeof item?.displayFamily !== "string")
        throw new Error("Invalid saved word.");
      return item;
    })
    .sort((left, right) => left.customOrder - right.customOrder)
    .map((item, index) => ({
      ...item,
      selectedForms:
        Array.isArray(item.selectedForms) &&
        item.selectedForms.every((form) => typeof form === "string")
          ? [...new Set(item.selectedForms.map((form) => form.trim()).filter(Boolean))]
          : [item.displayFamily],
      customOrder: index,
    }));
  return {
    schemaVersion: "1.1.0",
    items,
    lessonTitle: typeof parsed.lessonTitle === "string" ? parsed.lessonTitle : "",
  };
}

export function normalizePackage72Document(raw: string | null): TeachingListDocument {
  return migratePackage72TeachingList(raw, manifestJson.dataVersion);
}

async function readDocument(): Promise<TeachingListDocument> {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    const current = localStorage.getItem(STORAGE_KEY);
    return current
      ? normalizeDocument(current)
      : normalizePackage72Document(localStorage.getItem(LEGACY_WEB_STORAGE_KEY));
  }
  return normalizeDocument(await AsyncStorage.getItem(STORAGE_KEY));
}

async function readLibrary(): Promise<LessonLibrary> {
  const raw =
    Platform.OS === "web" && typeof localStorage !== "undefined"
      ? localStorage.getItem(LESSON_LIBRARY_STORAGE_KEY)
      : await AsyncStorage.getItem(LESSON_LIBRARY_STORAGE_KEY);
  return raw !== null
    ? parseLessonLibrary(raw)
    : parseLessonLibrary(
        JSON.stringify(migrateLessonLibrary(await readDocument(), new Date().toISOString())),
      );
}

async function writeDocument(document: LessonLibrary): Promise<void> {
  const raw = JSON.stringify(document);
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.setItem(LESSON_LIBRARY_STORAGE_KEY, raw);
  } else {
    await AsyncStorage.setItem(LESSON_LIBRARY_STORAGE_KEY, raw);
  }
}

export function createTeachingItem(
  family: FamilyRecord,
  order: number,
  selectedForm?: string,
): TeachingListItem {
  const now = new Date().toISOString();
  return {
    basewordKey: family.baseword_key,
    displayFamily: family.display_family,
    status: "Notice",
    notes: "",
    connections: "",
    selectedForms: [selectedForm?.trim() || family.display_family],
    customOrder: order,
    addedAt: now,
    updatedAt: now,
    dataVersion: manifestJson.dataVersion,
    derived: derivedFields(family),
  };
}

export async function refreshTeachingItems(
  items: TeachingListItem[],
  repository: HkeleRepository,
): Promise<TeachingListItem[]> {
  return Promise.all(
    items.map(async (item) => {
      try {
        const { family } = await repository.getFamily(item.basewordKey);
        return {
          ...item,
          displayFamily: family.display_family,
          dataVersion: manifestJson.dataVersion,
          derived: derivedFields(family),
        };
      } catch {
        return item;
      }
    }),
  );
}

export function useTeachingList(repository: HkeleRepository) {
  const [library, setLibrary] = useState<LessonLibrary | null>(null);
  const libraryRef = useRef<LessonLibrary | null>(null);
  const itemsRef = useRef<TeachingListItem[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [sessionSources, setSessionSources] = useState<Record<string, string>>({});
  const [undoState, setUndoState] = useState<{
    lessonId: string;
    label: string;
    items: TeachingListItem[];
  } | null>(null);
  const writes = useRef(Promise.resolve());
  const pendingWrites = useRef(0);
  const mounted = useRef(true);
  const current = library ? activeLesson(library) : null;
  const items = current?.items ?? [];
  const lessonTitle = current?.title ?? "";
  const activeLessonId = library?.activeLessonId ?? "";

  const persist = useCallback((document: LessonLibrary) => {
    pendingWrites.current += 1;
    setSaving(true);
    writes.current = writes.current
      .catch(() => undefined)
      .then(() => writeDocument(document))
      .then(
        () => {
          if (mounted.current) setSaveError("");
        },
        () => {
          if (mounted.current)
            setSaveError(
              "We couldn't save your latest changes on this device. Export a copy before leaving.",
            );
        },
      )
      .then(() => {
        pendingWrites.current -= 1;
        if (mounted.current) setSaving(pendingWrites.current > 0);
      });
  }, []);

  const applyLibrary = useCallback(
    (next: LessonLibrary) => {
      libraryRef.current = next;
      itemsRef.current = activeLesson(next).items;
      setLibrary(next);
      persist(next);
    },
    [persist],
  );

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void readLibrary()
      .then((document) => {
        if (!active) return;
        applyLibrary(document);
        setReady(true);
      })
      .catch(() => {
        if (active)
          setSaveError(
            "We couldn't open your saved lessons. Please reload; your saved data has not been replaced.",
          );
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [applyLibrary]);

  useEffect(() => {
    if (!ready || !activeLessonId || !libraryRef.current) return;
    let active = true;
    const snapshot = activeLesson(libraryRef.current);
    void refreshTeachingItems(snapshot.items, repository).then((refreshed) => {
      const latest = libraryRef.current;
      if (!active || !latest || latest.activeLessonId !== snapshot.id) return;
      const currentItems = activeLesson(latest).items;
      const merged = mergeRefreshedLessonItems(currentItems, refreshed);
      if (JSON.stringify(merged) !== JSON.stringify(currentItems))
        applyLibrary(replaceLessonItems(latest, merged, new Date().toISOString()));
    });
    return () => {
      active = false;
    };
  }, [activeLessonId, ready, repository, applyLibrary]);

  const commit = useCallback(
    (next: TeachingListItem[], undoLabel?: string) => {
      const latest = libraryRef.current;
      if (!latest) return;
      if (undoLabel)
        setUndoState({
          lessonId: latest.activeLessonId,
          label: undoLabel,
          items: itemsRef.current,
        });
      const ordered = next.map((item, index) => ({ ...item, customOrder: index }));
      applyLibrary(replaceLessonItems(latest, ordered, new Date().toISOString()));
    },
    [applyLibrary],
  );

  const updateLessonTitle = useCallback(
    (value: string) => {
      const latest = libraryRef.current;
      if (latest) applyLibrary(renameActiveLesson(latest, value, new Date().toISOString()));
    },
    [applyLibrary],
  );

  const createLesson = useCallback(
    (title: string) => {
      const latest = libraryRef.current;
      if (!latest) return;
      let id: string;
      do {
        id = `lesson-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      } while (latest.lessons.some((lesson) => lesson.id === id));
      setUndoState(null);
      setSessionSources({});
      applyLibrary(addSavedLesson(latest, title, id, new Date().toISOString()));
    },
    [applyLibrary],
  );

  const switchLesson = useCallback(
    (id: string) => {
      const latest = libraryRef.current;
      if (
        !latest ||
        !latest.lessons.some((lesson) => lesson.id === id) ||
        latest.activeLessonId === id
      )
        return;
      setUndoState(null);
      setSessionSources({});
      applyLibrary(selectSavedLesson(latest, id));
    },
    [applyLibrary],
  );

  const retrySave = useCallback(() => {
    if (libraryRef.current) persist(libraryRef.current);
  }, [persist]);

  const undo = useCallback(() => {
    if (!undoState || undoState.lessonId !== libraryRef.current?.activeLessonId) return;
    commit(undoState.items);
    setUndoState(null);
  }, [commit, undoState]);

  const addSelections = useCallback(
    (selections: LessonSelection[]) => {
      const merged = mergeLessonSelections(itemsRef.current, selections, createTeachingItem);
      commit(merged.items, "Updated lesson words");
      return { added: merged.added, formsAdded: merged.formsAdded, total: merged.items.length };
    },
    [commit],
  );

  const add = useCallback(
    (family: FamilyRecord, selectedForm?: string, sourceLabel?: string) => {
      const fromKnowledgeCheck = sourceLabel === "Learner/teacher marked as Not known";
      if (fromKnowledgeCheck)
        setSessionSources((current) => ({ ...current, [family.baseword_key]: sourceLabel }));
      addSelections([
        {
          family,
          selectedForms: [selectedForm?.trim() || family.display_family],
          sourceLabel: fromKnowledgeCheck ? "Word knowledge check" : (sourceLabel ?? "Find words"),
        },
      ]);
    },
    [addSelections],
  );

  const addMany = useCallback(
    (families: FamilyRecord[]) => {
      const unique = [...new Map(families.map((family) => [family.baseword_key, family])).values()];
      const result = addSelections(
        unique.map((family) => ({
          family,
          selectedForms: [family.display_family],
          sourceLabel: "Find words",
        })),
      );
      return { ...result, existing: unique.length - result.added };
    },
    [addSelections],
  );

  const remove = useCallback(
    (basewordKey: string) => {
      commit(
        itemsRef.current.filter((item) => item.basewordKey !== basewordKey),
        "Removed word family",
      );
    },
    [commit],
  );

  const removeSelectedForm = useCallback(
    (basewordKey: string, form: string) => {
      commit(
        itemsRef.current.flatMap((item) => {
          if (item.basewordKey !== basewordKey) return [item];
          const selectedForms = item.selectedForms.filter((value) => value !== form);
          return selectedForms.length
            ? [{ ...item, selectedForms, updatedAt: new Date().toISOString() }]
            : [];
        }),
        "Removed selected word",
      );
    },
    [commit],
  );

  const update = useCallback(
    (
      basewordKey: string,
      patch: Partial<Pick<TeachingListItem, "notes" | "connections" | "status" | "teachingFocus">>,
    ) => {
      setUndoState(null);
      commit(
        itemsRef.current.map((item) =>
          item.basewordKey === basewordKey
            ? { ...item, ...patch, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
    },
    [commit],
  );

  const move = useCallback(
    (basewordKey: string, direction: -1 | 1) => {
      const next = [...itemsRef.current];
      const index = next.findIndex((item) => item.basewordKey === basewordKey);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return;
      const [item] = next.splice(index, 1);
      if (!item) return;
      next.splice(target, 0, item);
      commit(next);
    },
    [commit],
  );

  return useMemo(
    () => ({
      items,
      lessonTitle,
      activeLessonId,
      lessons: library?.lessons ?? [],
      lessonDisplayTitle:
        current && library ? lessonLabel(current, library.lessons.indexOf(current)) : "",
      createLesson,
      switchLesson,
      saving,
      retrySave,
      updateLessonTitle,
      ready,
      saveError,
      add,
      addMany,
      addSelections,
      remove,
      removeSelectedForm,
      update,
      move,
      undoState,
      undo,
      sessionSourceFor: (key: string) => sessionSources[key] ?? null,
      sourceFor: (key: string) =>
        items.find((item) => item.basewordKey === key)?.sourceLabels?.join(" · ") || null,
    }),
    [
      items,
      lessonTitle,
      activeLessonId,
      library,
      current,
      createLesson,
      switchLesson,
      saving,
      retrySave,
      updateLessonTitle,
      ready,
      saveError,
      sessionSources,
      add,
      addMany,
      addSelections,
      remove,
      removeSelectedForm,
      update,
      move,
      undoState,
      undo,
    ],
  );
}

export type TeachingListStore = ReturnType<typeof useTeachingList>;

// Kept for reading earlier saved lists; these are not learner attainment judgements.
export const TEACHING_STATUSES: TeachingStatus[] = ["Notice", "Practise", "Master"];
