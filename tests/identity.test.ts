import assert from "node:assert/strict";
import test from "node:test";

import { TestDataSource } from "../src/data/DataSource";
import type { DataManifest, IdentityLookupRecord } from "../src/domain/contracts";
import { IdentityService } from "../src/services/identityService";

const manifest: DataManifest = {
  schemaVersion: "1.0.0",
  dataVersion: "test",
  minimumAppVersion: "0.1.0",
  releaseDate: "2026-09-21",
  sourcePackages: [],
  counts: {
    totalFamilies: 163784,
    forms: 319924,
    ranked: 163570,
    unranked: 214,
    candidate: 3185,
    inclusiveReference: 3430,
    referenceOnly: 245,
  },
  files: [],
  compatibilityRules: {
    compatibleSchemaMajor: 1,
    incompatibleSchemaAction: "REFUSE_LOAD",
    stableFamilyKey: "baseword_key",
    stableFormKey: "form_key",
    generalUnavailableMeaning: "SOURCE_COMPONENT_UNAVAILABLE_NOT_ZERO",
    ordinaryDataUpdateChanges: "dataVersion",
    incompatibleStructureUpdateChanges: "schemaVersion",
  },
};

const routes = new Map<string, IdentityLookupRecord>([
  [
    "drives",
    {
      normalizedQuery: "drives",
      owners: [
        {
          basewordKey: "drive",
          displayFamily: "drive",
          displayBlocked: false,
          matchPriority: 1,
          matchClasses: ["EXACT_CURRENT_BAWF_FORM"],
          matchedForms: ["drives"],
        },
        {
          basewordKey: "drives",
          displayFamily: "drives",
          displayBlocked: false,
          matchPriority: 2,
          matchClasses: ["EXACT_CURRENT_BAWF_FAMILY"],
          matchedForms: [],
        },
      ],
    },
  ],
  [
    "degraded",
    {
      normalizedQuery: "degraded",
      owners: [
        {
          basewordKey: "degrade",
          displayFamily: "degrade",
          displayBlocked: false,
          matchPriority: 1,
          matchClasses: ["EXACT_CURRENT_BAWF_FORM"],
          matchedForms: ["degraded"],
        },
        {
          basewordKey: "degraded",
          displayFamily: "degraded",
          displayBlocked: false,
          matchPriority: 1,
          matchClasses: ["EXACT_CURRENT_BAWF_FORM"],
          matchedForms: ["degraded"],
        },
      ],
    },
  ],
  [
    "blockedfixture",
    {
      normalizedQuery: "blockedfixture",
      owners: [
        {
          basewordKey: "blocked:key",
          displayFamily: "blocked",
          displayBlocked: true,
          matchPriority: 1,
          matchClasses: ["BLOCKED_IDENTITY"],
          matchedForms: ["blockedfixture"],
        },
      ],
    },
  ],
]);

const service = new IdentityService(new TestDataSource(manifest, routes));

test("drives resolves to ranked Candidate family drive before the independent drives family", async () => {
  const result = await service.search("drives");
  assert.equal(result.status, "RESOLVED");
  assert.equal(result.owners[0]?.basewordKey, "drive");
  assert.equal(result.alternatives[0]?.basewordKey, "drives");
});

test("I and us resolve to registered pronoun identities while uppercase US is blocked", async () => {
  assert.equal((await service.search("I")).owners[0]?.basewordKey, "trial:pronoun:i");
  assert.equal((await service.search("us")).owners[0]?.basewordKey, "trial:pronoun:us");
  assert.equal((await service.search("US")).status, "BLOCKED");
  assert.equal(
    (await service.search("US")).identityException?.currentClassification,
    "COUNTRY_ABBREVIATION_OR_OTHER_CONTEXT_REQUIRED",
  );
});

test("does remains context-blocked while registered grammatical relations are explained", async () => {
  assert.equal((await service.search("does")).status, "BLOCKED");
  for (const query of ["I'm", "I’m", "don't", "I'll", "I’ll", "won't", "that's", "I'd"]) {
    const result = await service.search(query);
    assert.equal(result.status, "REGISTERED_GRAMMATICAL_RELATION", query);
    assert.equal(result.bestOwnerCount, 0, query);
    assert.equal(result.owners.length, 0, query);
    assert.equal(result.grammaticalRelation?.rankedFamilyAssignment, false, query);
  }
  assert.deepEqual(
    (await service.search("I’m")).grammaticalRelation?.alternatives[0]?.components.map(
      (item) => item.displayFamily,
    ),
    ["I", "be"],
  );
  assert.deepEqual(
    (await service.search("don't")).grammaticalRelation?.alternatives[0]?.components.map(
      (item) => item.displayFamily,
    ),
    ["do", "not"],
  );
});

test("equal-best owners remain ambiguous", async () => {
  const result = await service.search("degraded");
  assert.equal(result.status, "AMBIGUOUS");
  assert.equal(result.bestOwnerCount, 2);
});

test("display-blocked owners remain blocked and unknown words remain unmatched", async () => {
  assert.equal((await service.search("blockedfixture")).status, "BLOCKED");
  assert.equal((await service.search("zzzznotaword")).status, "UNMATCHED");
});
