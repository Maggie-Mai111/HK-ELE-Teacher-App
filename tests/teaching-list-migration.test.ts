import assert from "node:assert/strict";
import test from "node:test";

import { migratePackage72TeachingList } from "../src/services/teachingListMigration.js";

test("Package72 localStorage migration preserves forms, order, status and notes", () => {
  const migrated = migratePackage72TeachingList(
    JSON.stringify([
      {
        baseword_key: "analyse",
        display_family: "analyse",
        selected_forms: ["analysis", "analyse"],
        order: 2,
        depth: "Practise",
        notes: "compare in class",
        connections: "analysis",
        set_membership: "Candidate",
        overall_frequency_order: 42,
        hk_corpus_frequency_rank: 31,
        hk_corpus_frequency_band: "HK Top 1k",
      },
      {
        baseword_key: "act",
        display_family: "act",
        selected_forms: ["action"],
        order: 1,
        depth: "Master",
        notes: "",
        connections: "",
      },
    ]),
    "2026-09-14-package67-v1",
    "2026-09-26T00:00:00.000Z",
  );
  assert.equal(migrated.schemaVersion, "1.1.0");
  assert.deepEqual(
    migrated.items.map((item) => item.basewordKey),
    ["act", "analyse"],
  );
  assert.deepEqual(migrated.items[1]?.selectedForms, ["analysis", "analyse"]);
  assert.equal(migrated.items[1]?.status, "Practise");
  assert.equal(migrated.items[1]?.notes, "compare in class");
});
