import { useRef } from 'react';
import { FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import type { UIMessage } from 'ai';

import type { Agent } from '@/lib/agents';
import { EmptyState } from '@/components/ui';
import { MessageBubble } from './message-bubble';

export interface MessageListProps {
  messages: UIMessage[];
  agent: Agent;
  status: 'ready' | 'submitted' | 'streaming' | 'error';
  footer?: React.ReactElement | null;
}

export function MessageList({ messages, agent, status, footer }: MessageListProps) {
  const listRef = useRef<FlatList<UIMessage>>(null);
  const isStreaming = status === 'streaming' || status === 'submitted';

  if (messages.length === 0) {
    return (
      <EmptyState
        glyph={agent.glyph}
        title={`Talk to ${agent.name}`}
        description={agent.description}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1"
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <MessageBubble
            message={item}
            agent={agent}
            streaming={isStreaming && index === messages.length - 1 && item.role === 'assistant'}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListFooterComponent={footer}
        keyboardShouldPersistTaps="handled"
      />
    </KeyboardAvoidingView>
  );
}
