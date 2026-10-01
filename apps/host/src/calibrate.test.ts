import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { loadCases, runCalibration } from "./calibrate";

const REPO = join(import.meta.dirname, "../../..");

test("calibration fixtures pass on echo", async () => {
  const cases = await loadCases();
  assert.ok(cases.length >= 2);
  const report = await runCalibration({ repoRoot: REPO });
  assert.equal(report.provider, "echo");
  assert.equal(report.failed, 0, report.cases.filter((c) => !c.ok).map((c) => `${c.id}: ${c.errors.join(", ")}`).join("; "));
  assert.equal(report.passed, cases.length);
});
