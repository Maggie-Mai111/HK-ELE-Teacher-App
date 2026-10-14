import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  consentChoice,
  mayCollectUsage,
  validConsentChoice,
} from "../src/services/privacyPreferences.js";

const fixture = JSON.parse(readFileSync("tests/fixtures/web-consent-choices.json", "utf8"));

test("App matches captured Web local consent semantics without starting collection", () => {
  const choice = consentChoice(true, fixture.now);
  assert.deepEqual(choice, fixture.choice);
  assert.equal(validConsentChoice(choice), true);
  assert.equal(mayCollectUsage(choice), false);
  assert.deepEqual(
    Object.keys(choice!).sort(),
    [
      "noticeVersion",
      "consentedAt",
      "feedbackConsent",
      "ratingConsent",
      "usageConsent",
      "collectionEnabled",
      "scope",
    ].sort(),
  );
});

test("App matches Web rejection of absent choices, old acknowledgements and incomplete scopes", () => {
  for (const item of fixture.cases) {
    assert.equal(validConsentChoice(item.record), item.valid, item.id);
    assert.equal(mayCollectUsage(item.record), false);
  }
  assert.equal(consentChoice(false, fixture.now), null);
  assert.equal(consentChoice(true, "invalid"), null);
});
