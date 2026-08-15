import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { AgentSwitcherSheet, ChatHeader, Composer, MessageList } from '@/components/chat';
import { Label, Text } from '@/components/ui';
import { getAgent } from '@/lib/agents';
import { useAgentChat } from '@/lib/use-agent-chat';
import { useTabBarInset } from '@/theme/layout';

export default function ChatScreen() {
  const params = useLocalSearchParams<{ agent?: string }>();
  const [activeAgentId, setActiveAgentId] = useState(params.agent ?? 'hermes');
  const [switcherVisible, setSwitcherVisible] = useState(false);
  const agent = getAgent(activeAgentId);
  const tabBarInset = useTabBarInset();

  // Adjust state during render when navigated here with a new `?agent=`
  // param (e.g. from the Alliance tab) — see "Adjusting state" in the React
  // docs. Deliberately not an effect: this must happen before paint.
  const [lastParamAgent, setLastParamAgent] = useState(params.agent);
  if (params.agent && params.agent !== lastParamAgent) {
    setLastParamAgent(params.agent);
    setActiveAgentId(params.agent);
  }

  const { messages, sendMessage, status, stop, error } = useAgentChat(activeAgentId);
  const isStreaming = status === 'streaming' || status === 'submitted';

  return (
    <Screen edges={[]}>
      <ChatHeader agent={agent} onPressSwitch={() => setSwitcherVisible(true)} />
      <View className="flex-1">
        <MessageList messages={messages} agent={agent} status={status} />
        {error ? (
          <View className="mx-4 mb-2 rounded-md border-[0.5px] border-danger/30 bg-danger/10 px-3 py-2">
            <Label tone="danger">Connection issue</Label>
            <Text variant="footnote" tone="danger" className="mt-0.5">
              {error.message}
            </Text>
          </View>
        ) : null}
      </View>
      <Composer
        streaming={isStreaming}
        onStop={stop}
        bottomInset={tabBarInset}
        onSend={(text) => {
          void sendMessage({ text });
        }}
      />
      <AgentSwitcherSheet
        visible={switcherVisible}
        activeId={activeAgentId}
        onClose={() => setSwitcherVisible(false)}
        onSelect={setActiveAgentId}
      />
    </Screen>
  );
}
