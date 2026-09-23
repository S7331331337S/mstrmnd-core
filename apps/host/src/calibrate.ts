import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  createRuntime,
  denyApprover,
  loadDoctrinePin,
} from "@mstrmnd/intelligence-core";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "../../..");

export interface CalibrationCase {
  id: string;
  goal: string;
  agentId?: string;
  expect: {
    status: "succeeded" | "failed";
    minSteps?: number;
    doctrinePinned?: boolean;
  };
}

export interface CaseResult {
  id: string;
  ok: boolean;
  status: string;
  steps: number;
  doctrineRef: string | null;
  errors: string[];
  durationMs: number;
}

export interface CalibrationReport {
  at: string;
  provider: string;
  doctrineRef: string | null;
  passed: number;
  failed: number;
  cases: CaseResult[];
}

export function defaultCasesPath(repoRoot = REPO_ROOT): string {
  return join(repoRoot, "fixtures", "calibration", "cases.json");
}

export async function loadCases(path = defaultCasesPath()): Promise<CalibrationCase[]> {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as { cases?: CalibrationCase[] } | CalibrationCase[];
  return Array.isArray(parsed) ? parsed : parsed.cases ?? [];
}

export async function runCalibration(opts: {
  repoRoot?: string;
  casesPath?: string;
} = {}): Promise<CalibrationReport> {
  const repoRoot = opts.repoRoot ?? REPO_ROOT;
  const cases = await loadCases(opts.casesPath ?? defaultCasesPath(repoRoot));
  const runtime = await createRuntime({
    allowMissingVault: true,
    repoRoot,
  });
  const pin = await loadDoctrinePin(repoRoot);
  const results: CaseResult[] = [];

  for (const c of cases) {
    const started = Date.now();
    const errors: string[] = [];
    try {
      const orch = runtime.createOrchestrator({
        dryRun: true,
        writeApprover: denyApprover,
      });
      const run = orch.createRun(c.agentId ?? "operator-agent", c.goal);
      const finished = await orch.dispatch(run);
      if (finished.status !== c.expect.status) {
        errors.push(`status ${finished.status} != ${c.expect.status}`);
      }
      if (c.expect.minSteps != null && finished.steps.length < c.expect.minSteps) {
        errors.push(`steps ${finished.steps.length} < ${c.expect.minSteps}`);
      }
      if (c.expect.doctrinePinned) {
        const ref = finished.doctrineRef ?? pin?.ref ?? null;
        if (!ref || ref.length !== 40) {
          errors.push("doctrine pin missing or not a full SHA");
        }
      }
      results.push({
        id: c.id,
        ok: errors.length === 0,
        status: finished.status,
        steps: finished.steps.length,
        doctrineRef: finished.doctrineRef,
        errors,
        durationMs: Date.now() - started,
      });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
      results.push({
        id: c.id,
        ok: false,
        status: "error",
        steps: 0,
        doctrineRef: pin?.ref ?? null,
        errors,
        durationMs: Date.now() - started,
      });
    }
  }

  return {
    at: new Date().toISOString(),
    provider: runtime.provider.id,
    doctrineRef: runtime.context.doctrineRef,
    passed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    cases: results,
  };
}

export async function writeReport(
  report: CalibrationReport,
  repoRoot = REPO_ROOT
): Promise<string> {
  const dir = join(repoRoot, ".generated", "calibration");
  await mkdir(dir, { recursive: true });
  const latest = join(dir, "latest.json");
  const stamped = join(dir, `${report.at.replace(/[:.]/g, "-")}.json`);
  const json = JSON.stringify(report, null, 2);
  await writeFile(latest, json);
  await writeFile(stamped, json);
  return latest;
}

export async function calibrateMain(repoRoot = REPO_ROOT): Promise<CalibrationReport> {
  const report = await runCalibration({ repoRoot });
  const path = await writeReport(report, repoRoot);
  console.log(
    `calibration ${report.failed === 0 ? "PASS" : "FAIL"} passed=${report.passed} failed=${report.failed} provider=${report.provider} doctrine=${report.doctrineRef ?? "none"} report=${path}`
  );
  for (const c of report.cases) {
    const mark = c.ok ? "ok" : "FAIL";
    console.log(`  ${mark} ${c.id} status=${c.status} steps=${c.steps} ${c.errors.join("; ")}`);
  }
  return report;
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) {
  calibrateMain()
    .then((report) => {
      if (report.failed > 0) process.exit(1);
    })
    .catch((err) => {
      console.error("calibration fatal:", err);
      process.exit(1);
    });
}
