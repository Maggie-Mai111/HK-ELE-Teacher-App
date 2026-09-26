export type HkeleEnvironment = "local" | "staging" | "production";

const environmentValue = process.env.EXPO_PUBLIC_HKELE_ENVIRONMENT?.trim() ?? "";
const environment = (["local", "staging", "production"] as const).includes(
  environmentValue as HkeleEnvironment,
)
  ? (environmentValue as HkeleEnvironment)
  : null;
const endpoint = process.env.EXPO_PUBLIC_HKELE_AI_FILTER_URL?.trim() || null;
const turnstileSiteKey = process.env.EXPO_PUBLIC_HKELE_TURNSTILE_SITE_KEY?.trim() || null;
const fixtureMode =
  environment === "local" && process.env.EXPO_PUBLIC_HKELE_AI_FIXTURE_MODE === "true";

function validEndpoint(value: string | null, target: HkeleEnvironment | null): boolean {
  if (!value || !target) return false;
  try {
    const url = new URL(value);
    if (url.pathname !== "/api/ai/interpret-filter") return false;
    if (target === "local") {
      return url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
    }
    return url.protocol === "https:" && !["127.0.0.1", "localhost"].includes(url.hostname);
  } catch {
    return false;
  }
}

export const aiRuntimeConfiguration = Object.freeze({
  environment,
  endpoint: validEndpoint(endpoint, environment) ? endpoint : null,
  turnstileSiteKey: environment && turnstileSiteKey ? turnstileSiteKey : null,
  fixtureMode,
  turnstileAction: "ai_filter",
  requestTimeoutMs: 12_000,
  configured:
    fixtureMode ||
    (environment !== null && validEndpoint(endpoint, environment) && turnstileSiteKey !== null),
});
