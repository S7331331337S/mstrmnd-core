import { View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

import type { Agent } from '@/lib/agents';
import { Avatar, Card, Label, PressableScale, Text } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';

export interface AgentCardProps {
  agent: Agent;
  onPress: () => void;
}

export function AgentCard({ agent, onPress }: AgentCardProps) {
  const { theme } = useTheme();

  return (
    <PressableScale onPress={onPress} scaleTo={0.985}>
      <Card padding="md" radius="lg" className="mb-3 flex-row items-center gap-3">
        <Avatar glyph={agent.glyph} status={agent.status} size="lg" />
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text variant="callout" weight="semibold">
              {agent.name}
            </Text>
            <Label tone={agent.status === 'online' ? 'accent' : 'subtle'}>{agent.status}</Label>
          </View>
          <Text variant="footnote" tone="muted" className="mt-0.5">
            {agent.role}
          </Text>
          <Text variant="footnote" tone="subtle" numberOfLines={2} className="mt-1.5">
            {agent.description}
          </Text>
        </View>
        <ChevronRight size={18} color={theme.foregroundSubtle} />
      </Card>
    </PressableScale>
  );
}
