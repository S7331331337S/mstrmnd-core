import { MstrmndPlugin } from "@mstrmnd/plugin-sdk";
import { onboardingSchema } from "./schema.js";
import type { OnboardingAnswers } from "./schema.js";

export type { OnboardingAnswers } from "./schema.js";
export { onboardingSchema } from "./schema.js";

const SYSTEM_PROMPT = `You are the MSTRMND onboarding specialist. Your role is to conduct a structured interview
with an operator to capture all the information needed to initialize their MSTRMND intelligence layer.

Extract the following from the conversation context or the operator's message:
- Company/organization name and primary domain
- Vault or storage path (where their knowledge lives)
- Preferred LLM provider and specific model
- Custom agent roles they need
- Any external integrations (Slack, email, webhooks, etc.)
- Admin contact email

If any field is unclear, make a reasonable inference. For paths, default to "./mstrmnd-context" if not specified.
For model preferences, default to "openai" / "gpt-4o" if not specified.
Be thorough but concise.`;

/**
 * OnboardingAgent drives the structured interview flow.
 * It uses generateObject to extract a fully-typed OnboardingAnswers object
 * from either a single-shot prompt or a multi-turn conversation.
 */
export class OnboardingAgent {
  private plugin: MstrmndPlugin;

  constructor(plugin: MstrmndPlugin) {
    this.plugin = plugin;
  }

  /**
   * Run a single-shot extraction from a free-form operator description.
   * Suitable for headless / programmatic onboarding.
   */
  async extractFromDescription(description: string): Promise<OnboardingAnswers> {
    return this.plugin.generateObject(
      `The following is an operator's description of their deployment needs. Extract all relevant onboarding information:\n\n${description}`,
      onboardingSchema,
      { system: SYSTEM_PROMPT }
    );
  }

  /**
   * Run an interactive multi-turn questionnaire.
   * Streams questions to stdout and reads answers from stdin.
   * Returns fully-validated OnboardingAnswers when the interview is complete.
   */
  async runInteractiveInterview(): Promise<OnboardingAnswers> {
    const readline = await import("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const ask = (question: string): Promise<string> =>
      new Promise((resolve) => rl.question(question, resolve));

    console.log("\n🧠 MSTRMND Onboarding Interview\n");
    console.log("Answer each question. Press Enter to use the default.\n");

    const companyName = await ask("Organization / company name: ");
    const domain = await ask("Primary domain or industry: ");
    const vaultPath =
      (await ask("Vault / storage path [./mstrmnd-context]: ")) || "./mstrmnd-context";
    const modelPreferenceRaw =
      (await ask("LLM provider — openai / anthropic / google [openai]: ")) || "openai";
    const modelId =
      (await ask("Model ID [gpt-4o]: ")) || "gpt-4o";
    const rolesRaw = await ask(
      "Custom agent roles (comma-separated, e.g. researcher,writer) []: "
    );
    const contactEmail = await ask("Admin contact email (optional): ");

    rl.close();

    const modelPreference = (
      ["openai", "anthropic", "google"].includes(modelPreferenceRaw)
        ? modelPreferenceRaw
        : "openai"
    ) as "openai" | "anthropic" | "google";

    const customAgentRoles = rolesRaw
      ? rolesRaw.split(",").map((r) => r.trim()).filter(Boolean)
      : [];

    const raw: OnboardingAnswers = {
      companyName,
      domain,
      vaultPath,
      modelPreference,
      modelId,
      customAgentRoles,
      contactEmail: contactEmail || undefined,
    };

    return onboardingSchema.parse(raw);
  }
}
