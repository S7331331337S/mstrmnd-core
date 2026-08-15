import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  simulateReadableStream,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type UIMessage,
} from 'ai';
import { MockLanguageModelV4 } from 'ai/test';

import { getAgent } from '@/lib/agents';

export const runtime = 'nodejs';

interface ChatRequestBody {
  messages: UIMessage[];
  agentId?: string;
}

export async function POST(req: Request) {
  const { messages, agentId } = (await req.json()) as ChatRequestBody;
  const agent = getAgent(agentId ?? 'hermes');

  const result = streamText({
    model: resolveModel(agent.id, lastUserText(messages), agent.mockReply),
    system: agent.system,
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'none',
    },
  });
}

/**
 * Resolves a live Vercel AI Gateway model when `AI_GATEWAY_API_KEY` is
 * configured (Cloud Agent secret or `.env.local`), otherwise falls back to
 * an in-process mock model so the alliance is fully interactive out of the
 * box. Both paths run through the exact same `streamText` pipeline.
 */
function resolveModel(
  agentId: string,
  lastMessage: string,
  mockReply: (lastUserMessage: string) => string,
): LanguageModel {
  const hasGateway = Boolean(process.env.AI_GATEWAY_API_KEY);
  if (hasGateway) {
    return (process.env.EXPO_PUBLIC_MSTRMND_MODEL || 'anthropic/claude-sonnet-4.5') as LanguageModel;
  }
  return createDemoModel(mockReply(lastMessage));
}

function createDemoModel(replyText: string): LanguageModel {
  const words = replyText.split(' ');
  const textId = 'demo-1';

  return new MockLanguageModelV4({
    doStream: async () => ({
      stream: simulateReadableStream({
        initialDelayInMs: 260,
        chunkDelayInMs: 28,
        chunks: [
          { type: 'text-start', id: textId },
          ...words.map((word, index) => ({
            type: 'text-delta' as const,
            id: textId,
            delta: index === 0 ? word : ` ${word}`,
          })),
          { type: 'text-end', id: textId },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
              inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: words.length, text: words.length, reasoning: undefined },
            },
          },
        ],
      }),
    }),
  });
}

function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'user') continue;
    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join(' ');
  }
  return '';
}
