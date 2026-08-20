import { createGenesisService } from "../lib/genesis-service";

async function main() {
  const svc = createGenesisService();
  const ws = "ws_test";
  const records = await svc.issue(ws, {
    name: "Maestro",
    purpose: "Coordinate MSTRMND operations",
    values: ["accuracy", "initiative", "traceability"],
    boundaries: ["no unapproved financial transactions"],
    controllerType: "organization",
    controllerId: "mstrmnd.ai",
    modelPolicy: "gateway/model-agnostic",
    approvalPolicy: "risk-tiered",
    bindSubagents: true,
  });
  console.log(
    "issued",
    records.map(
      (r) =>
        `${r.name} ${r.agentId} parent=${r.signed.manifest.lineage.parentAgentId}`,
    ),
  );
  const maestro = records[0];
  const ev = await svc.ingest({
    agentId: maestro.agentId,
    eventType: "model.completed",
    payload: { text: "hello", api_key: "sk-secret-should-redact" },
    runtime: { framework: "eve", model: "echo" },
  });
  console.log("ingested seq", ev.sequence, ev.eventType, ev.payloadHash);
  const v1 = await svc.verify(maestro.agentId, 1);
  const v2 = await svc.verify(maestro.agentId, ev.sequence);
  console.log("verify genesis.created", v1.ok, JSON.stringify(v1.checks));
  console.log("verify model.completed", v2.ok, JSON.stringify(v2.checks));
  const batch = await svc.anchor(maestro.agentId);
  console.log(
    "anchored",
    batch.root,
    `${batch.fromSequence}-${batch.toSequence}`,
    batch.anchor.kind,
  );
  const v3 = await svc.verify(maestro.agentId, ev.sequence);
  console.log("verify with merkle", v3.ok, JSON.stringify(v3.checks));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
