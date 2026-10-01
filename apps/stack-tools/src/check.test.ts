import assert from "node:assert/strict";
import test from "node:test";
import { checkStackTools, reportOk } from "./check";
import type { Runner } from "./run";
import { firstVersion } from "./run";
import { probeVercelLive } from "./vercel-adapter";

const fakeRun: Runner = async (command, args) => {
  if (command === "vercel" && args[0] === "--version") {
    return { code: 0, stdout: "48.1.0", stderr: "" };
  }
  if (command === "gh" && args[0] === "--version") {
    return { code: 0, stdout: "gh version 2.81.0 (2026-01-01)", stderr: "" };
  }
  if (command === "gh" && args[0] === "auth") {
    return { code: 0, stdout: "Logged in", stderr: "" };
  }
  if (command === "gh" && args[0] === "api") {
    return { code: 0, stdout: "operator-zero", stderr: "" };
  }
  if (command === "gh" && args[0] === "run") {
    return {
      code: 0,
      stdout: JSON.stringify([
        { databaseId: 1, name: "CI", conclusion: "success", status: "completed", headBranch: "main" },
      ]),
      stderr: "",
    };
  }
  return { code: 127, stdout: "", stderr: "unexpected" };
};

test("firstVersion reads semver from CLI banners", () => {
  assert.equal(firstVersion("gh version 2.81.0 (2026-01-01)"), "2.81.0");
  assert.equal(firstVersion("v48.1.0"), "v48.1.0");
});

test("offline check reports CLIs and skips live vendor calls", async () => {
  const report = await checkStackTools({ live: false, run: fakeRun });
  assert.equal(report.live, false);
  assert.equal(report.vercelSdk.loaded, true);
  assert.equal(report.clis.find((c) => c.id === "vercel-cli")?.available, true);
  assert.equal(report.clis.find((c) => c.id === "gh")?.available, true);
  assert.equal(report.vercel.skipped, true);
  assert.equal(report.github.skipped, true);
  assert.equal(reportOk(report), true);
});

test("live check uses injected Vercel client and gh runner", async () => {
  const report = await checkStackTools({
    live: true,
    run: fakeRun,
    vercelClient: {
      projects: {
        getProjects: async () => ({
          projects: [{ id: "prj_1", name: "mstrmnd-os", framework: "nextjs" }],
        }),
        getProject: async () => ({ id: "prj_1", name: "mstrmnd-os" }),
      },
    },
  });
  assert.equal(report.vercel.skipped, false);
  assert.equal(report.vercel.projectCount, 1);
  assert.equal(report.vercel.projects?.[0]?.name, "mstrmnd-os");
  assert.equal(report.github.skipped, false);
  assert.equal(report.github.login, "operator-zero");
  assert.equal(report.github.recentRuns?.[0]?.name, "CI");
  assert.equal(reportOk(report), true);
});

test("probeVercelLive skips without token or client", async () => {
  const prev = process.env.VERCEL_TOKEN;
  delete process.env.VERCEL_TOKEN;
  delete process.env.VERCEL_ACCESS_TOKEN;
  const probe = await probeVercelLive(null);
  if (prev) process.env.VERCEL_TOKEN = prev;
  assert.equal(probe.skipped, true);
  assert.match(probe.reason ?? "", /VERCEL_TOKEN/);
});
