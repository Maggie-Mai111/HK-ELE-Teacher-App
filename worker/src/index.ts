import {
  AI_FILTER_MAX_QUERY_LENGTH,
  AI_FILTER_MAX_TURNSTILE_TOKEN_LENGTH,
  AI_FILTER_TURNSTILE_ACTION,
  type AiFilterRequest,
} from "../../src/domain/aiFilterSchema";
import { SYSTEM_PROMPT } from "./prompt";
import { validateAiFilterGatewayRequest, validateAiFilterResult } from "./validate";

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface WorkerEnv {
  ENVIRONMENT: "local" | "staging" | "production";
  ALLOWED_ORIGIN: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_EXPECTED_HOSTNAME: string;
  TURNSTILE_EXPECTED_ACTION: string;
  TURNSTILE_SITEVERIFY_URL?: string;
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_MODEL: string;
  DEEPSEEK_API_URL: string;
  AI_SESSION_RATE_LIMITER: RateLimitBinding;
  AI_GLOBAL_RATE_LIMITER: RateLimitBinding;
}

type Fetcher = typeof fetch;

const ROUTE = "/api/ai/interpret-filter";
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const DEEPSEEK = "https://api.deepseek.com/chat/completions";
const MAX_GATEWAY_BODY_LENGTH =
  AI_FILTER_MAX_QUERY_LENGTH * 4 + AI_FILTER_MAX_TURNSTILE_TOKEN_LENGTH + 1024;

function corsHeaders(origin: string): HeadersInit {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

function json(origin: string, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
    },
  });
}

function safeError(origin: string, status: number, code: string, message: string): Response {
  return json(origin, status, { error: { code, message } });
}

function isLoopback(url: URL): boolean {
  return url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname);
}

function validateConfiguration(env: WorkerEnv): URL | null {
  if (!["local", "staging", "production"].includes(env.ENVIRONMENT)) return null;
  if (!env.ALLOWED_ORIGIN || env.ALLOWED_ORIGIN === "*") return null;
  let allowed: URL;
  try {
    allowed = new URL(env.ALLOWED_ORIGIN);
  } catch {
    return null;
  }
  if (allowed.origin !== env.ALLOWED_ORIGIN || allowed.pathname !== "/") return null;
  if (env.ENVIRONMENT === "local" ? !isLoopback(allowed) : allowed.protocol !== "https:") {
    return null;
  }
  if (allowed.hostname !== env.TURNSTILE_EXPECTED_HOSTNAME) return null;
  if (env.TURNSTILE_EXPECTED_ACTION !== AI_FILTER_TURNSTILE_ACTION) return null;
  if (!env.TURNSTILE_SECRET_KEY || !env.DEEPSEEK_API_KEY) return null;
  if (env.DEEPSEEK_MODEL !== "deepseek-flash") return null;
  if (!env.AI_SESSION_RATE_LIMITER || !env.AI_GLOBAL_RATE_LIMITER) return null;
  const siteverify = env.TURNSTILE_SITEVERIFY_URL || SITEVERIFY;
  const provider = env.DEEPSEEK_API_URL || DEEPSEEK;
  try {
    const siteverifyUrl = new URL(siteverify);
    const providerUrl = new URL(provider);
    if (env.ENVIRONMENT === "local") {
      if (!isLoopback(siteverifyUrl) || !isLoopback(providerUrl)) return null;
    } else if (siteverify !== SITEVERIFY || provider !== DEEPSEEK) {
      return null;
    }
  } catch {
    return null;
  }
  return allowed;
}

function providerContent(value: unknown): string {
  if (typeof value !== "object" || value === null) throw new Error("invalid provider envelope");
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || typeof choices[0] !== "object" || choices[0] === null) {
    throw new Error("invalid provider choices");
  }
  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) throw new Error("invalid provider message");
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string" || !content.trim() || content.length > 8192) {
    throw new Error("invalid provider content");
  }
  return content;
}

async function validateTurnstile(
  token: string,
  env: WorkerEnv,
  fetcher: Fetcher,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetcher(env.TURNSTILE_SITEVERIFY_URL || SITEVERIFY, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const value = (await response.json()) as {
      success?: unknown;
      hostname?: unknown;
      action?: unknown;
    };
    return (
      value.success === true &&
      value.hostname === env.TURNSTILE_EXPECTED_HOSTNAME &&
      value.action === env.TURNSTILE_EXPECTED_ACTION
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function callDeepSeek(
  request: AiFilterRequest,
  env: WorkerEnv,
  fetcher: Fetcher,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const upstream = await fetcher(env.DEEPSEEK_API_URL || DEEPSEEK, {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-flash",
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        max_tokens: 384,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: request.query },
        ],
      }),
      signal: controller.signal,
    });
    if (!upstream.ok) {
      const error = new Error("provider unavailable") as Error & { status?: number };
      error.status = upstream.status;
      throw error;
    }
    return JSON.parse(providerContent(await upstream.json())) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

async function allowed(binding: RateLimitBinding, key: string): Promise<boolean> {
  try {
    return (await binding.limit({ key })).success;
  } catch {
    return false;
  }
}

export async function handleRequest(
  request: Request,
  env: WorkerEnv,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const configuredOrigin = validateConfiguration(env);
  if (!configuredOrigin) {
    return safeError("null", 503, "ENVIRONMENT_NOT_CONFIGURED", "AI search is not configured.");
  }
  const origin = request.headers.get("origin") ?? "";
  if (origin !== configuredOrigin.origin) {
    return safeError("null", 403, "ORIGIN_NOT_ALLOWED", "Origin is not allowed.");
  }
  const url = new URL(request.url);
  if (url.pathname !== ROUTE) return safeError(origin, 404, "NOT_FOUND", "Endpoint not found.");
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") return safeError(origin, 405, "METHOD_NOT_ALLOWED", "Use POST.");
  if (!request.headers.get("content-type")?.toLocaleLowerCase().startsWith("application/json")) {
    return safeError(origin, 415, "CONTENT_TYPE_REQUIRED", "Use application/json.");
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_GATEWAY_BODY_LENGTH) {
    return safeError(origin, 413, "REQUEST_TOO_LARGE", "Request is too large.");
  }
  if (!(await allowed(env.AI_GLOBAL_RATE_LIMITER, `${env.ENVIRONMENT}:global:${ROUTE}`))) {
    return safeError(origin, 429, "GLOBAL_RATE_LIMITED", "AI search is temporarily busy.");
  }
  let parsed: unknown;
  try {
    const body = await request.text();
    if (body.length > MAX_GATEWAY_BODY_LENGTH) {
      return safeError(origin, 413, "REQUEST_TOO_LARGE", "Request is too large.");
    }
    parsed = JSON.parse(body) as unknown;
  } catch {
    return safeError(origin, 400, "INVALID_JSON", "Request JSON is invalid.");
  }
  let checked: ReturnType<typeof validateAiFilterGatewayRequest>;
  try {
    checked = validateAiFilterGatewayRequest(parsed);
  } catch {
    return safeError(origin, 400, "INVALID_REQUEST", "Request fields are invalid.");
  }
  if (!(await validateTurnstile(checked.turnstileToken, env, fetcher))) {
    return safeError(origin, 403, "TURNSTILE_REJECTED", "Anti-abuse verification failed.");
  }
  if (
    !(await allowed(
      env.AI_SESSION_RATE_LIMITER,
      `${env.ENVIRONMENT}:session:${checked.anonymousSessionId}:${ROUTE}`,
    ))
  ) {
    return safeError(origin, 429, "SESSION_RATE_LIMITED", "Try again later.");
  }
  const providerRequest: AiFilterRequest = {
    query: checked.query,
    locale: checked.locale,
    surface: checked.surface,
  };
  try {
    const result = validateAiFilterResult(await callDeepSeek(providerRequest, env, fetcher));
    return json(origin, 200, result);
  } catch (error) {
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number((error as { status?: unknown }).status)
        : 0;
    if (status === 429) {
      return safeError(origin, 429, "PROVIDER_RATE_LIMITED", "AI search is temporarily busy.");
    }
    return safeError(
      origin,
      502,
      "PROVIDER_RESPONSE_REJECTED",
      "AI search returned no usable filter. Nothing was applied.",
    );
  }
}

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleRequest(request, env);
  },
};
