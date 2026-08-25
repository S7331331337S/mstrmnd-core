import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GitHubScmConnector,
  OriginScmConnector,
  selectScmConnector,
} from "./index.ts";
import { createA2AAdapter } from "../a2a/adapter.ts";

test("GitHub is the source of truth; Origin is interchangeable but not migrated", () => {
  const github = selectScmConnector("github");
  const origin = selectScmConnector("origin");
  const gitlab = selectScmConnector("gitlab");
  assert.equal(github.info.kind, "github");
  assert.equal(github.info.sourceOfTruth, true);
  assert.equal(origin.info.kind, "origin");
  assert.equal(origin.info.sourceOfTruth, false);
  assert.equal(origin.info.status, "beta-not-migrated");
  assert.equal(gitlab.info.kind, "gitlab");
  assert.ok(github instanceof GitHubScmConnector);
  assert.ok(origin instanceof OriginScmConnector);
  const fallback = selectScmConnector(undefined);
  assert.equal(fallback.info.kind, "github");
});

test("A2A adapter refuses delegation without a boundary and stays unsupported until wired", async () => {
  const a2a = createA2AAdapter();
  const rejected = await a2a.delegate({
    fromAgentId: "peer",
    goal: "do work",
    boundaryId: "",
    allowedTools: [],
  });
  assert.equal(rejected.status, "rejected");
  const held = await a2a.delegate({
    fromAgentId: "peer",
    goal: "do work",
    boundaryId: "operator-zero-default",
    allowedTools: ["search_memory"],
  });
  assert.equal(held.protocol, "a2a");
  assert.equal(held.status, "unsupported");
});
