import { View } from 'react-native';

import { Text } from './text';

export interface EmptyStateProps {
  glyph?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ glyph, title, description, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-10 py-16">
      {glyph ? (
        <View className="mb-1 h-14 w-14 items-center justify-center rounded-full border-[0.5px] border-line bg-muted">
          <Text variant="title2" weight="monoSemibold" tone="subtle">
            {glyph}
          </Text>
        </View>
      ) : null}
      <Text variant="title3" weight="semibold" className="text-center">
        {title}
      </Text>
      {description ? (
        <Text variant="footnote" tone="muted" className="text-center">
          {description}
        </Text>
      ) : null}
      {action}
    </View>
  );
}
