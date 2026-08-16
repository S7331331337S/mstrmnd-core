"use client";

import { useEffect, useRef, useState } from "react";
import { useEveAgent } from "eve/react";

function textOf(message: {
  parts: readonly { type: string; text?: string }[];
}): string {
  return message.parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

export function AllianceCommand() {
  const agent = useEveAgent();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isBusy = agent.status === "submitted" || agent.status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [agent.data.messages, agent.status]);

  const subagentEvents = agent.events.filter(
    (e) => e.type === "subagent.called" || e.type === "subagent.completed",
  ).length;

  return (
    <section className="flex flex-col border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 h-10">
        <span className="label">Command · Maestro</span>
        <span className="label flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isBusy ? "bg-accent pulse" : "bg-faint"
            }`}
          />
          {agent.status}
          {subagentEvents > 0 ? ` · ${subagentEvents} subagent events` : ""}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="h-[420px] overflow-y-auto px-4 py-4 flex flex-col gap-4"
      >
        {agent.data.messages.length === 0 ? (
          <div className="text-muted text-sm leading-relaxed">
            <p className="text-foreground mb-2">The alliance is standing by.</p>
            <p>
              Give Maestro a goal. It assembles context from the Third-Mind,
              coordinates specialists, and executes. Try:
            </p>
            <ul className="mt-3 space-y-1 mono text-xs text-faint">
              <li>&rsaquo; Summarize how the MSTRMND alliance is organized.</li>
              <li>&rsaquo; What should I keep in the Third-Mind and why?</li>
            </ul>
          </div>
        ) : (
          agent.data.messages.map((message) => {
            const body = textOf(message);
            const isUser = message.role === "user";
            return (
              <div key={message.id} className="flex flex-col gap-1">
                <span className="label">
                  {isUser ? "Operator" : "Maestro"}
                </span>
                <div
                  className={`text-sm leading-relaxed whitespace-pre-wrap ${
                    isUser ? "text-muted" : "text-foreground"
                  }`}
                >
                  {body || (
                    <span className="text-faint mono text-xs">…</span>
                  )}
                </div>
              </div>
            );
          })
        )}
        {agent.status === "streaming" && (
          <span className="label pulse">Maestro is responding…</span>
        )}
        {agent.status === "error" && (
          <span className="label text-foreground">
            Error: {agent.error?.message ?? "unknown"}
          </span>
        )}
      </div>

      <form
        className="flex items-center gap-2 border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          const value = input.trim();
          if (value.length === 0 || isBusy) return;
          setInput("");
          void agent.send(value);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={isBusy}
          placeholder="Direct the alliance…"
          className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-faint disabled:opacity-50"
        />
        {isBusy ? (
          <button
            type="button"
            onClick={() => void agent.cancel()}
            className="label border border-line-strong px-3 py-1.5 hover:text-foreground"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={input.trim().length === 0}
            className="label border border-line-strong px-3 py-1.5 text-foreground hover:bg-surface-2 disabled:opacity-40"
          >
            Send
          </button>
        )}
      </form>
    </section>
  );
}
