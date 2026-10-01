import { checkStackTools, reportOk } from "./check";

function parseArgs(argv: string[]) {
  const out = { live: false, help: false, json: false };
  for (const a of argv) {
    if (a === "--live") out.live = true;
    else if (a === "--json") out.json = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2).filter((a) => a !== "check" && a !== "--"));
  if (args.help) {
    console.log(`mstrmnd stack-tools — Vercel SDK/CLI + GitHub CLI probe

Usage:
  pnpm stack:tools [--live] [--json]

Offline (default): print vercel + gh versions; confirm @vercel/sdk loads.
--live: read-only Vercel project list (VERCEL_TOKEN) and gh api/user + run list.
`);
    return;
  }
  const report = await checkStackTools({ live: args.live });
  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`stack-tools ${reportOk(report) ? "PASS" : "FAIL"} live=${report.live}`);
    for (const cli of report.clis) {
      console.log(
        `  ${cli.available ? "ok" : "MISSING"} ${cli.id} ${cli.version ?? ""} ${cli.detail ?? ""}`.trim()
      );
    }
    console.log(`  vercel-sdk loaded=${report.vercelSdk.loaded} live=${report.vercel.skipped ? "skipped" : "ok"} ${report.vercel.reason ?? ""}`.trim());
    if (report.vercel.projects?.length) {
      for (const p of report.vercel.projects) {
        console.log(`    project ${p.name} (${p.id})`);
      }
    }
    console.log(`  github live=${report.github.skipped ? "skipped" : "ok"} ${report.github.login ?? ""} ${report.github.reason ?? ""}`.trim());
    if (report.github.recentRuns?.length) {
      for (const run of report.github.recentRuns) {
        console.log(`    run ${run.name} ${run.status}/${run.conclusion ?? ""} ${run.headBranch ?? ""}`);
      }
    }
  }
  if (!reportOk(report)) process.exit(1);
}

main().catch((err) => {
  console.error("stack-tools fatal:", err);
  process.exit(1);
});
