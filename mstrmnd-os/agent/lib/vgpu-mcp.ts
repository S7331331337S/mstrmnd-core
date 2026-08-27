/**
 * vgpu MCP adapter — modern Streamable HTTP (MCP 2026-07-28).
 *
 * Hosted vgpu.sh is modern-only and rejects the legacy initialize handshake
 * that eve 0.38's `defineMcpClientConnection` client still sends. This module
 * is the seam: tools call it; nothing under `agent/tools/` imports a vendor
 * GPU SDK. Swap the URL with `MSTRMND_VGPU_MCP_URL` (local `npx vgpu mcp`
 * behind an HTTP proxy, or another modern MCP endpoint).
 *
 * @see https://vgpu.sh/docs/mcp
 * @see docs/portability.md
 */

export const VGPU_MCP_PROTOCOL = "2026-07-28";
export const VGPU_MCP_DEFAULT_URL = "https://vgpu.sh/api/mcp";

export type VgpuMcpToolName = "docs" | "examples";

export function vgpuMcpUrl(): string {
  const override = process.env.MSTRMND_VGPU_MCP_URL?.trim();
  return override && override.length > 0 ? override : VGPU_MCP_DEFAULT_URL;
}

export async function callVgpuMcpTool(
  toolName: VgpuMcpToolName,
  args: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<unknown> {
  const url = vgpuMcpUrl();
  const body = {
    jsonrpc: "2.0" as const,
    id: 1,
    method: "tools/call",
    params: {
      name: toolName,
      arguments: args,
      _meta: {
        "io.modelcontextprotocol/protocolVersion": VGPU_MCP_PROTOCOL,
        "io.modelcontextprotocol/clientInfo": {
          name: "mstrmnd",
          version: "0.1.0",
        },
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };

  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": VGPU_MCP_PROTOCOL,
      "Mcp-Method": "tools/call",
      "Mcp-Name": toolName,
    },
    body: JSON.stringify(body),
  });

  const raw = await readMcpBody(response);
  const parsed = parseJsonRpc(raw);
  if (!parsed) {
    return {
      ok: false as const,
      error: `vgpu MCP returned unreadable payload (HTTP ${response.status})`,
      hint: `Check MSTRMND_VGPU_MCP_URL (current: ${url}). Hosted vgpu.sh speaks MCP ${VGPU_MCP_PROTOCOL} only.`,
    };
  }

  if ("error" in parsed && parsed.error) {
    const err = parsed.error as { message?: unknown; code?: unknown; data?: unknown };
    return {
      ok: false as const,
      error: typeof err.message === "string" ? err.message : "vgpu MCP error",
      code: err.code,
      data: err.data,
    };
  }

  const result = (parsed as { result?: unknown }).result;
  return unwrapToolResult(result);
}

async function readMcpBody(response: Response): Promise<string> {
  const text = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) return text;
  const dataLines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  return dataLines.join("\n") || text;
}

function parseJsonRpc(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const value = JSON.parse(trimmed) as unknown;
    return isRecord(value) ? value : null;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      const value = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
      return isRecord(value) ? value : null;
    } catch {
      return null;
    }
  }
}

function unwrapToolResult(result: unknown): unknown {
  if (!isRecord(result)) return result ?? { ok: false as const, error: "empty vgpu MCP result" };
  if (result.structuredContent !== undefined) return result.structuredContent;
  const content = result.content;
  if (Array.isArray(content) && content.length === 1 && isRecord(content[0])) {
    const first = content[0];
    if (first.type === "text" && typeof first.text === "string") {
      try {
        return JSON.parse(first.text) as unknown;
      } catch {
        return { text: first.text };
      }
    }
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
