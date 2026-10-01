import type { Runner } from "./run";

export interface GithubLiveProbe {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  login?: string;
  recentRuns?: Array<{
    databaseId?: number;
    name?: string;
    conclusion?: string;
    status?: string;
    headBranch?: string;
  }>;
}

function withoutGithubTokens(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  return env;
}

export async function probeGithubLive(
  run: Runner,
  opts: { retried?: boolean } = {}
): Promise<GithubLiveProbe> {
  const version = await run("gh", ["--version"]);
  if (version.code !== 0) {
    return { ok: false, skipped: true, reason: "gh CLI not installed" };
  }

  const auth = await run("gh", ["auth", "status"]);
  const hasToken = Boolean(process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim());
  if (auth.code !== 0 && !hasToken) {
    return {
      ok: true,
      skipped: true,
      reason: "gh not authenticated — set GH_TOKEN or run gh auth login",
    };
  }

  const user = await run("gh", ["api", "user", "--jq", ".login"]);
  const runs = await run("gh", [
    "run",
    "list",
    "--limit",
    "5",
    "--json",
    "databaseId,name,conclusion,status,headBranch",
  ]);
  let recentRuns: GithubLiveProbe["recentRuns"] = [];
  if (runs.code === 0 && runs.stdout) {
    try {
      recentRuns = JSON.parse(runs.stdout) as GithubLiveProbe["recentRuns"];
    } catch {
      recentRuns = [];
    }
  }

  const envTokenFailed =
    hasToken && !opts.retried && (user.code !== 0 || /401|Bad credentials/i.test(user.stderr + runs.stderr));
  if (envTokenFailed) {
    const retryEnv = withoutGithubTokens();
    return probeGithubLive((cmd, args) => run(cmd, args, retryEnv), { retried: true });
  }

  if (user.code !== 0 && runs.code !== 0) {
    return {
      ok: true,
      skipped: true,
      reason: user.stderr || runs.stderr || "gh token cannot read user or runs",
    };
  }

  return {
    ok: true,
    skipped: false,
    login: user.code === 0 ? user.stdout.trim() : undefined,
    reason: user.code !== 0 ? "repo token: user lookup skipped" : undefined,
    recentRuns,
  };
}
