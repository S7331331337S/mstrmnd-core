import { useEffect, useState, type PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn } from '@/lib/utils';
import { motion } from '@/theme/tokens';
import { Divider } from './divider';

export interface SheetProps extends PropsWithChildren {
  visible: boolean;
  onClose: () => void;
  className?: string;
}

/**
 * A crisp bottom sheet — solid surface, hairline top border, drag handle,
 * spring entrance. Deliberately not built on RN's `Modal`: it renders
 * inconsistently on react-native-web (no true portal/overlay), so this
 * mounts a plain absolutely-positioned overlay instead, which behaves
 * identically on native and web.
 */
export function Sheet({ visible, onClose, className, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(400);
  const backdropOpacity = useSharedValue(0);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      // Mounting is the one legitimate case for calling setState directly in
      // this effect: it's syncing local render state ("is there a node to
      // animate yet") from the `visible` prop, not derived data that could
      // be computed during render. Unmounting is deferred until the exit
      // animation finishes, via the reanimated callback below.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      translateY.value = withSpring(0, motion.spring.gentle);
      backdropOpacity.value = withTiming(1, { duration: motion.duration.base });
    } else {
      translateY.value = withTiming(400, { duration: motion.duration.fast });
      backdropOpacity.value = withTiming(0, { duration: motion.duration.fast }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, translateY, backdropOpacity]);

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!mounted) return null;

  return (
    <View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', zIndex: 100, elevation: 100 }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable className="flex-1 bg-overlay/40" onPress={onClose} accessibilityLabel="Dismiss" />
      </Animated.View>
      <Animated.View style={[sheetStyle, { maxHeight: '80%' }]}>
        <View
          className={cn(
            'rounded-t-xl border-[0.5px] border-line bg-surface-raised px-5 pt-3',
            className,
          )}
        >
          <View className="items-center pb-3">
            <View className="h-1 w-9 rounded-full bg-line-strong/40" />
          </View>
          <Divider className="mb-2" />
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}
