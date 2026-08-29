import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getAgent } from "@/agents/roster";
import { AgentAvatar } from "@/components/agent-avatar";
import { Card } from "@/components/card";
import { Screen } from "@/components/screen";
import { ThemedText } from "@/components/themed-text";
import { useHaptics } from "@/hooks/use-haptics";
import { useSessions } from "@/lib/session-store";
import type { Session } from "@/lib/types";
import { colors, radius, shadows, spacing } from "@/theme";

export function Sessions() {
  const router = useRouter();
  const haptics = useHaptics();
  const insets = useSafeAreaInsets();

  const sessions = useSessions((s) => s.sessions);
  const remove = useSessions((s) => s.remove);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
          <ThemedText variant="largeTitle">History</ThemedText>
          <ThemedText variant="subhead">
            Every room the board has sat in.
          </ThemedText>
        </View>

        {sessions.length === 0 ? (
          <Animated.View entering={FadeIn}>
            <Card style={styles.empty}>
              <Ionicons name="albums-outline" size={26} color={colors.tertiaryLabel} />
              <ThemedText variant="headline">No sessions yet</ThemedText>
              <ThemedText variant="subhead" style={styles.emptyText}>
                Put a question to the board from the Table tab and it will show up here.
              </ThemedText>
            </Card>
          </Animated.View>
        ) : (
          sessions.map((session) => (
            <Animated.View key={session.id} layout={LinearTransition} entering={FadeIn}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  haptics.tap();
                  router.push(`/room/${session.id}`);
                }}
                onLongPress={() => {
                  haptics.warn();
                  remove(session.id);
                }}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowHead}>
                  <ThemedText variant="overline" style={{ color: statusColor(session) }}>
                    {statusText(session)}
                  </ThemedText>
                  <ThemedText variant="caption" style={{ color: colors.tertiaryLabel }}>
                    {relativeTime(session.createdAt)}
                  </ThemedText>
                </View>

                <ThemedText variant="headline" numberOfLines={2}>
                  {session.topic}
                </ThemedText>

                {session.verdict ? (
                  <View style={styles.verdict}>
                    <ThemedText variant="subhead" numberOfLines={3} style={styles.verdictText}>
                      {session.verdict}
                    </ThemedText>
                  </View>
                ) : null}

                <View style={styles.rowFoot}>
                  <View style={styles.bench}>
                    {session.members.slice(0, 5).map((id) => (
                      <AgentAvatar key={id} agent={getAgent(id)} size="sm" />
                    ))}
                    {session.members.length > 5 ? (
                      <ThemedText variant="caption" style={styles.more}>
                        +{session.members.length - 5}
                      </ThemedText>
                    ) : null}
                  </View>

                  <ThemedText variant="caption" style={{ color: colors.tertiaryLabel }}>
                    {session.engine === "demo" ? "offline" : "hosted"}
                  </ThemedText>
                </View>
              </Pressable>
            </Animated.View>
          ))
        )}

        {sessions.length > 0 ? (
          <ThemedText variant="caption" style={styles.hint}>
            Long-press a session to delete it.
          </ThemedText>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function statusText(session: Session): string {
  switch (session.status) {
    case "complete":
      return "Adjourned";
    case "running":
      return "In session";
    case "stopped":
      return "Stopped";
    case "error":
      return "Failed";
    default:
      return "Draft";
  }
}

/**
 * Status is carried by the word, not a hue — so the color only sets how loudly
 * it's said: live and finished states in ink, resting states receded.
 */
function statusColor(session: Session): string {
  switch (session.status) {
    case "running":
    case "complete":
      return colors.label;
    default:
      return colors.tertiaryLabel;
  }
}

function relativeTime(timestamp: number): string {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  head: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    textAlign: "center",
    maxWidth: 260,
  },
  row: {
    backgroundColor: colors.surface,
    boxShadow: shadows.card,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.md,
  },
  rowHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  verdict: {
    backgroundColor: colors.surfaceSunken,
    borderLeftWidth: 2,
    borderLeftColor: colors.ink,
    borderRadius: radius.sm,
    borderCurve: "continuous",
    padding: spacing.md,
  },
  verdictText: {
    color: colors.label,
  },
  rowFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bench: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  more: {
    color: colors.tertiaryLabel,
    marginLeft: spacing.xs,
  },
  hint: {
    textAlign: "center",
    color: colors.tertiaryLabel,
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
});
