// Restore the registered public PWA connection when no build override was supplied.
// An explicit environment always requires its own complete configuration.
export function resolvePublicAiBuildConfig(environment, profile) {
  const keys = [
    "EXPO_PUBLIC_HKELE_ENVIRONMENT",
    "EXPO_PUBLIC_HKELE_AI_FILTER_URL",
    "EXPO_PUBLIC_HKELE_TURNSTILE_SITE_KEY",
    "EXPO_PUBLIC_HKELE_AI_FIXTURE_MODE",
  ];
  const explicit = keys.some((key) => (environment[key] ?? "").trim() !== "");
  const resolved = { ...environment };
  if (!explicit) {
    if (
      profile.environment !== "staging" ||
      profile.endpoint !==
        "https://hkele-ai-filter-staging.hkele-teacher-webapp.workers.dev/api/ai/interpret-filter" ||
      !/^0x[A-Za-z0-9_-]+$/.test(profile.turnstileSiteKey)
    ) {
      throw new Error("Registered public App AI configuration is invalid.");
    }
    resolved.EXPO_PUBLIC_HKELE_ENVIRONMENT = profile.environment;
    resolved.EXPO_PUBLIC_HKELE_AI_FILTER_URL = profile.endpoint;
    resolved.EXPO_PUBLIC_HKELE_TURNSTILE_SITE_KEY = profile.turnstileSiteKey;
  }
  const target = resolved.EXPO_PUBLIC_HKELE_ENVIRONMENT?.trim();
  const fixture = resolved.EXPO_PUBLIC_HKELE_AI_FIXTURE_MODE === "true";
  if (fixture && target !== "local") {
    throw new Error("AI fixture mode is allowed only with the explicit local environment.");
  }
  if (fixture) return resolved;
  if (!new Set(["local", "staging", "production"]).has(target)) {
    throw new Error("Set a valid EXPO_PUBLIC_HKELE_ENVIRONMENT before building.");
  }
  const endpoint = resolved.EXPO_PUBLIC_HKELE_AI_FILTER_URL?.trim();
  const key = resolved.EXPO_PUBLIC_HKELE_TURNSTILE_SITE_KEY?.trim();
  if (!endpoint || !key) {
    throw new Error(
      `AI configuration for ${target} is incomplete. Supply its endpoint and public Turnstile site key.`,
    );
  }
  const url = new URL(endpoint);
  const loopback = ["127.0.0.1", "localhost"].includes(url.hostname);
  if (
    url.pathname !== "/api/ai/interpret-filter" ||
    (target === "local"
      ? url.protocol !== "http:" || !loopback
      : url.protocol !== "https:" || loopback)
  ) {
    throw new Error(`AI endpoint does not match the ${target} environment.`);
  }
  const known = {
    staging:
      "https://hkele-ai-filter-staging.hkele-teacher-webapp.workers.dev/api/ai/interpret-filter",
    production: "https://hkele-ai-filter.hkele-teacher-webapp.workers.dev/api/ai/interpret-filter",
  };
  if (known[target] && endpoint !== known[target]) {
    throw new Error(`AI endpoint differs from the registered ${target} Worker.`);
  }
  return resolved;
}
