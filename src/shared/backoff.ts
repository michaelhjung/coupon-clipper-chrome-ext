export const MAX_ATTEMPTS = 3;
export const MAX_DELAY_MS = 5000;
const RATE_LIMIT_MIN_MS = 500;
const SHRINK_AFTER = 5;
const SHRINK_FACTOR = 0.75;

export interface BackoffState {
  delayMs: number;
  floorMs: number;
  consecutiveOk: number;
  adaptive: boolean;
}

export const createBackoff = (startMs: number, adaptive: boolean): BackoffState => ({
  delayMs: startMs,
  floorMs: startMs,
  consecutiveOk: 0,
  adaptive,
});

export const onOk = (s: BackoffState): BackoffState => {
  const consecutiveOk = s.consecutiveOk + 1;
  if (!s.adaptive || consecutiveOk < SHRINK_AFTER) return { ...s, consecutiveOk };
  return {
    ...s,
    consecutiveOk: 0,
    delayMs: Math.max(s.floorMs, Math.round(s.delayMs * SHRINK_FACTOR)),
  };
};

export const onRateLimited = (s: BackoffState): BackoffState => {
  if (!s.adaptive) return { ...s, consecutiveOk: 0 };
  return {
    ...s,
    consecutiveOk: 0,
    delayMs: Math.min(MAX_DELAY_MS, Math.max(RATE_LIMIT_MIN_MS, s.delayMs * 2)),
  };
};

export const onFailed = (s: BackoffState): BackoffState => ({ ...s, consecutiveOk: 0 });
