-- ============================================================
-- MASTERBRAIN — Schema v1
-- ============================================================
-- The data model maps directly to the closed-loop:
--
--   signal  →  decision  →  deliberation[]  →  outcome
--                 ↓                              ↓
--             execution[]                   canon_pattern
--
-- Every consequential thing the council does is recorded.
-- CANON learns by querying this history.
-- ============================================================

-- Required for embeddings (CANON's semantic retrieval)
create extension if not exists "vector" with schema public;
create extension if not exists "uuid-ossp" with schema public;

-- ============================================================
-- 1. ARCHETYPES — the 12 council seats + 3 meta roles
-- ============================================================
create table archetypes (
  id            text primary key,        -- 'strategist', 'closer', 'adversary'
  name          text not null,           -- 'The Strategist', 'The Closer'
  agent_codename text not null unique,   -- 'AXIOM', 'ENVOY', 'HEX'
  layer         text not null check (layer in ('capital', 'building', 'operating', 'network', 'vision', 'meta')),
  responsibility text not null,
  created_at    timestamptz default now()
);

-- ============================================================
-- 2. SIGNALS — anything that triggers the council
-- ============================================================
create type signal_source as enum ('asana', 'github', 'slack', 'webhook', 'manual', 'scheduled');
create type signal_severity as enum ('low', 'medium', 'high', 'critical');

create table signals (
  id            uuid primary key default uuid_generate_v4(),
  source        signal_source not null,
  source_id     text,                    -- external id (asana task gid, github pr#, etc)
  kind          text not null,           -- 'pricing_question', 'feature_proposal', 'incident', 'strategy_review'
  severity      signal_severity not null default 'medium',
  payload       jsonb not null,          -- the raw signal content
  context       text,                    -- pre-summarized context for routing
  ingested_at   timestamptz default now(),
  processed_at  timestamptz
);

create index signals_kind_idx on signals(kind);
create index signals_ingested_idx on signals(ingested_at desc);

-- ============================================================
-- 3. DECISIONS — synthesized output from a deliberation
-- ============================================================
create type decision_status as enum ('pending', 'deliberating', 'synthesized', 'executing', 'closed', 'overridden');

create table decisions (
  id              uuid primary key default uuid_generate_v4(),
  signal_id       uuid references signals(id) on delete cascade,
  title           text not null,
  status          decision_status not null default 'pending',
  quorum          text[] not null,        -- archetype ids consulted
  resolution      text,                   -- the actual decision
  reasoning       text,                   -- why
  dissent         text,                   -- what HEX argued, that was overridden
  priors_used     uuid[],                 -- canon_pattern ids that informed this
  confidence      numeric(3,2),           -- 0.00–1.00
  embedding       vector(1536),
  created_at      timestamptz default now(),
  synthesized_at  timestamptz,
  closed_at       timestamptz
);

create index decisions_status_idx on decisions(status);
create index decisions_created_idx on decisions(created_at desc);
create index decisions_embedding_idx on decisions using ivfflat (embedding vector_cosine_ops);

-- ============================================================
-- 4. DELIBERATIONS — each agent's contribution to a decision
-- ============================================================
create table deliberations (
  id            uuid primary key default uuid_generate_v4(),
  decision_id   uuid not null references decisions(id) on delete cascade,
  archetype_id  text not null references archetypes(id),
  position      text not null,           -- the agent's argument
  confidence    numeric(3,2),
  reasoning     jsonb,                   -- structured: assumptions, evidence, tradeoffs
  tokens_in     integer,
  tokens_out    integer,
  latency_ms    integer,
  model         text,
  created_at    timestamptz default now()
);

create index deliberations_decision_idx on deliberations(decision_id);

-- ============================================================
-- 5. EXECUTIONS — what actually happened after the decision
-- ============================================================
create type execution_status as enum ('queued', 'in_flight', 'succeeded', 'failed', 'skipped');

create table executions (
  id            uuid primary key default uuid_generate_v4(),
  decision_id   uuid not null references decisions(id) on delete cascade,
  archetype_id  text not null references archetypes(id),  -- which agent owns it
  action        text not null,           -- 'create_asana_task', 'open_pr', 'send_message'
  payload       jsonb,
  status        execution_status not null default 'queued',
  external_id   text,                    -- the asana gid / github pr# we created
  error         text,
  created_at    timestamptz default now(),
  completed_at  timestamptz
);

-- ============================================================
-- 6. OUTCOMES — reality check on the decision
-- ============================================================
create type outcome_verdict as enum ('validated', 'partial', 'invalidated', 'unknown');

create table outcomes (
  id            uuid primary key default uuid_generate_v4(),
  decision_id   uuid not null references decisions(id) on delete cascade unique,
  verdict       outcome_verdict not null,
  measured_at   timestamptz default now(),
  evidence      text not null,           -- what happened, in plain language
  metrics       jsonb,                   -- structured metrics if available
  lessons       text                     -- extracted by CANON
);

-- ============================================================
-- 7. CANON_PATTERNS — extracted, reusable wisdom
-- ============================================================
-- CANON ingests outcomes and produces patterns over time.
-- These become priors for future deliberations.
create table canon_patterns (
  id            uuid primary key default uuid_generate_v4(),
  pattern       text not null,           -- "When X, Y leads to Z"
  signal_kinds  text[] not null,         -- which kinds of signals this applies to
  source_decisions uuid[] not null,      -- which decisions this was extracted from
  confidence    numeric(3,2) not null,
  times_used    integer default 0,
  times_validated integer default 0,
  embedding     vector(1536) not null,
  created_at    timestamptz default now(),
  last_used_at  timestamptz
);

create index canon_patterns_embedding_idx on canon_patterns using ivfflat (embedding vector_cosine_ops);

-- ============================================================
-- 8. AGENT_INVOCATIONS — observability layer
-- ============================================================
create table agent_invocations (
  id            uuid primary key default uuid_generate_v4(),
  archetype_id  text not null references archetypes(id),
  decision_id   uuid references decisions(id) on delete set null,
  prompt_hash   text,
  tokens_in     integer,
  tokens_out    integer,
  latency_ms    integer,
  cost_usd      numeric(10,6),
  model         text not null,
  cached        boolean default false,
  succeeded     boolean default true,
  error         text,
  created_at    timestamptz default now()
);

create index agent_invocations_archetype_idx on agent_invocations(archetype_id, created_at desc);

-- ============================================================
-- VIEWS for the dashboard
-- ============================================================
create or replace view council_activity as
select
  a.agent_codename,
  a.name,
  count(distinct d.id) as deliberations_count,
  avg(d.latency_ms) as avg_latency_ms,
  sum(d.tokens_out) as total_tokens_out,
  max(d.created_at) as last_active_at
from archetypes a
left join deliberations d on d.archetype_id = a.id
group by a.id, a.agent_codename, a.name;
