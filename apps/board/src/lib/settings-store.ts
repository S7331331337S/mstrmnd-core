import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

import type { Depth } from "@/agents/deliberation";

export const MODELS = [
  { id: "claude-opus-5", label: "Opus 5", hint: "Sharpest board. Slowest." },
  { id: "claude-sonnet-5", label: "Sonnet 5", hint: "Best balance. Recommended." },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", hint: "Fastest, cheapest." },
] as const;

export type ModelId = (typeof MODELS)[number]["id"];

const PREFS_KEY = "mstrmnd.prefs.v1";
const API_KEY_KEY = "mstrmnd.anthropic.key";

type Prefs = {
  model: ModelId;
  depth: Depth;
  haptics: boolean;
};

const DEFAULT_PREFS: Prefs = {
  model: "claude-sonnet-5",
  depth: "full",
  haptics: true,
};

type SettingsState = Prefs & {
  apiKey: string | null;
  hydrated: boolean;
  hydrate(): Promise<void>;
  setModel(model: ModelId): void;
  setDepth(depth: Depth): void;
  setHaptics(haptics: boolean): void;
  setApiKey(key: string | null): Promise<void>;
};

/**
 * SecureStore is unavailable on web, where AsyncStorage (localStorage) is the
 * only option. The web build is for previewing, so the key is stored there with
 * that tradeoff made explicit in the UI.
 */
async function readApiKey(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return await AsyncStorage.getItem(API_KEY_KEY);
    return await SecureStore.getItemAsync(API_KEY_KEY);
  } catch {
    return null;
  }
}

async function writeApiKey(key: string | null): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (key) await AsyncStorage.setItem(API_KEY_KEY, key);
      else await AsyncStorage.removeItem(API_KEY_KEY);
      return;
    }
    if (key) await SecureStore.setItemAsync(API_KEY_KEY, key);
    else await SecureStore.deleteItemAsync(API_KEY_KEY);
  } catch {
    // Storage failure shouldn't crash settings; the key just won't persist.
  }
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULT_PREFS,
  apiKey: null,
  hydrated: false,

  async hydrate() {
    if (get().hydrated) return;

    const [raw, apiKey] = await Promise.all([
      AsyncStorage.getItem(PREFS_KEY).catch(() => null),
      readApiKey(),
    ]);

    let prefs = DEFAULT_PREFS;
    if (raw) {
      try {
        prefs = { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
      } catch {
        // Corrupt prefs fall back to defaults rather than blocking startup.
      }
    }

    set({ ...prefs, apiKey, hydrated: true });
  },

  setModel(model) {
    set({ model });
    void persist(get());
  },
  setDepth(depth) {
    set({ depth });
    void persist(get());
  },
  setHaptics(haptics) {
    set({ haptics });
    void persist(get());
  },
  async setApiKey(key) {
    const trimmed = key?.trim() || null;
    set({ apiKey: trimmed });
    await writeApiKey(trimmed);
  },
}));

function persist(state: SettingsState): Promise<void> {
  const prefs: Prefs = {
    model: state.model,
    depth: state.depth,
    haptics: state.haptics,
  };
  return AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
}
