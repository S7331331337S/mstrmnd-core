/**
 * Vercel REST adapter. Lives at the edge — intelligence-core never imports this.
 * Read-only: list projects / fetch one project. No deploy, no mutate.
 */
export interface VercelProjectSummary {
  id: string;
  name: string;
  framework?: string;
}

export interface VercelLiveProbe {
  ok: boolean;
  skipped: boolean;
  reason?: string;
  projectCount?: number;
  projects?: VercelProjectSummary[];
  target?: { idOrName: string; found: boolean };
}

export interface VercelSdkLike {
  projects: {
    getProjects: (q: {
      limit?: string;
      teamId?: string;
      search?: string;
    }) => Promise<unknown>;
    getProject: (q: {
      idOrName: string;
      teamId?: string;
    }) => Promise<unknown>;
  };
}

function asProjectList(result: unknown): VercelProjectSummary[] {
  const rows = Array.isArray(result)
    ? result
    : result && typeof result === "object" && "projects" in result
      ? (result as { projects?: unknown }).projects
      : [];
  if (!Array.isArray(rows)) return [];
  const out: VercelProjectSummary[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { id?: unknown; name?: unknown; framework?: unknown };
    if (typeof rec.id !== "string" || typeof rec.name !== "string") continue;
    out.push({
      id: rec.id,
      name: rec.name,
      framework: typeof rec.framework === "string" ? rec.framework : undefined,
    });
  }
  return out;
}

export function vercelToken(): string | undefined {
  const token =
    process.env.VERCEL_TOKEN?.trim() || process.env.VERCEL_ACCESS_TOKEN?.trim();
  return token || undefined;
}

export async function createVercelClient(
  token = vercelToken()
): Promise<VercelSdkLike | null> {
  if (!token) return null;
  const { Vercel } = await import("@vercel/sdk");
  return new Vercel({ bearerToken: token });
}

export async function probeVercelLive(
  client: VercelSdkLike | null = null
): Promise<VercelLiveProbe> {
  const token = vercelToken();
  if (!token && !client) {
    return {
      ok: true,
      skipped: true,
      reason: "VERCEL_TOKEN unset — SDK loaded, live call skipped",
    };
  }
  const sdk = client ?? (await createVercelClient(token));
  if (!sdk) {
    return { ok: false, skipped: true, reason: "failed to construct Vercel client" };
  }
  const teamId = process.env.VERCEL_TEAM_ID?.trim() || undefined;
  const search = process.env.VERCEL_PROJECT?.trim() || undefined;
  const result = await sdk.projects.getProjects({
    limit: "5",
    teamId,
    search,
  });
  const projects = asProjectList(result);

  let target: VercelLiveProbe["target"];
  if (search) {
    try {
      const found = await sdk.projects.getProject({ idOrName: search, teamId });
      const rec = found && typeof found === "object" ? (found as { id?: unknown; name?: unknown }) : {};
      target = {
        idOrName: search,
        found: typeof rec.id === "string" || typeof rec.name === "string",
      };
    } catch {
      target = { idOrName: search, found: false };
    }
  }

  return {
    ok: true,
    skipped: false,
    projectCount: projects.length,
    projects,
    target,
  };
}
