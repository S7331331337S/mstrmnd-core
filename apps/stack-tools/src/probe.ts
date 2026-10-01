import { firstVersion, type Runner } from "./run";

export interface CliProbe {
  id: "vercel-cli" | "gh";
  available: boolean;
  version: string | null;
  detail?: string;
}

export async function probeVercelCli(run: Runner): Promise<CliProbe> {
  const result = await run("vercel", ["--version"]);
  if (result.code !== 0) {
    return {
      id: "vercel-cli",
      available: false,
      version: null,
      detail: result.stderr || result.stdout || `exit ${result.code}`,
    };
  }
  return {
    id: "vercel-cli",
    available: true,
    version: firstVersion(result.stdout) ?? firstVersion(result.stderr),
    detail: result.stdout.split("\n")[0],
  };
}

export async function probeGhCli(run: Runner): Promise<CliProbe> {
  const result = await run("gh", ["--version"]);
  if (result.code !== 0) {
    return {
      id: "gh",
      available: false,
      version: null,
      detail: result.stderr || result.stdout || `exit ${result.code}`,
    };
  }
  return {
    id: "gh",
    available: true,
    version: firstVersion(result.stdout),
    detail: result.stdout.split("\n")[0],
  };
}

export async function probeLocalClis(run: Runner): Promise<CliProbe[]> {
  return Promise.all([probeVercelCli(run), probeGhCli(run)]);
}
