export type BoardPolicyInput = {
  hasSession: boolean;
  usedToday: number;
  dailyLimit: number;
  promptChars: number;
  maxPromptChars: number;
};

export type BoardPolicyDecision =
  | { allow: true }
  | { allow: false; reason: string; status: 401 | 403 | 413 | 429 };

export const DEFAULT_DAILY_LIMIT = 200;
export const DEFAULT_MAX_PROMPT_CHARS = 48_000;

/** Pure gate for Board completions — no I/O, no vendor names. */
export function decideBoardPolicy(input: BoardPolicyInput): BoardPolicyDecision {
  if (!input.hasSession) {
    return { allow: false, reason: "Sign in to MSTRMND OS to run a live board.", status: 401 };
  }
  if (input.promptChars > input.maxPromptChars) {
    return {
      allow: false,
      reason: "That brief is too large for one turn. Shorten the question or context.",
      status: 413,
    };
  }
  if (input.usedToday >= input.dailyLimit) {
    return {
      allow: false,
      reason: "Workspace Board budget for today is spent. Try again tomorrow.",
      status: 429,
    };
  }
  return { allow: true };
}

export function dailyLimitFromEnv(): number {
  const raw = Number(process.env.BOARD_DAILY_REQUEST_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DAILY_LIMIT;
}

export function maxPromptCharsFromEnv(): number {
  const raw = Number(process.env.BOARD_MAX_PROMPT_CHARS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_PROMPT_CHARS;
}
