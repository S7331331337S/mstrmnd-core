import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { PressableScale, type PressableScaleProps } from './pressable-scale';

const iconButtonVariants = cva('items-center justify-center rounded-full', {
  variants: {
    variant: {
      solid: 'bg-accent',
      subtle: 'bg-muted',
      ghost: 'bg-transparent',
      outline: 'bg-transparent border border-[0.5px] border-line',
    },
    size: {
      sm: 'h-8 w-8',
      md: 'h-10 w-10',
      lg: 'h-12 w-12',
    },
    disabled: {
      true: 'opacity-40',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'ghost',
    size: 'md',
    disabled: false,
  },
});

export interface IconButtonProps
  extends Omit<PressableScaleProps, 'children'>,
    VariantProps<typeof iconButtonVariants> {
  children: React.ReactNode;
}

export function IconButton({
  variant,
  size,
  disabled,
  className,
  children,
  ...props
}: IconButtonProps) {
  return (
    <PressableScale
      className={cn(iconButtonVariants({ variant, size, disabled }), className)}
      disabled={disabled ?? undefined}
      scaleTo={0.9}
      haptic
      {...props}
    >
      {children}
    </PressableScale>
  );
}
