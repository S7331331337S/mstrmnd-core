import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, shadows, spacing } from "@/theme";

/**
 * Neutral elevated container. Takes children rather than content props so it
 * outlives any particular screen's layout.
 */
export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return (
    <View style={[styles.card, padded && styles.padded, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderCurve: "continuous",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    boxShadow: shadows.card,
    overflow: "hidden",
  },
  padded: {
    padding: spacing.lg,
  },
});
