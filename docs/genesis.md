# MSTRMND Genesis

An agent’s identity is not its prompt or model. It is a persistent Ed25519
key, an immutable genesis manifest, and a signed history of every subsequent
state transition.

This document is the runtime contract for slice 1. Product positioning:

> MSTRMND Genesis gives every AI agent a persistent identity, attributable
> memory, and verifiable operational history — independent of which model
> provides its intelligence.

## Identity algorithm

1. Generate an Ed25519 keypair (`node:crypto`).
2. Store the private key in the keystore adapter — never under `agent/` or in
   the event ledger.
3. Build a canonical Genesis Manifest (`mstrmnd.genesis/v1`).
4. RFC 8785 canonicalize → SHA-256 → Ed25519 sign.
5. Permanent id:

```
agent_id = "mstrmnd:agent:" + base64url(sha256(ed25519_public_key))
```

No padding; the digest encoding is 43 characters. The same public key also
resolves as `did:key:z6Mk…` (multicodec `0xed01` + base58btc).

The key is stable. Instructions, skills, models, permissions, and memories
evolve as signed version events. Subagents receive their own keypairs with
`lineage.parentAgentId` set — they are different agents, not aliases.

`IdentityModel` (values/interests loaded from `identity.md`) remains the
profile projection. Genesis hashes that artifact; it does not replace it.

## Witness model

The agent runtime is not trusted to audit itself.

```
Eve hook / Hermes orchestrator
        │  unsigned observation
        ▼
Execution witness (Next.js API or Hermes process)
        │  agent signature + platform witness signature
        ▼
Append-only ledger (Postgres or JSONL)
        │
        ▼
Merkle batch → anchor adapter (log default)
```

- **Agent signature** — the witness process holds the agent key handle and
  signs the canonical event, attributed to that agent.
- **Witness signature** — a distinct platform key (`mstrmnd:witness:platform`)
  signs that the event was accepted and sequenced.
- Eve hooks POST observations and never see private keys.

Honest limit for this slice: a compromised agent can skip emitting. Tamper
evidence starts once an event is accepted. Blocking direct model/tool egress
is a later execution-gateway slice — do not claim it here.

## What the system claims

The complete system is:

- Append-only at the application layer (the store refuses `UPDATE`/`DELETE`
  of events)
- Tamper-evident through hash chaining (`previousEventHash`)
- Externally witnessed through Merkle-root anchoring (`MSTRMND_ANCHOR=log`
  writes the root locally; `evm` / Rekor are typed seams only)
- Cryptographically attributable through dual Ed25519 signatures

That is a more defensible claim than “the database is immutable.”

## Capture / redact

v1 event types: `genesis.created`, `identity.amended`,
`instructions.versioned`, `model.completed`, `tool.proposed`, `tool.approved`,
`tool.execution.completed`, `memory.written`, `memory.superseded`,
`subagent.spawned`, `policy.decided`, `run.completed`, `error.raised`.

Redacted before hash: API keys, credentials, secret-shaped headers, oversized
file bodies (replaced with a hash). Hidden model chain-of-thought is not
captured.

## Memory

Four kinds, one mutation rule — never silent mutate.

- Identity — versioned constitutional amendment events
- Episodic — the event chain itself
- Semantic — a new record `supersedes` the old (`reason`, `sourceEventId`)
- Procedural — hashed skill/tool artifacts plus source events

Third-Mind writes append a new row and point `supersedes` at the previous
current record. `read`/`search`/`list` return the current view; history
remains readable by id.

## Packages and adapters

| Piece | Where |
|---|---|
| Protocol + crypto | `@mstrmnd/genesis` (Node builtins only) |
| Types re-export | `@mstrmnd/schemas` |
| Hermes adapter | `packages/intelligence-core` orchestrator → JSONL ledger |
| Eve adapter | `mstrmnd-os/agent/hooks/genesis-witness.ts` → `/api/genesis/ingest` |
| Witness + UI | `mstrmnd-os` Foundry, Genesis ID, Chronicle |

Keystore: `MSTRMND_KEYSTORE=local` (default encrypted files under
`.mstrmnd/keystore`). AWS KMS, GCP KMS, and Turnkey implement the same
`Keystore` interface.

Anchor: `MSTRMND_ANCHOR=log` (default). Live Base/EVM and ERC-8004 are out of
this slice.

## Verify

Chronicle’s “Verify this event” checks:

1. Agent signature over the canonical unsigned event
2. Witness signature over the same bytes
3. `previousEventHash` matches the prior event (or null at sequence 1)
4. Optional Merkle inclusion against the latest batch

Hermes still writes `.mstrmnd/audit.jsonl`. That file is a projection.
`GenesisEvent` is the canonical ledger.
