import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useHaptics } from "@/hooks/use-haptics";
import { colors, radius, shadows, spacing } from "@/theme";

import { ThemedText } from "./themed-text";

/**
 * Emphasis is carried by fill weight, since there is no accent color to escalate
 * to: filled ink > filled grey > hairline outline.
 */
const variants = {
  primary: { background: colors.ink, label: colors.onInk, bordered: false, lift: true },
  secondary: { background: colors.surfaceSunken, label: colors.label, bordered: false, lift: false },
  ghost: { background: colors.surface, label: colors.secondaryLabel, bordered: true, lift: false },
} as const;

const sizes = {
  sm: { paddingVertical: 9, paddingHorizontal: spacing.lg, variant: "caption" },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, variant: "headline" },
  lg: { paddingVertical: 15, paddingHorizontal: spacing.xl, variant: "headline" },
} as const;

export function Button({
  title,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  style,
  onPress,
}: {
  title: string;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const haptics = useHaptics();
  const v = variants[variant];
  const s = sizes[size];
  const isOff = disabled || loading;

  // A disabled button becomes genuinely inert rather than a faded solid — fading
  // ink just reads as a grey button that ought to work.
  const background = disabled ? colors.surfaceSunken : v.background;
  const label = disabled ? colors.tertiaryLabel : v.label;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isOff, busy: loading }}
      disabled={isOff}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          paddingHorizontal: s.paddingHorizontal,
          backgroundColor: background,
          opacity: pressed && !isOff ? 0.9 : 1,
          transform: [{ scale: pressed && !isOff ? 0.985 : 1 }],
        },
        v.bordered && styles.bordered,
        v.lift && !disabled && styles.lift,
        style,
      ]}
    >
      <View style={[styles.body, { paddingVertical: s.paddingVertical }]}>
        {loading ? (
          <ActivityIndicator color={label} size="small" />
        ) : (
          <ThemedText variant={s.variant} style={{ color: label }}>
            {title}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bordered: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairlineStrong,
  },
  lift: {
    boxShadow: shadows.card,
  },
  body: {
    alignItems: "center",
    justifyContent: "center",
  },
});
