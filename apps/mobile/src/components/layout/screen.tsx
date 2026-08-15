import type { PropsWithChildren } from 'react';
import { View, type ViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { cn } from '@/lib/utils';

export interface ScreenProps extends PropsWithChildren<ViewProps> {
  edges?: Edge[];
  className?: string;
}

/** Base screen container — obsidian/paper background + safe area. */
export function Screen({ edges = ['top'], className, children, ...props }: ScreenProps) {
  return (
    <SafeAreaView edges={edges} className={cn('flex-1 bg-background', className)} {...props}>
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  );
}
