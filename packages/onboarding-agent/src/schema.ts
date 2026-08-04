import { z } from "zod";

export const onboardingSchema = z.object({
  companyName: z
    .string()
    .min(1)
    .describe("The name of the organization or individual deploying MSTRMND"),
  domain: z
    .string()
    .min(1)
    .describe(
      "Primary domain or industry (e.g. 'media production', 'fintech', 'personal')"
    ),
  vaultPath: z
    .string()
    .min(1)
    .describe(
      "Absolute or relative path to the Obsidian vault or primary storage directory"
    ),
  modelPreference: z
    .enum(["openai", "anthropic", "google"])
    .describe("Preferred LLM provider for this deployment"),
  modelId: z
    .string()
    .min(1)
    .describe(
      "Specific model to use (e.g. 'gpt-4o', 'claude-3-5-sonnet-20241022', 'gemini-2.0-flash')"
    ),
  customAgentRoles: z
    .array(z.string())
    .describe(
      "List of custom agent roles or capabilities needed (e.g. ['researcher', 'writer', 'analyst'])"
    ),
  integrationEndpoints: z
    .array(
      z.object({
        name: z.string().describe("Integration name (e.g. 'slack', 'email', 'webhook')"),
        url: z.string().url().optional().describe("Endpoint URL if applicable"),
      })
    )
    .optional()
    .describe("External integration endpoints to configure"),
  contactEmail: z
    .string()
    .email()
    .optional()
    .describe("Admin contact email for notifications and audit logs"),
});

export type OnboardingAnswers = z.infer<typeof onboardingSchema>;
