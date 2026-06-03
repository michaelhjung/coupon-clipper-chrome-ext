export const CLIP_RATE_LIMIT_DELAY_KEY = "clipRateLimitDelayMs";
export const DEFAULT_CLIP_RATE_LIMIT_DELAY_MS = 250;
export const MIN_CLIP_RATE_LIMIT_DELAY_MS = 0;
export const MAX_CLIP_RATE_LIMIT_DELAY_MS = 3000;
export const CLIP_RATE_LIMIT_DELAY_STEP_MS = 50;

export const normalizeClipRateLimitDelay = (value: unknown) => {
  const delay = Number(value);

  if (!Number.isFinite(delay)) return DEFAULT_CLIP_RATE_LIMIT_DELAY_MS;

  return Math.min(
    MAX_CLIP_RATE_LIMIT_DELAY_MS,
    Math.max(MIN_CLIP_RATE_LIMIT_DELAY_MS, Math.round(delay))
  );
};

export const getClipRateLimitDelay = async () => {
  const result = await chrome.storage.local.get(CLIP_RATE_LIMIT_DELAY_KEY);
  return normalizeClipRateLimitDelay(result[CLIP_RATE_LIMIT_DELAY_KEY]);
};

export const setClipRateLimitDelay = async (delayMs: number) => {
  await chrome.storage.local.set({
    [CLIP_RATE_LIMIT_DELAY_KEY]: normalizeClipRateLimitDelay(delayMs),
  });
};

export const resetClipRateLimitDelay = async () => {
  await setClipRateLimitDelay(DEFAULT_CLIP_RATE_LIMIT_DELAY_MS);
};
