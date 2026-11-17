# Database migrations (mstrmnd-os)

Plain, numbered SQL files in `db/migrations/`, applied in order with `psql`
as the **database owner**. Each file is idempotent (safe to re-run) and wraps
its changes in one transaction. `lib/db.ts` still bootstraps the two tables on
a brand-new database (dev), but anything beyond `create table` lives here.

| File | What |
|---|---|
| `0001_rls.sql` | `mstrmnd_app` role (NOLOGIN, NOSUPERUSER, NOBYPASSRLS), minimal grants on `users` / `observations`, ENABLE + FORCE RLS keyed on `app.workspace_id`, and the `mstrmnd_auth_lookup(email)` SECURITY DEFINER sign-in lookup |

## Run

```bash
# OWNER_DATABASE_URL = the neondb_owner connection string (direct/unpooled).
# Never commit it; export it only in the shell that runs the migration.
psql "$OWNER_DATABASE_URL" -v ON_ERROR_STOP=1 -f mstrmnd-os/db/migrations/0001_rls.sql
```

The migration is safe to apply while the app still connects as
`neondb_owner`: the owner has BYPASSRLS, and `lib/db.ts` already sets
`app.workspace_id` on every scoped query.

## Switching the app to `mstrmnd_app`

The migration creates the role **NOLOGIN** so no password lives in git. To
let the app connect as it (out of band, by someone with the owner URL):

```sql
-- password generated locally, e.g. openssl rand -base64 32; never committed
ALTER ROLE mstrmnd_app LOGIN PASSWORD '<generated>';
```

Then point the app's `DATABASE_URL` at a connection string for
`mstrmnd_app` (same host/database). `lib/db.ts` reads `DATABASE_URL` first.

## How the app uses it

* Every workspace-scoped query runs through `withWorkspace(ws, fn)` in
  `lib/db.ts`: `begin; select set_config('app.workspace_id', ws, true); ...;
  commit` on one pooled connection (works with Neon's transaction pooler).
* A missing workspace throws in production; the shared `ws_local` scope is
  dev-only.
* Sign-in (no session yet) calls `mstrmnd_auth_lookup(email)`. Sign-up inserts
  under the new user's own workspace, which satisfies the RLS `WITH CHECK`.

## Test

`tests/db-rls.test.ts` (part of `pnpm --dir mstrmnd-os test:tools`, so it runs
in CI, where it skips) proves the policies as `mstrmnd_app`. To run it for
real, apply `0001_rls.sql` to a **throwaway Neon branch** and:

```bash
TEST_DATABASE_URL="<owner url of the TEST branch>" pnpm --dir mstrmnd-os test:tools
```

It seeds, `SET LOCAL ROLE mstrmnd_app`, asserts, and rolls everything back.

## Rollback

```sql
BEGIN;
ALTER TABLE public.observations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.observations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS observations_workspace_isolation ON public.observations;
DROP POLICY IF EXISTS users_workspace_isolation ON public.users;
COMMIT;
-- Only after the app no longer connects as mstrmnd_app:
-- DROP FUNCTION IF EXISTS public.mstrmnd_auth_lookup(text);  -- app falls back to a direct owner query
-- REVOKE ALL ON public.users, public.observations FROM mstrmnd_app;
-- REVOKE USAGE ON SCHEMA public FROM mstrmnd_app;
-- DROP ROLE IF EXISTS mstrmnd_app;
```
