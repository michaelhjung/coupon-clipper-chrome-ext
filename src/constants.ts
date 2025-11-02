import { generateUUID } from "./utils/general";

export const VERSION = "1.4.5";

export const CHROME_EXT_URL =
  "https://chromewebstore.google.com/detail/coupon-clipper/dihamlfidaeahaijeogelncpkpefhded";

export const DEFAULT_STORE_ID = "3132";
export const DEFAULT_CLIENT_ID = "306b9569-2a31-4fb9-93aa-08332ba3c55d";
export const DEFAULT_CLIENT_SECRET =
  "N4tK3pW7pP6nB4kL6vN4kW0rS5lE4qH2fY0aB2rK1eP5gK4yV5";
export const DEFAULT_CORRELATION_ID = generateUUID();
export enum CouponPagePath {
  FORU = "/foru/coupons-deals.html",
  LOYALTY = "/loyalty/coupons-deals",
  SOMETHING_EXTRA = "/something-extra/offers-and-savings", // RALEY'S
}
export const ALL_COUPON_PATHS = new Set<string>(Object.values(CouponPagePath));

export const STORES = [
  {
    name: "Acme",
    url: "acmemarkets.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Albertsons",
    url: "albertsons.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Andronico's",
    url: "andronicos.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Balducci's",
    url: "balduccis.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Carrs",
    url: "carrsqc.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Haggen",
    url: "haggen.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Jewel-Osco",
    url: "jewelosco.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Kings Food Markets",
    url: "kingsfoodmarkets.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Pavilions",
    url: "pavilions.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Raley's",
    url: "raleys.com",
    couponPath: CouponPagePath.SOMETHING_EXTRA,
  },
  {
    name: "Randalls",
    url: "randalls.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Safeway",
    url: "safeway.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Shaw's",
    url: "shaws.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Star Market",
    url: "starmarket.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Tom Thumb",
    url: "tomthumb.com",
    couponPath: CouponPagePath.LOYALTY,
  },
  {
    name: "Vons",
    url: "vons.com",
    couponPath: CouponPagePath.LOYALTY,
  },
];
