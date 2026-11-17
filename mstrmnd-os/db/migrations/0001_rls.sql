-- 0001_rls: least-privilege app role + row-level security on the app tables.
--
-- Run as the database OWNER (neondb_owner), never as mstrmnd_app. Idempotent:
-- safe to re-run. See ../README.md for the run command and rollback.
--
-- What it does
--   * Ensures the app tables exist (same DDL as lib/db.ts ensureSchema).
--   * Creates role mstrmnd_app: NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB,
--     NOCREATEROLE, not the owner of anything. The LOGIN + password is added out
--     of band (ALTER ROLE ... LOGIN PASSWORD ...) so no secret lives in git.
--   * Grants it only what the app uses: SELECT/INSERT on users,
--     SELECT/INSERT/UPDATE on observations (INSERT ... ON CONFLICT DO UPDATE).
--     Both tables use uuid ids, so there are no sequences to grant.
--     Nothing on the template tables ("User", "Chat", ...), drizzle, neon_auth.
--   * ENABLE + FORCE RLS on users and observations. Policies key on the
--     transaction-local GUC app.workspace_id that lib/db.ts sets per query.
--     Unset / empty GUC => no rows visible, no rows writable.
--   * mstrmnd_auth_lookup(email): narrow SECURITY DEFINER lookup for sign-in,
--     which happens before there is a session/workspace. EXECUTE only for
--     mstrmnd_app (and the owner); revoked from PUBLIC.
--
-- Note: the owner (neondb_owner) has BYPASSRLS, so FORCE does not affect it;
-- the app keeps working unchanged while it still connects as the owner.

begin;

-- 1. Tables (no-op on an existing database) ---------------------------------
create table if not exists public.users (
  id uuid primary key,
  email text unique not null,
  name text not null,
  password_hash text not null,
  workspace_id text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.observations (
  id uuid primary key,
  scope text not null,
  key text not null,
  content text not null,
  tags text[] not null default '{}',
  agent text not null,
  created_at timestamptz not null default now(),
  unique (scope, key)
);

create index if not exists observations_scope_created_idx
  on public.observations (scope, created_at desc);

-- 2. Role ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'mstrmnd_app') then
    create role mstrmnd_app nologin nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
  elsif exists (
    select 1 from pg_roles
     where rolname = 'mstrmnd_app'
       and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication)
  ) then
    -- Only a superuser can change these attributes, so refuse instead of
    -- silently running RLS against a role that would bypass it.
    raise exception 'mstrmnd_app exists with unsafe attributes (super/bypassrls/createrole/createdb/replication); fix it before running 0001_rls';
  end if;
  -- Never touch LOGIN/PASSWORD here; that is set out of band.
end
$$;

-- 3. Grants (reset, then grant exactly what the app needs) --------------------
revoke all on table public.users, public.observations from mstrmnd_app;
grant usage on schema public to mstrmnd_app;
grant select, insert on table public.users to mstrmnd_app;
grant select, insert, update on table public.observations to mstrmnd_app;

-- 4. Row-level security -------------------------------------------------------
alter table public.observations enable row level security;
alter table public.observations force row level security;

drop policy if exists observations_workspace_isolation on public.observations;
create policy observations_workspace_isolation on public.observations
  for all
  using (scope = nullif(current_setting('app.workspace_id', true), ''))
  with check (scope = nullif(current_setting('app.workspace_id', true), ''));

alter table public.users enable row level security;
alter table public.users force row level security;

-- One personal workspace per user (workspace_id = 'ws_' || id); a session can
-- see / create only the user row of its own workspace.
drop policy if exists users_workspace_isolation on public.users;
create policy users_workspace_isolation on public.users
  for all
  using (workspace_id = nullif(current_setting('app.workspace_id', true), ''))
  with check (workspace_id = nullif(current_setting('app.workspace_id', true), ''));

-- 5. Sign-in lookup (pre-session) ---------------------------------------------
-- Owned by the migration runner (the table owner, which has BYPASSRLS), so it
-- can read across workspaces; it returns at most one row for an exact email.
create or replace function public.mstrmnd_auth_lookup(p_email text)
returns table (
  id uuid,
  email text,
  name text,
  password_hash text,
  workspace_id text
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select u.id, u.email, u.name, u.password_hash, u.workspace_id
    from public.users u
   where u.email = lower(btrim(p_email))
   limit 1
$$;

revoke all on function public.mstrmnd_auth_lookup(text) from public;
grant execute on function public.mstrmnd_auth_lookup(text) to mstrmnd_app;

commit;
