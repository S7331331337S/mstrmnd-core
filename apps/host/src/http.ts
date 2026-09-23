import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createRuntime,
  type MstrmndRuntime,
} from "@mstrmnd/intelligence-core";
import { createMstrmndMcpServer } from "@mstrmnd/mcp-server";
import { adkManifest, agentCard, publicBaseUrl } from "./adk";
import {
  HttpError,
  agentsPayload,
  approveAllowed,
  approveWrite,
  getContext,
  getDoctrineFile,
  healthPayload,
  listWorkspace,
  readyPayload,
  readCalibrationReport,
  readWorkspaceFile,
  runAgent,
  searchMemory,
  stageWrite,
} from "./facade";

const MAX_BODY = 1_000_000;

function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
    "cache-control": "no-store",
  });
  res.end(json);
}

function notFound(res: ServerResponse): void {
  send(res, 404, { error: "not found" });
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_BODY) throw new HttpError(413, "request body too large");
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const raw = await readBody(req);
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    throw new HttpError(400, "JSON object required");
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, "invalid JSON");
  }
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function applyCors(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = process.env.MSTRMND_API_CORS_ORIGIN ?? "*";
  res.setHeader("access-control-allow-origin", origin);
  res.setHeader("access-control-allow-headers", "content-type, x-mstrmnd-approve");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }
  return false;
}

export interface HostServer {
  server: Server;
  runtime: MstrmndRuntime;
  close: () => Promise<void>;
}

export async function createHostServer(opts: {
  repoRoot?: string;
  vaultPath?: string;
} = {}): Promise<HostServer> {
  const runtime = await createRuntime({
    allowMissingVault: true,
    repoRoot: opts.repoRoot,
    vaultPath: opts.vaultPath,
  });
  const mcp = createMstrmndMcpServer(() => runtime);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await mcp.connect(transport);

  const server = createServer(async (req, res) => {
    try {
      if (applyCors(req, res)) return;
      const host = header(req, "host");
      const url = new URL(req.url ?? "/", `http://${host ?? "127.0.0.1"}`);
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const method = req.method ?? "GET";

      if (path === "/mcp" || path.startsWith("/mcp/")) {
        await transport.handleRequest(req, res);
        return;
      }

      if (method === "GET" && path === "/health") {
        send(res, 200, await healthPayload(runtime));
        return;
      }
      if (method === "GET" && path === "/ready") {
        const body = await readyPayload(runtime);
        send(res, body.ready ? 200 : 503, body);
        return;
      }
      if (method === "GET" && (path === "/adk" || path === "/.well-known/adk.json")) {
        send(res, 200, adkManifest(runtime, publicBaseUrl(host)));
        return;
      }
      if (method === "GET" && path === "/.well-known/agent.json") {
        send(res, 200, agentCard(runtime, publicBaseUrl(host)));
        return;
      }
      if (method === "GET" && path === "/v1/context") {
        send(res, 200, await getContext(runtime, url.searchParams.get("q") ?? undefined));
        return;
      }
      if (method === "GET" && path === "/v1/identity") {
        send(res, 200, { identity: runtime.identity });
        return;
      }
      if (method === "GET" && path === "/v1/doctrine") {
        const pin = await readyPayload(runtime);
        send(res, 200, {
          ...pin,
          slice: runtime.context.doctrineSlice ?? [],
        });
        return;
      }
      if (method === "GET" && path.startsWith("/v1/doctrine/")) {
        const rel = path.slice("/v1/doctrine/".length);
        send(res, 200, await getDoctrineFile(runtime, rel));
        return;
      }
      if (method === "GET" && path === "/v1/memory") {
        const q = url.searchParams.get("q") ?? "";
        if (!q.trim()) throw new HttpError(400, "q is required");
        const limit = Number(url.searchParams.get("limit") ?? "10");
        send(res, 200, await searchMemory(runtime, q, Number.isFinite(limit) ? limit : 10));
        return;
      }
      if (method === "GET" && path === "/v1/workspace") {
        send(
          res,
          200,
          await listWorkspace(
            runtime,
            url.searchParams.get("mount") ?? undefined,
            url.searchParams.get("path") ?? ""
          )
        );
        return;
      }
      if (method === "GET" && path === "/v1/workspace/file") {
        const filePath = url.searchParams.get("path");
        if (!filePath) throw new HttpError(400, "path is required");
        send(
          res,
          200,
          await readWorkspaceFile(
            runtime,
            filePath,
            url.searchParams.get("mount") ?? undefined
          )
        );
        return;
      }
      if (method === "POST" && path === "/v1/workspace/drafts") {
        const body = await readJson(req);
        const target = typeof body.path === "string" ? body.path : "";
        const content = typeof body.content === "string" ? body.content : "";
        if (!target || !content) throw new HttpError(400, "path and content are required");
        send(
          res,
          201,
          await stageWrite(
            runtime,
            target,
            content,
            typeof body.mountId === "string" ? body.mountId : undefined
          )
        );
        return;
      }
      if (method === "POST" && path.match(/^\/v1\/workspace\/drafts\/[^/]+\/approve$/)) {
        if (!approveAllowed(header(req, "x-mstrmnd-approve"))) {
          throw new HttpError(403, "approval token required (X-MSTRMND-APPROVE)");
        }
        const draftId = path.split("/")[4] ?? "";
        send(res, 200, await approveWrite(runtime, draftId));
        return;
      }
      if (method === "GET" && path === "/v1/agents") {
        send(res, 200, agentsPayload());
        return;
      }
      if (method === "POST" && path === "/v1/runs") {
        const body = await readJson(req);
        const goal = typeof body.goal === "string" ? body.goal : "";
        if (!goal.trim()) throw new HttpError(400, "goal is required");
        const agentId =
          typeof body.agentId === "string" ? body.agentId : "operator-agent";
        // Network host never publishes. dryRun defaults true; false still uses denyApprover.
        const finished = await runAgent(runtime, goal, agentId, body.dryRun !== false);
        send(res, 200, {
          runId: finished.runId,
          status: finished.status,
          doctrineRef: finished.doctrineRef,
          resultSummary: finished.resultSummary,
          steps: finished.steps.length,
          error: finished.error,
          boundaryId: finished.boundaryId,
        });
        return;
      }
      if (method === "GET" && path === "/v1/calibration") {
        const report = await readCalibrationReport(runtime.config.repoRoot);
        if (!report) throw new HttpError(404, "no calibration report yet");
        send(res, 200, report);
        return;
      }

      notFound(res);
    } catch (err) {
      if (err instanceof HttpError) {
        send(res, err.status, { error: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      send(res, 500, { error: message });
    }
  });

  return {
    server,
    runtime,
    close: async () => {
      await transport.close();
      await new Promise<void>((resolve, reject) => {
        server.close((e) => (e ? reject(e) : resolve()));
      });
    },
  };
}

export async function listen(
  host: HostServer,
  port: number,
  hostname: string
): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    host.server.once("error", reject);
    host.server.listen(port, hostname, () => resolve());
  });
  const addr = host.server.address();
  if (addr && typeof addr === "object") return addr.port;
  return port;
}
