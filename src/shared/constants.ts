import storesJson from "./stores.json";

import type { StoreConfig } from "./types";

export const STORES: StoreConfig[] = storesJson as StoreConfig[];

export const CHROME_EXT_URL =
  "https://chromewebstore.google.com/detail/coupon-clipper/dihamlfidaeahaijeogelncpkpefhded";
export const GITHUB_URL = "https://github.com/michaelhjung/coupon-clipper-chrome-ext";
export const KO_FI_URL = "https://ko-fi.com/michaelhjung";
export const AUTHOR_URL = "https://michaelhjung.com";

export const AUTO_CLIP_COOLDOWN_MS = 30 * 60 * 1000;

export const getStoreByName = (name: string): StoreConfig | undefined =>
  STORES.find((store) => store.name === name);

export const getStoreFromUrl = (url: string): StoreConfig | undefined => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return STORES.find(
      (store) => hostname === store.url || hostname.endsWith(`.${store.url}`)
    );
  } catch {
    return undefined;
  }
};

export const isCouponPath = (store: StoreConfig, pathname: string) =>
  [store.couponPath, ...(store.altCouponPaths ?? [])].some((p) => pathname.startsWith(p));

export const isCouponPageUrl = (url: string): boolean => {
  const store = getStoreFromUrl(url);
  if (!store) return false;
  try {
    return isCouponPath(store, new URL(url).pathname);
  } catch {
    return false;
  }
};

export const getCouponPageUrl = (store: StoreConfig) =>
  `https://www.${store.url}${store.couponPath}`;

export const getSignInUrl = (store: StoreConfig) =>
  `https://www.${store.url}${store.signInPath ?? store.couponPath}`;
