import { CHAIR, getAgent, type AgentId } from "@/agents/roster";
import { createId } from "@/lib/id";
import type { Provider, Round, Session, Turn } from "@/lib/types";

export type DeliberationEvents = {
  /** A turn was added to the transcript and is about to be spoken. */
  onTurnStart(turn: Turn): void;
  onDelta(turnId: string, text: string): void;
  onTurnEnd(turnId: string, finalText: string): void;
  onTurnError(turnId: string, message: string): void;
};

export type Depth = "quick" | "full";

const MAX_TOKENS = { opening: 400, crossfire: 400, ruling: 600 } as const;

/**
 * Runs the full board: openings in seat order, an optional crossfire round where
 * members answer each other, then the chair's ruling.
 *
 * Turn failures are isolated — one member erroring out does not abort the room,
 * because a partial board is still worth reading. An aborted signal stops cleanly.
 */
export async function runDeliberation({
  session,
  provider,
  depth,
  events,
  signal,
}: {
  session: Session;
  provider: Provider;
  depth: Depth;
  events: DeliberationEvents;
  signal: AbortSignal;
}): Promise<void> {
  const transcript: { name: string; text: string }[] = [];
  const spoken: string[] = [];

  const speak = async (agentId: AgentId, round: Round) => {
    if (signal.aborted) return;

    const agent = getAgent(agentId);
    const turn: Turn = {
      id: createId("t_"),
      agentId,
      round,
      text: "",
      status: "thinking",
    };
    events.onTurnStart(turn);

    let text = "";
    try {
      const stream = provider.stream({
        system: agent.systemPrompt,
        messages: [
          { role: "user", content: buildPrompt(session, round, agent.name, transcript) },
        ],
        maxTokens: MAX_TOKENS[round],
        signal,
        meta: { agentId, topic: session.topic, round, priorSpeakers: [...spoken] },
      });

      for await (const chunk of stream) {
        if (signal.aborted) return;
        if (chunk.type === "delta") {
          text += chunk.text;
          events.onDelta(turn.id, chunk.text);
        }
      }
    } catch (error) {
      if (signal.aborted) return;
      events.onTurnError(turn.id, describeError(error));
      return;
    }

    const finalText = text.trim();
    if (!finalText) {
      events.onTurnError(turn.id, "That member returned nothing.");
      return;
    }

    events.onTurnEnd(turn.id, finalText);
    transcript.push({ name: agent.name, text: finalText });
    if (!spoken.includes(agent.name)) spoken.push(agent.name);
  };

  for (const agentId of session.members) {
    await speak(agentId, "opening");
    if (signal.aborted) return;
  }

  if (depth === "full" && session.members.length > 1) {
    // Reversed so the member who opened last doesn't also lead the rebuttals.
    for (const agentId of [...session.members].reverse()) {
      await speak(agentId, "crossfire");
      if (signal.aborted) return;
    }
  }

  await speak(CHAIR.id, "ruling");
}

function buildPrompt(
  session: Session,
  round: Round,
  speakerName: string,
  transcript: { name: string; text: string }[],
): string {
  const parts: string[] = [`THE QUESTION BEFORE THE BOARD:\n${session.topic}`];

  if (session.context.trim()) {
    parts.push(`CONTEXT FROM THE USER:\n${session.context.trim()}`);
  }

  if (transcript.length) {
    const record = transcript
      .map((entry) => `${entry.name}: ${entry.text}`)
      .join("\n\n");
    parts.push(`WHAT THE BOARD HAS SAID SO FAR:\n${record}`);
  }

  switch (round) {
    case "opening":
      parts.push(
        `You are ${speakerName}. Give your opening position on the question. Bring your specific lens — do not try to cover what other members will cover.`,
      );
      break;
    case "crossfire":
      parts.push(
        `You are ${speakerName}. The room has now heard everyone. Respond to the strongest point someone else made — name them directly, and either sharpen it or take it apart. Do not restate your opening. Add something new.`,
      );
      break;
    case "ruling":
      parts.push(
        "The deliberation is closed. Deliver the ruling in the four labelled sections, exactly as instructed.",
      );
      break;
  }

  return parts.join("\n\n");
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "Stopped.";
    if (error.message.includes("Network request failed")) {
      return "No connection. Check your network and try again.";
    }
    return error.message;
  }
  return "Something went wrong reaching the model.";
}

/** The chair's headline, used as the one-line summary in session history. */
export function extractVerdict(rulingText: string): string | undefined {
  const match = rulingText.match(/THE CALL\s*\n+(.+?)(?:\n\s*\n|$)/s);
  const line = (match?.[1] ?? "").trim().replace(/\s+/g, " ");
  return line || undefined;
}
