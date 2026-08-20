import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AGENT_ID_PREFIX,
  LocalKeystore,
  JsonlLedger,
  acceptObservation,
  agentIdFromPublicKey,
  canonicalize,
  currentMemoryView,
  didKeyFromPublicKey,
  eventHash,
  generateEd25519,
  inclusionProof,
  isAgentId,
  issueGenesis,
  merkleOfNamedBlobs,
  merkleRoot,
  publicKeyMultibase,
  redact,
  sha256Prefixed,
  supersedeMemory,
  verifyEvent,
  verifyInclusion,
  verifyManifest,
  WITNESS_HANDLE,
  type MemoryRecord,
} from "../src/index.ts";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "genesis-"));
}

describe("identity", () => {
  it("derives a 43-char base64url agent id from the public key", () => {
    const { publicKeyRaw } = generateEd25519();
    const id = agentIdFromPublicKey(publicKeyRaw);
    assert.equal(id.startsWith(AGENT_ID_PREFIX), true);
    assert.equal(id.length, AGENT_ID_PREFIX.length + 43);
    assert.equal(isAgentId(id), true);
    assert.match(id.slice(AGENT_ID_PREFIX.length), /^[A-Za-z0-9_-]{43}$/);
  });

  it("exposes did:key and multibase z6Mk for the same key", () => {
    const { publicKeyRaw } = generateEd25519();
    const mb = publicKeyMultibase(publicKeyRaw);
    const did = didKeyFromPublicKey(publicKeyRaw);
    assert.equal(mb.startsWith("z6Mk"), true);
    assert.equal(did, `did:key:${mb}`);
  });
});

describe("JCS", () => {
  it("is stable under key reordering", () => {
    const a = canonicalize({ b: 1, a: { d: true, c: "x" } });
    const b = canonicalize({ a: { c: "x", d: true }, b: 1 });
    assert.equal(a, b);
    assert.equal(a, '{"a":{"c":"x","d":true},"b":1}');
  });
});

describe("keystore + genesis issue", () => {
  it("signs and verifies a genesis manifest", async () => {
    const ks = new LocalKeystore({ dir: join(tmp(), "ks"), secret: "test" });
    const issued = await issueGenesis({
      keystore: ks,
      name: "Maestro",
      controller: { type: "organization", id: "mstrmnd.ai" },
      identity: {
        purpose: "Coordinate MSTRMND operations",
        values: ["accuracy", "initiative", "traceability"],
        boundaries: ["no unapproved financial transactions"],
      },
      runtimePolicy: {
        frameworks: ["eve", "hermes"],
        modelPolicy: "gateway/model-agnostic",
        approvalPolicy: "risk-tiered",
      },
      artifacts: {
        instructionsHash: sha256Prefixed("instructions"),
        skillsRoot: sha256Prefixed("skills"),
        toolsRoot: sha256Prefixed("tools"),
        policyHash: sha256Prefixed("policy"),
      },
    });
    assert.equal(isAgentId(issued.signed.agentId), true);
    assert.equal(await verifyManifest(issued.signed, issued.publicKeyRaw), true);
    const again = await issueGenesis({
      keystore: ks,
      name: "Maestro",
      controller: { type: "organization", id: "mstrmnd.ai" },
      identity: issued.signed.manifest.identity,
      runtimePolicy: issued.signed.manifest.runtimePolicy,
      artifacts: issued.signed.manifest.artifacts,
    });
    assert.equal(again.signed.agentId, issued.signed.agentId);
  });
});

describe("ledger chain", () => {
  it("appends a dual-signed hash chain and detects tampering", async () => {
    const dir = tmp();
    const ks = new LocalKeystore({ dir: join(dir, "ks"), secret: "test" });
    const ledger = new JsonlLedger(join(dir, "ledger"));
    const issued = await issueGenesis({
      keystore: ks,
      name: "Maestro",
      controller: { type: "organization", id: "mstrmnd.ai" },
      identity: { purpose: "p", values: ["v"], boundaries: [] },
      runtimePolicy: {
        frameworks: ["hermes"],
        modelPolicy: "echo",
        approvalPolicy: "risk-tiered",
      },
      artifacts: {
        instructionsHash: sha256Prefixed(""),
        skillsRoot: sha256Prefixed(""),
        toolsRoot: sha256Prefixed(""),
        policyHash: sha256Prefixed(""),
      },
    });

    const e1 = await acceptObservation({
      observation: {
        agentId: issued.signed.agentId,
        eventType: "genesis.created",
        payload: { manifestHash: issued.signed.manifestHash },
        runtime: { framework: "hermes" },
      },
      ledger,
      keystore: ks,
      agentHandle: issued.handle,
    });
    const e2 = await acceptObservation({
      observation: {
        agentId: issued.signed.agentId,
        eventType: "model.completed",
        payload: { text: "hello" },
        runtime: { framework: "hermes", model: "echo" },
        runId: "run_1",
      },
      ledger,
      keystore: ks,
      agentHandle: issued.handle,
    });

    assert.equal(e1.sequence, 1);
    assert.equal(e1.previousEventHash, null);
    assert.equal(e2.sequence, 2);
    assert.equal(e2.previousEventHash, eventHash(e1));

    const agentPub = await ks.getPublicKey(issued.handle);
    const witnessPub = await ks.getPublicKey(WITNESS_HANDLE);
    const ok = await verifyEvent({
      event: e2,
      previous: e1,
      agentPublicKey: agentPub,
      witnessPublicKey: witnessPub,
    });
    assert.equal(ok.ok, true);

    const tampered = { ...e2, payloadHash: sha256Prefixed("mutated") };
    const bad = await verifyEvent({
      event: tampered,
      previous: e1,
      agentPublicKey: agentPub,
      witnessPublicKey: witnessPub,
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.checks.agentSignature, false);

    await assert.rejects(
      () => ledger.append(e1),
      /refuses rewrite/,
    );
  });
});

describe("merkle", () => {
  it("proves inclusion of a leaf", () => {
    const leaves = ["a", "b", "c", "d", "e"].map((s) => sha256Prefixed(s));
    const root = merkleRoot(leaves);
    for (let i = 0; i < leaves.length; i++) {
      const proof = inclusionProof(leaves, i);
      assert.equal(proof.root, root);
      assert.equal(verifyInclusion(proof), true);
    }
    const broken = inclusionProof(leaves, 0);
    broken.leaf = leaves[1];
    assert.equal(verifyInclusion(broken), false);
  });

  it("hashes named blobs in sorted order", () => {
    const a = merkleOfNamedBlobs([
      { name: "b.md", content: "b" },
      { name: "a.md", content: "a" },
    ]);
    const b = merkleOfNamedBlobs([
      { name: "a.md", content: "a" },
      { name: "b.md", content: "b" },
    ]);
    assert.equal(a, b);
  });
});

describe("redaction", () => {
  it("strips credential-shaped fields and values", () => {
    const out = redact({
      tool: "http",
      api_key: "sk-live-super-secret",
      headers: { Authorization: "Bearer abcdefghijklmnop" },
      nested: { password: "hunter2", ok: true },
    }) as Record<string, unknown>;
    assert.equal(out.api_key, "[redacted]");
    assert.equal((out.nested as Record<string, unknown>).password, "[redacted]");
    assert.equal((out.nested as Record<string, unknown>).ok, true);
    assert.equal(out.tool, "http");
  });
});

describe("memory supersession", () => {
  it("keeps history and returns the latest current view", () => {
    const first: MemoryRecord = {
      id: "memory_144",
      kind: "semantic",
      key: "alliance.positioning",
      content: "old",
      createdAt: "2026-08-01T00:00:00Z",
    };
    const second = supersedeMemory(first, {
      id: "memory_291",
      kind: "semantic",
      key: "alliance.positioning",
      content: "new",
      reason: "contradicted_by_user",
      sourceEventId: "evt_9F3",
      createdAt: "2026-08-17T00:00:00Z",
    });
    assert.equal(second.supersedes, "memory_144");
    const view = currentMemoryView([first, second]);
    assert.equal(view.length, 1);
    assert.equal(view[0].id, "memory_291");
  });
});
