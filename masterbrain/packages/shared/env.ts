// ============================================================
// @masterbrain/shared/env — Validated environment access
// ============================================================
// Every field is a lazy getter. Two reasons:
//
//   1. Consistency. The previous shape mixed required fields
//      (functions, evaluated on call) with optional ones (plain
//      strings, evaluated once at module load). Call sites had to
//      know which was which — `env.ANTHROPIC_API_KEY` but
//      `env.WEBHOOK_SECRET`.
//   2. Correctness. An optional value read at import time is frozen
//      at import time, so anything configured later in the process
//      lifetime — a test harness, a deferred secret load — silently
//      stayed empty forever.
//
// Required fields still fail fast, just at first read rather than
// at import.
// ============================================================

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Anthropic
  get ANTHROPIC_API_KEY() { return required('ANTHROPIC_API_KEY'); },
  get COUNCIL_MODEL()     { return optional('COUNCIL_MODEL',   'claude-opus-5'); },
  get ROUTING_MODEL()     { return optional('ROUTING_MODEL',   'claude-sonnet-5'); },
  get MEMORY_MODEL()      { return optional('MEMORY_MODEL',    'claude-haiku-4-5-20251001'); },
  get ADVERSARY_MODEL()   { return optional('ADVERSARY_MODEL', 'claude-opus-5'); },

  // Vercel AI Gateway
  get AI_GATEWAY_API_KEY()  { return optional('AI_GATEWAY_API_KEY'); },
  get AI_GATEWAY_BASE_URL() { return optional('AI_GATEWAY_BASE_URL', 'https://ai-gateway.vercel.sh/v1'); },

  // Supabase
  get SUPABASE_URL()              { return required('NEXT_PUBLIC_SUPABASE_URL'); },
  get SUPABASE_ANON_KEY()         { return required('NEXT_PUBLIC_SUPABASE_ANON_KEY'); },
  get SUPABASE_SERVICE_ROLE_KEY() { return required('SUPABASE_SERVICE_ROLE_KEY'); },

  // Integrations
  get ASANA_ACCESS_TOKEN()  { return optional('ASANA_ACCESS_TOKEN'); },
  get ASANA_WORKSPACE_GID() { return optional('ASANA_WORKSPACE_GID'); },
  get ASANA_PROJECT_GID()   { return optional('ASANA_PROJECT_GID'); },
  get GITHUB_TOKEN()        { return optional('GITHUB_TOKEN'); },
  get GITHUB_OWNER()        { return optional('GITHUB_OWNER'); },
  get SLACK_BOT_TOKEN()     { return optional('SLACK_BOT_TOKEN'); },
  get SLACK_SIGNING_SECRET(){ return optional('SLACK_SIGNING_SECRET'); },

  // Auth. Every mutating route requires this; empty means refuse to serve.
  get WEBHOOK_SECRET() { return optional('WEBHOOK_SECRET'); },
  get API_TOKEN()      { return optional('MASTERBRAIN_API_TOKEN'); },

  // Embeddings. CANON returns no priors at all unless this is set, because a
  // non-semantic embedding is worse than no memory.
  get EMBEDDINGS_PROVIDER() { return optional('EMBEDDINGS_PROVIDER'); }, // '' | 'voyage' | 'openai'
  get EMBEDDINGS_API_KEY()  { return optional('EMBEDDINGS_API_KEY'); },
  get EMBEDDINGS_MODEL()    { return optional('EMBEDDINGS_MODEL', 'voyage-3'); },

  get APP_URL() { return optional('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'); },
} as const;
