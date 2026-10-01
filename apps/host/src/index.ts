import { createHostServer, listen } from "./http";

async function main() {
  const port = Number(process.env.PORT ?? "8080");
  const hostname = process.env.HOST ?? "0.0.0.0";
  const host = await createHostServer();
  const bound = await listen(host, Number.isFinite(port) ? port : 8080, hostname);
  const { runtime } = host;
  console.log(
    `MSTRMND HOST ONLINE http://${hostname}:${bound}  api=/v1 mcp=/mcp adk=/adk cli=hermes provider=${runtime.provider.id} doctrine=${runtime.context.doctrineRef ?? "none"}`
  );
}

main().catch((err) => {
  console.error("MSTRMND HOST fatal:", err);
  process.exit(1);
});
