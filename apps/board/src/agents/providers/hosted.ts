import { fetch } from "expo/fetch";

import type { Provider, ProviderRequest, QualityHint, StreamChunk } from "@/lib/types";

import { StreamError, decodeSse } from "./sse";

export { StreamError };

export type HostedProviderOptions = {
  osBaseUrl: string;
  token: string;
  hint: QualityHint;
};

/**
 * Streams completions from mstrmnd-os `/api/board/complete`.
 *
 * Uses `expo/fetch` rather than the global: React Native's fetch is built on
 * XMLHttpRequest and exposes no `response.body`, so token-by-token streaming is
 * only possible through the WinterCG implementation. On web it delegates to the
 * browser's fetch, which streams natively.
 *
 * The client never holds a vendor API key. Auth is a Board session JWT; the
 * concrete model is chosen on the server from a quality hint.
 */
export function createHostedProvider(options: HostedProviderOptions): Provider {
  return {
    kind: "hosted",
    async *stream(request: ProviderRequest): AsyncGenerator<StreamChunk> {
      const response = await fetch(completeUrl(options.osBaseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${options.token}`,
          "x-mstrmnd-client": "board",
        },
        body: JSON.stringify({
          system: request.system,
          messages: request.messages,
          maxTokens: request.maxTokens,
          hint: options.hint,
        }),
        signal: request.signal,
      });

      if (!response.ok) {
        throw new StreamError(await describeFailure(response), response.status);
      }
      if (!response.body) {
        throw new StreamError("The API returned an empty response body.");
      }

      yield* decodeSse(response.body);
    },
  };
}

export function completeUrl(osBaseUrl: string): string {
  return `${osBaseUrl.replace(/\/$/, "")}/api/board/complete`;
}

export function signInUrl(osBaseUrl: string): string {
  return `${osBaseUrl.replace(/\/$/, "")}/api/auth/signin`;
}

/** Turn an HTTP failure into something a user can act on. */
async function describeFailure(response: {
  status: number;
  json(): Promise<unknown>;
}): Promise<string> {
  let detail = "";
  try {
    const body = (await response.json()) as { error?: string };
    detail = typeof body.error === "string" ? body.error : "";
  } catch {
    // Non-JSON error body — the status alone will have to do.
  }

  switch (response.status) {
    case 401:
    case 403:
      return detail || "Session expired. Sign in again in Settings.";
    case 413:
      return detail || "That brief is too large. Shorten the question or context.";
    case 429:
      return detail || "Workspace Board budget for today is spent. Try again tomorrow.";
    default:
      return detail || `The API returned ${response.status}.`;
  }
}
