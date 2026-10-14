import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildFeedbackUrl,
  registeredFeedbackWord,
  type FeedbackConfiguration,
} from "../src/services/feedbackService.js";
import {
  consentChoice,
  validConsentChoice,
  mayCollectUsage,
} from "../src/services/privacyPreferences.js";
import { localImageUri } from "../src/services/ocr/browserOcr.js";

const config: FeedbackConfiguration = {
  productVersion: "test-version",
  dataVersion: "Package67-20260914",
  report: {
    url: "https://docs.google.com/forms/d/e/test-form/viewform",
    fields: {
      product: "entry.1",
      page: "entry.2",
      word: "entry.3",
      family: "entry.4",
      familyKey: "entry.5",
      productVersion: "entry.6",
      dataVersion: "entry.7",
      text: "entry.8",
    },
  },
  rating: {
    url: "https://docs.google.com/forms/d/e/test-rating/viewform",
    fields: { word: "entry.3", family: "entry.4", familyKey: "entry.5" },
  },
};
const context = {
  product: "App/PWA" as const,
  page: "Word detail",
  word: "happily",
  family: "happy",
  familyKey: "happy",
  text: "private classroom text",
  email: "private@example.invalid",
  token: ["private", "session"].join("-"),
};

test("feedback prefills only approved context and never private text or identity", () => {
  const url = new URL(buildFeedbackUrl("report", context, config)!);
  assert.equal(url.searchParams.get("entry.3"), "happily");
  assert.equal(url.searchParams.get("entry.5"), "happy");
  assert.equal(url.searchParams.has("entry.8"), false);
  assert.equal(url.toString().includes("private"), false);
});
test("unconnected forms and non-Google, insecure and credentialed URLs fail closed", () => {
  for (const url of [
    "",
    "javascript:alert(1)",
    "https://docs.google.com.evil.invalid/forms/d/e/a/viewform",
    "http://docs.google.com/forms/d/e/a/viewform",
    "https://user@docs.google.com/forms/d/e/a/viewform",
    "https://docs.google.com/forms/d/e/a/edit",
  ]) {
    assert.equal(
      buildFeedbackUrl("report", context, { ...config, report: { ...config.report, url } }),
      null,
    );
  }
});
test("ratings require a specific word and family; registered form selection is exact", () => {
  assert.equal(buildFeedbackUrl("rating", { product: "App/PWA", page: "Browse" }, config), null);
  assert.equal(registeredFeedbackWord(" Happily ", ["happy", "happily"]), "happily");
  assert.equal(registeredFeedbackWord("happ", ["happy", "happily"]), null);
});
test("App matches the captured Web feedback contract fixtures", () => {
  const fixture = JSON.parse(readFileSync("tests/fixtures/web-feedback-urls.json", "utf8"));
  for (const kind of ["report", "rating"] as const)
    assert.equal(buildFeedbackUrl(kind, context, config), fixture[kind]);
});

test("one reference carries word identity and versions without private material", () => {
  const referenceConfig: FeedbackConfiguration = {
    ...config,
    rating: { ...config.rating, requiredContext: "reference", fields: { reference: "entry.42" } },
  };
  const url = new URL(buildFeedbackUrl("rating", context, referenceConfig)!);
  const fixture = JSON.parse(readFileSync("tests/fixtures/web-feedback-urls.json", "utf8"));
  assert.equal(url.toString(), fixture.reference);
  assert.equal(
    buildFeedbackUrl("rating", context, {
      ...referenceConfig,
      rating: { ...referenceConfig.rating, fields: {} },
    }),
    fixture.pendingReference,
  );
  const reference = url.searchParams.get("entry.42")!;
  assert.match(reference, /Word: happily/);
  assert.match(reference, /Family key: happy/);
  assert.match(reference, /Data version: Package67-20260914/);
  assert.match(reference, /Product version: test-version/);
  assert.equal(reference.includes("private"), false);
  assert.equal([...url.searchParams.keys()].filter((key) => key.startsWith("entry.")).length, 1);
  for (const entry of ["", "entry.pending", "field.42"])
    assert.equal(
      buildFeedbackUrl("rating", context, {
        ...referenceConfig,
        rating: { ...referenceConfig.rating, fields: { reference: entry } },
      }),
      null,
    );
});
test("explicit agreement is required and never starts collection in this trial", () => {
  const now = "2026-10-12T02:00:00+08:00";
  assert.equal(consentChoice(false, now), null);
  assert.equal(consentChoice(true, "bad-date"), null);
  const choice = consentChoice(true, now)!;
  assert.equal(validConsentChoice(choice), true);
  assert.equal(choice.usageConsent, true);
  assert.equal(choice.collectionEnabled, false);
  assert.equal(mayCollectUsage(choice), false);
  assert.equal(mayCollectUsage({ ...choice, collectionEnabled: true }), false);
  for (const mutation of [
    { noticeVersion: "old" },
    { consentedAt: "bad-date" },
    { usageConsent: false },
    { feedbackConsent: false },
    { ratingConsent: false },
    { collectionEnabled: true },
    { scope: "research" },
  ])
    assert.equal(validConsentChoice({ ...choice, ...mutation }), false);
  assert.equal(
    validConsentChoice({
      noticeVersion: "local-preview-20261012-v1",
      acknowledgedAt: now,
      usageConsent: false,
    }),
    false,
  );
});

test("browser OCR accepts only local image sources", () => {
  assert.equal(localImageUri("blob:http://localhost/photo"), true);
  assert.equal(localImageUri("data:image/png;base64,abc"), true);
  for (const uri of [
    "https://example.invalid/photo.png",
    "data:text/plain,secret",
    "javascript:alert(1)",
    "",
  ])
    assert.equal(localImageUri(uri), false);
});
