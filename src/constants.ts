import { generateUUID } from "./utils/general";

export const VERSION = "1.1.0";

export const CHROME_EXT_URL =
  "https://chromewebstore.google.com/detail/coupon-clipper/dihamlfidaeahaijeogelncpkpefhded";

export const DEFAULT_STORE_ID = "3132";
export const DEFAULT_CLIENT_ID = "306b9569-2a31-4fb9-93aa-08332ba3c55d";
export const DEFAULT_CLIENT_SECRET =
  "N4tK3pW7pP6nB4kL6vN4kW0rS5lE4qH2fY0aB2rK1eP5gK4yV5";
export const DEFAULT_CORRELATION_ID = generateUUID();

export const STORES = [
  {
    storeName: "Safeway",
    url: "https://www.safeway.com/foru/coupons-deals.html",
  },
  {
    storeName: "Albertsons",
    url: "https://www.albertsons.com/foru/coupons-deals.html",
  },
  {
    storeName: "Vons",
    url: "https://www.vons.com/foru/coupons-deals.html",
  },
];
