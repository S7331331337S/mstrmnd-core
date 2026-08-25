import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ciGreenObjective,
  fixtureHarnessRecords,
  scoreHarnessBenchmark,
} from "./harness-benchmark.ts";
import {
  fixtureCreativeCases,
  GPT_IMAGE_2_PRICING,
  scoreCreativeBenchmark,
} from "./creative-benchmark.ts";
import { localDelegationPort } from "./delegation.ts";

test("CI-green harness benchmark records policy and interventions above the harness", () => {
  const objective = ciGreenObjective();
  assert.match(objective.goal, /CI green/i);
  assert.equal(objective.boundary.networkAllowlist.length, 0);
  const report = scoreHarnessBenchmark(objective, fixtureHarnessRecords());
  assert.equal(report.records.length, 3);
  assert.ok(report.records.every((r) => r.policyEventCount >= 1));
  assert.ok(["cursor", "codex", "claude-code"].every((h) =>
    report.records.some((r) => r.harness === h)
  ));
  assert.ok(report.interventionRate > 0);
});

test("GPT-Image-2 transparent is a candidate, not the default, on fixture data", () => {
  assert.equal(GPT_IMAGE_2_PRICING.transparentBackground, true);
  const report = scoreCreativeBenchmark(fixtureCreativeCases());
  assert.equal(report.recommendedDefault, "postprocess-removal");
  assert.equal(report.gptImage2TransparentReady, false);
  for (const need of [
    "product-cutout",
    "avatar",
    "app-asset",
    "social-overlay",
    "presentation",
    "brand-composite",
  ] as const) {
    assert.ok(
      report.cases.some(
        (c) =>
          c.provider === "gpt-image-2" &&
          c.useCase === need &&
          c.background === "transparent"
      ),
      `missing GPT-Image-2 transparent case for ${need}`
    );
  }
});

test("local delegation port does not speak A2A", async () => {
  const result = await localDelegationPort.delegate({
    fromAgentId: "operator-agent",
    goal: "delegate a subtask",
    boundaryId: "operator-zero-default",
    allowedTools: ["search_memory"],
  });
  assert.equal(result.protocol, "none");
  assert.equal(result.status, "unsupported");
});
