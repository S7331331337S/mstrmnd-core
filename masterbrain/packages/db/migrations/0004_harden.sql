-- ============================================================
-- MASTERBRAIN — Hardening
-- ============================================================
-- Three corrections to the v1 schema:
--   1. RLS on every table. Without it, the anon key — which is
--      public by design — has full read/write on the whole
--      ledger, including canon_patterns, whose contents are
--      injected into every future council prompt.
--   2. canon_patterns.embedding becomes nullable, so patterns
--      still accrue while no embeddings provider is configured.
--   3. council_activity reads the table that actually carries
--      per-invocation telemetry.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Row Level Security
-- ------------------------------------------------------------
-- The service role bypasses RLS entirely, which is how the server
-- reaches these tables. Enabling RLS with no permissive policy
-- therefore closes the anon and authenticated roles out completely
-- while leaving the application unaffected.

alter table archetypes        enable row level security;
alter table signals           enable row level security;
alter table decisions         enable row level security;
alter table deliberations     enable row level security;
alter table executions        enable row level security;
alter table outcomes          enable row level security;
alter table canon_patterns    enable row level security;
alter table agent_invocations enable row level security;

alter table archetypes        force row level security;
alter table signals           force row level security;
alter table decisions         force row level security;
alter table deliberations     force row level security;
alter table executions        force row level security;
alter table outcomes          force row level security;
alter table canon_patterns    force row level security;
alter table agent_invocations force row level security;

-- A policy is not a grant. Supabase grants anon/authenticated SELECT on public
-- tables by default — which is exactly why RLS being off above was dangerous —
-- but the two are separate mechanisms, so revoke the default grants explicitly
-- and re-grant only the one table that is safe to expose.
revoke all on archetypes, signals, decisions, deliberations,
              executions, outcomes, canon_patterns, agent_invocations
  from anon, authenticated;

-- The archetype roster is reference data, not operational data — the only
-- table safe to expose read-only when the dashboard goes public.
grant select on archetypes to anon, authenticated;
create policy archetypes_read_all on archetypes for select to anon, authenticated using (true);

-- ------------------------------------------------------------
-- 2. Patterns accrue even without an embeddings provider
-- ------------------------------------------------------------
alter table canon_patterns alter column embedding drop not null;

-- Retrieval must skip un-embedded rows rather than error on them.
-- The return type changes (numeric -> float, per F-07), and `create or replace`
-- cannot change a function's return type, so the old signature is dropped first.
drop function if exists match_canon_patterns(vector, float, int, text[]);

create function match_canon_patterns(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  signal_kinds text[]
)
returns table (
  id uuid,
  pattern text,
  confidence float,
  similarity float,
  source_decisions uuid[]
)
language sql stable
as $$
  select
    cp.id,
    cp.pattern,
    cp.confidence::float,
    (1 - (cp.embedding <=> query_embedding))::float as similarity,
    cp.source_decisions
  from canon_patterns cp
  where cp.embedding is not null
    and 1 - (cp.embedding <=> query_embedding) > match_threshold
  order by
    -- Signal kind is a ranking boost, not a gate. The previous `&&` filter meant
    -- a pattern surfaced only under an identical free-form kind string, so
    -- 'pricing_decision' and 'pricing_question' never saw each other's history —
    -- which contradicts the premise that patterns transfer between signals.
    (cp.embedding <=> query_embedding) - (case when cp.signal_kinds && signal_kinds then 0.05 else 0 end)
  limit match_count;
$$;

-- ------------------------------------------------------------
-- 3. Dashboard view reads the table that holds the telemetry
-- ------------------------------------------------------------
-- insert_deliberation never writes latency_ms/tokens_out; recordInvocation
-- writes them to agent_invocations. The old view aggregated the empty columns
-- and rendered null latency and zero tokens for every archetype.
-- `create or replace view` cannot add or reorder columns, so drop first.
drop view if exists council_activity;

create view council_activity as
select
  a.agent_codename,
  a.name,
  count(distinct d.id)                                  as deliberations_count,
  avg(i.latency_ms)                                     as avg_latency_ms,
  sum(i.tokens_out)                                     as total_tokens_out,
  count(i.id) filter (where i.succeeded is false)        as failed_invocations,
  greatest(max(d.created_at), max(i.created_at))        as last_active_at
from archetypes a
left join deliberations    d on d.archetype_id = a.id
left join agent_invocations i on i.archetype_id = a.id
group by a.id, a.agent_codename, a.name;
