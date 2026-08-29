import { View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';

import type { Agent } from '@/lib/agents';
import { Avatar, Label, PressableScale, Text } from '@/components/ui';
import { GlassSurface } from '@/components/ui/glass-surface';
import { useTheme } from '@/theme/theme-provider';

export interface ChatHeaderProps {
  agent: Agent;
  onPressSwitch: () => void;
}

export function ChatHeader({ agent, onPressSwitch }: ChatHeaderProps) {
  const { theme } = useTheme();

  return (
    <GlassSurface variant="bar" edge="bottom" className="px-4 pb-3 pt-2">
      <PressableScale onPress={onPressSwitch} className="flex-row items-center gap-3">
        <Avatar glyph={agent.glyph} status={agent.status} size="md" />
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text variant="title3" weight="semibold">
              {agent.name}
            </Text>
            <ChevronDown size={16} color={theme.foregroundSubtle} />
          </View>
          <Label tone="subtle" className="mt-0.5">
            {agent.role}
          </Label>
        </View>
      </PressableScale>
    </GlassSurface>
  );
}
