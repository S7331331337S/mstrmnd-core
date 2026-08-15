import { View, type ViewProps } from 'react-native';

import { cn } from '@/lib/utils';

export interface DividerProps extends ViewProps {
  orientation?: 'horizontal' | 'vertical';
  strong?: boolean;
  className?: string;
}

/** A crisp 0.5px hairline — the brand's signature thin line. */
export function Divider({ orientation = 'horizontal', strong, className, ...props }: DividerProps) {
  const colorClass = strong ? 'bg-line-strong/60' : 'bg-line/60';
  return (
    <View
      className={cn(
        orientation === 'horizontal' ? 'h-[0.5px] w-full' : 'w-[0.5px] h-full',
        colorClass,
        className,
      )}
      {...props}
    />
  );
}
