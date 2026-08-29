import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import type { Agent } from "@/agents/roster";
import { alpha, colors, fonts } from "@/theme";

import { ThemedText } from "./themed-text";

const SIZES = { sm: 34, md: 44, lg: 58 } as const;

/**
 * Monogram avatar. With no color in the system, state is carried by **fill vs
 * outline**: an inactive member is a hairline circle, an active one is filled
 * ink. That reads faster than a hue change and survives being printed.
 *
 * While a member holds the floor a soft ring breathes behind them — the only
 * ambient motion in the room, so the eye lands on whoever is speaking.
 */
export function AgentAvatar({
  agent,
  size = "md",
  speaking = false,
  dimmed = false,
}: {
  agent: Agent;
  size?: keyof typeof SIZES;
  speaking?: boolean;
  dimmed?: boolean;
}) {
  const dimension = SIZES[size];
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (speaking) {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 220 });
    }
    return () => cancelAnimation(pulse);
  }, [speaking, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.06 + pulse.value * 0.16,
    transform: [{ scale: 1 + pulse.value * 0.3 }],
  }));

  const filled = speaking || !dimmed;

  return (
    <View style={{ width: dimension, height: dimension }}>
      {speaking ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.ring, { borderRadius: dimension / 2 }, ringStyle]}
        />
      ) : null}

      <View
        style={[
          styles.body,
          {
            borderRadius: dimension / 2,
            backgroundColor: filled ? colors.ink : "transparent",
            borderColor: filled ? colors.ink : colors.hairlineStrong,
          },
        ]}
      >
        <ThemedText
          style={{
            fontFamily: fonts.semibold,
            fontSize: dimension * 0.31,
            letterSpacing: 0.3,
            color: filled ? colors.onInk : colors.tertiaryLabel,
          }}
        >
          {agent.monogram}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(1),
  },
  body: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
