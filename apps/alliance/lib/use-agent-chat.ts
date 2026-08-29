import { useCallback, useEffect, useRef, useState } from "react";

import { cancelTurn, runTurn } from "@/lib/agent-client";
import { getAgent } from "@/lib/agents";
import type { ChatMessage, ChatStatus } from "@/lib/chat-types";
import { isBackendConfigured } from "@/lib/config";

interface Conversation {
  messages: ChatMessage[];
  sessionId?: string;
}

const conversations = new Map<string, Conversation>();

function conversationFor(agentId: string): Conversation {
  const existing = conversations.get(agentId);
  if (existing) return existing;
  const created = { messages: [] };
  conversations.set(agentId, created);
  return created;
}

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useAgentChat(agentId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => conversationFor(agentId).messages);
  const [status, setStatus] = useState<ChatStatus>("ready");
  const [error, setError] = useState<Error | undefined>();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const updateMessages = useCallback((id: string, next: ChatMessage[]) => {
    const conversation = conversationFor(id);
    conversation.messages = next;
    if (agentId === id) setMessages(next);
  }, [agentId]);

  const sendMessage = useCallback(async ({ text }: { text: string }) => {
    const prompt = text.trim();
    if (!prompt || abortRef.current) return;

    const idAtSend = agentId;
    const conversation = conversationFor(idAtSend);
    const userMessage: ChatMessage = {
      id: id("user"),
      role: "user",
      parts: [{ type: "text", text: prompt }],
    };
    const assistantId = id("assistant");
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      parts: [{ type: "text", text: "" }],
    };
    updateMessages(idAtSend, [...conversation.messages, userMessage, assistantMessage]);
    setError(undefined);
    setStatus("submitted");

    const controller = new AbortController();
    abortRef.current = controller;

    const writeAssistant = (value: string) => {
      const current = conversationFor(idAtSend).messages;
      updateMessages(
        idAtSend,
        current.map((message) =>
          message.id === assistantId
            ? { ...message, parts: [{ type: "text", text: value }] }
            : message,
        ),
      );
    };

    try {
      if (!isBackendConfigured()) {
        setStatus("streaming");
        await new Promise((resolve) => setTimeout(resolve, 350));
        if (!controller.signal.aborted) writeAssistant(getAgent(idAtSend).mockReply(prompt));
      } else {
        setStatus("streaming");
        const result = await runTurn(prompt, {
          sessionId: conversation.sessionId,
          signal: controller.signal,
          onText: writeAssistant,
        });
        conversation.sessionId = result.sessionId;
        writeAssistant(result.text || "(no response)");
      }
      if (!controller.signal.aborted) setStatus("ready");
    } catch (caught) {
      if (!controller.signal.aborted) {
        const next = caught instanceof Error ? caught : new Error("The alliance is unreachable.");
        setError(next);
        setStatus("error");
        writeAssistant(next.message);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [agentId, updateMessages]);

  const stop = useCallback(() => {
    const controller = abortRef.current;
    controller?.abort();
    abortRef.current = null;
    const sessionId = conversationFor(agentId).sessionId;
    if (sessionId) void cancelTurn(sessionId).catch(() => undefined);
    setStatus("ready");
  }, [agentId]);

  return { messages, sendMessage, status, stop, error };
}
