// ============================================================
// harness/fake-anthropic — a local /v1/messages endpoint
// ============================================================
// Stands in for the Anthropic API so the loop can be exercised
// without credentials. It is deliberately NOT a mock of the agent
// classes: the real SDK sends real HTTP here, and the real parsing,
// validation and error handling run against the response.
//
// It also enforces the model allowlist the way the real API does,
// so a bad model id fails here exactly as it would in production.
// ============================================================

import { createServer, type Server } from 'node:http';

const KNOWN_MODELS = new Set([
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-haiku-4-5-20251001',
]);

export interface CallLog {
  model: string;
  role: 'routing' | 'deliberation' | 'adversary' | 'synthesis' | 'memory';
  system: string;
}

function classify(system: string, user: string): CallLog['role'] {
  if (system.includes('Decide which council archetypes should deliberate')) return 'routing';
  if (system.includes('synthesizing the council')) return 'synthesis';
  if (system.includes('You are HEX')) return 'adversary';
  if (user.includes('A decision has been measured against reality')) return 'memory';
  return 'deliberation';
}

function body(role: CallLog['role'], system: string, user: string): string {
  switch (role) {
    case 'routing':
      return JSON.stringify({
        primary: ['allocator', 'strategist', 'closer', 'grower'],
        consulted: ['researcher', 'oracle'],
        // Deliberately include two ids NEXUS is forbidden to route to and one
        // that does not exist, to prove the validation added for F-08 holds.
        reasoning: 'Take-rate decision: capital + conversion voices lead, research and pattern synthesis consult.',
        ...(process.env.HARNESS_BAD_ROUTING === '1'
          ? { primary: ['allocator', 'adversary', 'elder', 'chief_vibes_officer', 'closer'], consulted: [] }
          : {}),
        ...(process.env.HARNESS_BAD_ROUTING === '2'
          ? { primary: ['adversary', 'elder', 'chief_vibes_officer'], consulted: [] }
          : {}),
      });

    case 'synthesis':
      return JSON.stringify({
        title: 'Set MSTRMND v1 take rate at 10%',
        resolution:
          'Launch at 10%. Price the rate as a positioning instrument during the pre-launch window, ' +
          'and revisit only once provider supply is no longer the binding constraint.',
        reasoning:
          'Comps run 15–25%, so 10% is legibly below market and buys supply-side acquisition at a stage ' +
          'where supply, not margin, is the constraint. The revenue delta at pre-launch volume is immaterial.',
        dissent:
          'HEX: 10% is a one-way door. Raising a take rate post-launch reads as a betrayal to the earliest ' +
          'providers — the exact cohort whose goodwill the discount was meant to buy.',
        confidence: 0.71,
      });

    case 'adversary':
      return JSON.stringify({
        position:
          'The council is pricing for acquisition and ignoring that take rate is the hardest number to move upward later.',
        confidence: 0.64,
        reasoning: {
          assumptions: ['That supply is the binding constraint', 'That the rate can be revisited later'],
          evidence: ['Every marketplace that raised take rate post-launch paid for it in churn and press'],
          tradeoffs: ['5 points of margin forgone permanently, not temporarily'],
        },
      });

    case 'memory':
      return JSON.stringify({
        patterns: [
          {
            pattern:
              'When pricing a two-sided marketplace pre-launch, the council favours supply acquisition over margin, ' +
              'and reality has so far returned that the rate is not revisitable without churn.',
            confidence: 0.6,
            signal_kinds: ['pricing_decision', 'pricing_question'],
          },
        ],
      });

    default: {
      const who = /You are ([A-Z]+)/.exec(system)?.[1] ?? 'AGENT';
      return JSON.stringify({
        position: `${who}: 10% is the correct launch rate given where the constraint actually sits.`,
        confidence: 0.72,
        reasoning: {
          assumptions: [`${who} assumes pre-launch supply is the binding constraint`],
          evidence: ['Comps: intro 15%, onlyfans 20%, cameo 25%'],
          tradeoffs: ['Forgoes near-term margin for acquisition velocity'],
        },
      });
    }
  }
}

export function startFakeAnthropic(calls: CallLog[]): Promise<{ url: string; server: Server }> {
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const json = (() => { try { return JSON.parse(raw); } catch { return {}; } })();
      const model: string = json.model ?? '';
      const system: string = json.system ?? '';
      const user: string = json.messages?.[0]?.content ?? '';

      // The real API 404s an unknown model. Reproduce that exactly — it is the
      // whole mechanism behind F-01.
      if (!KNOWN_MODELS.has(model)) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({
          type: 'error',
          error: { type: 'not_found_error', message: `model: ${model}` },
        }));
        return;
      }

      const role = classify(system, user);
      calls.push({ model, role, system });

      const text = body(role, system, user);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        id: 'msg_harness',
        type: 'message',
        role: 'assistant',
        model,
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
        usage: { input_tokens: Math.ceil(raw.length / 4), output_tokens: Math.ceil(text.length / 4) },
      }));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      resolve({ url: `http://127.0.0.1:${port}`, server });
    });
  });
}
