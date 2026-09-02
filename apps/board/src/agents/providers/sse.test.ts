/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";

import { StreamError, decodeSse } from "./sse";

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

function anthropicDelta(text: string): string {
  return `event: content_block_delta\ndata: ${JSON.stringify({
    type: "content_block_delta",
    delta: { type: "text_delta", text },
  })}\n\n`;
}

function hostedDelta(text: string): string {
  return `data: ${JSON.stringify({ type: "delta", text })}\n\n`;
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
    const stream = streamOf(anthropicDelta("Raise "), anthropicDelta("the "), anthropicDelta("round."));
    expect(await collect(stream)).toBe("Raise the round.");
  });

  it("reassembles a frame split across network chunks", async () => {
    const frame = anthropicDelta("bootstrap");
    const cut = Math.floor(frame.length / 2);
    const stream = streamOf(frame.slice(0, cut), frame.slice(cut));
    expect(await collect(stream)).toBe("bootstrap");
  });

  it("reads a final frame that has no trailing blank line", async () => {
    const stream = streamOf(anthropicDelta("first"), anthropicDelta("last").trimEnd());
    expect(await collect(stream)).toBe("firstlast");
  });

  it("ignores non-text events and keep-alive pings", async () => {
    const stream = streamOf(
      `event: message_start\ndata: ${JSON.stringify({ type: "message_start" })}\n\n`,
      ": ping\n\n",
      anthropicDelta("only this"),
      `event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`,
    );
    expect(await collect(stream)).toBe("only this");
  });

  it("survives a malformed frame rather than dropping the stream", async () => {
    const stream = streamOf(anthropicDelta("before"), "data: {not json\n\n", anthropicDelta("after"));
    expect(await collect(stream)).toBe("beforeafter");
  });

  it("throws when the stream reports an error event", async () => {
    const stream = streamOf(
      anthropicDelta("partial"),
      `event: error\ndata: ${JSON.stringify({
        type: "error",
        error: { message: "overloaded_error" },
      })}\n\n`,
    );

    await expect(collect(stream)).rejects.toThrow(StreamError);
  });

  it("reads hosted OS frames (delta + done)", async () => {
    const stream = streamOf(
      hostedDelta("Raise "),
      hostedDelta("the "),
      `data: ${JSON.stringify({ type: "done" })}\n\n`,
    );
    expect(await collect(stream)).toBe("Raise the ");
  });

  it("reassembles a hosted frame split across network chunks", async () => {
    const frame = hostedDelta("hosted");
    const cut = Math.floor(frame.length / 2);
    const stream = streamOf(frame.slice(0, cut), frame.slice(cut));
    expect(await collect(stream)).toBe("hosted");
  });
});
