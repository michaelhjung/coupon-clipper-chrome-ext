import { describe, expect, it } from "vitest";

import {
  createBackoff,
  MAX_ATTEMPTS,
  MAX_DELAY_MS,
  onFailed,
  onOk,
  onRateLimited,
  RATE_LIMIT_MIN_MS,
  retryDelayMs,
} from "../src/shared/backoff";

const okTimes = (s: ReturnType<typeof createBackoff>, n: number) => {
  for (let i = 0; i < n; i++) s = onOk(s);
  return s;
};

describe("backoff", () => {
  it("starts at the configured delay", () => {
    expect(createBackoff(250, true).delayMs).toBe(250);
    expect(MAX_ATTEMPTS).toBe(3);
  });

  it("doubles on rate limit with a 500ms minimum and 5000ms cap", () => {
    let s = createBackoff(250, true);
    s = onRateLimited(s);
    expect(s.delayMs).toBe(500);
    s = onRateLimited(s);
    expect(s.delayMs).toBe(1000);
    s = onRateLimited(onRateLimited(onRateLimited(s)));
    expect(s.delayMs).toBe(MAX_DELAY_MS);
  });

  it("shrinks by 25% after 5 consecutive successes but never below the floor", () => {
    let s = onRateLimited(onRateLimited(createBackoff(250, true))); // 1000
    s = okTimes(s, 4);
    expect(s.delayMs).toBe(1000);
    s = onOk(s);
    expect(s.delayMs).toBe(750);
    s = okTimes(s, 5);
    expect(s.delayMs).toBe(563);
    s = okTimes(s, 25);
    expect(s.delayMs).toBe(250);
  });

  it("a failure resets the success streak", () => {
    let s = onRateLimited(onRateLimited(createBackoff(250, true))); // 1000
    s = okTimes(s, 4);
    s = onFailed(s);
    s = onOk(s);
    expect(s.delayMs).toBe(1000);
  });

  it("waits at least the rate-limit minimum before a retry, even with adaptive off", () => {
    expect(retryDelayMs(onRateLimited(createBackoff(0, false)))).toBe(RATE_LIMIT_MIN_MS);
    expect(retryDelayMs(onRateLimited(createBackoff(2000, false)))).toBe(2000);
    expect(retryDelayMs(onRateLimited(createBackoff(250, true)))).toBe(500);
  });

  it("never changes when adaptive is off", () => {
    let s = createBackoff(400, false);
    s = onRateLimited(s);
    s = okTimes(s, 10);
    expect(s.delayMs).toBe(400);
  });
});
