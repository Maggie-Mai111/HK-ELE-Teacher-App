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

const STORAGE_KEY = "hkele-teaching-list-v2";
const EMPTY_DOCUMENT: TeachingListDocument = { schemaVersion: "1.0.0", items: [] };

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
  if (parsed.schemaVersion !== "1.0.0" || !Array.isArray(parsed.items)) return EMPTY_DOCUMENT;
  const items = parsed.items
    .filter(
      (item): item is TeachingListItem =>
        typeof item?.basewordKey === "string" && typeof item?.displayFamily === "string",
    )
    .sort((left, right) => left.customOrder - right.customOrder)
    .map((item, index) => ({ ...item, customOrder: index }));
  return { schemaVersion: "1.0.0", items };
}

async function readDocument(): Promise<TeachingListDocument> {
  const raw =
    Platform.OS === "web" && typeof localStorage !== "undefined"
      ? localStorage.getItem(STORAGE_KEY)
      : await AsyncStorage.getItem(STORAGE_KEY);
  return normalizeDocument(raw);
}

async function writeDocument(document: TeachingListDocument): Promise<void> {
  const raw = JSON.stringify(document);
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, raw);
  } else {
    await AsyncStorage.setItem(STORAGE_KEY, raw);
  }
}

export function createTeachingItem(family: FamilyRecord, order: number): TeachingListItem {
  const now = new Date().toISOString();
  return {
    basewordKey: family.baseword_key,
    displayFamily: family.display_family,
    status: "Notice",
    notes: "",
    connections: "",
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

  useEffect(() => {
    let active = true;
    void readDocument().then(async (document) => {
      const refreshed = await refreshTeachingItems(document.items, repository);
      if (!active) return;
      setItems(refreshed);
      setReady(true);
      await writeDocument({ schemaVersion: "1.0.0", items: refreshed });
    });
    return () => {
      active = false;
    };
  }, [repository]);

  const commit = useCallback((next: TeachingListItem[]) => {
    const ordered = next.map((item, index) => ({ ...item, customOrder: index }));
    setItems(ordered);
    void writeDocument({ schemaVersion: "1.0.0", items: ordered });
  }, []);

  const add = useCallback(
    (family: FamilyRecord) => {
      if (items.some((item) => item.basewordKey === family.baseword_key)) return;
      commit([...items, createTeachingItem(family, items.length)]);
    },
    [commit, items],
  );

  const remove = useCallback(
    (basewordKey: string) => commit(items.filter((item) => item.basewordKey !== basewordKey)),
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
    () => ({ items, ready, add, remove, update, move }),
    [add, items, move, ready, remove, update],
  );
}

export type TeachingListStore = ReturnType<typeof useTeachingList>;

export const TEACHING_STATUSES: TeachingStatus[] = ["Notice", "Practise", "Master"];
