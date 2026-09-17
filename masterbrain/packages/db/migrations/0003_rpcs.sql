-- ============================================================
-- MASTERBRAIN — RPC: match_canon_patterns
-- ============================================================
-- pgvector semantic search RPC used by CANON.queryPriors()
-- Filters by signal_kind AND ranks by cosine similarity.
-- ============================================================

create or replace function match_canon_patterns(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  signal_kinds text[]
)
returns table (
  id uuid,
  pattern text,
  confidence numeric,
  similarity float,
  source_decisions uuid[]
)
language sql stable
as $$
  select
    cp.id,
    cp.pattern,
    cp.confidence,
    1 - (cp.embedding <=> query_embedding) as similarity,
    cp.source_decisions
  from canon_patterns cp
  where cp.signal_kinds && signal_kinds
    and 1 - (cp.embedding <=> query_embedding) > match_threshold
  order by cp.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================
-- RPC: increment_prior_usage
-- ============================================================
-- Called from /api/canon/ingest when an outcome lands.
-- Tracks which priors led to validated/invalidated decisions.
-- ============================================================

create or replace function increment_prior_usage(
  prior_ids uuid[],
  validated_inc int
)
returns void
language sql
as $$
  update canon_patterns
  set times_used = times_used + 1,
      times_validated = times_validated + validated_inc,
      last_used_at = now()
  where id = any(prior_ids);
$$;
