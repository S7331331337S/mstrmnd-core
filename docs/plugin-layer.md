# MSTRMND Plugin Layer — Documentation

## Overview

The MSTRMND plugin layer packages the core intelligence infrastructure as an embeddable middleware for agent customer applications. It consists of four packages:

| Package | Purpose |
|---|---|
| `@mstrmnd/plugin-sdk` | Vercel AI SDK 7 wrapper — model factory, token tracking |
| `@mstrmnd/onboarding-agent` | Interactive questionnaire via `generateObject` + Zod |
| `@mstrmnd/context-generator` | Locked folder structure + `.mstrmnd-seal` integrity |
| `@mstrmnd/setup-cli` | Internal (`init`) and client (`client-init`) setup CLIs |

---

## Plugin SDK (`@mstrmnd/plugin-sdk`)

### Installation

```ts
import { MstrmndPlugin } from "@mstrmnd/plugin-sdk";

const plugin = new MstrmndPlugin({
  model: {
    provider: "openai",   // "openai" | "anthropic" | "google"
    modelId: "gpt-4o",
    // apiKey: "sk-..." — or set OPENAI_API_KEY env var
  },
  contextPath: "./mstrmnd-context",
});
```

### Supported Providers

| Provider | Env Var | Example Model IDs |
|---|---|---|
| `openai` | `OPENAI_API_KEY` | `gpt-4o`, `gpt-4-turbo` |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-3-5-sonnet-20241022` |
| `google` | `GOOGLE_API_KEY` | `gemini-2.0-flash`, `gemini-1.5-pro` |

### API

```ts
// Generate free-form text
const text = await plugin.generateText("Summarize this document...", {
  system: "You are a concise analyst.",
});

// Generate structured output
import { z } from "zod";
const result = await plugin.generateObject("Extract entities...", z.object({ ... }));

// Token usage
console.log(plugin.usage.getTotalTokens());
console.log(plugin.usage.getRecords()); // Per-call breakdown
```

---

## Onboarding Agent (`@mstrmnd/onboarding-agent`)

### Interactive Interview (CLI)

```ts
import { OnboardingAgent } from "@mstrmnd/onboarding-agent";

const agent = new OnboardingAgent(plugin);
const answers = await agent.runInteractiveInterview(); // prompts on stdout/stdin
```

### Headless Extraction

```ts
const answers = await agent.extractFromDescription(`
  We are Acme Corp, a fintech company. Vault at /data/acme-vault.
  We use OpenAI gpt-4o. Roles: researcher, writer.
`);
```

### Answer Schema

```ts
{
  companyName: string;
  domain: string;
  vaultPath: string;
  modelPreference: "openai" | "anthropic" | "google";
  modelId: string;
  customAgentRoles: string[];
  integrationEndpoints?: Array<{ name: string; url?: string }>;
  contactEmail?: string;
}
```

---

## Context Generator (`@mstrmnd/context-generator`)

### Generated Structure

```
mstrmnd-context/
├── identity.md                  — Auto-generated identity profile
├── config.json                  — Locked configuration (version-tracked)
├── agents/
│   └── roles.json               — Custom agent role definitions
├── connectors/
│   └── filesystem.config.json   — Vault/filesystem connector config
├── .mstrmnd-seal                — SHA-256 integrity checksum
└── audit.log.json               — Setup audit trail
```

### Usage

```ts
import { generateContext, verifySeal } from "@mstrmnd/context-generator";

// Generate locked structure
const ctx = generateContext(answers, "./mstrmnd-context");
console.log(ctx.seal);         // SHA-256 checksum
console.log(ctx.trackedFiles); // Files covered by the seal

// Verify integrity later
const valid = verifySeal("./mstrmnd-context", ctx.trackedFiles);
if (!valid) throw new Error("Context tampered!");
```

---

## Setup CLI (`@mstrmnd/setup-cli`)

### Internal Developer Setup

```sh
# Interactive
pnpm --filter @mstrmnd/setup-cli init

# Headless (CI/automation)
MSTRMND_ONBOARDING_JSON='{"companyName":"Test","domain":"dev",...}' \
  pnpm --filter @mstrmnd/setup-cli init -- --headless --context-path ./ctx
```

### Client Setup

```sh
# Interactive
pnpm --filter @mstrmnd/setup-cli client-init

# Headless
MSTRMND_MODEL_PROVIDER=anthropic \
MSTRMND_MODEL_ID=claude-3-5-sonnet-20241022 \
MSTRMND_ONBOARDING_JSON='{"companyName":"Acme",...}' \
  pnpm --filter @mstrmnd/setup-cli client-init -- --headless --context-path ./client-ctx
```

### Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `MSTRMND_MODEL_PROVIDER` | `openai` | LLM provider for setup |
| `MSTRMND_MODEL_ID` | `gpt-4o` | Model for setup |
| `MSTRMND_ONBOARDING_JSON` | — | JSON answers (headless mode) |
| `MSTRMND_CONTEXT_PATH` | `./mstrmnd-context` | Context directory |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `GOOGLE_API_KEY` | — | Google AI API key |

---

## MCP Server Integration

Two new tools are exposed by the MCP server when `@mstrmnd/context-generator` is available:

### `get_locked_config`
Returns the parsed `config.json` from the context directory.

```json
{ "contextPath": "./mstrmnd-context" }
```

### `verify_context_integrity`
Verifies the `.mstrmnd-seal` checksum against current file state.

```json
{ "contextPath": "./mstrmnd-context" }
// → { "integrityValid": true }
```

Set `MSTRMND_CONTEXT_PATH` env var to configure the default context path.

---

## Example Customer Integration

See `apps/example-client/src/index.ts` for a full end-to-end example:

```sh
cd apps/example-client
OPENAI_API_KEY=sk-... tsx src/index.ts
```
