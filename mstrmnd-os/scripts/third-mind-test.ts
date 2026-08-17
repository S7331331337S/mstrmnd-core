/**
 * Offline round-trip test for the scoped Third-Mind store. No network, no model.
 * Run with: pnpm test:memory
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileThirdMindStore } from "../agent/lib/third-mind";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok   ${msg}`);
  else {
    failures++;
    console.error(`  FAIL ${msg}`);
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "third-mind-"));
  const store = new FileThirdMindStore(join(dir, "third-mind.json"));
  const A = "ws_alpha";
  const B = "ws_beta";

  console.log("Third-Mind scoped round-trip");

  const a = await store.write({
    scope: A,
    key: "alliance.positioning",
    content: "MSTRMND installs the intelligence layer between vision and execution.",
    tags: ["positioning", "doctrine"],
    agent: "maestro",
  });
  assert(!!a.id, "write returns an id");

  await store.write({
    scope: A,
    key: "memory.design",
    content: "Third-Mind is the shared observation layer; agents read/write via tools.",
    tags: ["memory", "architecture"],
    agent: "memory-keeper",
  });

  // Different workspace writes the same key — must not collide.
  await store.write({
    scope: B,
    key: "alliance.positioning",
    content: "Beta workspace note.",
    agent: "maestro",
  });

  const read = await store.read(A, "alliance.positioning");
  assert(read?.content.includes("intelligence layer") ?? false, "read by key (scope A)");

  const readById = await store.read(A, a.id);
  assert(readById?.key === "alliance.positioning", "read by id (scope A)");

  const hits = await store.search(A, "memory observation layer");
  assert(hits.length >= 1, "search finds relevant observation");
  assert(hits[0].key === "memory.design", "top hit is most relevant");
  assert(hits.every((h) => h.scope === A), "search never returns other workspaces");

  const listA = await store.list(A);
  const listB = await store.list(B);
  assert(listA.length === 2, "workspace A sees only its 2 observations");
  assert(listB.length === 1, "workspace B sees only its 1 observation");
  assert(
    (await store.read(B, "alliance.positioning"))?.content === "Beta workspace note.",
    "same key isolated across workspaces",
  );

  const updated = await store.write({
    scope: A,
    key: "alliance.positioning",
    content: "Updated: models are interchangeable; the alliance persists.",
    agent: "maestro",
  });
  assert(updated.id === a.id, "writing an existing key updates in place (stable id)");
  assert((await store.list(A)).length === 2, "no duplicate keys after update");

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
