import { View } from 'react-native';
import { Check } from 'lucide-react-native';

import { agents } from '@/lib/agents';
import { Avatar, Label, PressableScale, Sheet, Text } from '@/components/ui';
import { useTheme } from '@/theme/theme-provider';

export interface AgentSwitcherSheetProps {
  visible: boolean;
  activeId: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}

export function AgentSwitcherSheet({ visible, activeId, onClose, onSelect }: AgentSwitcherSheetProps) {
  const { theme } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Label className="mb-3 px-1">The Alliance</Label>
      {agents.map((agent) => {
        const active = agent.id === activeId;
        return (
          <PressableScale
            key={agent.id}
            className="mb-1 flex-row items-center gap-3 rounded-md px-2 py-2.5"
            onPress={() => {
              onSelect(agent.id);
              onClose();
            }}
          >
            <Avatar glyph={agent.glyph} status={agent.status} size="md" tone={active ? 'accent' : 'muted'} />
            <View className="flex-1">
              <Text variant="callout" weight="semibold">
                {agent.name}
              </Text>
              <Text variant="footnote" tone="muted" numberOfLines={1}>
                {agent.role}
              </Text>
            </View>
            {active ? <Check size={18} color={theme.accent} /> : null}
          </PressableScale>
        );
      })}
    </Sheet>
  );
}
