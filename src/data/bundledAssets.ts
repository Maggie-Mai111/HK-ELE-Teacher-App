/* eslint-disable @typescript-eslint/no-require-imports */

export const BUNDLED_DATA_ASSETS = Object.freeze({
  families: require("../../data/releases/2026-11-17-current-rules-final-v2/reference/families.json.gz"),
  forms: require("../../data/releases/2026-11-17-current-rules-final-v2/reference/forms.json.gz"),
  searchRoutes: require("../../data/releases/2026-11-17-current-rules-final-v2/reference/search-routes.json.gz"),
  cpb: require("../../data/releases/2026-11-17-current-rules-final-v2/cpb/cpb-sight-words-100.json"),
  identityContract: require("../../data/releases/2026-11-17-current-rules-final-v2/identity/identity-contract.json"),
  grammaticalRelations: require("../../data/releases/2026-11-17-current-rules-final-v2/identity/grammatical-relations.json"),
});

export const BUNDLED_DATA_FILE_COUNT = Object.keys(BUNDLED_DATA_ASSETS).length;
