# Deploying MSTRMND OS

This app is a **portable template**: the model provider, database, and auth are
all resolved from environment variables, so the same codebase runs locally, on a
temporary preview, on Vercel, or on any Node host. Nothing vendor‑specific is
hard‑coded into the domain logic.

## TL;DR env matrix

| Variable | Required | Purpose | Notes |
| --- | --- | --- | --- |
| `AUTH_SECRET` | yes (custom auth) | Signs the session JWT (app + agent share it) | Any stable 32+ char random string |
| `DATABASE_URL` (or `POSTGRES_URL`) | for persistence | Users + Third‑Mind in Postgres/Neon | Omit to use the file‑backed dev store. Neon: use the **pooled** string with `?sslmode=require` |
| Model key — one of: `AI_GATEWAY`(/`AI_GATEWAY_API_KEY`), `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `XAI_TOKEN`, `PERPLEXITY_API_TOKEN` | for live model | Maestro/subagent inference | Tool‑calling + subagent delegation need a tool‑capable provider (Gateway/Anthropic/OpenAI/xAI) |
| `MSTRMND_PROVIDER` / `MSTRMND_MODEL` | no | Force a provider / model id | Otherwise auto‑detected from the keys above |
| `NODE_VERSION` | build | Must be **≥ 24** (eve requirement) | |

Auth and DB are intentionally swappable per deployment. Neon Auth (hosted Better
Auth, incl. Google OAuth) is a WIP alternative to the built‑in email/password
auth — see the platform PR.

## Option 1 — Live preview (no account, ephemeral)

Run the app and expose it with a Cloudflare quick tunnel — handy to share a
working URL without deploying:

```bash
pnpm install
DATABASE_URL=... AUTH_SECRET=... MSTRMND_PROVIDER=perplexity pnpm dev   # :3000
cloudflared tunnel --url http://localhost:3000                          # prints a *.trycloudflare.com URL
```

The URL lives only as long as the process/host; it's a preview, not a deploy.

## Option 2 — Vercel (recommended, one project)

`next.config.ts` composes `withEve(withWorkflow(...))`, so the Next app **and**
the eve agent runtime deploy together as a single Vercel project.

1. Import this repo in Vercel (New Project → pick the branch).
2. Set env vars: `DATABASE_URL`, `AUTH_SECRET`, and a model key
   (`AI_GATEWAY_API_KEY` recommended, or link the project for OIDC).
3. Deploy. Add the deployed domain to Neon Auth **trusted domains** if you adopt
   Neon Auth.

Requires Node 24 (set the Vercel Project → Node.js Version to 24.x).

## Option 3 — Any Node host (Render / Railway / Fly / self‑host / Docker)

The eve runtime needs a Node server, so a container/Node host works:

```bash
pnpm install
pnpm eve:build      # builds the eve runtime output
pnpm build          # next build
pnpm start          # next start (serves the eve runtime via withEve)
```

Set the same env vars as Vercel, and `PORT`. Use Node 24. For a non‑Vercel host
where the eve service is separate, see `EVE_NEXT_PRODUCTION_ORIGIN` in the eve
docs.

## A note on Cloudflare Workers / GitHub Pages

These are **static/edge** targets and cannot host the durable eve agent runtime
(Node server + Workflows) or a Postgres‑connected backend. Use the Cloudflare
**tunnel** (Option 1) for a preview, and Vercel or a Node host (Options 2–3) for
a real deployment. GitHub is used for source + CI, not hosting the live app.

## Switching auth / DB per deployment

- **No DB:** omit `DATABASE_URL` → file‑backed users + Third‑Mind (dev/demo).
- **Postgres/Neon:** set `DATABASE_URL` → schema auto‑creates on first connect.
- **Auth:** built‑in email/password (JWT cookie) today; Neon Auth (Better Auth +
  Google OAuth) is a flagged WIP that only needs `NEON_AUTH_BASE_URL` +
  `NEON_AUTH_COOKIE_SECRET`.
