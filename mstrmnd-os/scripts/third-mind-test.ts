/**
 * Offline round-trip test for the Third-Mind store. No network, no model.
 * Run with: pnpm test:memory
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileThirdMindStore } from "../agent/lib/third-mind";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ok   ${msg}`);
  } else {
    failures++;
    console.error(`  FAIL ${msg}`);
  }
}

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "third-mind-"));
  const store = new FileThirdMindStore(join(dir, "third-mind.json"));

  console.log("Third-Mind round-trip");

  const a = await store.write({
    key: "alliance.positioning",
    content: "MSTRMND installs the intelligence layer between vision and execution.",
    tags: ["positioning", "doctrine"],
    agent: "maestro",
  });
  assert(!!a.id, "write returns an id");

  await store.write({
    key: "memory.design",
    content: "Third-Mind is the shared observation layer; agents read/write via tools.",
    tags: ["memory", "architecture"],
    agent: "memory-keeper",
  });

  const read = await store.read("alliance.positioning");
  assert(read?.content.includes("intelligence layer") ?? false, "read by key returns content");

  const readById = await store.read(a.id);
  assert(readById?.key === "alliance.positioning", "read by id returns row");

  const hits = await store.search("memory observation layer");
  assert(hits.length >= 1, "search finds relevant observation");
  assert(hits[0].key === "memory.design", "top hit is the most relevant row");
  assert(typeof hits[0].score === "number" && hits[0].score > 0, "hits carry a score");

  // Prefix credit: "research" should partially match "researcher"-style content.
  await store.write({ key: "topic.research", content: "The researcher gathers evidence.", agent: "researcher" });
  const prefix = await store.search("research");
  assert(prefix.length >= 1, "prefix search matches");

  const updated = await store.write({
    key: "alliance.positioning",
    content: "Updated: models are interchangeable; the alliance persists.",
    agent: "maestro",
  });
  assert(updated.id === a.id, "writing an existing key updates in place (stable id)");
  const list = await store.list();
  assert(list.filter((o) => o.key === "alliance.positioning").length === 1, "no duplicate keys after update");
  assert(list.length === 3, "list returns all distinct observations");

  console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
