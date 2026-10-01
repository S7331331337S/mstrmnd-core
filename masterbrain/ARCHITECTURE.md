# MASTERBRAIN — Architecture

This document explains *why* the codebase is shaped the way it is. The README covers *what* and *how*. Read this if you're about to change something structural.

---

## The thesis

A multi-agent system without **memory** and **structured disagreement** is a vibes engine — it produces plausible-sounding outputs that don't compound. Most agent frameworks ship with neither. MASTERBRAIN is built around both, treated as first-class architectural concerns.

The 12 council archetypes are not the innovation. The structural elements that make the 12 useful are:

- **NEXUS** — never deliberates. Discipline.
- **CANON** — every decision and outcome accrues. The system gets smarter over time without re-prompting.
- **HEX** — auto-invoked. The forced no. Prevents groupthink-as-a-service.

Lose any one of those three and the system degrades to "expensive group chat."

---

## The closed loop, in detail

### Phase 1 — Intake

A signal arrives via one of:
- `POST /api/signals/ingest` (the canonical entry point)
- `POST /api/webhooks/{asana,github,slack}` (event-driven from external systems)
- A scheduled cron (e.g., weekly strategic review)
- A direct call from Claude via the MCP endpoint at `/api/mcp`

The signal is normalized to the `Signal` type (see `packages/shared/index.ts`) and persisted in `signals` table. Every signal has a `kind` (the classifier — `pricing_decision`, `feature_proposal`, `incident`, etc.) and a `severity`.

### Phase 2 — Routing (NEXUS)

NEXUS receives the signal and returns a `QuorumPlan` — which archetypes are *primary* voices, which are *consulted* voices.

Routing is intentionally a small, fast call (`claude-sonnet-5`, not Opus). It is not the place to be precious. The quality of the routing matters less than the consistency.

Routing rules NEXUS enforces:
- Never routes to itself, CANON, or HEX (those are auto-invoked at fixed phases)
- Quorum sizing scales with severity
- A signal's `kind` is the primary signal for which archetypes get invoked

### Phase 3a — Priors (CANON)

CANON queries the pattern store via pgvector semantic search. Returns the top-K most relevant patterns from prior decisions, each with:
- A similarity score (0–1)
- A confidence score (how often this pattern has been validated)
- The source decisions it was extracted from

Priors are passed to every deliberating agent.

### Phase 3b — Deliberation (council in parallel)

The routed quorum agents deliberate in parallel via `Promise.all`, each wrapped in its own try/catch. Each agent receives:
- The signal
- The priors from CANON
- Its own persona

Each returns a `DeliberationOutput`:
```ts
{
  archetype_id: 'strategist',
  position: 'Take the 10% rate. Premium positioning compounds.',
  confidence: 0.75,
  reasoning: {
    assumptions: [...],
    evidence: [...],
    tradeoffs: [...]
  }
}
```

**One agent's failure does not collapse the council.** Each deliberation is wrapped
in its own try/catch inside a `Promise.all`, so a timeout or rate limit costs one
voice rather than the round. Partial deliberation > no deliberation.

**An empty quorum is not partial deliberation.** If routing returns nothing
routable, `runLoop` throws rather than synthesizing a decision with no council
behind it.

### Phase 3c — Adversarial review (HEX)

HEX runs *after* the council. It receives the same signal + priors, plus all peer positions. Its only job: produce the strongest argument *against* the emerging consensus.

HEX is on `claude-opus-5` (not Sonnet) because adversarial reasoning is the place to spend tokens. If HEX is weak, the loop is weak.

### Phase 4 — Synthesis (NEXUS)

NEXUS takes:
- The deliberations
- The adversary's position
- The priors

And synthesizes a `Decision`:
```ts
{
  title: 'Set MSTRMND v1 take rate at 10%',
  resolution: '...',
  reasoning: '...',
  dissent: '...',         // HEX's argument, preserved
  confidence: 0.72,
}
```

**The dissent is preserved on the decision row.** This is critical. When CANON later ingests the outcome, it can see what was overridden and learn whether the override was correct.

### Phase 5 — Execution

The decision routes to building agents who own external systems:
- FORGE opens PRs via GitHub MCP
- CIPHER files Asana tasks
- HERALD drafts the announcement
- LEDGER updates the financial model

Execution is async and tracked per action in `executions` table.

### Phase 6 — Closure

When reality returns a verdict, `POST /api/canon/ingest` records the outcome. CANON:
1. Persists the outcome
2. Increments `times_used` and (if validated) `times_validated` on the priors that informed the decision
3. Asks the memory model to extract new patterns from this case
4. Embeds and persists the new patterns

**The next loop starts with better priors.** This is the compounding effect.

---

## Why pnpm monorepo

- Shared types across the agents, the orchestration layer, and the app
- One install, one typecheck, one deploy
- Cheap to add a 16th archetype or extract a package later
- Native Vercel support (workspaces just work)

## Why Next.js App Router

- The existing MSTRMND Labs stack is Next.js 15
- Route handlers (`app/api/.../route.ts`) are a clean fit for the signal/decision API
- Server Components for the dashboard
- Native Vercel AI Gateway integration
- The same app can also host the MCP server endpoint

## Why Supabase

- Already in your stack (`bpuwiwaibuwlkdjhdxnn`)
- Postgres with pgvector available natively
- RLS available for when the dashboard goes public
- Auth available if HERALD/WEAVER ever need to act on behalf of users

## Why Vercel AI Gateway

- Caching of repeated prompts (the council asks similar questions across signals)
- Cost tracking per agent
- Single retry/timeout policy
- Provider failover (if Anthropic has an incident, can route to a backup)

---

## What I deliberately did *not* build

**A shared agent state machine.** Every framework tries to ship one. They are all wrong because the right state machine for routing differs from the right one for adversarial review which differs from the right one for synthesis. Better: three explicit functions in `orchestration/index.ts` that you can read top to bottom.

**A "tools" abstraction.** When an agent needs a tool, it calls the integration directly. Adding a tool layer that wraps everything would obscure what's actually happening at no real benefit. If we need tool-calling later, we'll add it where it earns its weight.

**An agent-to-agent message bus.** The council does not chat. It deliberates in parallel and synthesizes through NEXUS. A message bus would create emergent loops we can't reason about. If two agents need to confer, that's a signal NEXUS should re-route, not a feature.

**Streaming responses to the client.** The loop is async. The client gets a decision when there is one. Streaming individual agent deliberations is a fun demo and a bad product — users get noise, not a decision. The dashboard can show in-flight deliberations via Supabase Realtime if you want that view.

---

## Performance notes

| Phase             | Model                      | Approx tokens  | Approx latency |
|-------------------|----------------------------|----------------|----------------|
| Routing           | `claude-sonnet-5`          | ~800 in / 200 out | ~1s |
| Each deliberation | `claude-opus-5`            | ~1500 in / 600 out | ~4s |
| HEX               | `claude-opus-5`            | ~2500 in / 600 out | ~4s |
| Synthesis         | `claude-opus-5`            | ~4000 in / 800 out | ~5s |
| CANON query       | (embedding + pgvector)     | – | ~200ms |
| CANON ingest      | `claude-haiku-4-5`         | ~2000 in / 400 out | ~2s |

End-to-end loop on a medium-severity signal with 4 deliberating agents: **~12 seconds**.

For Vercel: `signals/ingest` sets `maxDuration = 60`. Check the current per-plan
ceiling before relying on it — the limits have moved, and a loop that exceeds it
is killed mid-synthesis after the council has already been paid for.

---

## Future architecture moves

When the system is real:

1. **Replace pseudo-embeddings.** Wire `Canon.embed()` to Voyage AI or OpenAI. Single biggest quality win.
2. **Add the MCP server.** Make MASTERBRAIN callable from Claude Desktop / Claude Code as a tool. The council becomes ambient.
3. **Add Realtime subscriptions** to the dashboard for in-flight deliberation views (Supabase Realtime → Server Components).
4. **Split the heavy archetypes** if any single agent becomes a bottleneck (e.g., FORGE for code-heavy decisions). Run their deliberation in a dedicated route handler with longer `maxDuration`.
5. **Add the human council.** Every verified operator on MSTRMND.ai is a candidate for a human council seat in their archetype. The agent council runs always-on; humans get pulled in for high-stakes signals. Same archetype taxonomy, same routing layer.
