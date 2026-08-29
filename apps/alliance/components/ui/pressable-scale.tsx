import { forwardRef } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { motion } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends PressableProps {
  /** Scale applied on press-in. Defaults to a tight, barely-there 0.97. */
  scaleTo?: number;
  haptic?: boolean;
}

/**
 * Shared press feedback for every interactive surface — a small mechanical
 * scale + opacity dip instead of a default Android ripple or iOS fade, so
 * buttons, cards, and chips all feel like one system.
 */
export const PressableScale = forwardRef<View, PressableScaleProps>(
  ({ scaleTo = 0.97, haptic = false, style, onPressIn, onPressOut, ...props }, ref) => {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
      opacity: opacity.value,
    }));

    return (
      <AnimatedPressable
        ref={ref}
        style={[animatedStyle, style]}
        onPressIn={(event) => {
          scale.value = withSpring(scaleTo, motion.spring.snappy);
          opacity.value = withSpring(0.86, motion.spring.snappy);
          if (haptic && Platform.OS !== 'web') {
            void Haptics.selectionAsync();
          }
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = withSpring(1, motion.spring.snappy);
          opacity.value = withSpring(1, motion.spring.snappy);
          onPressOut?.(event);
        }}
        {...props}
      />
    );
  },
);

PressableScale.displayName = 'PressableScale';
