export type HkFrequencyBand = "top-1k" | "next-1k" | "later" | "unranked";

export interface HkFrequencyDisplay {
  band: HkFrequencyBand;
  label: string;
  symbol: string;
}

export function hkFrequencyDisplay(rank: number | null): HkFrequencyDisplay {
  if (rank === null) return { band: "unranked", label: "No current HK rank", symbol: "○" };
  if (rank <= 1000) return { band: "top-1k", label: "HK Top 1k", symbol: "●" };
  if (rank <= 2000) return { band: "next-1k", label: "HK Next 1k", symbol: "◆" };
  return { band: "later", label: "HK rank 2,001+", symbol: "▨" };
}

export function validHkRange(start: number, end: number): boolean {
  return Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start;
}

export function inHkRange(rank: number | null, start: number, end: number): boolean {
  return rank !== null && validHkRange(start, end) && rank >= start && rank <= end;
}
