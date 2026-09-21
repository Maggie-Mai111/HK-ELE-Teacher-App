import registryJson from "../../data/releases/2026-09-14-package67-v1/identity/grammatical-relations.json";
import type { RegisteredGrammaticalRelation } from "../domain/contracts";

interface RegistryPayload {
  relationCount: number;
  relations: RegisteredGrammaticalRelation[];
}

const payload = registryJson as RegistryPayload;
const normalizeApostrophes = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[’‘ʼ＇]/g, "'");
const relations = new Map(
  payload.relations.map((relation) => [relation.normalizedSurface, Object.freeze(relation)]),
);

if (relations.size !== payload.relationCount || relations.size !== 60) {
  throw new Error("The registered grammatical-relation data is incomplete.");
}

export function registeredGrammaticalRelation(
  surface: string,
): RegisteredGrammaticalRelation | null {
  return relations.get(normalizeApostrophes(surface)) ?? null;
}

export function grammaticalRelationDisplay(relation: RegisteredGrammaticalRelation): string {
  return relation.alternatives
    .map((alternative) =>
      alternative.components.map((component) => component.displayFamily).join(" + "),
    )
    .join(" / ");
}

export const REGISTERED_GRAMMATICAL_RELATION_COUNT = relations.size;
