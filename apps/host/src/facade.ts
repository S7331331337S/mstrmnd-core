import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  assembleContext,
  denyApprover,
  listAgentSpecs,
  loadDoctrinePin,
  readDoctrineFile,
  WorkspacePathError,
  type MstrmndRuntime,
} from "@mstrmnd/intelligence-core";
import { probeLocalClis, defaultRunner } from "@mstrmnd/stack-tools";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

function defaultMount(runtime: MstrmndRuntime, mountId?: string): string {
  return mountId ?? runtime.workspace.listMounts()[0]?.id ?? "vault";
}

export async function healthPayload(runtime: MstrmndRuntime) {
  const pin = await loadDoctrinePin(runtime.config.repoRoot);
  return {
    ok: true,
    service: "mstrmnd-core",
    transports: ["api", "mcp", "adk", "cli", "tools"],
    provider: runtime.provider.id,
    doctrineRef: runtime.context.doctrineRef,
    doctrineStatus: pin?.status ?? "missing",
    company: runtime.context.company.name,
    operator: runtime.context.operator.displayName,
    memory: runtime.memory.size,
    mounts: runtime.workspace.listMounts().map((m) => m.id),
  };
}

export async function toolsPayload() {
  const clis = await probeLocalClis(defaultRunner);
  return {
    vercelSdk: "@vercel/sdk",
    clis,
  };
}

export async function readyPayload(runtime: MstrmndRuntime) {
  const pin = await loadDoctrinePin(runtime.config.repoRoot);
  const ready = Boolean(pin?.ref);
  return {
    ready,
    doctrineRef: pin?.ref ?? null,
    doctrineStatus: pin?.status ?? "missing",
    provider: runtime.provider.id,
  };
}

export async function getContext(runtime: MstrmndRuntime, memoryQuery?: string) {
  if (memoryQuery?.trim()) {
    return assembleContext({
      vaultPath: runtime.config.vaultPath,
      repoRoot: runtime.config.repoRoot,
      memory: runtime.memory,
      memoryQuery,
    });
  }
  return runtime.context;
}

export async function getDoctrineFile(
  runtime: MstrmndRuntime,
  relativePath: string
) {
  const cleaned = relativePath.replace(/^\/+/, "");
  if (!cleaned || cleaned.split("/").includes("..")) {
    throw new HttpError(400, "invalid doctrine path");
  }
  const md = await readDoctrineFile(cleaned, runtime.config.repoRoot);
  if (!md) throw new HttpError(404, `doctrine file not found: ${cleaned}`);
  return { path: cleaned, content: md };
}

export async function searchMemory(
  runtime: MstrmndRuntime,
  query: string,
  limit = 10
) {
  const { memories } = runtime.memory.search(query);
  return {
    query,
    count: Math.min(memories.length, limit),
    results: memories.slice(0, limit).map((m) => ({
      id: m.id,
      title: m.title,
      tags: m.relationships,
      snippet: m.content?.slice(0, 300) ?? "",
      scope: m.scope,
      provenance: m.provenance,
    })),
  };
}

export async function listWorkspace(
  runtime: MstrmndRuntime,
  mountId?: string,
  path = ""
) {
  const id = defaultMount(runtime, mountId);
  try {
    const nodes = await runtime.workspace.list(id, path);
    return {
      mountId: id,
      path,
      count: nodes.length,
      nodes: nodes.map((n) => ({
        path: n.path,
        kind: n.kind,
        name: n.name,
        size: n.size,
      })),
    };
  } catch (err) {
    if (err instanceof WorkspacePathError) throw new HttpError(400, err.message);
    throw err;
  }
}

export async function readWorkspaceFile(
  runtime: MstrmndRuntime,
  path: string,
  mountId?: string,
  maxBytes?: number
) {
  const id = defaultMount(runtime, mountId);
  try {
    const file = await runtime.workspace.read(id, path, maxBytes);
    return { mountId: id, ...file };
  } catch (err) {
    if (err instanceof WorkspacePathError) throw new HttpError(400, err.message);
    throw err;
  }
}

export async function stageWrite(
  runtime: MstrmndRuntime,
  path: string,
  content: string,
  mountId?: string
) {
  const id = defaultMount(runtime, mountId);
  try {
    const draft = await runtime.workspace.stageDraft(id, path, content);
    return {
      status: "awaiting_approval",
      draftId: draft.id,
      mountId: draft.mountId,
      targetPath: draft.targetPath,
      draftPath: draft.draftPath,
      bytes: draft.bytes,
    };
  } catch (err) {
    if (err instanceof WorkspacePathError) throw new HttpError(400, err.message);
    throw err;
  }
}

export function approveAllowed(header: string | undefined): boolean {
  const token = process.env.MSTRMND_APPROVE_TOKEN?.trim();
  if (!token) return false;
  return header === token;
}

export async function approveWrite(runtime: MstrmndRuntime, draftId: string) {
  try {
    const published = await runtime.workspace.publishDraft(draftId);
    return { status: "published", draftId, path: published.path, bytes: published.bytes };
  } catch (err) {
    if (err instanceof WorkspacePathError) throw new HttpError(400, err.message);
    throw err;
  }
}

export async function runAgent(
  runtime: MstrmndRuntime,
  goal: string,
  agentId = "operator-agent",
  dryRun = true
) {
  const orch = runtime.createOrchestrator({
    dryRun,
    writeApprover: denyApprover,
  });
  const run = orch.createRun(agentId, goal);
  return orch.dispatch(run);
}

export function agentsPayload() {
  return { agents: listAgentSpecs() };
}

export async function readCalibrationReport(repoRoot: string) {
  const path = join(repoRoot, ".generated", "calibration", "latest.json");
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}
