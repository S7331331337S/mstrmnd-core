import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/utils';
import { useTheme } from '@/theme/theme-provider';

export interface TextFieldProps extends TextInputProps {
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  containerClassName?: string;
}

export function TextField({
  leading,
  trailing,
  className,
  containerClassName,
  onFocus,
  onBlur,
  style,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const { theme } = useTheme();

  return (
    <View
      className={cn(
        'flex-row items-center gap-2 rounded-lg border-[0.5px] bg-surface px-3',
        focused ? 'border-accent' : 'border-line',
        containerClassName,
      )}
    >
      {leading}
      <TextInput
        className={cn('flex-1 py-3 text-[15px] font-sans text-foreground', className)}
        placeholderTextColor={theme.foregroundSubtle}
        selectionColor={theme.accent}
        cursorColor={theme.accent}
        style={style}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...props}
      />
      {trailing}
    </View>
  );
}
