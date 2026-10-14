export const PRIVACY_NOTICE_VERSION = "teacher-preview-consent-20261012-v2";
export const PRIVACY_STORAGE_KEY = "hkele.local-preview.privacy.v1";
export interface PrivacyPreferences {
  noticeVersion: string;
  consentedAt: string;
  feedbackConsent: true;
  ratingConsent: true;
  usageConsent: true;
  collectionEnabled: false;
  scope: "local-preview-choice";
}
// This local choice is not a server-side research participation record.
export function consentChoice(agreed: boolean, now: string): PrivacyPreferences | null {
  if (!agreed || !Number.isFinite(Date.parse(now))) return null;
  return {
    noticeVersion: PRIVACY_NOTICE_VERSION,
    consentedAt: now,
    feedbackConsent: true,
    ratingConsent: true,
    usageConsent: true,
    collectionEnabled: false,
    scope: "local-preview-choice",
  };
}
export function validConsentChoice(value: unknown): value is PrivacyPreferences {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PrivacyPreferences>;
  return (
    record.noticeVersion === PRIVACY_NOTICE_VERSION &&
    typeof record.consentedAt === "string" &&
    Number.isFinite(Date.parse(record.consentedAt)) &&
    record.feedbackConsent === true &&
    record.ratingConsent === true &&
    record.usageConsent === true &&
    record.collectionEnabled === false &&
    record.scope === "local-preview-choice"
  );
}
export function mayCollectUsage(_choice: unknown): boolean {
  // Collection needs its own approved notice, service and acceptance in a later task.
  void _choice;
  return false;
}
