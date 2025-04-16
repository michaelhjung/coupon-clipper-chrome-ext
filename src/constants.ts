import { generateUUID } from "./utils/general";

export const VERSION = "1.2.1";

export const CHROME_EXT_URL =
  "https://chromewebstore.google.com/detail/coupon-clipper/dihamlfidaeahaijeogelncpkpefhded";

export const DEFAULT_STORE_ID = "3132";
export const DEFAULT_CLIENT_ID = "306b9569-2a31-4fb9-93aa-08332ba3c55d";
export const DEFAULT_CLIENT_SECRET =
  "N4tK3pW7pP6nB4kL6vN4kW0rS5lE4qH2fY0aB2rK1eP5gK4yV5";
export const DEFAULT_CORRELATION_ID = generateUUID();

export const STORES = [
  {
    name: "Acme",
    url: "https://www.acmemarkets.com",
  },
  {
    name: "Albertsons",
    url: "https://www.albertsons.com",
  },
  {
    name: "Andronico's",
    url: "https://www.andronicos.com",
  },
  {
    name: "Balducci's",
    url: "https://www.balduccis.com",
  },
  {
    name: "Carrs",
    url: "https://www.carrsqc.com",
  },
  {
    name: "Haggen",
    url: "https://www.haggen.com",
  },
  {
    name: "Jewel-Osco",
    url: "https://www.jewelosco.com",
  },
  {
    name: "Kings Food Markets",
    url: "https://www.kingsfoodmarkets.com",
  },
  {
    name: "Pavilions",
    url: "https://www.pavilions.com",
  },
  {
    name: "Randalls",
    url: "https://www.randalls.com",
  },
  {
    name: "Safeway",
    url: "https://www.safeway.com",
  },
  {
    name: "Shaw's",
    url: "https://www.shaws.com",
  },
  {
    name: "Star Market",
    url: "https://www.starmarket.com",
  },
  {
    name: "Tom Thumb",
    url: "https://www.tomthumb.com",
  },
  {
    name: "Vons",
    url: "https://www.vons.com",
  },
];
