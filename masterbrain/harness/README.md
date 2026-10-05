# Harness

Runs the closed loop with no Anthropic key and no Supabase project, so the
pipeline can be exercised and regressions caught before either exists.

```bash
pnpm verify          # typecheck + checks + route-checks
pnpm harness:loop    # one signal, end to end, with the ledger printed
```

## What is real

- **The schema.** PGlite is Postgres compiled to WASM. All four migrations,
  the `vector(1536)` columns, the ivfflat indexes, the RLS policies and the
  `match_canon_patterns` RPC execute as real Postgres.
- **The loop.** `runLoop`, `Nexus.route`, `Nexus.synthesize`, `Canon`, `Hex`
  and the twelve council agents are the shipped code, unmodified.
- **The SDK path.** The Anthropic SDK sends real HTTP to a local server that
  speaks the `/v1/messages` wire format, so request construction, response
  parsing, JSON-fence tolerance, schema validation, telemetry and error
  handling all run for real. The server enforces the model allowlist the way
  the API does, which is why a stale model id fails here exactly as it would
  in production.
- **The routes.** `route-checks.ts` imports the actual route modules and calls
  their exported `POST` with a real `Request`.

## What is emulated

- **The model's judgement.** Responses are canned. The harness proves the loop
  runs, persists and fails correctly — not that the council reasons well. That
  question needs a real key.
- **PostgREST.** `pglite-supabase.ts` implements the handful of supabase-js
  call shapes the codebase uses, over real SQL. It deliberately reproduces one
  PostgREST behaviour that matters: `numeric` comes back as a **string**.
- **Supabase roles.** `anon`, `authenticated` and `service_role` are created in
  the harness bootstrap; a managed project provisions them.

## What it will not catch

Anything downstream of a real model: prompt quality, whether HEX actually
finds the strongest counter-argument, whether the twelve archetypes produce
twelve distinguishable positions, real latency, real cost.
