/**
 * Live smoke test for the vgpu MCP adapter (modern 2026-07-28 HTTP).
 * Run with: pnpm test:vgpu
 */
import { callVgpuMcpTool, vgpuMcpUrl } from "../agent/lib/vgpu-mcp";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.error(`  FAIL ${msg}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main() {
  console.log(`vgpu MCP adapter  url=${vgpuMcpUrl()}`);

  const docs = await callVgpuMcpTool("docs", {
    operation: "search",
    query: "render pipeline",
  });
  assert(isRecord(docs), "docs search returns an object");
  assert(isRecord(docs) && docs.ok !== false, "docs search is not an error payload");
  const docResults = isRecord(docs) && Array.isArray(docs.results) ? docs.results : [];
  assert(docResults.length > 0, `docs search has hits (got ${docResults.length})`);

  const firstHit = docResults[0];
  const target =
    isRecord(firstHit) && typeof firstHit.virtualPath === "string"
      ? firstHit.virtualPath
      : "/guides/getting-started.docs.md";
  const read = await callVgpuMcpTool("docs", {
    operation: "read",
    target,
    limit: 800,
  });
  assert(isRecord(read) && read.ok !== false, `docs read of ${target} succeeded`);
  const readText =
    (isRecord(read) && typeof read.text === "string" && read.text) ||
    (isRecord(read) && typeof read.content === "string" && read.content) ||
    JSON.stringify(read);
  assert(readText.length > 40, `docs read returned body (${readText.length} chars)`);

  const examples = await callVgpuMcpTool("examples", {
    operation: "search",
    query: "gradient",
  });
  assert(isRecord(examples), "examples search returns an object");
  assert(
    isRecord(examples) && examples.ok !== false,
    "examples search is not an error payload",
  );
  const exampleHits =
    isRecord(examples) && Array.isArray(examples.results)
      ? examples.results
      : isRecord(examples) && Array.isArray(examples.examples)
        ? examples.examples
        : [];
  assert(
    exampleHits.length > 0 || (isRecord(examples) && Object.keys(examples).length > 0),
    "examples search returned a payload",
  );

  if (failures > 0) {
    console.error(`\n${failures} failure(s)`);
    console.error("docs payload:", JSON.stringify(docs).slice(0, 800));
    console.error("examples payload:", JSON.stringify(examples).slice(0, 800));
    process.exit(1);
  }
  console.log("\nall passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
