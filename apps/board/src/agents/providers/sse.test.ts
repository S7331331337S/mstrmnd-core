/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";

import { AnthropicError, decodeSse } from "./sse";

/** Build a ReadableStream that emits the given strings as separate byte chunks. */
function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function delta(text: string): string {
  return `event: content_block_delta\ndata: ${JSON.stringify({
    type: "content_block_delta",
    delta: { type: "text_delta", text },
  })}\n\n`;
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string> {
  let out = "";
  for await (const chunk of decodeSse(stream)) {
    if (chunk.type === "delta") out += chunk.text;
  }
  return out;
}

describe("decodeSse", () => {
  it("concatenates text deltas in order", async () => {
    const stream = streamOf(delta("Raise "), delta("the "), delta("round."));
    expect(await collect(stream)).toBe("Raise the round.");
  });

  it("reassembles a frame split across network chunks", async () => {
    const frame = delta("bootstrap");
    const cut = Math.floor(frame.length / 2);
    const stream = streamOf(frame.slice(0, cut), frame.slice(cut));
    expect(await collect(stream)).toBe("bootstrap");
  });

  it("reads a final frame that has no trailing blank line", async () => {
    const stream = streamOf(delta("first"), delta("last").trimEnd());
    expect(await collect(stream)).toBe("firstlast");
  });

  it("ignores non-text events and keep-alive pings", async () => {
    const stream = streamOf(
      `event: message_start\ndata: ${JSON.stringify({ type: "message_start" })}\n\n`,
      ": ping\n\n",
      delta("only this"),
      `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
    );
    expect(await collect(stream)).toBe("only this");
  });

  it("survives a malformed frame rather than dropping the stream", async () => {
    const stream = streamOf(delta("before"), "data: {not json\n\n", delta("after"));
    expect(await collect(stream)).toBe("beforeafter");
  });

  it("throws when the stream reports an error event", async () => {
    const stream = streamOf(
      delta("partial"),
      `event: error\ndata: ${JSON.stringify({
        type: "error",
        error: { message: "overloaded_error" },
      })}\n\n`,
    );

    await expect(collect(stream)).rejects.toThrow(AnthropicError);
  });
});
