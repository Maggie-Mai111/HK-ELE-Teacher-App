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
}

export async function interpretAiFilter(
  request: AiFilterRequest,
  security: Pick<AiFilterGatewayRequest, "turnstileToken" | "anonymousSessionId">,
  options: ClientOptions = {},
): Promise<AiFilterResult> {
  const checked = validateAiFilterRequest(request);
  if (aiRuntimeConfiguration.fixtureMode) return interpretAiFilterFixture(checked.query);
  let gateway: AiFilterGatewayRequest;
  try {
    gateway = validateAiFilterGatewayRequest({ ...checked, ...security });
  } catch {
    throw new AiFilterClientError(
      "NOT_CONFIGURED",
      "AI anti-abuse protection is not ready. Manual filters remain available.",
    );
  }
  const endpoint =
    options.endpoint === undefined ? aiRuntimeConfiguration.endpoint : options.endpoint;
  if (!endpoint)
    throw new AiFilterClientError(
      "NOT_CONFIGURED",
      "AI search is not configured. Manual filters remain available.",
    );
  const controller = new AbortController();
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
        "AI search is busy. Try manual filters or retry later.",
      );
    if (!response.ok)
      throw new AiFilterClientError(
        "SERVICE_UNAVAILABLE",
        "AI search is unavailable. Manual filters remain available.",
      );
    try {
      return validateAiFilterResult(await response.json());
    } catch {
      throw new AiFilterClientError(
        "INVALID_RESPONSE",
        "AI returned an invalid filter. Nothing was applied.",
      );
    }
  } catch (error) {
    if (error instanceof AiFilterClientError) throw error;
    throw new AiFilterClientError(
      "OFFLINE",
      "AI search could not connect. Manual filters remain available.",
    );
  } finally {
    clearTimeout(timer);
  }
}
