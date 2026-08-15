import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Screen } from '@/components/layout/screen';
import { AgentCard } from '@/components/agents/agent-card';
import { Label, Text } from '@/components/ui';
import { agents } from '@/lib/agents';
import { useTabBarInset } from '@/theme/layout';

export default function AllianceScreen() {
  const router = useRouter();
  const tabBarInset = useTabBarInset();

  return (
    <Screen>
      <FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View className="mb-5 mt-2 px-1">
            <Label>MSTRMND // ALLIANCE</Label>
            <Text variant="title1" weight="semibold" className="mt-1">
              The Alliance
            </Text>
            <Text variant="footnote" tone="muted" className="mt-1.5">
              Specialist agents behind the intelligence layer. Tap one to start a conversation.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <AgentCard
            agent={item}
            onPress={() => router.navigate({ pathname: '/', params: { agent: item.id } })}
          />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: tabBarInset + 24 }}
      />
    </Screen>
  );
}
