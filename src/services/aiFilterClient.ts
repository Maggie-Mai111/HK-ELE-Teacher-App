import {
  validateAiFilterRequest,
  validateAiFilterGatewayRequest,
  validateAiFilterResult,
  type AiFilterRequest,
  type AiFilterGatewayRequest,
  type AiFilterResult,
} from "../domain/aiFilterSchema";
import { aiRuntimeConfiguration } from "../config/runtime";
import { interpretAiFilterFixture } from "./aiFilterFixture";
import { AI_OFFLINE_MESSAGE, isAiNetworkOnline } from "./aiConnectivity";

export type AiFilterClientErrorCode =
  "OFFLINE" | "NOT_CONFIGURED" | "RATE_LIMITED" | "SERVICE_UNAVAILABLE" | "INVALID_RESPONSE";

export class AiFilterClientError extends Error {
  constructor(
    readonly code: AiFilterClientErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiFilterClientError";
  }
}

interface ClientOptions {
  endpoint?: string | null;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  isOnline?: () => boolean;
  signal?: AbortSignal;
}

export async function interpretAiFilter(
  request: AiFilterRequest,
  security: Pick<AiFilterGatewayRequest, "turnstileToken" | "anonymousSessionId">,
  options: ClientOptions = {},
): Promise<AiFilterResult> {
  const checked = validateAiFilterRequest(request);
  if (aiRuntimeConfiguration.fixtureMode) return interpretAiFilterFixture(checked.query);
  const isOnline = options.isOnline ?? isAiNetworkOnline;
  if (!isOnline()) throw new AiFilterClientError("OFFLINE", AI_OFFLINE_MESSAGE);
  let gateway: AiFilterGatewayRequest;
  try {
    gateway = validateAiFilterGatewayRequest({ ...checked, ...security });
  } catch {
    throw new AiFilterClientError(
      "NOT_CONFIGURED",
      "Please complete the verification and try again.",
    );
  }
  const endpoint =
    options.endpoint === undefined ? aiRuntimeConfiguration.endpoint : options.endpoint;
  if (!endpoint)
    throw new AiFilterClientError(
      "NOT_CONFIGURED",
      "We couldn't start this search. Use the word filters below.",
    );
  const controller = new AbortController();
  const cancel = () => controller.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? aiRuntimeConfiguration.requestTimeoutMs,
  );
  try {
    const response = await (options.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(gateway),
      signal: controller.signal,
    });
    if (response.status === 429)
      throw new AiFilterClientError(
        "RATE_LIMITED",
        "Search is busy. Try again shortly or use the word filters below.",
      );
    if (!response.ok)
      throw new AiFilterClientError(
        "SERVICE_UNAVAILABLE",
        "We couldn't complete the search. Try again or use the word filters below.",
      );
    try {
      return validateAiFilterResult(await response.json());
    } catch {
      throw new AiFilterClientError(
        "INVALID_RESPONSE",
        "We couldn't understand that request. Try one of the examples.",
      );
    }
  } catch (error) {
    if (error instanceof AiFilterClientError) throw error;
    throw new AiFilterClientError(
      isOnline() ? "SERVICE_UNAVAILABLE" : "OFFLINE",
      isOnline() ? "We couldn't connect. Check your connection and try again." : AI_OFFLINE_MESSAGE,
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", cancel);
  }
}
