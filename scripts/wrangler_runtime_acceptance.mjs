import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const appOrigin = "http://127.0.0.1:19078";
const workerOrigin = "http://127.0.0.1:18781";
const route = `${workerOrigin}/api/ai/interpret-filter`;
let providerRequests = 0;
let tokenCounter = 0;

const ready = (query) => ({
  status: "ready",
  summary: query.slice(0, 90),
  filters: query.includes("root act")
    ? { scope: "inclusive_reference", root: "act", limit: 100, sort: "overall" }
    : query.includes("Top 1k")
      ? { scope: "inclusive_reference", hkBands: ["HK Top 1k"], limit: 10, sort: "hk" }
      : query.includes("not-registered")
        ? { scope: "candidate", root: "not-registered", limit: 10, sort: "overall" }
        : { scope: "candidate", earliestObservedTo: "P2", limit: 10, sort: "overall" },
  clarifyingQuestion: null,
  warnings: [],
});

function body(request) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

const mock = createServer(async (request, response) => {
  try {
    const value = await body(request);
    response.setHeader("content-type", "application/json");
    if (request.url === "/turnstile/v0/siteverify") {
      const token = String(value.response ?? "");
      const cases = {
        invalid: { success: false, "error-codes": ["invalid-input-response"] },
        expired: { success: false, "error-codes": ["timeout-or-duplicate"] },
        duplicate: { success: false, "error-codes": ["timeout-or-duplicate"] },
        "wrong-host": { success: true, hostname: "evil.example", action: "ai_filter" },
        "wrong-action": { success: true, hostname: "127.0.0.1", action: "wrong" },
      };
      response.end(
        JSON.stringify(
          cases[token] ?? { success: true, hostname: "127.0.0.1", action: "ai_filter" },
        ),
      );
      return;
    }
    if (request.url === "/chat/completions") {
      providerRequests += 1;
      const query = String(value.messages?.[1]?.content ?? "");
      if (query === "PROVIDER_429") {
        response.statusCode = 429;
        response.end(JSON.stringify({ error: "mock" }));
        return;
      }
      if (query === "PROVIDER_OFFLINE") {
        request.socket.destroy();
        return;
      }
      if (query === "PROVIDER_TIMEOUT") {
        setTimeout(() => response.end(JSON.stringify({ error: "late" })), 11_000);
        return;
      }
      const content =
        query === "INVALID_JSON"
          ? "{"
          : query === "UNKNOWN_FIELD"
            ? JSON.stringify({ ...ready(query), raw: true })
            : JSON.stringify(ready(query));
      response.end(JSON.stringify({ choices: [{ message: { content } }] }));
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not found" }));
  } catch {
    response.statusCode = 400;
    response.end(JSON.stringify({ error: "bad mock request" }));
  }
});

function listen(server, port) {
  return new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListen);
  });
}

function uuid(index) {
  return `123e4567-e89b-42d3-a456-${String(index).padStart(12, "0")}`;
}

function gateway(query, patch = {}) {
  tokenCounter += 1;
  return {
    query,
    locale: "en-HK",
    surface: "browse",
    turnstileToken: `valid-${tokenCounter}`,
    anonymousSessionId: uuid(tokenCounter),
    ...patch,
  };
}

async function post(payload, origin = appOrigin) {
  return fetch(route, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function waitForWorker(child) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Wrangler exited with ${child.exitCode}`);
    try {
      const response = await fetch(route, { method: "GET", headers: { origin: appOrigin } });
      if (response.status === 405) return;
    } catch {
      // Continue until the bounded startup deadline.
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error("Wrangler local runtime did not start in time");
}

await listen(mock, 18782);
const executable = process.execPath;
const wranglerEntry = resolve(process.cwd(), "node_modules/wrangler/bin/wrangler.js");
let wranglerOutput = "";

async function startWorker() {
  const stateDirectory = await mkdtemp(join(tmpdir(), "hkele-package82-wrangler-"));
  const child = spawn(
    executable,
    [
      wranglerEntry,
      "dev",
      "--local",
      "--port",
      "18781",
      "--config",
      "worker/wrangler.jsonc",
      "--persist-to",
      stateDirectory,
      "--var",
      "DEEPSEEK_API_KEY:local-mock-only",
      "--var",
      "TURNSTILE_SECRET_KEY:local-mock-only",
    ],
    {
      cwd: resolve(process.cwd()),
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => (wranglerOutput += chunk.toString()));
  child.stderr.on("data", (chunk) => (wranglerOutput += chunk.toString()));
  await waitForWorker(child);
  return { child, stateDirectory };
}

async function stopWorker(instance) {
  if (!instance) return;
  instance.child.kill();
  await new Promise((resolveExit) => {
    if (instance.child.exitCode !== null) {
      resolveExit();
      return;
    }
    instance.child.once("exit", resolveExit);
    setTimeout(resolveExit, 2_000);
  });
  await rm(instance.stateDirectory, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 100,
  });
}

let activeWorker;

try {
  activeWorker = await startWorker();
  const options = await fetch(route, { method: "OPTIONS", headers: { origin: appOrigin } });
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("access-control-allow-origin"), appOrigin);
  assert.equal((await post(gateway("grade"), "https://evil.example")).status, 403);
  assert.equal((await post(gateway("grade", { turnstileToken: "" }))).status, 400);
  for (const token of ["invalid", "expired", "duplicate", "wrong-host", "wrong-action"]) {
    assert.equal((await post(gateway("grade", { turnstileToken: token }))).status, 403, token);
  }

  await stopWorker(activeWorker);
  activeWorker = await startWorker();
  for (const query of ["grade", "Top 1k", "root act", "not-registered"]) {
    assert.equal((await post(gateway(query))).status, 200, query);
  }
  for (const [query, status] of [
    ["INVALID_JSON", 502],
    ["UNKNOWN_FIELD", 502],
    ["PROVIDER_429", 429],
    ["PROVIDER_OFFLINE", 502],
    ["PROVIDER_TIMEOUT", 502],
  ]) {
    assert.equal((await post(gateway(query))).status, status, query);
  }

  await stopWorker(activeWorker);
  activeWorker = await startWorker();
  const session = uuid(999999);
  for (let index = 0; index < 3; index += 1) {
    assert.equal(
      (await post(gateway("grade", { anonymousSessionId: session }))).status,
      200,
      `session request ${index + 1}`,
    );
  }
  assert.equal(
    (await post(gateway("grade", { anonymousSessionId: session }))).status,
    429,
    "session limit",
  );

  let globalLimited = false;
  for (let index = 0; index < 20; index += 1) {
    const response = await post(gateway("grade", { turnstileToken: "invalid" }));
    if (response.status === 429) {
      globalLimited = true;
      break;
    }
  }
  assert.equal(globalLimited, true, "local Wrangler global binding simulation must reject");
  assert.ok(providerRequests > 0);
  assert.doesNotMatch(wranglerOutput, /Authorization:|fresh-test-token|DEEPSEEK_API_KEY=/i);
  process.stdout.write(
    `${JSON.stringify({
      status: "PASS",
      wranglerVersion: "4.141.0",
      provider: "LOCAL_MOCK_ONLY",
      realDeepSeekRequests: 0,
      turnstile: "PASS_SUCCESS_AND_FAIL_CLOSED_CASES",
      sessionRateLimit: "PASS_LOCAL_SIMULATION",
      globalRateLimit: "PASS_LOCAL_SIMULATION",
      providerFailures: "PASS_NO_RETRY",
    })}\n`,
  );
} finally {
  await stopWorker(activeWorker);
  await new Promise((resolveClose) => mock.close(resolveClose));
}
