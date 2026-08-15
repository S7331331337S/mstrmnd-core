import { useState } from 'react';
import { View } from 'react-native';
import { ArrowUp, Square } from 'lucide-react-native';

import { IconButton, TextField } from '@/components/ui';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useTheme } from '@/theme/theme-provider';

export interface ComposerProps {
  onSend: (text: string) => void;
  onStop?: () => void;
  streaming?: boolean;
  placeholder?: string;
  bottomInset?: number;
}

export function Composer({
  onSend,
  onStop,
  streaming,
  placeholder = 'Message the alliance…',
  bottomInset = 0,
}: ComposerProps) {
  const [value, setValue] = useState('');
  const { theme } = useTheme();

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  };

  return (
    <GlassSurface
      variant="bar"
      edge="top"
      className="px-4 pt-3"
      style={{ paddingBottom: bottomInset + 8 }}
    >
      <View className="flex-row items-end gap-2">
        <TextField
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          multiline
          containerClassName="flex-1 min-h-[44px]"
          className="max-h-28 py-2.5"
          onSubmitEditing={submit}
          blurOnSubmit={false}
          returnKeyType="send"
        />
        <IconButton
          variant="solid"
          size="md"
          onPress={streaming ? onStop : submit}
          disabled={!streaming && value.trim().length === 0}
          accessibilityLabel={streaming ? 'Stop response' : 'Send message'}
        >
          {streaming ? (
            <Square size={16} color={theme.accentForeground} fill={theme.accentForeground} />
          ) : (
            <ArrowUp size={18} color={theme.accentForeground} strokeWidth={2.5} />
          )}
        </IconButton>
      </View>
    </GlassSurface>
  );
}
