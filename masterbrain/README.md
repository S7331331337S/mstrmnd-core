# MASTERBRAIN

> The Council of Twelve as an operating system.

15 archetypes. 6 closed-loop phases. Memory that compounds.

```
                            ┌──────────────────────────┐
        SIGNAL  ────────►   │   1. INTAKE              │
                            │   2. ROUTING   (NEXUS)   │
                            │   3a. PRIORS   (CANON)   │
                            │   3b. DELIBERATE (12)    │
                            │   3c. ADVERSARY (HEX)    │
                            │   4. SYNTHESIS (NEXUS)   │
                            └──────────────────────────┘
                                       │
                                       ▼
                            ┌──────────────────────────┐
                            │   5. EXECUTION           │
                            │      (Asana, GitHub, …)  │
                            └──────────────────────────┘
                                       │
                                       ▼
                            ┌──────────────────────────┐
                            │   6. CLOSURE             │
                            │      → CANON ingests     │
                            │      → patterns accrue   │
                            └──────────────────────────┘
                                       │
                                       └──► priors for next loop
```

## The 15 Archetypes

| Layer       | Archetype       | Agent     | Owns |
|-------------|-----------------|-----------|------|
| Capital     | The Allocator   | `LEDGER`  | Capital decisions, runway, ROI |
| Capital     | The Strategist  | `AXIOM`   | Direction, positioning, where to point |
| Building    | The Architect   | `FORGE`   | Systems, infra, technical architecture |
| Building    | The Artisan     | `CANVAS`  | Design, brand, visual taste |
| Building    | The Researcher  | `SCOUT`   | Frontier research, market intel |
| Operating   | The Steward     | `CIPHER`  | Day-to-day ops, security, compliance |
| Operating   | The Closer      | `ENVOY`   | Deal mechanics, pricing, conversion |
| Operating   | The Grower      | `VECTOR`  | Distribution, channels, compounding growth |
| Network     | The Herald      | `HERALD`  | Outbound comms, announcements |
| Network     | The Connector   | `WEAVER`  | Relationship graph, intro routing |
| Network     | The Storyteller | `BARD`    | Long-form narrative, brand voice |
| Vision      | The Oracle      | `ORACLE`  | Pattern synthesis across layers |
| **Meta**    | The Orchestrator| `NEXUS`   | Convenes, routes, synthesizes (never deliberates) |
| **Meta**    | The Elder       | `CANON`   | Memory. Surfaces priors. Ingests outcomes. |
| **Meta**    | The Adversary   | `HEX`     | Red-teams every consequential decision |

CANON and HEX are not optional. They are the structural forces that make the system get smarter over time and keep the council honest. Disable them and you have an expensive Slack channel.

## Quickstart

```bash
# 1. Install
pnpm install

# 2. Provision Supabase
#    Run the migrations in order against your Supabase project:
#    packages/db/migrations/0001_initial.sql
#    packages/db/migrations/0002_seed_archetypes.sql
#    packages/db/migrations/0003_rpcs.sql

# 3. Configure
cp .env.example .env.local
# Fill in: ANTHROPIC_API_KEY, SUPABASE_*

# 4. Run the dev server
pnpm dev

# 5. Sanity-test the loop end-to-end (needs a real key + Supabase)
pnpm council:test

# ...or exercise it with no credentials at all:
#   PGlite runs the real migrations, a local server speaks the
#   Anthropic wire format, and the real loop runs against both.
pnpm verify
```

## Architecture

The codebase is a pnpm monorepo with one app and five packages:

```
apps/masterbrain/              # Next.js 15 App Router
  app/api/signals/ingest/      # POST: run the loop on a new signal
  app/api/council/deliberate/  # POST: lower-level loop trigger
  app/api/canon/query/         # POST: surface priors for a signal
  app/api/canon/ingest/        # POST: record outcome, extract patterns

packages/agents/               # The 15 archetypes
  base/agent.ts                # Base class — shared invocation contract
  council/{12 agents}/         # The deliberating council
  meta/{canon,hex}/            # Memory + adversary
  council/nexus/               # The orchestrator (does not deliberate)

packages/orchestration/        # The closed-loop pipeline
packages/canon/                # Memory system (pgvector-backed)
packages/db/                   # Supabase client + migrations
packages/integrations/         # Asana, GitHub, Slack adapters
packages/shared/               # Types + env validation
```

## Why this works (and what to know before you ship)

**1. CANON and HEX are not optional features.** They are the structural forces that make this different from a multi-agent Slack channel. Without CANON, every decision starts from scratch and you waste tokens re-discovering things you already knew. Without HEX, the council converges on consensus and rationalizes the convergence. Together they make the system *get sharper over time*.

**2. NEXUS doesn't deliberate.** This is a discipline. The orchestrator routes and synthesizes — the moment NEXUS starts having opinions on substance, it biases everything downstream. Keep NEXUS on `claude-sonnet-5` for speed, and never give it deliberation prompts.

**3. The 12 council agents run in parallel.** One agent's failure doesn't collapse the council — each deliberation is wrapped in its own try/catch inside a `Promise.all`. This is intentional: partial deliberation is better than no deliberation when an agent times out or hits a rate limit. An *empty* quorum is different, and fails the loop.

**4. CANON has no memory until you configure embeddings.** `Canon.embed()` calls Voyage or OpenAI when `EMBEDDINGS_PROVIDER` and `EMBEDDINGS_API_KEY` are set, and `queryPriors()` returns `[]` when they are not.

There is deliberately no fallback. The original placeholder summed character codes into positional buckets, which makes similarity track text length rather than meaning: across 15 pairs of test signals every score landed between 0.88 and 0.94 — all of them clearing the 0.70 retrieval threshold — with 0.003 separating the mean of same-topic pairs from the mean of unrelated ones. Priors are injected into every council prompt as earned wisdom, so a wrong prior is worse than no prior. Patterns still accrue while embeddings are unconfigured; they are stored with a null embedding and become retrievable once you backfill.

**5. The MCP endpoint at `/api/mcp` is where this connects to your existing Claude Code / Claude Desktop setup.** Implement it once and you get the council as a tool inside every Claude conversation.

## The loop in code

The whole closed loop is one function: `runLoop(signal)` in `packages/orchestration/index.ts`. Read it. It is ~120 lines. Everything else is supporting infrastructure.

```ts
import { runLoop } from '@masterbrain/orchestration';

const decision = await runLoop({
  source: 'asana',
  kind: 'pricing_decision',
  severity: 'high',
  context: 'Setting v1 take rate. 10% or 15%.',
  payload: { options: ['10%', '15%'] },
});

// decision.resolution  → the synthesized answer
// decision.reasoning   → why
// decision.dissent     → what HEX argued, overridden
// decision.confidence  → 0.0–1.0
```

## What's stubbed vs real

**Before you deploy anything:** set `MASTERBRAIN_API_TOKEN`. Every mutating route requires it and refuses to serve without it. `/api/canon/ingest` writes to the pattern store that feeds every future deliberation — an open write there is an open write to the system's memory.

**Real:**
- Base agent class, full invocation contract
- NEXUS (routing + synthesis)
- HEX (adversarial review with overridden prompt)
- CANON (semantic retrieval + outcome ingestion + pattern extraction)
- The orchestration pipeline (`runLoop`)
- All API routes (`signals/ingest`, `canon/query`, `canon/ingest`), bearer-gated
- DB schema + migrations + RPCs, RLS on every table
- All 12 council personas (locked-in voice, ready to invoke)

**Stubbed (intentionally — fill in as you go):**
- Each council agent's body beyond the persona (the base class handles everything; subclasses can override `buildPrompt` for archetype-specific framing)
- Integration adapters (Asana, GitHub, Slack) — wire to your existing MSTRMND Labs setup
- The dashboard UI under `app/(dashboard)/*` — placeholders for now
- The MCP endpoint `app/api/mcp/route.ts` — adapt your existing implementation

## Deploy

```bash
# From the repo root
vercel link --project masterbrain-os --scope mstrmndhub
vercel env pull .env.local
vercel deploy --prod
```

Then point `masterbrain.mstrmnd.io` at the Vercel deployment.

## License

Internal — MSTRMND Labs.
