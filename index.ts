import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./apps/mcp-server/src/mcp.js";

function sendJson(res: ServerResponse, status: number, body: object): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function isAuthorized(req: IncomingMessage, token: string): boolean {
  const expected = `Bearer ${token}`;
  const received = req.headers.authorization;
  return (
    typeof received === "string" &&
    received.length === expected.length &&
    timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  );
}

/** Streamable HTTP MCP endpoint served at the deployment root. */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) {
    sendJson(res, 503, { error: "MCP authentication is not configured" });
    return;
  }

  if (!isAuthorized(req, token)) {
    res.setHeader("www-authenticate", "Bearer");
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  const server = await createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  try {
    await server.connect(transport);
    res.once("close", () => {
      void transport.close();
      void server.close();
    });
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("MSTRMND MCP HTTP fatal:", error);
    if (!res.headersSent) {
      sendJson(res, 500, {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}
