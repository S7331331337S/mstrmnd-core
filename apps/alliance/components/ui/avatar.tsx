import { View } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Text } from './text';
import { StatusDot, type StatusDotProps } from './status-dot';

const avatarVariants = cva('items-center justify-center rounded-full border-[0.5px] border-line/70', {
  variants: {
    tone: {
      accent: 'bg-accent',
      muted: 'bg-muted',
    },
    size: {
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
      xl: 'h-16 w-16',
    },
  },
  defaultVariants: { tone: 'muted', size: 'md' },
});

const glyphSize: Record<string, 'footnote' | 'callout' | 'title3' | 'title2'> = {
  sm: 'footnote',
  md: 'callout',
  lg: 'title3',
  xl: 'title2',
};

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  glyph: string;
  status?: StatusDotProps['status'];
  className?: string;
}

export function Avatar({ glyph, tone, size = 'md', status, className }: AvatarProps) {
  return (
    <View className="relative">
      <View className={cn(avatarVariants({ tone, size }), className)}>
        <Text
          variant={glyphSize[size ?? 'md']}
          weight="monoSemibold"
          tone={tone === 'accent' ? 'inverted' : 'default'}
        >
          {glyph}
        </Text>
      </View>
      {status ? (
        <View className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background p-[2px]">
          <StatusDot status={status} size={8} />
        </View>
      ) : null}
    </View>
  );
}
