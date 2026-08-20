import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import {
  JsonAgentRegistry,
  JsonlLedger,
  LocalKeystore,
  acceptObservation,
  batchEvents,
  eventHash,
  inclusionProof,
  issueGenesis,
  merkleOfNamedBlobs,
  selectAnchor,
  sha256Prefixed,
  verifyEvent,
  verifyManifest,
  WITNESS_HANDLE,
  type AgentRecord,
  type AgentRegistry,
  type GenesisEvent,
  type Keystore,
  type LedgerStore,
  type MerkleBatch,
  type SignedGenesis,
  type UnsignedObservation,
  type VerifyResult,
} from "@mstrmnd/genesis";
import { hasDatabase } from "./db";
import {
  PostgresAgentRegistry,
  PostgresLedger,
  insertBatch,
  latestBatch as pgLatestBatch,
} from "./genesis-ledger";

const SUBAGENTS = [
  {
    id: "researcher",
    purpose: "Deep research and source synthesis",
    dir: join("agent", "subagents", "researcher"),
  },
  {
    id: "critic",
    purpose: "Adversarial review and risk surfacing",
    dir: join("agent", "subagents", "critic"),
  },
  {
    id: "memory-keeper",
    purpose: "Curate the Third-Mind observation layer",
    dir: join("agent", "subagents", "memory-keeper"),
  },
] as const;

export interface FoundryInput {
  name: string;
  purpose: string;
  values: string[];
  boundaries: string[];
  controllerType: string;
  controllerId: string;
  modelPolicy: string;
  approvalPolicy: string;
  bindSubagents?: boolean;
}

export interface GenesisService {
  keystore: Keystore;
  ledger: LedgerStore;
  registry: AgentRegistry;
  issue(workspaceId: string, input: FoundryInput): Promise<AgentRecord[]>;
  ingest(
    observation: UnsignedObservation,
    opts?: { workspaceId?: string },
  ): Promise<GenesisEvent>;
  listAgents(workspaceId: string): Promise<AgentRecord[]>;
  getAgent(agentId: string): Promise<AgentRecord | null>;
  listEvents(agentId: string, limit?: number): Promise<GenesisEvent[]>;
  getEvent(agentId: string, sequence: number): Promise<GenesisEvent | null>;
  verify(agentId: string, sequence: number): Promise<VerifyResult>;
  anchor(agentId: string): Promise<MerkleBatch>;
  latestBatch(agentId: string): Promise<MerkleBatch | null>;
}

function rootDir(): string {
  return process.cwd();
}

function genesisDir(): string {
  return join(rootDir(), ".mstrmnd", "genesis");
}

function keystoreDir(): string {
  return join(rootDir(), ".mstrmnd", "keystore");
}

function collectFiles(dir: string): Array<{ name: string; content: string }> {
  if (!existsSync(dir)) return [];
  const out: Array<{ name: string; content: string }> = [];
  const walk = (d: string) => {
    for (const ent of readdirSync(d)) {
      if (ent.startsWith(".")) continue;
      const p = join(d, ent);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.isFile()) {
        out.push({
          name: relative(dir, p).replace(/\\/g, "/"),
          content: readFileSync(p, "utf8"),
        });
      }
    }
  };
  walk(dir);
  return out;
}

export function hashAgentArtifacts(agentDir: string): {
  instructionsHash: string;
  skillsRoot: string;
  toolsRoot: string;
  policyHash: string;
} {
  const instructions = join(agentDir, "instructions.md");
  const instructionsHash = existsSync(instructions)
    ? sha256Prefixed(readFileSync(instructions))
    : sha256Prefixed("");
  const skillsRoot = merkleOfNamedBlobs(collectFiles(join(agentDir, "skills")));
  const toolsRoot = merkleOfNamedBlobs(collectFiles(join(agentDir, "tools")));
  const agentTs = join(agentDir, "agent.ts");
  const policyHash = existsSync(agentTs)
    ? sha256Prefixed(readFileSync(agentTs))
    : sha256Prefixed("");
  return { instructionsHash, skillsRoot, toolsRoot, policyHash };
}

function writePublicGenesis(agentDir: string, signed: SignedGenesis): void {
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(
    join(agentDir, "genesis.json"),
    JSON.stringify(signed, null, 2) + "\n",
    "utf8",
  );
}

function fileBatchesPath(): string {
  return join(genesisDir(), "batches.json");
}

function loadFileBatches(): MerkleBatch[] {
  if (!existsSync(fileBatchesPath())) return [];
  try {
    const parsed = JSON.parse(readFileSync(fileBatchesPath(), "utf8"));
    return Array.isArray(parsed) ? (parsed as MerkleBatch[]) : [];
  } catch {
    return [];
  }
}

function saveFileBatches(rows: MerkleBatch[]): void {
  mkdirSync(dirname(fileBatchesPath()), { recursive: true });
  writeFileSync(fileBatchesPath(), JSON.stringify(rows, null, 2), "utf8");
}

export function createGenesisService(): GenesisService {
  const keystore = new LocalKeystore({ dir: keystoreDir() });
  const usePg = hasDatabase();
  const ledger: LedgerStore = usePg
    ? new PostgresLedger()
    : new JsonlLedger(join(genesisDir(), "events"));
  const registry: AgentRegistry = usePg
    ? new PostgresAgentRegistry()
    : new JsonAgentRegistry(join(genesisDir(), "agents.json"));

  async function persistIssued(
    workspaceId: string,
    issued: {
      signed: SignedGenesis;
      handle: string;
    },
    agentDir: string,
  ): Promise<AgentRecord> {
    const record: AgentRecord = {
      agentId: issued.signed.agentId,
      name: issued.signed.manifest.name,
      workspaceId,
      keyHandle: issued.handle,
      signed: issued.signed,
      createdAt: issued.signed.manifest.createdAt,
    };
    await registry.put(record);
    writePublicGenesis(join(rootDir(), agentDir), issued.signed);
    const tip = await ledger.getTip(record.agentId);
    if (!tip) {
      await acceptObservation({
        observation: {
          agentId: record.agentId,
          eventType: "genesis.created",
          payload: { manifestHash: issued.signed.manifestHash },
          runtime: { framework: "eve" },
        },
        ledger,
        keystore,
        agentHandle: issued.handle,
      });
    }
    return record;
  }

  return {
    keystore,
    ledger,
    registry,

    async issue(workspaceId, input) {
      const existing = await registry.getByName(workspaceId, input.name);
      if (existing) {
        const all = await registry.list(workspaceId);
        return all.filter(
          (a) =>
            a.agentId === existing.agentId ||
            a.signed.manifest.lineage.parentAgentId === existing.agentId,
        );
      }

      const maestroDir = "agent";
      const issued = await issueGenesis({
        keystore,
        name: input.name,
        workspaceId,
        controller: { type: input.controllerType, id: input.controllerId },
        identity: {
          purpose: input.purpose,
          values: input.values,
          boundaries: input.boundaries,
        },
        runtimePolicy: {
          frameworks: ["eve", "hermes"],
          modelPolicy: input.modelPolicy,
          approvalPolicy: input.approvalPolicy,
        },
        artifacts: hashAgentArtifacts(join(rootDir(), maestroDir)),
        lineage: { parentAgentId: null, generation: 0 },
      });
      if (!(await verifyManifest(issued.signed, issued.publicKeyRaw))) {
        throw new Error("issued manifest failed signature verification");
      }
      const records: AgentRecord[] = [
        await persistIssued(workspaceId, issued, maestroDir),
      ];

      if (input.bindSubagents !== false) {
        for (const sub of SUBAGENTS) {
          const child = await issueGenesis({
            keystore,
            name: sub.id,
            workspaceId,
            controller: { type: input.controllerType, id: input.controllerId },
            identity: {
              purpose: sub.purpose,
              values: input.values,
              boundaries: input.boundaries,
            },
            runtimePolicy: {
              frameworks: ["eve"],
              modelPolicy: input.modelPolicy,
              approvalPolicy: input.approvalPolicy,
            },
            artifacts: hashAgentArtifacts(join(rootDir(), sub.dir)),
            lineage: {
              parentAgentId: issued.signed.agentId,
              generation: 1,
            },
          });
          records.push(await persistIssued(workspaceId, child, sub.dir));
        }
      }
      return records;
    },

    async ingest(observation, opts) {
      const record =
        (await registry.get(observation.agentId)) ??
        (opts?.workspaceId
          ? await registry.getByName(opts.workspaceId, observation.agentId)
          : null);
      if (!record) {
        throw new Error(`unknown agent: ${observation.agentId}`);
      }
      return acceptObservation({
        observation: {
          ...observation,
          agentId: record.agentId,
          actor: observation.actor ?? { agentId: record.agentId },
          runtime: observation.runtime ?? { framework: "eve" },
        },
        ledger,
        keystore,
        agentHandle: record.keyHandle,
      });
    },

    listAgents(workspaceId) {
      return registry.list(workspaceId);
    },

    getAgent(agentId) {
      return registry.get(agentId);
    },

    listEvents(agentId, limit = 200) {
      return ledger.list(agentId, { limit });
    },

    getEvent(agentId, sequence) {
      return ledger.get(agentId, sequence);
    },

    async verify(agentId, sequence) {
      const event = await ledger.get(agentId, sequence);
      if (!event) throw new Error("event not found");
      const previous =
        sequence > 1 ? await ledger.get(agentId, sequence - 1) : null;
      const record = await registry.get(agentId);
      if (!record) throw new Error("unknown agent");
      const agentPublicKey = await keystore.getPublicKey(record.keyHandle);
      const witnessPublicKey = await keystore.getPublicKey(WITNESS_HANDLE);
      const batch = await this.latestBatch(agentId);
      let merkle;
      if (batch) {
        const idx = batch.eventHashes.indexOf(eventHash(event));
        if (idx >= 0) merkle = inclusionProof(batch.eventHashes, idx);
      }
      return verifyEvent({
        event,
        previous,
        agentPublicKey,
        witnessPublicKey,
        merkle,
      });
    },

    async anchor(agentId) {
      const events = await ledger.list(agentId);
      if (events.length === 0) throw new Error("no events to anchor");
      const existing = await this.latestBatch(agentId);
      const start = existing ? existing.toSequence : 0;
      const slice = events.filter((e) => e.sequence > start);
      if (slice.length === 0) {
        if (existing) return existing;
        throw new Error("no new events to anchor");
      }
      const batch = await batchEvents(
        agentId,
        slice,
        selectAnchor(process.env.MSTRMND_ANCHOR),
      );
      if (hasDatabase()) await insertBatch(batch);
      else {
        const rows = loadFileBatches();
        rows.push(batch);
        saveFileBatches(rows);
      }
      return batch;
    },

    async latestBatch(agentId) {
      if (hasDatabase()) return pgLatestBatch(agentId);
      const rows = loadFileBatches().filter((b) => b.agentId === agentId);
      return rows[rows.length - 1] ?? null;
    },
  };
}

let singleton: GenesisService | null = null;

export function genesisService(): GenesisService {
  if (!singleton) singleton = createGenesisService();
  return singleton;
}
