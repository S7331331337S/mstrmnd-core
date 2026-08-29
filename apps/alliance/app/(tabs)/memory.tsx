import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Search } from 'lucide-react-native';

import { Screen } from '@/components/layout/screen';
import { MemoryNodeCard } from '@/components/memory/memory-node-card';
import { EmptyState, Label, Text, TextField } from '@/components/ui';
import { searchMemory } from '@/lib/memory';
import { useTabBarInset } from '@/theme/layout';
import { useTheme } from '@/theme/theme-provider';

export default function MemoryScreen() {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchMemory(query), [query]);
  const tabBarInset = useTabBarInset();
  const { theme } = useTheme();

  return (
    <Screen>
      <View className="px-4 pb-3 pt-2">
        <Label>PERSONAL MEMORY GRAPH</Label>
        <Text variant="title1" weight="semibold" className="mt-1">
          Memory
        </Text>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes, identity, artifacts…"
          className="text-[15px]"
          containerClassName="mt-4"
          leading={<Search size={16} color={theme.foregroundSubtle} />}
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MemoryNodeCard node={item} />}
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: tabBarInset + 24 }}
        ListEmptyComponent={
          <EmptyState glyph="∅" title="No matches" description="Try a different search term." />
        }
        keyboardShouldPersistTaps="handled"
      />
    </Screen>
  );
}
