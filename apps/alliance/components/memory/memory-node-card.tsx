import { View } from 'react-native';

import type { MemoryNode } from '@/lib/memory';
import { Badge, Card, Label, Text } from '@/components/ui';

const typeLabel: Record<MemoryNode['type'], string> = {
  memory: 'Memory',
  concept: 'Concept',
  artifact: 'Artifact',
};

export function MemoryNodeCard({ node }: { node: MemoryNode }) {
  return (
    <Card padding="md" radius="lg" className="mb-3">
      <View className="flex-row items-start justify-between gap-3">
        <Text variant="callout" weight="semibold" className="flex-1">
          {node.title}
        </Text>
        <Badge tone="accent">{typeLabel[node.type]}</Badge>
      </View>
      <Text variant="footnote" tone="muted" className="mt-2" numberOfLines={3}>
        {node.content}
      </Text>
      <View className="mt-3 flex-row items-center justify-between">
        <ConfidenceMeter value={node.confidence} />
        {node.relationships.length > 0 ? (
          <Label tone="subtle">
            {node.relationships.length} link{node.relationships.length === 1 ? '' : 's'}
          </Label>
        ) : null}
      </View>
    </Card>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-[3px] w-14 overflow-hidden rounded-full bg-muted">
        <View className="h-full rounded-full bg-accent" style={{ width: `${Math.round(value * 100)}%` }} />
      </View>
      <Label tone="subtle">{Math.round(value * 100)}%</Label>
    </View>
  );
}
