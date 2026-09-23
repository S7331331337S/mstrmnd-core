import { probeGithubLive, type GithubLiveProbe } from "./github-adapter";
import { probeLocalClis, type CliProbe } from "./probe";
import { defaultRunner, type Runner } from "./run";
import { probeVercelLive, type VercelLiveProbe, type VercelSdkLike } from "./vercel-adapter";

export interface StackToolsReport {
  at: string;
  live: boolean;
  clis: CliProbe[];
  vercelSdk: { loaded: true };
  vercel: VercelLiveProbe;
  github: GithubLiveProbe;
}

export async function checkStackTools(opts: {
  live?: boolean;
  run?: Runner;
  vercelClient?: VercelSdkLike | null;
} = {}): Promise<StackToolsReport> {
  const run = opts.run ?? defaultRunner;
  const live = opts.live ?? process.env.MSTRMND_TOOLS_LIVE === "1";
  const clis = await probeLocalClis(run);
  const vercel = live
    ? await probeVercelLive(opts.vercelClient)
    : {
        ok: true,
        skipped: true,
        reason: "live probe off — pass --live or MSTRMND_TOOLS_LIVE=1",
      };
  const github = live
    ? await probeGithubLive(run)
    : {
        ok: true,
        skipped: true,
        reason: "live probe off — pass --live or MSTRMND_TOOLS_LIVE=1",
      };
  return {
    at: new Date().toISOString(),
    live,
    clis,
    vercelSdk: { loaded: true },
    vercel,
    github,
  };
}

export function reportOk(report: StackToolsReport): boolean {
  const clisOk = report.clis.every((c) => c.available);
  const vercelOk = report.vercel.ok;
  const githubOk = report.github.ok;
  return clisOk && vercelOk && githubOk;
}
