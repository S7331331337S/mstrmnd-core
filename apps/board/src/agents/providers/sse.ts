import type { StreamChunk } from "@/lib/types";

/**
 * Deliberately free of any React Native / Expo import so it can be unit tested
 * directly — network streaming is otherwise impossible to exercise without a
 * live OS session.
 */

export class StreamError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "StreamError";
  }
}

/** @deprecated Use StreamError. Kept so older tests and imports still resolve. */
export const AnthropicError = StreamError;

/** Turns a raw SSE byte stream into text deltas. */
export async function* decodeSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Events are separated by a blank line; hold back any partial tail so a
      // frame split across two network chunks still parses.
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const chunk = parseEvent(event);
        if (chunk) yield chunk;
      }
    }

    // A final frame with no trailing blank line still counts.
    const tail = parseEvent(buffer);
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

function parseEvent(event: string): StreamChunk | null {
  const dataLine = event.split("\n").find((line) => line.startsWith("data:"));
  if (!dataLine) return null;

  const payload = dataLine.slice("data:".length).trim();
  if (!payload || payload === "[DONE]") return null;

  let parsed: {
    type?: string;
    text?: string;
    delta?: { type?: string; text?: string };
    error?: { message?: string };
  };
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null; // A malformed frame should not kill an otherwise good stream.
  }

  if (parsed.type === "error") {
    throw new StreamError(parsed.error?.message ?? "The stream reported an error.");
  }
  if (parsed.type === "delta" && typeof parsed.text === "string") {
    return { type: "delta", text: parsed.text };
  }
  if (parsed.type === "done") {
    return { type: "done" };
  }
  if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
    return { type: "delta", text: parsed.delta.text ?? "" };
  }
  return null;
}
