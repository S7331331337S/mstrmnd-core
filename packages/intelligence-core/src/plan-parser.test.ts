import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseToolPlan } from "./plan-parser";

describe("parseToolPlan", () => {
  it("parses a JSON array", () => {
    const calls = parseToolPlan(
      `[{"tool":"search_memory","args":{"query":"x"}},{"tool":"draft_write","args":{"path":"a.md","content":"hi"}}]`
    );
    assert.ok(calls);
    assert.equal(calls.length, 2);
    assert.equal(calls[0]?.tool, "search_memory");
    assert.equal(calls[1]?.args.path, "a.md");
  });

  it("parses a fenced array and ignores prose", () => {
    const calls = parseToolPlan(
      `Sure.\n\`\`\`json\n[{"tool":"get_context","args":{}}]\n\`\`\`\n`
    );
    assert.ok(calls);
    assert.equal(calls[0]?.tool, "get_context");
  });

  it("returns an empty array for an explicit empty plan", () => {
    const calls = parseToolPlan("[]");
    assert.ok(calls);
    assert.equal(calls.length, 0);
  });

  it("returns null for EchoProvider output", () => {
    assert.equal(parseToolPlan("[echo] Goal: do a thing"), null);
  });

  it("caps at eight tools", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      tool: `t${i}`,
      args: {},
    }));
    const calls = parseToolPlan(JSON.stringify(many));
    assert.equal(calls?.length, 8);
  });
});
