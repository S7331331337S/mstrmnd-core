import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, LinearTransition } from "react-native-reanimated";

import { getAgent } from "@/agents/roster";
import { AgentAvatar } from "@/components/agent-avatar";
import { ThemedText } from "@/components/themed-text";
import { ThinkingDots } from "@/components/thinking-dots";
import type { Turn } from "@/lib/types";
import { colors, radius, shadows, spacing } from "@/theme";

import { RulingBody } from "./ruling-body";

/** One member's contribution to the transcript. */
export function TurnCard({ turn }: { turn: Turn }) {
  const agent = getAgent(turn.agentId);
  const isRuling = turn.round === "ruling";
  const speaking = turn.status === "speaking" || turn.status === "thinking";

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18).stiffness(140)}
      layout={LinearTransition.springify().damping(20)}
      style={[styles.card, isRuling && styles.ruling, speaking && styles.speaking]}
    >
      <View style={styles.header}>
        <AgentAvatar agent={agent} size="sm" speaking={speaking} />

        <View style={styles.identity}>
          <ThemedText variant="headline">{agent.name}</ThemedText>
          <ThemedText variant="overline">
            {isRuling ? "Ruling" : turn.round === "crossfire" ? "Crossfire" : agent.role}
          </ThemedText>
        </View>

        {turn.status === "thinking" ? <ThinkingDots /> : null}
      </View>

      {turn.status === "error" ? (
        <Animated.View entering={FadeIn} style={styles.error}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.secondaryLabel} />
          <ThemedText variant="subhead" style={styles.errorText}>
            {turn.error}
          </ThemedText>
        </Animated.View>
      ) : turn.text ? (
        isRuling ? (
          <RulingBody text={turn.text} />
        ) : (
          <ThemedText variant="body">
            {turn.text}
            {turn.status === "speaking" ? (
              <ThemedText style={styles.caret}>▍</ThemedText>
            ) : null}
          </ThemedText>
        )
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    boxShadow: shadows.card,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.lg,
    gap: spacing.md,
  },
  /** The member holding the floor is outlined and lifted, never tinted. */
  speaking: {
    borderColor: colors.hairlineStrong,
    boxShadow: shadows.raised,
  },
  ruling: {
    boxShadow: shadows.raised,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  identity: {
    flex: 1,
    gap: 3,
  },
  caret: {
    color: colors.tertiaryLabel,
  },
  error: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSunken,
    borderRadius: radius.md,
    borderCurve: "continuous",
    padding: spacing.md,
  },
  errorText: {
    flex: 1,
    color: colors.secondaryLabel,
  },
});
