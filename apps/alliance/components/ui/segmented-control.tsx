import { useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { motion } from '@/theme/tokens';
import { Text } from './text';

export interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** A tight, mechanical segmented control — used for the theme picker and
 * similar tri-state choices. Slides a solid indicator behind the active
 * label instead of restyling each segment independently. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const [width, setWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = width / options.length;

  const indicatorStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: withSpring(activeIndex * segmentWidth, motion.spring.snappy) }],
  }));

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      className={`flex-row rounded-md bg-muted p-1 ${className ?? ''}`}
    >
      {width > 0 ? (
        <Animated.View
          style={indicatorStyle}
          className="absolute bottom-1 top-1 rounded-sm bg-surface border-[0.5px] border-line/70"
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            className="flex-1 items-center justify-center py-2"
            onPress={() => {
              if (Platform.OS !== 'web') void Haptics.selectionAsync();
              onChange(option.value);
            }}
          >
            <Text variant="footnote" weight="semibold" tone={active ? 'default' : 'subtle'}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
