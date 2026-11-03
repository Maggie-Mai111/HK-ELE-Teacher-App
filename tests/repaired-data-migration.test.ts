import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { savedIdentityStillApplies } from "../src/services/identityMigration";
import { validateUpdateManifest, type DataUpdateManifest } from "../src/services/dataUpdate/updateContract";
import { aiEvidenceForms, type AiFormEvidence } from "../src/services/aiFormEvidence";
import release from "../src/config/aiFormEvidence.json";

const version = "2026-11-03-a2658-finite-family-closure-v1";
test("old same-spelled agency cannot retain age evidence after its registered move to agent", () => {
  assert.equal(savedIdentityStillApplies("age", ["agency"], "2026-10-20-a-main-v1", version), false);
  assert.equal(savedIdentityStillApplies("use", ["reusable"], "2026-10-20-a-main-v1", version), true);
  assert.equal(savedIdentityStillApplies("agent", ["agency"], version, version), true);
});
test("mixed saved forms require review as a whole instead of silently dropping the moved form", () => {
  assert.equal(savedIdentityStillApplies("age", ["age", "agency"], "2026-10-20-a-main-v1", version), false);
});
test("six screened identities remain in Full while ranked and unavailable populations stay distinct", () => {
  const manifest = JSON.parse(readFileSync("public/hkele-data/update-manifest.json", "utf8")) as DataUpdateManifest;
  assert.equal(validateUpdateManifest(manifest, "0.5.0").counts.teachingScopeExcluded, 176);
  assert.throws(() => validateUpdateManifest({...manifest, counts: {...manifest.counts, teachingScopeExcluded: 0}}, "0.5.0"), /relationships/);
});
test("the exact AI evidence has classical roots only and the repaired owner, without GPT fallback", () => {
  const document = JSON.parse(gunzipSync(readFileSync("public/assets/" + release.path)).toString()) as AiFormEvidence;
  assert.equal(aiEvidenceForms(document, "a").find((f) => f.normalized_form === "a")?.root, null);
  assert.equal(aiEvidenceForms(document, "age").find((f) => f.normalized_form === "age")?.root, null);
  assert.ok(aiEvidenceForms(document, "agent").some((f) => f.normalized_form === "agency" && String(f.root).includes("act")));
  assert.ok(!aiEvidenceForms(document, "age").some((f) => f.normalized_form === "agency"));
});
