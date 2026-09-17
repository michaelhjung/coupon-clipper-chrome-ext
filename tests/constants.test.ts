import { describe, expect, it } from "vitest";

import {
  getCouponPageUrl,
  getSignInUrl,
  getStoreByName,
  getStoreFromUrl,
  isCouponPageUrl,
  STORES,
} from "../src/shared/constants";

describe("constants", () => {
  it("loads 17 stores with a strategy each", () => {
    expect(STORES).toHaveLength(17);
    expect(
      STORES.every((s) => ["albertsons-api", "raleys-dom", "cvs-api"].includes(s.strategy))
    ).toBe(true);
  });

  it("matches store by hostname including subdomains", () => {
    expect(getStoreFromUrl("https://www.safeway.com/loyalty/coupons-deals")?.name).toBe("Safeway");
    expect(getStoreFromUrl("https://shop.vons.com/")?.name).toBe("Vons");
    expect(getStoreFromUrl("https://notsafeway.com/")).toBeUndefined();
    expect(getStoreFromUrl("garbage")).toBeUndefined();
  });

  it("recognises coupon pages for either Albertsons path, Raley's and CVS", () => {
    expect(isCouponPageUrl("https://www.safeway.com/loyalty/coupons-deals")).toBe(true);
    expect(isCouponPageUrl("https://www.cvs.com/extracare/home")).toBe(true);
    expect(isCouponPageUrl("https://www.cvs.com/")).toBe(false);
    expect(isCouponPageUrl("https://www.safeway.com/foru/coupons-deals.html?x=1")).toBe(true);
    expect(isCouponPageUrl("https://www.raleys.com/something-extra/offers-and-savings")).toBe(true);
    expect(isCouponPageUrl("https://www.safeway.com/")).toBe(false);
    expect(isCouponPageUrl("https://example.com/loyalty/coupons-deals")).toBe(false);
    // Another store's coupon path is not this store's coupon page.
    expect(isCouponPageUrl("https://www.raleys.com/loyalty/coupons-deals")).toBe(false);
    expect(isCouponPageUrl("https://www.safeway.com/something-extra/offers-and-savings")).toBe(false);
  });

  it("builds coupon and sign-in URLs", () => {
    const safeway = getStoreByName("Safeway")!;
    const raleys = getStoreByName("Raley's")!;
    expect(getCouponPageUrl(safeway)).toBe("https://www.safeway.com/loyalty/coupons-deals");
    expect(getSignInUrl(safeway)).toBe("https://www.safeway.com/account/sign-in");
    expect(getSignInUrl(raleys)).toBe("https://www.raleys.com/something-extra/offers-and-savings");
    expect(getSignInUrl(getStoreByName("CVS")!)).toBe("https://www.cvs.com/account-login/look-up");
  });
});
