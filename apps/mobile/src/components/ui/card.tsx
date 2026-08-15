import { View, type ViewProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const cardVariants = cva('border-[0.5px] border-line/70', {
  variants: {
    surface: {
      flat: 'bg-transparent border-transparent',
      card: 'bg-surface',
      raised: 'bg-surface-raised',
    },
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-5',
    },
    radius: {
      sm: 'rounded-sm',
      md: 'rounded-md',
      lg: 'rounded-lg',
      xl: 'rounded-xl',
    },
  },
  defaultVariants: {
    surface: 'card',
    padding: 'md',
    radius: 'lg',
  },
});

export interface CardProps extends ViewProps, VariantProps<typeof cardVariants> {
  className?: string;
}

export function Card({ surface, padding, radius, className, ...props }: CardProps) {
  return <View className={cn(cardVariants({ surface, padding, radius }), className)} {...props} />;
}
