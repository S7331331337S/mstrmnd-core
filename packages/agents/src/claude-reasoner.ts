import type { Reasoner, ReasonerInput } from "./reasoner";

/**
 * Synthesizes an answer with Claude, grounded in retrieved memory.
 *
 * `@anthropic-ai/sdk` is an optional dependency — the specifier is held in a
 * variable so the type checker treats the import as dynamic, letting the repo
 * typecheck without the package installed. `isAvailable()` requires both the
 * package and a credential, so Hermes silently keeps using the extractive
 * reasoner rather than failing at the first question.
 */

const PACKAGE = "@anthropic-ai/sdk";

/** Opus 5: thinking is on by default and max_tokens caps thinking + text
 *  together, so this is sized well above the length of any expected answer. */
const MODEL = "claude-opus-5";
const MAX_TOKENS = 16000;

export class ClaudeReasoner implements Reasoner {
  readonly name = `claude:${MODEL}`;

  private client: { messages: { stream: (args: unknown) => AsyncIterable<unknown> & { finalMessage(): Promise<{ content: Array<{ type: string; text?: string }> }> } } } | null =
    null;

  /** True when the SDK is installed and a credential is present. The SDK also
   *  resolves `ant auth login` profiles, so an unset key is not proof of no
   *  credentials — but a profile check would need the SDK loaded, so this
   *  intentionally errs toward the offline default. */
  static async isAvailable(): Promise<boolean> {
    if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
      return false;
    }
    try {
      await import(PACKAGE);
      return true;
    } catch {
      return false;
    }
  }

  private async sdk() {
    if (this.client) return this.client;
    const mod = await import(PACKAGE);
    const Ctor = mod.default ?? mod.Anthropic;
    this.client = new Ctor();
    return this.client!;
  }

  async answer({ question, passages, identity, history }: ReasonerInput): Promise<string> {
    const client = await this.sdk();

    const system = [
      "You are Hermes, the agent runtime for the user's personal intelligence layer.",
      "Answer strictly from the MEMORY passages provided. Cite the note id you drew each claim from.",
      "If the passages do not contain the answer, say so plainly rather than filling the gap from general knowledge.",
      "Lead with the answer; supporting detail after. Keep it to the length the question needs.",
      identity.values.length > 0 ? `The user's stated values: ${identity.values.join(", ")}.` : "",
      identity.interests.length > 0 ? `Their interests: ${identity.interests.join(", ")}.` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const memory =
      passages.length > 0
        ? passages
            .map((p) => `<note id="${p.id}" title="${p.title}">\n${p.excerpt}\n</note>`)
            .join("\n\n")
        : "(no matching notes)";

    // Prior turns first, then this question — stable content ahead of volatile
    // keeps the cacheable prefix intact as the conversation grows.
    const messages = [
      ...history.flatMap((turn) => [
        { role: "user" as const, content: turn.question },
        { role: "assistant" as const, content: turn.answer },
      ]),
      {
        role: "user" as const,
        content: `<memory>\n${memory}\n</memory>\n\nQuestion: ${question}`,
      },
    ];

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages,
    });
    const message = await stream.finalMessage();

    return message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();
  }
}
