import cpbJson from "../../data/releases/2026-09-14-package67-v1/cpb/cpb-sight-words-100.json";
import type { CpbSightWord } from "../domain/contracts";

interface CpbDocument {
  listId: string;
  itemCount: number;
  items: CpbSightWord[];
}

const document = cpbJson as CpbDocument;

export function normalizeCpbSurface(surface: string): string {
  return surface
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[’‘ʼ＇]/g, "'");
}

export const CPB_ITEMS = document.items;
export const CPB_LIST_ID = document.listId;

const byMatchKey = new Map(CPB_ITEMS.map((item) => [item.matchKey, item]));

export function matchCpb100(surface: string): CpbSightWord | null {
  return byMatchKey.get(normalizeCpbSurface(surface)) ?? null;
}

if (CPB_ITEMS.length !== 100 || new Set(CPB_ITEMS.map((item) => item.rank)).size !== 100) {
  throw new Error("The registered CPB 100 data failed its runtime boundary check.");
}
