import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_DAILY_LIMIT,
  DEFAULT_MAX_PROMPT_CHARS,
  dailyLimitFromEnv,
  decideBoardPolicy,
  maxPromptCharsFromEnv,
} from "./board-policy";

describe("decideBoardPolicy", () => {
  const ok = {
    hasSession: true,
    usedToday: 0,
    dailyLimit: DEFAULT_DAILY_LIMIT,
    promptChars: 100,
    maxPromptChars: DEFAULT_MAX_PROMPT_CHARS,
  };

  it("allows a signed-in request under budget", () => {
    assert.deepEqual(decideBoardPolicy(ok), { allow: true });
  });

  it("rejects a missing session", () => {
    const decision = decideBoardPolicy({ ...ok, hasSession: false });
    assert.equal(decision.allow, false);
    if (!decision.allow) assert.equal(decision.status, 401);
  });

  it("rejects an oversized prompt", () => {
    const decision = decideBoardPolicy({
      ...ok,
      promptChars: DEFAULT_MAX_PROMPT_CHARS + 1,
    });
    assert.equal(decision.allow, false);
    if (!decision.allow) assert.equal(decision.status, 413);
  });

  it("rejects a spent daily budget", () => {
    const decision = decideBoardPolicy({ ...ok, usedToday: DEFAULT_DAILY_LIMIT });
    assert.equal(decision.allow, false);
    if (!decision.allow) assert.equal(decision.status, 429);
  });
});

describe("env helpers", () => {
  it("falls back when env is unset or invalid", () => {
    const prevLimit = process.env.BOARD_DAILY_REQUEST_LIMIT;
    const prevChars = process.env.BOARD_MAX_PROMPT_CHARS;
    delete process.env.BOARD_DAILY_REQUEST_LIMIT;
    delete process.env.BOARD_MAX_PROMPT_CHARS;
    assert.equal(dailyLimitFromEnv(), DEFAULT_DAILY_LIMIT);
    assert.equal(maxPromptCharsFromEnv(), DEFAULT_MAX_PROMPT_CHARS);
    process.env.BOARD_DAILY_REQUEST_LIMIT = "0";
    process.env.BOARD_MAX_PROMPT_CHARS = "nope";
    assert.equal(dailyLimitFromEnv(), DEFAULT_DAILY_LIMIT);
    assert.equal(maxPromptCharsFromEnv(), DEFAULT_MAX_PROMPT_CHARS);
    process.env.BOARD_DAILY_REQUEST_LIMIT = "12";
    process.env.BOARD_MAX_PROMPT_CHARS = "99";
    assert.equal(dailyLimitFromEnv(), 12);
    assert.equal(maxPromptCharsFromEnv(), 99);
    if (prevLimit === undefined) delete process.env.BOARD_DAILY_REQUEST_LIMIT;
    else process.env.BOARD_DAILY_REQUEST_LIMIT = prevLimit;
    if (prevChars === undefined) delete process.env.BOARD_MAX_PROMPT_CHARS;
    else process.env.BOARD_MAX_PROMPT_CHARS = prevChars;
  });
});
