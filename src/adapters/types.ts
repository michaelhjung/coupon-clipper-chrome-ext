import type { ClipResult, Coupon, StoreConfig } from "../shared/types";

export interface StoreAdapter {
  readonly store: StoreConfig;
  // One-time page setup (e.g. injecting a MAIN-world helper); called once by
  // the content script, never by tests.
  init?(): void;
  isSignedIn(): Promise<boolean>;
  loadAll(): Promise<number>;
  getUnclipped(): Coupon[];
  // Fast path: fetch every unclipped coupon from the store's API without
  // touching the page. Resolves null when unavailable so callers fall back to
  // loadAll() + getUnclipped().
  fetchUnclipped?(): Promise<Coupon[] | null>;
  clip(coupon: Coupon): Promise<ClipResult>;
  markClipped(coupon: Coupon): void;
}
