import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

import { isWorkflowPath } from "./proxy-paths";

// config.matcher must be a string literal in proxy.ts (Next.js analyses it
// statically), so extract it from the source and emulate Next's anchored match.
const proxySource = readFileSync(join(import.meta.dirname, "..", "proxy.ts"), "utf8");
const matcherLiteral = proxySource.match(/matcher:\s*\[\s*"((?:[^"\\]|\\.)*)"/)?.[1];
assert.ok(matcherLiteral, "could not find config.matcher literal in proxy.ts");
const PROXY_MATCHER = JSON.parse(`"${matcherLiteral}"`) as string;
const matcherRe = new RegExp(`^${PROXY_MATCHER}$`);
const runsProxy = (path: string) => matcherRe.test(path);

describe("isWorkflowPath", () => {
  it("matches the workflow prefix and its children", () => {
    assert.equal(isWorkflowPath("/.well-known/workflow"), true);
    assert.equal(isWorkflowPath("/.well-known/workflow/v1/flow"), true);
    assert.equal(isWorkflowPath("/.well-known/workflow/v1/step"), true);
    assert.equal(isWorkflowPath("/.well-known/workflow/v1/webhook/abc"), true);
  });

  it("does not match lookalikes or other well-known paths", () => {
    assert.equal(isWorkflowPath("/.well-known/workflows"), false);
    assert.equal(isWorkflowPath("/.well-known/agent.json"), false);
    assert.equal(isWorkflowPath("/workflow"), false);
    assert.equal(isWorkflowPath("/"), false);
  });
});

describe("proxy config.matcher", () => {
  it("skips the workflow routes", () => {
    assert.equal(runsProxy("/.well-known/workflow/v1/flow"), false);
    assert.equal(runsProxy("/.well-known/workflow/v1/step"), false);
  });

  it("still runs on app routes and other well-known paths", () => {
    assert.equal(runsProxy("/"), true);
    assert.equal(runsProxy("/dashboard"), true);
    assert.equal(runsProxy("/api/something"), true);
    assert.equal(runsProxy("/.well-known/agent.json"), true);
  });

  it("still skips Next internals and static assets", () => {
    assert.equal(runsProxy("/_next/static/chunk.js"), false);
    assert.equal(runsProxy("/logo.svg"), false);
  });
});
