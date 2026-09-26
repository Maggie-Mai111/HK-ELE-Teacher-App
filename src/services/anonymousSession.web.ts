const STORAGE_KEY = "hkele-ai-anonymous-session-v1";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function getAnonymousSessionId(): string | null {
  if (typeof window === "undefined" || !window.crypto?.randomUUID) return null;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)?.toLocaleLowerCase() ?? "";
    if (UUID_V4.test(existing)) return existing;
    const created = window.crypto.randomUUID().toLocaleLowerCase();
    window.localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    return null;
  }
}
