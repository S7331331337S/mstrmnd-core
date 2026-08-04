import { generateText, generateObject } from "ai";
import type { LanguageModelV1 } from "ai";
import type { ZodType } from "zod";
import type { MstrmndPluginConfig } from "./model-factory.js";
import { createModel } from "./model-factory.js";
import { UsageTracker } from "./usage-tracker.js";

export type { MstrmndPluginConfig, ModelConfig, ModelProvider } from "./model-factory.js";
export { createModel } from "./model-factory.js";
export { UsageTracker } from "./usage-tracker.js";

/**
 * Core plugin class. Instantiate with a model config and use to drive
 * onboarding, context generation, or any LLM-powered workflow.
 */
export class MstrmndPlugin {
  readonly model: LanguageModelV1;
  readonly usage: UsageTracker;
  readonly config: MstrmndPluginConfig;

  constructor(config: MstrmndPluginConfig) {
    this.config = config;
    this.model = createModel(config.model);
    this.usage = new UsageTracker();
  }

  async generateText(
    prompt: string,
    options?: { system?: string; maxTokens?: number }
  ): Promise<string> {
    const result = await generateText({
      model: this.model,
      prompt,
      system: options?.system,
      maxTokens: options?.maxTokens,
    });

    if (result.usage) {
      this.usage.record(
        this.config.model.modelId,
        this.config.model.provider,
        {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        }
      );
    }

    return result.text;
  }

  async generateObject<T>(
    prompt: string,
    schema: ZodType<T>,
    options?: { system?: string }
  ): Promise<T> {
    const result = await generateObject({
      model: this.model,
      prompt,
      schema,
      system: options?.system,
    });

    if (result.usage) {
      this.usage.record(
        this.config.model.modelId,
        this.config.model.provider,
        {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        }
      );
    }

    return result.object;
  }
}
