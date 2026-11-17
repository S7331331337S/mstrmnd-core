import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { calibrationSkipReason, loadCases, runCalibration } from "./calibrate";

// Echo is an explicit, test-only opt-in; there is no default provider.
process.env.NODE_ENV ??= "test";
process.env.MSTRMND_MODEL_PROVIDER ??= "echo";

const REPO = join(import.meta.dirname, "../../..");

test("calibration fixtures pass on echo", async () => {
  const cases = await loadCases();
  assert.ok(cases.length >= 2);
  const report = await runCalibration({ repoRoot: REPO });
  assert.equal(report.provider, "echo");
  assert.equal(report.failed, 0, report.cases.filter((c) => !c.ok).map((c) => `${c.id}: ${c.errors.join(", ")}`).join("; "));
  assert.equal(report.passed, cases.length);
});

test("calibration skips (no test provider) when no real provider is configured", () => {
  assert.match(calibrationSkipReason({}) ?? "", /^skipped: no model provider/);
  assert.match(calibrationSkipReason({ NODE_ENV: "production" }) ?? "", /^skipped: no model provider/);
  // echo is not a real provider outside test / explicit opt-in
  assert.match(
    calibrationSkipReason({ NODE_ENV: "production", MSTRMND_MODEL_PROVIDER: "echo" }) ?? "",
    /^skipped: no model provider/
  );
  assert.equal(calibrationSkipReason({ NODE_ENV: "production", MSTRMND_MODEL_PROVIDER: "openai-compatible" }), null);
  assert.equal(calibrationSkipReason({ NODE_ENV: "test", MSTRMND_MODEL_PROVIDER: "echo" }), null);
});
