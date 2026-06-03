import { STORES } from "../constants";

export type CouponClipTally = Record<string, number>;

export const COUPON_CLIP_TALLY_KEY = "couponClipTally";

export const getStoreNameFromUrl = (url: string) => {
  const normalizedUrl = url.toLowerCase();
  return STORES.find((store) => normalizedUrl.includes(store.url))?.name;
};

export const incrementCouponClipTally = async (
  storeName: string,
  clippedCount: number
) => {
  if (clippedCount <= 0) return;

  const currentTally = await getCouponClipTally();

  await chrome.storage.local.set({
    [COUPON_CLIP_TALLY_KEY]: {
      ...currentTally,
      [storeName]: (currentTally[storeName] || 0) + clippedCount,
    },
  });
};

export const getCouponClipTally = async (): Promise<CouponClipTally> => {
  const result = await chrome.storage.local.get(COUPON_CLIP_TALLY_KEY);
  const tally = result[COUPON_CLIP_TALLY_KEY];

  if (!tally || typeof tally !== "object" || Array.isArray(tally)) return {};

  return tally as CouponClipTally;
};
