import { apiUrl, isBackendConfigured } from "./config";

/**
 * Client for the MSTRMND OS agent runtime.
 *
 * Speaks the eve HTTP protocol over plain fetch — create a session, stream it
 * as newline-delimited JSON, send follow-ups by session id. That protocol is
 * the same on every host, so this file contains no hosting assumptions: swap
 * the backend from Vercel to a container and only `EXPO_PUBLIC_MSTRMND_API_URL`
 * changes.
 *
 *   POST /eve/v1/session               → { sessionId }
 *   POST /eve/v1/session/:id           → follow-up message
 *   GET  /eve/v1/session/:id/stream    → NDJSON event stream
 *   POST /eve/v1/session/:id/cancel    → cancel the in-flight turn
 */

/** An eve stream event, narrowed to the fields this client acts on. */
export interface AgentEvent {
  type: string;
  data?: {
    /** Cumulative assistant text on `message.appended` / `message.completed`. */
    text?: string;
    message?: string;
    delta?: string;
    code?: string;
    [key: string]: unknown;
  };
  meta?: { id?: string; at?: string };
}

export interface StreamHandlers {
  /** Cumulative assistant text so far. Called on every text event. */
  onText?: (text: string) => void;
  /** The turn settled; `text` is the final assistant message. */
  onDone?: (text: string) => void;
  /** The turn or session failed. */
  onError?: (error: Error) => void;
}

export class AgentClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "AgentClientError";
  }
}

/**
 * Streaming-capable fetch. Expo's fetch supports incremental response bodies on
 * native; the global one does not. Falling back keeps the client working (the
 * reply lands in one piece) rather than failing on a runtime without it.
 */
type FetchLike = typeof globalThis.fetch;

function streamingFetch(): FetchLike {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const expoFetch = require("expo/fetch")?.fetch as FetchLike | undefined;
    if (expoFetch) return expoFetch;
  } catch {
    // expo/fetch unavailable on this runtime — use the global implementation.
  }
  return globalThis.fetch;
}

async function postJson<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await globalThis.fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
    signal,
  });
  if (!response.ok) {
    throw new AgentClientError(
      `${path} failed with ${response.status}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

/** Start a durable session with its first message. Returns the session id. */
export async function createSession(
  message: string,
  signal?: AbortSignal,
): Promise<string> {
  const result = await postJson<{ sessionId: string }>(
    "/eve/v1/session",
    { message },
    signal,
  );
  return result.sessionId;
}

/** Send a follow-up message to an existing session. */
export async function sendMessage(
  sessionId: string,
  message: string,
  signal?: AbortSignal,
): Promise<void> {
  await postJson(`/eve/v1/session/${sessionId}`, { message }, signal);
}

/** Request cancellation of the session's in-flight turn. */
export async function cancelTurn(sessionId: string): Promise<void> {
  await postJson(`/eve/v1/session/${sessionId}/cancel`, {});
}

/** Pull the text carried by a stream event, whichever field it arrived in. */
function textOf(event: AgentEvent): string | undefined {
  const data = event.data;
  if (!data) return undefined;
  if (typeof data.text === "string") return data.text;
  if (typeof data.message === "string") return data.message;
  return undefined;
}

/**
 * Stream a session's events until the turn settles.
 *
 * Resolves with the final assistant text. Aborting the signal ends the read;
 * cancelling the turn itself is a separate `cancelTurn` call.
 */
export async function streamSession(
  sessionId: string,
  handlers: StreamHandlers = {},
  signal?: AbortSignal,
): Promise<string> {
  const response = await streamingFetch()(
    apiUrl(`/eve/v1/session/${sessionId}/stream`),
    // Cookies come from the platform cookie store; `credentials` is omitted
    // because the streaming implementation does not accept every init option.
    { headers: { Accept: "application/x-ndjson" }, signal },
  );

  if (!response.ok) {
    const error = new AgentClientError(
      `stream failed with ${response.status}`,
      response.status,
    );
    handlers.onError?.(error);
    throw error;
  }

  let text = "";
  let settled = false;

  const handleLine = (line: string): void => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return;

    let event: AgentEvent;
    try {
      event = JSON.parse(trimmed) as AgentEvent;
    } catch {
      return; // a partial or malformed line is not worth failing the turn over
    }

    switch (event.type) {
      case "message.appended":
      case "message.completed": {
        const next = textOf(event);
        if (next !== undefined) {
          text = next;
          handlers.onText?.(text);
        }
        break;
      }
      case "turn.completed":
      case "session.waiting":
      case "turn.cancelled":
        settled = true;
        break;
      case "turn.failed":
      case "session.failed":
      case "step.failed": {
        settled = true;
        handlers.onError?.(
          new AgentClientError(
            textOf(event) ?? `agent reported ${event.type}`,
          ),
        );
        break;
      }
    }
  };

  const body = response.body;
  if (body) {
    // Incremental path: decode NDJSON as it arrives.
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (!settled) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) handleLine(line);
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    if (buffer.length > 0) handleLine(buffer);
  } else {
    // Non-streaming runtime: the body arrives once the turn has settled.
    for (const line of (await response.text()).split("\n")) handleLine(line);
  }

  handlers.onDone?.(text);
  return text;
}

/**
 * One-shot convenience: start a session (or continue one) and stream the reply.
 * Returns the session id so the caller can keep the conversation going.
 */
export async function runTurn(
  message: string,
  options: StreamHandlers & { sessionId?: string; signal?: AbortSignal } = {},
): Promise<{ sessionId: string; text: string }> {
  if (!isBackendConfigured()) {
    throw new AgentClientError(
      "No backend configured. Set EXPO_PUBLIC_MSTRMND_API_URL to the host running MSTRMND OS.",
    );
  }

  const { sessionId: existing, signal, ...handlers } = options;

  const sessionId = existing ?? (await createSession(message, signal));
  if (existing) await sendMessage(existing, message, signal);

  const text = await streamSession(sessionId, handlers, signal);
  return { sessionId, text };
}
