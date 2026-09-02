import { fetch } from "expo/fetch";

import type { Provider, ProviderRequest, StreamChunk } from "@/lib/types";

import { AnthropicError, decodeSse } from "./sse";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

export { AnthropicError };

/**
 * Streams from the Messages API over SSE.
 *
 * Uses `expo/fetch` rather than the global: React Native's fetch is built on
 * XMLHttpRequest and exposes no `response.body`, so token-by-token streaming is
 * only possible through the WinterCG implementation. On web it delegates to the
 * browser's fetch, which streams natively.
 *
 * The key is read from device storage and the call goes straight to Anthropic —
 * fine for a personal board, but it does mean the key lives on the device. See
 * README "Bringing your own key" before shipping this to other people.
 */
export function createAnthropicProvider(apiKey: string, model: string): Provider {
  return {
    kind: "hosted",
    async *stream(request: ProviderRequest): AsyncGenerator<StreamChunk> {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": API_VERSION,
          // Required for the request to be accepted from a browser origin (web build).
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens,
          stream: true,
          system: request.system,
          messages: request.messages,
        }),
        signal: request.signal,
      });

      if (!response.ok) {
        throw new AnthropicError(await describeFailure(response), response.status);
      }
      if (!response.body) {
        throw new AnthropicError("The API returned an empty response body.");
      }

      yield* decodeSse(response.body);
      yield { type: "done" };
    },
  };
}

/** Turn an HTTP failure into something a user can act on. */
async function describeFailure(response: {
  status: number;
  json(): Promise<unknown>;
}): Promise<string> {
  let detail = "";
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? "";
  } catch {
    // Non-JSON error body — the status alone will have to do.
  }

  switch (response.status) {
    case 401:
    case 403:
      return "That API key was rejected. Check it in Settings.";
    case 404:
      return "That model isn't available to your account. Pick another in Settings.";
    case 429:
      return "Rate limited by the API. Wait a moment and run the board again.";
    case 529:
      return "The API is overloaded right now. Try again shortly.";
    default:
      return detail || `The API returned ${response.status}.`;
  }
}
