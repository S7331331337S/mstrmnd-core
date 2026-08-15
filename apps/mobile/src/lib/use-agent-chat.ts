import { useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';

import { generateAPIUrl } from './utils';

/**
 * One `useChat` instance per agent id. The AI SDK keys its internal chat
 * store by `id`, so switching the active agent in the UI and switching
 * back restores that agent's history instead of losing it.
 */
export function useAgentChat(agentId: string) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        fetch: expoFetch as unknown as typeof globalThis.fetch,
        api: generateAPIUrl('/api/chat'),
        body: () => ({ agentId }),
      }),
    [agentId],
  );

  return useChat({ id: agentId, transport });
}
