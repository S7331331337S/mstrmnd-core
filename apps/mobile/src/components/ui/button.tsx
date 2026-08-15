import { ActivityIndicator, View } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/theme-provider';
import { PressableScale, type PressableScaleProps } from './pressable-scale';
import { Text } from './text';

const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-lg border border-transparent',
  {
    variants: {
      variant: {
        primary: 'bg-accent',
        secondary: 'bg-surface border-line/60',
        outline: 'bg-transparent border-line',
        ghost: 'bg-transparent',
        destructive: 'bg-danger/10 border-danger/25',
      },
      size: {
        sm: 'h-9 px-3 rounded-md',
        md: 'h-11 px-4',
        lg: 'h-[52px] px-5 rounded-lg',
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
      disabled: {
        true: 'opacity-40',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      fullWidth: false,
      disabled: false,
    },
  },
);

const labelTone: Record<string, 'inverted' | 'default' | 'danger'> = {
  primary: 'inverted',
  secondary: 'default',
  outline: 'default',
  ghost: 'default',
  destructive: 'danger',
};

export interface ButtonProps
  extends Omit<PressableScaleProps, 'children'>,
    VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  disabled,
  loading,
  icon,
  trailingIcon,
  children,
  className,
  ...props
}: ButtonProps) {
  const { theme } = useTheme();
  const tone = labelTone[variant ?? 'primary'];

  return (
    <PressableScale
      className={cn(buttonVariants({ variant, size, fullWidth, disabled: disabled || loading }), className)}
      disabled={disabled || loading}
      haptic
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' ? theme.accentForeground : theme.foreground} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text
            variant={size === 'sm' ? 'footnote' : 'callout'}
            weight="semibold"
            tone={tone}
            numberOfLines={1}
          >
            {children}
          </Text>
          {trailingIcon ? <View>{trailingIcon}</View> : null}
        </>
      )}
    </PressableScale>
  );
}
