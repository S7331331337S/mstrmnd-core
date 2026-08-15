import { View } from 'react-native';
import type { UIMessage } from 'ai';

import { cn } from '@/lib/utils';
import type { Agent } from '@/lib/agents';
import { Avatar, Text, TypingDots } from '@/components/ui';

export interface MessageBubbleProps {
  message: UIMessage;
  agent: Agent;
  streaming?: boolean;
}

export function MessageBubble({ message, agent, streaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const text = message.parts
    .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('');

  return (
    <View className={cn('mb-3 flex-row items-end gap-2', isUser ? 'justify-end pl-10' : 'justify-start pr-10')}>
      {!isUser ? <Avatar glyph={agent.glyph} size="sm" tone="muted" /> : null}
      <View
        className={cn(
          'max-w-[82%] shrink rounded-lg border-[0.5px] px-4 py-3',
          isUser
            ? 'rounded-br-sm border-transparent bg-accent'
            : 'rounded-bl-sm border-line/70 bg-surface',
        )}
      >
        {text.length === 0 && streaming ? (
          <TypingDots />
        ) : (
          <Text
            variant="body"
            tone={isUser ? 'inverted' : 'default'}
            selectable
          >
            {text}
          </Text>
        )}
      </View>
    </View>
  );
}
