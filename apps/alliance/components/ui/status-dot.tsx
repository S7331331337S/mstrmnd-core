import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { cn } from '@/lib/utils';

export interface StatusDotProps {
  status?: 'online' | 'idle' | 'offline';
  pulse?: boolean;
  size?: number;
  className?: string;
}

const toneClass: Record<NonNullable<StatusDotProps['status']>, string> = {
  online: 'bg-accent',
  idle: 'bg-warning',
  offline: 'bg-foreground-subtle',
};

/** A small status indicator with the brand's slow breathing pulse for
 * "online" — mirrors `.pulse-brand` on the web dashboard. */
export function StatusDot({ status = 'online', pulse = status === 'online', size = 7, className }: StatusDotProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!pulse) {
      opacity.value = 1;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [pulse, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        className={cn('rounded-full', toneClass[status], className)}
        style={[{ width: size, height: size }, animatedStyle]}
      />
    </View>
  );
}
