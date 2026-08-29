import type { AgentId } from "@/agents/roster";

/** Which phase of the deliberation a turn belongs to. */
export type Round = "opening" | "crossfire" | "ruling";

export type TurnStatus = "queued" | "thinking" | "speaking" | "done" | "error";

export type Turn = {
  id: string;
  agentId: AgentId;
  round: Round;
  text: string;
  status: TurnStatus;
  /** Set when status is "error". */
  error?: string;
};

export type SessionStatus = "draft" | "running" | "complete" | "stopped" | "error";

export type Session = {
  id: string;
  topic: string;
  /** Optional extra context the user supplies about their situation. */
  context: string;
  members: AgentId[];
  turns: Turn[];
  status: SessionStatus;
  createdAt: number;
  updatedAt: number;
  /** Which engine produced this session — surfaced in history. */
  engine: EngineKind;
  /** Pulled out of the chair's ruling for the history list. */
  verdict?: string;
};

export type EngineKind = "claude" | "demo";

/** A single streamed chunk from a provider. */
export type StreamChunk = { type: "delta"; text: string } | { type: "done" };

export type ProviderMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ProviderRequest = {
  system: string;
  messages: ProviderMessage[];
  maxTokens: number;
  signal?: AbortSignal;
  /**
   * Who is speaking and about what. The Claude provider ignores this (everything
   * it needs is already in `system`/`messages`); the offline provider uses it to
   * compose an in-character line.
   */
  meta: {
    agentId: AgentId;
    topic: string;
    round: Round;
    /** Display names of members who already spoke this session. */
    priorSpeakers: string[];
  };
};

export interface Provider {
  readonly kind: EngineKind;
  stream(request: ProviderRequest): AsyncGenerator<StreamChunk, void, unknown>;
}
