import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import manifestJson from "../../data/current-manifest.json";
import type { FamilyRecord, HkeleRepository } from "../domain/hkele";
import type {
  TeachingListDocument,
  TeachingListItem,
  TeachingStatus,
} from "../domain/teachingList";
import { migratePackage72TeachingList } from "./teachingListMigration";

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
    external_level_reference_display: family.external_level_reference_display,
  };
}

function normalizeDocument(raw: string | null): TeachingListDocument {
  if (!raw) return EMPTY_DOCUMENT;
  const parsed = JSON.parse(raw) as Partial<TeachingListDocument>;
  if (!Array.isArray(parsed.items)) return EMPTY_DOCUMENT;
  const items = parsed.items
    .filter(
      (item): item is TeachingListItem =>
        typeof item?.basewordKey === "string" && typeof item?.displayFamily === "string",
    )
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
  return { schemaVersion: "1.1.0", items };
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

async function writeDocument(document: TeachingListDocument): Promise<void> {
  const raw = JSON.stringify(document);
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, raw);
  } else {
    await AsyncStorage.setItem(STORAGE_KEY, raw);
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
  const [items, setItems] = useState<TeachingListItem[]>([]);
  const [ready, setReady] = useState(false);
  const [undoState, setUndoState] = useState<{
    label: string;
    items: TeachingListItem[];
  } | null>(null);
  const [sessionSources, setSessionSources] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void readDocument().then(async (document) => {
      const refreshed = await refreshTeachingItems(document.items, repository);
      if (!active) return;
      setItems(refreshed);
      setReady(true);
      await writeDocument({ schemaVersion: "1.1.0", items: refreshed });
    });
    return () => {
      active = false;
    };
  }, [repository]);

  const commit = useCallback(
    (next: TeachingListItem[], undoLabel?: string) => {
      if (undoLabel) setUndoState({ label: undoLabel, items });
      const ordered = next.map((item, index) => ({ ...item, customOrder: index }));
      setItems(ordered);
      void writeDocument({ schemaVersion: "1.1.0", items: ordered });
    },
    [items],
  );

  const undo = useCallback(() => {
    if (!undoState) return;
    const restored = undoState.items.map((item, index) => ({ ...item, customOrder: index }));
    setItems(restored);
    setUndoState(null);
    void writeDocument({ schemaVersion: "1.1.0", items: restored });
  }, [undoState]);

  const add = useCallback(
    (family: FamilyRecord, selectedForm?: string, sessionSource?: string) => {
      const existing = items.find((item) => item.basewordKey === family.baseword_key);
      const chosen = selectedForm?.trim() || family.display_family;
      if (sessionSource) {
        setSessionSources((current) => ({
          ...current,
          [family.baseword_key]: sessionSource,
        }));
      }
      if (existing) {
        if (!existing.selectedForms.includes(chosen)) {
          commit(
            items.map((item) =>
              item.basewordKey === family.baseword_key
                ? {
                    ...item,
                    selectedForms: [...item.selectedForms, chosen],
                    updatedAt: new Date().toISOString(),
                  }
                : item,
            ),
          );
        }
        return;
      }
      commit([...items, createTeachingItem(family, items.length, chosen)]);
    },
    [commit, items],
  );

  const addMany = useCallback(
    (families: FamilyRecord[]) => {
      const existing = new Set(items.map((item) => item.basewordKey));
      const unique = families.filter(
        (family, index, values) =>
          values.findIndex((value) => value.baseword_key === family.baseword_key) === index,
      );
      const additions = unique
        .filter((family) => !existing.has(family.baseword_key))
        .map((family, index) => createTeachingItem(family, items.length + index));
      if (additions.length) commit([...items, ...additions], "Bulk addition to Teaching list");
      return {
        added: additions.length,
        existing: unique.length - additions.length,
        total: items.length + additions.length,
      };
    },
    [commit, items],
  );

  const remove = useCallback(
    (basewordKey: string) => {
      setSessionSources((current) => {
        const next = { ...current };
        delete next[basewordKey];
        return next;
      });
      commit(
        items.filter((item) => item.basewordKey !== basewordKey),
        "Removed family",
      );
    },
    [commit, items],
  );

  const removeSelectedForm = useCallback(
    (basewordKey: string, form: string) => {
      commit(
        items.flatMap((item) => {
          if (item.basewordKey !== basewordKey) return [item];
          const selectedForms = item.selectedForms.filter((value) => value !== form);
          return selectedForms.length
            ? [{ ...item, selectedForms, updatedAt: new Date().toISOString() }]
            : [];
        }),
        "Removed selected form",
      );
    },
    [commit, items],
  );

  const update = useCallback(
    (
      basewordKey: string,
      patch: Partial<Pick<TeachingListItem, "notes" | "connections" | "status">>,
    ) => {
      commit(
        items.map((item) =>
          item.basewordKey === basewordKey
            ? { ...item, ...patch, updatedAt: new Date().toISOString() }
            : item,
        ),
      );
    },
    [commit, items],
  );

  const move = useCallback(
    (basewordKey: string, direction: -1 | 1) => {
      const index = items.findIndex((item) => item.basewordKey === basewordKey);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= items.length) return;
      const next = [...items];
      const [item] = next.splice(index, 1);
      if (!item) return;
      next.splice(target, 0, item);
      commit(next);
    },
    [commit, items],
  );

  return useMemo(
    () => ({
      items,
      ready,
      add,
      addMany,
      remove,
      removeSelectedForm,
      update,
      move,
      undoState,
      undo,
      sourceFor: (basewordKey: string) => sessionSources[basewordKey] ?? null,
    }),
    [
      add,
      addMany,
      items,
      move,
      ready,
      remove,
      removeSelectedForm,
      sessionSources,
      undo,
      undoState,
      update,
    ],
  );
}

export type TeachingListStore = ReturnType<typeof useTeachingList>;

export const TEACHING_STATUSES: TeachingStatus[] = ["Notice", "Practise", "Master"];
