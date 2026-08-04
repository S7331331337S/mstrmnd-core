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
  complete(
    messages: ModelMessage[],
    opts?: ModelCompleteOptions
  ): Promise<string>;
}

/** Offline/CI provider — echoes the last user message with a fixed prefix. */
export class EchoProvider implements ModelProvider {
  readonly id = "echo";

  async complete(messages: ModelMessage[]): Promise<string> {
    const last = [...messages].reverse().find((m) => m.role === "user");
    const text = last?.content ?? "";
    return `[echo] ${text.slice(0, 2000)}`;
  }
}

export function resolveModelProvider(
  name = process.env.MSTRMND_MODEL_PROVIDER ?? "echo"
): ModelProvider {
  if (name === "echo" || !name) return new EchoProvider();
  // Future providers register here; unknown falls back to echo.
  return new EchoProvider();
}
