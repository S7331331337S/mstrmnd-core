export const MAX_PLAN_TOOLS = 8;

export interface ProposedToolCall {
  tool: string;
  args: Record<string, unknown>;
}

function asArgs(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalizeCalls(raw: unknown): ProposedToolCall[] | null {
  if (!Array.isArray(raw)) return null;
  const calls: ProposedToolCall[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const tool = rec.tool ?? rec.name;
    if (typeof tool !== "string" || !tool.trim()) continue;
    calls.push({ tool: tool.trim(), args: asArgs(rec.args) });
    if (calls.length >= MAX_PLAN_TOOLS) break;
  }
  return calls;
}

function extractJsonArray(text: string): unknown | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      // continue
    }
  }

  const idx = trimmed.search(/\[\s*\{/);
  if (idx < 0) return null;
  let depth = 0;
  for (let i = idx; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(trimmed.slice(idx, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Parse a model plan into allowlist-shaped tool calls.
 * Returns null when the text is not a tool-plan (EchoProvider, prose, etc.).
 * An explicit empty array `[]` is a parsed no-op plan, not a parse failure.
 */
export function parseToolPlan(text: string): ProposedToolCall[] | null {
  const extracted = extractJsonArray(text);
  if (extracted === null) return null;
  return normalizeCalls(extracted);
}
