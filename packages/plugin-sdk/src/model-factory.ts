import type { LanguageModelV1 } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

export type ModelProvider = "openai" | "anthropic" | "google";

export interface ModelConfig {
  provider: ModelProvider;
  modelId: string;
  apiKey?: string;
}

export interface MstrmndPluginConfig {
  model: ModelConfig;
  contextPath?: string;
}

/**
 * Creates a LanguageModelV1 instance from a ModelConfig.
 * Supports openai, anthropic, and google providers.
 */
export function createModel(config: ModelConfig): LanguageModelV1 {
  const apiKey = config.apiKey ?? getDefaultApiKey(config.provider);

  switch (config.provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey });
      return openai(config.modelId);
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey });
      return anthropic(config.modelId);
    }
    case "google": {
      const google = createGoogleGenerativeAI({ apiKey });
      return google(config.modelId);
    }
    default: {
      const _exhaustive: never = config.provider;
      throw new Error(`Unsupported model provider: ${String(_exhaustive)}`);
    }
  }
}

function getDefaultApiKey(provider: ModelProvider): string {
  const envMap: Record<ModelProvider, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_API_KEY",
  };
  const key = process.env[envMap[provider]];
  if (!key) {
    throw new Error(
      `Missing API key for provider "${provider}". Set the ${envMap[provider]} environment variable or pass apiKey in ModelConfig.`
    );
  }
  return key;
}
