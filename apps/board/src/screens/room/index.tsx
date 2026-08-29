import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getAgent } from "@/agents/roster";
import { AgentAvatar } from "@/components/agent-avatar";
import { Button } from "@/components/button";
import { Screen } from "@/components/screen";
import { ThemedText } from "@/components/themed-text";
import { useHaptics } from "@/hooks/use-haptics";
import { useSessions } from "@/lib/session-store";
import type { Session } from "@/lib/types";
import { colors, spacing } from "@/theme";

import { TurnCard } from "./turn-card";

export function Room({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const session = useSessions((s) => s.sessions.find((item) => item.id === sessionId));
  const runningId = useSessions((s) => s.runningId);
  const run = useSessions((s) => s.run);
  const stop = useSessions((s) => s.stop);

  const isRunning = runningId === sessionId;
  const started = useRef(false);

  // Auto-convene on first open. The ref guards against the effect re-firing when
  // the session object changes identity on every streamed token.
  useEffect(() => {
    if (started.current || !session) return;
    if (session.status === "draft") {
      started.current = true;
      void run(sessionId);
    }
  }, [session, run, sessionId]);

  // Stop the board if the user leaves mid-deliberation.
  useEffect(() => {
    return () => {
      if (useSessions.getState().runningId === sessionId) {
        useSessions.getState().stop();
      }
    };
  }, [sessionId]);

  const doneCount = session?.turns.filter((t) => t.status === "done").length ?? 0;
  useEffect(() => {
    if (doneCount > 0) haptics.tap();
    // Only fire on a completed turn, not on every token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount]);

  if (!session) {
    return (
      <Screen>
        <View style={[styles.missing, { paddingTop: insets.top + spacing.xxxl }]}>
          <ThemedText variant="title">This session is gone.</ThemedText>
          <Button title="Back to the table" variant="secondary" onPress={() => router.replace("/")} />
        </View>
      </Screen>
    );
  }

  const share = async () => {
    try {
      await Share.share({ message: transcriptText(session) });
    } catch {
      // User dismissed the sheet, or sharing is unavailable on this platform.
    }
  };

  return (
    <Screen>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={12}
            onPress={() => {
              haptics.tap();
              router.back();
            }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.secondaryLabel} />
          </Pressable>

          <ThemedText variant="overline" style={styles.status}>
            {statusLabel(session, isRunning)}
          </ThemedText>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share transcript"
            hitSlop={12}
            disabled={session.turns.length === 0}
            onPress={() => {
              haptics.tap();
              void share();
            }}
            style={session.turns.length === 0 && styles.disabled}
          >
            <Ionicons name="share-outline" size={20} color={colors.secondaryLabel} />
          </Pressable>
        </View>

        <ThemedText variant="title" style={styles.topic}>
          {session.topic}
        </ThemedText>

        <View style={styles.bench}>
          {session.members.map((id) => {
            const agent = getAgent(id);
            const speaking = session.turns.some(
              (t) => t.agentId === id && (t.status === "speaking" || t.status === "thinking"),
            );
            const spoke = session.turns.some((t) => t.agentId === id && t.status === "done");
            return (
              <AgentAvatar
                key={id}
                agent={agent}
                size="sm"
                speaking={speaking}
                dimmed={!speaking && !spoke}
              />
            );
          })}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.transcript, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          if (isRunning) scrollRef.current?.scrollToEnd({ animated: true });
        }}
      >
        {session.turns.map((turn) => (
          <TurnCard key={turn.id} turn={turn} />
        ))}

        {session.turns.length === 0 ? (
          <Animated.View entering={FadeIn} style={styles.convening}>
            <ThemedText variant="subhead" style={{ color: colors.tertiaryLabel }}>
              Convening the board…
            </ThemedText>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + spacing.lg }]}>
        {isRunning ? (
          <Button
            title="Stop the room"
            variant="secondary"
            onPress={() => {
              haptics.warn();
              stop();
            }}
          />
        ) : (
          <Button
            title={session.turns.length ? "Run it again" : "Convene the board"}
            onPress={() => {
              haptics.heavy();
              void run(sessionId);
            }}
          />
        )}
      </View>
    </Screen>
  );
}

function statusLabel(session: Session, isRunning: boolean): string {
  if (isRunning) return "In session";
  switch (session.status) {
    case "complete":
      return "Adjourned";
    case "stopped":
      return "Stopped";
    case "error":
      return "Failed";
    default:
      return "Ready";
  }
}

/** Plain-text transcript for the share sheet. */
function transcriptText(session: Session): string {
  const lines = [session.topic, ""];
  if (session.context) lines.push(session.context, "");

  for (const turn of session.turns) {
    if (turn.status !== "done") continue;
    lines.push(`${getAgent(turn.agentId).name.toUpperCase()}`, turn.text, "");
  }

  lines.push("— Deliberated in MSTRMND");
  return lines.join("\n");
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  status: {
    color: colors.secondaryLabel,
  },
  topic: {
    color: colors.label,
  },
  bench: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  transcript: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  convening: {
    paddingVertical: spacing.xxxl,
    alignItems: "center",
  },
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.canvas,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairlineStrong,
  },
  missing: {
    flex: 1,
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  disabled: {
    opacity: 0.3,
  },
});
