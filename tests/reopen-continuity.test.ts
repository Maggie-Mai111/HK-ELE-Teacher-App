import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  EMPTY_SESSION_WORK,
  reopenAction,
  sessionWorkDescription,
} from "../src/services/reopenSession.js";

async function navigation(
  status: number | "offline",
  installed = true,
  shell = true,
  invalidState = false,
) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const source = readFileSync("public/sw.js", "utf8")
    .replace("__PACKAGE85_CACHE_VERSION__", "fixture")
    .replace("__PACKAGE85_COMPACT_DATA_ASSETS__", "[]")
    .replace("__PACKAGE85_BUILD_ASSETS__", "[]");
  const writes: string[] = [];
  runInNewContext(source, {
    URL,
    Response,
    self: {
      location: { origin: "https://fixture.test" },
      addEventListener: (type: string, handler: (event: unknown) => void) => {
        handlers[type] = handler;
      },
    },
    fetch: async () => {
      if (status === "offline") throw new Error("unreachable");
      return new Response(status === 200 ? "online App" : "server error", { status });
    },
    caches: {
      open: async (name: string) => ({
        match: async () =>
          name === "hkele-offline-state-v1"
            ? invalidState
              ? new Response("broken state")
              : installed
                ? new Response(
                    JSON.stringify({ active: { cacheName: "hkele-offline-package-fixture" } }),
                  )
                : undefined
            : installed
              ? new Response("installed App")
              : undefined,
        put: async (_path: string, response: Response) => {
          writes.push(await response.text());
        },
      }),
      match: async () => (shell ? new Response("cached shell") : undefined),
    },
  });
  let response: Promise<Response> | undefined;
  handlers.fetch!({
    request: { method: "GET", url: "https://fixture.test/HK-ELE-Teacher-App/", mode: "navigate" },
    respondWith: (value: Promise<Response>) => {
      response = value;
    },
  });
  const result = await response!;
  return { status: result.status, body: await result.text(), writes };
}
test("temporary HTTP failures and network loss both open the installed App", async () => {
  for (const failure of [500, 502, 503, 504, 404, "offline"] as const) {
    const result = await navigation(failure);
    assert.equal(result.status, 200, String(failure));
    assert.equal(result.body, "installed App");
    assert.deepEqual(result.writes, []);
  }
});
test("HTTP error fallback uses the shell if no full download exists", async () => {
  const result = await navigation(503, false, true);
  assert.equal(result.status, 200);
  assert.equal(result.body, "cached shell");
  const damaged = await navigation(503, true, true, true);
  assert.equal(damaged.body, "cached shell");
});
test("a first visit without a local copy retains the original server response", async () => {
  const result = await navigation(503, false, false);
  assert.equal(result.status, 503);
  assert.equal(result.body, "server error");
});
test("a healthy connection continues to serve the online App", async () => {
  const result = await navigation(200);
  assert.equal(result.status, 200);
  assert.equal(result.body, "online App");
});
test("reopening requires confirmation for text, photo work and either knowledge answer", () => {
  assert.equal(reopenAction(EMPTY_SESSION_WORK, true, false), "reopen");
  for (const work of [
    { text: true, ocr: false, knowledge: false },
    { text: false, ocr: true, knowledge: false },
    { text: false, ocr: false, knowledge: true },
    { text: true, ocr: true, knowledge: true },
  ])
    assert.equal(reopenAction(work, true, false), "confirm");
  assert.equal(
    sessionWorkDescription({ text: false, ocr: true, knowledge: false }),
    "photo-recognition work",
  );
  assert.equal(
    sessionWorkDescription({ text: true, ocr: true, knowledge: true }),
    "current text, photo-recognition work and word-knowledge answers",
  );
});
test("pending or failed lesson saves and active downloads prevent reopening", () => {
  assert.equal(reopenAction(EMPTY_SESSION_WORK, false, false), "blocked");
  assert.equal(reopenAction({ text: true, ocr: true, knowledge: true }, false, false), "blocked");
  assert.equal(reopenAction(EMPTY_SESSION_WORK, true, true), "blocked");
});
