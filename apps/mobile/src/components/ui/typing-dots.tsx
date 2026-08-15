import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

function Dot({ delay }: { delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 380 }),
          withTiming(0, { duration: 380 }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.3 + progress.value * 0.7,
    transform: [{ translateY: -progress.value * 2 }],
  }));

  return <Animated.View style={style} className="h-1.5 w-1.5 rounded-full bg-foreground-muted" />;
}

/** Three breathing dots — shown while an agent's reply is streaming. */
export function TypingDots() {
  return (
    <View className="flex-row items-center gap-1 px-1 py-1">
      <Dot delay={0} />
      <Dot delay={120} />
      <Dot delay={240} />
    </View>
  );
}
