import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import { extractVerdict, runDeliberation, type Depth } from "@/agents/deliberation";
import { createAnthropicProvider } from "@/agents/providers/anthropic";
import { createDemoProvider } from "@/agents/providers/demo";
import type { AgentId } from "@/agents/roster";
import { createId } from "@/lib/id";
import { useSettings, type ModelId } from "@/lib/settings-store";
import type { EngineKind, Session, Turn } from "@/lib/types";

const SESSIONS_KEY = "mstrmnd.sessions.v1";
const MAX_STORED = 50;

type SessionState = {
  sessions: Session[];
  hydrated: boolean;
  /** Abort handle for the session currently running, if any. */
  runningId: string | null;

  hydrate(): Promise<void>;
  create(input: { topic: string; context: string; members: AgentId[] }): Session;
  get(id: string): Session | undefined;
  run(id: string): Promise<void>;
  stop(): void;
  remove(id: string): void;
  clear(): void;
};

let controller: AbortController | null = null;

export const useSessions = create<SessionState>((set, get) => {
  /** Apply a change to one session and keep the persisted copy in step. */
  const patch = (id: string, update: (session: Session) => Session) => {
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...update(s), updatedAt: Date.now() } : s,
      ),
    }));
    void persist(get().sessions);
  };

  const patchTurn = (id: string, turnId: string, update: (turn: Turn) => Turn) =>
    patch(id, (session) => ({
      ...session,
      turns: session.turns.map((t) => (t.id === turnId ? update(t) : t)),
    }));

  return {
    sessions: [],
    hydrated: false,
    runningId: null,

    async hydrate() {
      if (get().hydrated) return;

      const raw = await AsyncStorage.getItem(SESSIONS_KEY).catch(() => null);
      let sessions: Session[] = [];
      if (raw) {
        try {
          sessions = JSON.parse(raw) as Session[];
        } catch {
          sessions = []; // Corrupt history is dropped rather than crashing launch.
        }
      }

      // Anything left mid-run by a crash or force-quit is not resumable.
      sessions = sessions.map((s) =>
        s.status === "running" ? { ...s, status: "stopped" as const } : s,
      );

      set({ sessions, hydrated: true });
    },

    create({ topic, context, members }) {
      const session: Session = {
        id: createId("s_"),
        topic: topic.trim(),
        context: context.trim(),
        members,
        turns: [],
        status: "draft",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        engine: currentEngine(),
      };

      set((state) => ({ sessions: [session, ...state.sessions].slice(0, MAX_STORED) }));
      void persist(get().sessions);
      return session;
    },

    get(id) {
      return get().sessions.find((s) => s.id === id);
    },

    async run(id) {
      const session = get().get(id);
      if (!session || get().runningId) return;

      const { apiKey, model, depth } = useSettings.getState();
      const provider = apiKey
        ? createAnthropicProvider(apiKey, model as ModelId)
        : createDemoProvider();

      controller = new AbortController();
      set({ runningId: id });
      patch(id, (s) => ({ ...s, status: "running", turns: [], engine: provider.kind }));

      try {
        await runDeliberation({
          session,
          provider,
          depth: depth as Depth,
          signal: controller.signal,
          events: {
            onTurnStart(turn) {
              patch(id, (s) => ({ ...s, turns: [...s.turns, turn] }));
            },
            onDelta(turnId, text) {
              patchTurn(id, turnId, (t) => ({
                ...t,
                status: "speaking",
                text: t.text + text,
              }));
            },
            onTurnEnd(turnId, finalText) {
              patchTurn(id, turnId, (t) => ({ ...t, status: "done", text: finalText }));
            },
            onTurnError(turnId, message) {
              patchTurn(id, turnId, (t) => ({ ...t, status: "error", error: message }));
            },
          },
        });

        const aborted = controller.signal.aborted;
        patch(id, (s) => {
          const ruling = s.turns.find((t) => t.round === "ruling" && t.status === "done");
          const everyTurnFailed =
            s.turns.length > 0 && s.turns.every((t) => t.status === "error");
          return {
            ...s,
            status: aborted ? "stopped" : everyTurnFailed ? "error" : "complete",
            verdict: ruling ? extractVerdict(ruling.text) : undefined,
          };
        });
      } catch {
        patch(id, (s) => ({ ...s, status: "error" }));
      } finally {
        controller = null;
        set({ runningId: null });
      }
    },

    stop() {
      controller?.abort();
      controller = null;
      set({ runningId: null });
    },

    remove(id) {
      if (get().runningId === id) get().stop();
      set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
      void persist(get().sessions);
    },

    clear() {
      get().stop();
      set({ sessions: [] });
      void persist([]);
    },
  };
});

function currentEngine(): EngineKind {
  return useSettings.getState().apiKey ? "claude" : "demo";
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let pending: Session[] | null = null;

/**
 * Debounced write. State updates land on every streamed token, so writing through
 * each one would serialize the whole history hundreds of times per deliberation.
 */
function persist(sessions: Session[]): void {
  pending = sessions;
  if (persistTimer) return;

  persistTimer = setTimeout(() => {
    persistTimer = null;
    const snapshot = pending;
    pending = null;
    if (!snapshot) return;

    void AsyncStorage.setItem(
      SESSIONS_KEY,
      JSON.stringify(snapshot.slice(0, MAX_STORED)),
    ).catch(() => {});
  }, 600);
}
