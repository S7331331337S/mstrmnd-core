import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRuntime, type MstrmndRuntime } from "@mstrmnd/intelligence-core";
import { createMstrmndMcpServer } from "./register-tools";

async function main() {
  const runtime: MstrmndRuntime = await createRuntime({ allowMissingVault: true });
  console.error(
    `MSTRMND MCP: runtime ready — memory=${runtime.memory.size} doctrine=${runtime.context.doctrineRef ?? "none"} company=${runtime.context.company.name} model=${runtime.provider.id}`
  );
  const server = createMstrmndMcpServer(() => runtime);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MSTRMND MCP SERVER ONLINE (stdio) — plugin runtime");
}

main().catch((err) => {
  console.error("MSTRMND MCP fatal:", err);
  process.exit(1);
});
