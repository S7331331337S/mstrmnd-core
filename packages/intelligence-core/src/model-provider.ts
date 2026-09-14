export interface ModelMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ModelCompleteOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface ModelProvider {
  readonly id: string;
  /** Declared provider access; missing metadata fails closed in the orchestrator. */
  readonly policy?: { networkDestinations: string[]; credentialIds: string[]; estimatedCostUsd: number };
  complete(
    messages: ModelMessage[],
    opts?: ModelCompleteOptions
  ): Promise<string>;
}

/** Offline/CI provider — echoes the last user message with a fixed prefix. */
export class EchoProvider implements ModelProvider {
  readonly id = "echo";
  readonly policy = { networkDestinations: [], credentialIds: [], estimatedCostUsd: 0 };

  async complete(messages: ModelMessage[]): Promise<string> {
    const last = [...messages].reverse().find((m) => m.role === "user");
    const text = last?.content ?? "";
    return `[echo] ${text.slice(0, 2000)}`;
  }
}

export interface OpenAICompatibleConfig {
  apiKey: string;
  /** Conservative per-call budget reservation; required for governed remote calls. */
  estimatedCostUsd?: number;
  credentialId?: string;
  /** OpenAI-compatible chat completions base, e.g. https://api.openai.com/v1 */
  baseUrl?: string;
  /** Model id (provider-specific) */
  model?: string;
  /** Optional org header */
  organization?: string;
}

/**
 * Model-agnostic HTTP provider using the OpenAI Chat Completions wire format.
 * Works with OpenAI, compatible proxies, and many local gateways.
 */
export class OpenAICompatibleProvider implements ModelProvider {
  readonly id = "openai-compatible";
  readonly policy: { networkDestinations: string[]; credentialIds: string[]; estimatedCostUsd: number };
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private organization?: string;

  constructor(config: OpenAICompatibleConfig) {
    if (!config.apiKey?.trim()) {
      throw new Error("OpenAICompatibleProvider requires an API key");
    }
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com/v1").replace(
      /\/$/,
      ""
    );
    this.policy = {
      networkDestinations: [this.baseUrl],
      credentialIds: [config.credentialId ?? "model-api-key"],
      estimatedCostUsd: config.estimatedCostUsd ?? Infinity,
    };
    this.model = config.model ?? "gpt-4o-mini";
    this.organization = config.organization;
  }

  async complete(
    messages: ModelMessage[],
    opts: ModelCompleteOptions = {}
  ): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiKey}`,
    };
    if (this.organization) {
      headers["OpenAI-Organization"] = this.organization;
    }

    const body = {
      model: this.model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2048,
    };

    const res = await fetch(url, {
      method: "POST",
      redirect: "error",
      headers,
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `model provider HTTP ${res.status} from ${url}: ${text.slice(0, 800)}`
      );
    }

    let data: {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new Error(`model provider returned non-JSON: ${text.slice(0, 200)}`);
    }

    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("model provider returned empty content");
    }
    return content;
  }
}

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

/**
 * Resolve provider from name / env.
 *
 * - `echo` (default): offline stub for CI
 * - `openai` | `openai-compatible`: Chat Completions HTTP API
 *
 * Env:
 * - MSTRMND_MODEL_PROVIDER
 * - MSTRMND_MODEL_API_KEY or OPENAI_API_KEY
 * - MSTRMND_MODEL_BASE_URL (default https://api.openai.com/v1)
 * - MSTRMND_MODEL_NAME (default gpt-4o-mini)
 * - MSTRMND_MODEL_ORG (optional)
 */
export function resolveModelProvider(
  name = process.env.MSTRMND_MODEL_PROVIDER ?? "echo"
): ModelProvider {
  const id = (name || "echo").trim().toLowerCase();
  if (id === "echo") return new EchoProvider();

  if (id === "openai" || id === "openai-compatible") {
    const apiKey =
      env("MSTRMND_MODEL_API_KEY") ?? env("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error(
        `MSTRMND_MODEL_PROVIDER=${id} requires MSTRMND_MODEL_API_KEY or OPENAI_API_KEY`
      );
    }
    return new OpenAICompatibleProvider({
      apiKey,
      baseUrl: env("MSTRMND_MODEL_BASE_URL"),
      model: env("MSTRMND_MODEL_NAME"),
      organization: env("MSTRMND_MODEL_ORG"),
      estimatedCostUsd: env("MSTRMND_MODEL_CALL_BUDGET_USD") ? Number(env("MSTRMND_MODEL_CALL_BUDGET_USD")) : undefined,
    });
  }

  throw new Error(
    `Unknown MSTRMND_MODEL_PROVIDER=${name!}. Use echo | openai | openai-compatible`
  );
}
