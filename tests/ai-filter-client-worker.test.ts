import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

import { AiFilterClientError, interpretAiFilter } from "../src/services/aiFilterClient.js";
import { handleRequest, type WorkerEnv } from "../worker/src/index.js";

const SESSION = "123e4567-e89b-42d3-a456-426614174000";
const SECURITY = { turnstileToken: "fresh-test-token", anonymousSessionId: SESSION };
const ready = {
  status: "ready",
  summary: "10 words first observed by P4",
  filters: { scope: "inclusive_reference", earliestObservedTo: "P4", limit: 10, sort: "overall" },
  clarifyingQuestion: null,
  warnings: [],
};

test("client sends a fresh security envelope, validates response and never sends authorization", async () => {
  let received: Record<string, unknown> | null = null;
  let receivedAuthorization = false;
  const result = await interpretAiFilter(
    { query: "Find ten words by P4", locale: "en-HK", surface: "browse" },
    SECURITY,
    {
      endpoint: "https://worker.example/api/ai/interpret-filter",
      fetchImpl: async (_input, init) => {
        receivedAuthorization = new Headers(init?.headers).has("authorization");
        received = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify(ready), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  );
  assert.equal(result.status, "ready");
  assert.equal(receivedAuthorization, false);
  assert.equal(received?.["turnstileToken"], SECURITY.turnstileToken);
  assert.equal(received?.["anonymousSessionId"], SESSION);
});

test("client fails closed for missing protection, offline, 429 and unknown response fields", async () => {
  await assert.rejects(
    interpretAiFilter(
      { query: "Find words", locale: "en-HK", surface: "browse" },
      { turnstileToken: "", anonymousSessionId: SESSION },
      { endpoint: "https://worker.example" },
    ),
    (error: unknown) => error instanceof AiFilterClientError && error.code === "NOT_CONFIGURED",
  );
  await assert.rejects(
    interpretAiFilter({ query: "Find words", locale: "en-HK", surface: "browse" }, SECURITY, {
      endpoint: "https://worker.example",
      fetchImpl: async () => {
        throw new Error("offline");
      },
    }),
    (error: unknown) => error instanceof AiFilterClientError && error.code === "OFFLINE",
  );
  await assert.rejects(
    interpretAiFilter({ query: "Find words", locale: "en-HK", surface: "browse" }, SECURITY, {
      endpoint: "https://worker.example",
      fetchImpl: async () => new Response("", { status: 429 }),
    }),
    (error: unknown) => error instanceof AiFilterClientError && error.code === "RATE_LIMITED",
  );
  await assert.rejects(
    interpretAiFilter({ query: "Find words", locale: "en-HK", surface: "browse" }, SECURITY, {
      endpoint: "https://worker.example",
      fetchImpl: async () =>
        new Response(JSON.stringify({ ...ready, invented: true }), { status: 200 }),
    }),
    (error: unknown) => error instanceof AiFilterClientError && error.code === "INVALID_RESPONSE",
  );
});

function limiter(success = true) {
  const keys: string[] = [];
  return {
    keys,
    binding: {
      limit: async ({ key }: { key: string }) => {
        keys.push(key);
        return { success };
      },
    },
  };
}

function env(options: { session?: boolean; global?: boolean } = {}): WorkerEnv {
  const session = limiter(options.session ?? true);
  const global = limiter(options.global ?? true);
  return {
    ENVIRONMENT: "local",
    ALLOWED_ORIGIN: "http://127.0.0.1:19078",
    TURNSTILE_SECRET_KEY: "mock-only",
    TURNSTILE_EXPECTED_HOSTNAME: "127.0.0.1",
    TURNSTILE_EXPECTED_ACTION: "ai_filter",
    TURNSTILE_SITEVERIFY_URL: "http://127.0.0.1:18782/turnstile/v0/siteverify",
    DEEPSEEK_API_KEY: "mock-only",
    DEEPSEEK_MODEL: "deepseek-flash",
    DEEPSEEK_API_URL: "http://127.0.0.1:18782/chat/completions",
    AI_SESSION_RATE_LIMITER: session.binding,
    AI_GLOBAL_RATE_LIMITER: global.binding,
  };
}

function workerRequest(
  patch: Record<string, unknown> = {},
  origin = "http://127.0.0.1:19078",
): Request {
  return new Request("http://127.0.0.1:18781/api/ai/interpret-filter", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      query: "Find 10 words by P4",
      locale: "en-HK",
      surface: "browse",
      ...SECURITY,
      ...patch,
    }),
  });
}

function upstream(options: {
  turnstile?: Record<string, unknown>;
  providerStatus?: number;
  providerContent?: string;
}) {
  let providerRequests = 0;
  const fetcher = async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.includes("siteverify")) {
      return new Response(
        JSON.stringify(
          options.turnstile ?? {
            success: true,
            hostname: "127.0.0.1",
            action: "ai_filter",
            "error-codes": [],
          },
        ),
        { status: 200 },
      );
    }
    providerRequests += 1;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: options.providerContent ?? JSON.stringify(ready) } }],
      }),
      { status: options.providerStatus ?? 200 },
    );
  };
  return { fetcher: fetcher as typeof fetch, providerRequests: () => providerRequests };
}

test("worker route, OPTIONS, POST and CORS are exact and production wildcard fails closed", async () => {
  const mock = upstream({});
  const options = await handleRequest(
    new Request("http://127.0.0.1:18781/api/ai/interpret-filter", {
      method: "OPTIONS",
      headers: { origin: "http://127.0.0.1:19078" },
    }),
    env(),
    mock.fetcher,
  );
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-origin"), "http://127.0.0.1:19078");
  assert.equal(
    (await handleRequest(workerRequest({}, "https://evil.example"), env(), mock.fetcher)).status,
    403,
  );
  const misconfigured = env();
  misconfigured.ALLOWED_ORIGIN = "*";
  assert.equal((await handleRequest(workerRequest(), misconfigured, mock.fetcher)).status, 503);
  assert.equal(mock.providerRequests(), 0);
});

test("Turnstile missing, invalid, expired/duplicate, wrong hostname and wrong action fail closed", async () => {
  const missing = await handleRequest(
    workerRequest({ turnstileToken: "" }),
    env(),
    upstream({}).fetcher,
  );
  assert.equal(missing.status, 400);
  for (const turnstile of [
    { success: false, "error-codes": ["invalid-input-response"] },
    { success: false, "error-codes": ["timeout-or-duplicate"] },
    { success: true, hostname: "evil.example", action: "ai_filter", "error-codes": [] },
    { success: true, hostname: "127.0.0.1", action: "wrong", "error-codes": [] },
  ]) {
    const mock = upstream({ turnstile });
    const response = await handleRequest(workerRequest(), env(), mock.fetcher);
    assert.equal(response.status, 403);
    assert.equal(mock.providerRequests(), 0);
    assert.doesNotMatch(await response.text(), /timeout-or-duplicate|evil\.example|wrong/);
  }
});

test("independent global and anonymous-session limits fail before provider use", async () => {
  const globallyLimited = upstream({});
  assert.equal(
    (await handleRequest(workerRequest(), env({ global: false }), globallyLimited.fetcher)).status,
    429,
  );
  assert.equal(globallyLimited.providerRequests(), 0);
  const sessionLimited = upstream({});
  assert.equal(
    (await handleRequest(workerRequest(), env({ session: false }), sessionLimited.fetcher)).status,
    429,
  );
  assert.equal(sessionLimited.providerRequests(), 0);
});

test("validated request sends only the short query with low-cost non-thinking JSON settings", async () => {
  let providerBody: Record<string, unknown> | null = null;
  const base = upstream({});
  const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!String(input).includes("siteverify")) {
      providerBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    }
    return base.fetcher(input, init);
  };
  const response = await handleRequest(workerRequest(), env(), fetcher as typeof fetch);
  assert.equal(response.status, 200);
  assert.equal(base.providerRequests(), 1);
  assert.equal(providerBody?.["model"], "deepseek-flash");
  assert.deepEqual(providerBody?.["thinking"], { type: "disabled" });
  assert.equal(providerBody?.["max_tokens"], 384);
  const bodyText = JSON.stringify(providerBody);
  assert.doesNotMatch(bodyText, /fresh-test-token|123e4567|baseword_key|Teaching List|notes/);
});

test("invalid provider JSON, unknown fields, 429, timeout and offline make one attempt and fail closed", async () => {
  for (const fixture of [
    { providerContent: "not-json", expected: 502 },
    { providerContent: JSON.stringify({ ...ready, unknown: true }), expected: 502 },
    { providerStatus: 429, expected: 429 },
  ]) {
    const mock = upstream(fixture);
    const response = await handleRequest(workerRequest(), env(), mock.fetcher);
    assert.equal(response.status, fixture.expected);
    assert.equal(mock.providerRequests(), 1);
  }
  for (const failure of [new Error("offline"), new DOMException("timeout", "AbortError")]) {
    let providerRequests = 0;
    const fetcher = async (input: RequestInfo | URL) => {
      if (String(input).includes("siteverify")) return upstream({}).fetcher(input);
      providerRequests += 1;
      throw failure;
    };
    const response = await handleRequest(workerRequest(), env(), fetcher as typeof fetch);
    assert.equal(response.status, 502);
    assert.equal(providerRequests, 1);
  }
});

test("staging exposes only a safe provider failure stage while production stays generic", async () => {
  const staging = env();
  staging.ENVIRONMENT = "staging";
  staging.ALLOWED_ORIGIN = "https://maggie-mai111.github.io";
  staging.TURNSTILE_EXPECTED_HOSTNAME = "maggie-mai111.github.io";
  delete staging.TURNSTILE_SITEVERIFY_URL;
  staging.DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
  const rejected = upstream({
    providerStatus: 401,
    turnstile: {
      success: true,
      hostname: "maggie-mai111.github.io",
      action: "ai_filter",
      "error-codes": [],
    },
  });
  const stagingResponse = await handleRequest(
    workerRequest({}, "https://maggie-mai111.github.io"),
    staging,
    rejected.fetcher,
  );
  assert.equal(stagingResponse.status, 502);
  const stagingBody = (await stagingResponse.json()) as {
    error: { diagnostic?: { stage?: string; upstreamStatus?: number | null } };
  };
  assert.deepEqual(stagingBody.error.diagnostic, {
    stage: "provider_http",
    upstreamStatus: 401,
  });

  const production = { ...staging, ENVIRONMENT: "production" as const };
  const productionResponse = await handleRequest(
    workerRequest({}, "https://maggie-mai111.github.io"),
    production,
    rejected.fetcher,
  );
  const productionBody = (await productionResponse.json()) as {
    error: { diagnostic?: unknown };
  };
  assert.equal(productionBody.error.diagnostic, undefined);
});

test("secret and privacy boundary contains only mock placeholders and no raw logging", () => {
  const ignore = readFileSync(".gitignore", "utf8");
  assert.match(ignore, /^\.dev\.vars$/m);
  assert.match(ignore, /^\.dev\.vars\.\*$/m);
  assert.match(ignore, /^\.env$/m);
  assert.match(ignore, /^\.env\.\*$/m);
  assert.match(ignore, /^!\.dev\.vars\.example$/m);
  assert.deepEqual(readFileSync("worker/.dev.vars.example", "utf8").trim().split(/\r?\n/), [
    "DEEPSEEK_API_KEY=local_mock_only",
    "TURNSTILE_SECRET_KEY=local_mock_only",
  ]);
  const clientFiles = [
    "App.tsx",
    "index.ts",
    ...readdirSync("src", { recursive: true })
      .map(String)
      .filter((file) => /\.(?:js|mjs|ts|tsx)$/.test(file))
      .map((file) => `src/${file.replaceAll("\\", "/")}`),
  ];
  for (const file of clientFiles) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /DEEPSEEK_API_KEY|TURNSTILE_SECRET_KEY|Bearer\s+[A-Za-z0-9._-]+/);
  }
  const workerSource = readFileSync("worker/src/index.ts", "utf8");
  assert.doesNotMatch(workerSource, /console\.|JSON\.stringify\(await upstream\.json/);
});
