import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

import type { Depth } from "@/agents/deliberation";
import type { QualityHint } from "@/lib/types";

export const QUALITY = [
  { id: "fast" as const, label: "Fast", hint: "Cheapest. Good for a quick pass." },
  { id: "balanced" as const, label: "Balanced", hint: "Default. Best for most rooms." },
  { id: "capable" as const, label: "Capable", hint: "Slowest. Use when the question is hard." },
];

const PREFS_KEY = "mstrmnd.prefs.v2";
const TOKEN_KEY = "mstrmnd.os.session";
const LEGACY_PREFS_KEY = "mstrmnd.prefs.v1";
const LEGACY_API_KEY = "mstrmnd.anthropic.key";

const DEFAULT_OS_URL =
  process.env.EXPO_PUBLIC_MSTRMND_API_URL?.replace(/\/$/, "") || "http://localhost:3001";

type Prefs = {
  quality: QualityHint;
  depth: Depth;
  haptics: boolean;
  osBaseUrl: string;
};

const DEFAULT_PREFS: Prefs = {
  quality: "balanced",
  depth: "full",
  haptics: true,
  osBaseUrl: DEFAULT_OS_URL,
};

type SettingsState = Prefs & {
  token: string | null;
  email: string | null;
  hydrated: boolean;
  hydrate(): Promise<void>;
  setQuality(quality: QualityHint): void;
  setDepth(depth: Depth): void;
  setHaptics(haptics: boolean): void;
  setOsBaseUrl(url: string): void;
  setSession(input: { token: string; email: string } | null): Promise<void>;
};

/**
 * SecureStore is unavailable on web, where AsyncStorage (localStorage) is the
 * only option. The web build is for previewing, so the session token is stored
 * there with that tradeoff made explicit in the UI.
 */
async function readSecret(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return await AsyncStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeSecret(key: string, value: string | null): Promise<void> {
  try {
    if (Platform.OS === "web") {
      if (value) await AsyncStorage.setItem(key, value);
      else await AsyncStorage.removeItem(key);
      return;
    }
    if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // Storage failure shouldn't crash settings; the secret just won't persist.
  }
}

function normalizePrefs(raw: unknown): Prefs {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFS;
  const value = raw as Partial<Prefs> & { model?: string };
  const quality =
    value.quality === "fast" || value.quality === "capable" || value.quality === "balanced"
      ? value.quality
      : DEFAULT_PREFS.quality;
  return {
    quality,
    depth: value.depth === "quick" || value.depth === "full" ? value.depth : DEFAULT_PREFS.depth,
    haptics: typeof value.haptics === "boolean" ? value.haptics : DEFAULT_PREFS.haptics,
    osBaseUrl:
      typeof value.osBaseUrl === "string" && value.osBaseUrl.trim()
        ? value.osBaseUrl.replace(/\/$/, "")
        : DEFAULT_PREFS.osBaseUrl,
  };
}

export const useSettings = create<SettingsState>((set, get) => ({
  ...DEFAULT_PREFS,
  token: null,
  email: null,
  hydrated: false,

  async hydrate() {
    if (get().hydrated) return;

    const [raw, legacyRaw, token] = await Promise.all([
      AsyncStorage.getItem(PREFS_KEY).catch(() => null),
      AsyncStorage.getItem(LEGACY_PREFS_KEY).catch(() => null),
      readSecret(TOKEN_KEY),
    ]);

    // Drop any leftover client Anthropic key from the pre-OS build.
    await writeSecret(LEGACY_API_KEY, null);

    let prefs = DEFAULT_PREFS;
    const source = raw ?? legacyRaw;
    if (source) {
      try {
        prefs = normalizePrefs(JSON.parse(source) as unknown);
      } catch {
        // Corrupt prefs fall back to defaults rather than blocking startup.
      }
    }

    let email: string | null = null;
    if (token) {
      email = emailFromJwt(token);
    }

    set({ ...prefs, token, email, hydrated: true });
    if (!raw) void persist(get());
  },

  setQuality(quality) {
    set({ quality });
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
  setOsBaseUrl(url) {
    set({ osBaseUrl: url.trim().replace(/\/$/, "") || DEFAULT_OS_URL });
    void persist(get());
  },
  async setSession(input) {
    const token = input?.token?.trim() || null;
    const email = input?.email?.trim() || (token ? emailFromJwt(token) : null);
    set({ token, email });
    await writeSecret(TOKEN_KEY, token);
  },
}));

export function isHostedReady(state: Pick<SettingsState, "token" | "osBaseUrl">): boolean {
  return Boolean(state.token && state.osBaseUrl);
}

export function emailFromJwt(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(globalThis.atob(padded)) as { email?: unknown };
    return typeof json.email === "string" ? json.email : null;
  } catch {
    return null;
  }
}

function persist(state: SettingsState): Promise<void> {
  const prefs: Prefs = {
    quality: state.quality,
    depth: state.depth,
    haptics: state.haptics,
    osBaseUrl: state.osBaseUrl,
  };
  return AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
}
