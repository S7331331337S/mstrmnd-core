import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';

import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/theme-provider';
import { blur as blurTokens } from '@/theme/tokens';

type GlassVariant = keyof typeof blurTokens;
type Edge = 'top' | 'bottom' | 'none';

export interface GlassSurfaceProps extends PropsWithChildren<ViewProps> {
  variant?: GlassVariant;
  /** Draws a single hairline on the given edge — the crisp seam between the
   * glass surface and the content behind it. */
  edge?: Edge;
  className?: string;
}

/**
 * The brand's translucent material: a real gaussian blur (native on iOS
 * and web via backdrop-filter; a tinted fallback on platforms without it)
 * plus a low-opacity tint so text stays legible over any background, and a
 * single 0.5px hairline seam instead of a hard drop shadow.
 */
export function GlassSurface({
  variant = 'bar',
  edge = 'none',
  className,
  style,
  children,
  ...props
}: GlassSurfaceProps) {
  const { theme } = useTheme();
  const intensity = blurTokens[variant][theme.scheme];

  const edgeStyle =
    edge === 'top'
      ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line }
      : edge === 'bottom'
        ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line }
        : null;

  return (
    <View className={cn('overflow-hidden', className)} style={[edgeStyle, style]} {...props}>
      <BlurView
        intensity={intensity}
        tint={theme.blurTint}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={StyleSheet.absoluteFill}
        className={theme.scheme === 'dark' ? 'bg-background/40' : 'bg-background/55'}
      />
      {children}
    </View>
  );
}
