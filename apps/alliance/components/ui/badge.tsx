import { View, type ViewProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Label } from './label';

const badgeVariants = cva('flex-row items-center self-start rounded-xs border-[0.5px] px-2 py-1', {
  variants: {
    tone: {
      default: 'bg-muted border-line/70',
      accent: 'bg-accent-dim/[0.14] border-accent/25',
      warning: 'bg-warning/10 border-warning/30',
      danger: 'bg-danger/10 border-danger/30',
    },
  },
  defaultVariants: { tone: 'default' },
});

const labelTone: Record<string, 'subtle' | 'accent' | 'warning' | 'danger'> = {
  default: 'subtle',
  accent: 'accent',
  warning: 'warning',
  danger: 'danger',
};

export interface BadgeProps extends ViewProps, VariantProps<typeof badgeVariants> {
  children: string;
  className?: string;
}

export function Badge({ tone = 'default', children, className, ...props }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ tone }), className)} {...props}>
      <Label tone={labelTone[tone ?? 'default']} className="tracking-wide">
        {children}
      </Label>
    </View>
  );
}
